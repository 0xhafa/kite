import curriculumData from "../../../data/curriculum.json";
import rulesData from "../../../data/rules.json";
import { adaptCurriculum } from "@/domain/curriculum-adapter";
import {
  aiModelSelectionSchema,
  type AiModelSelection,
} from "@/domain/ai-models";
import {
  completeCurriculumSelectionSchema,
  type CompleteCurriculumSelection,
} from "@/domain/curriculum-navigation";
import {
  activityGroupSchema,
  type Activity,
  type GenerationBatch,
} from "@/domain/generation";
import { generationModelInputSchema } from "@/domain/model-contracts";
import type { ActivityReviewItem, ReviewDecision } from "@/domain/review";
import type { ReviewSessionDecisionHistory } from "@/domain/review-session";
import {
  validationReportSchema,
  type ValidationReport,
  type ValidationResult,
} from "@/domain/rules";
import { loadRuleCatalog } from "@/domain/rules-catalog";
import type { BatchTokenUsage, ModelRun } from "@/domain/usage";
import {
  GenerationRepository,
  ModelRunRepository,
  TraceabilityRepository,
} from "@/db/repositories";

import { getApplicationDatabase } from "../application-database";
import {
  createInitialGenerationArtifacts,
  createRegenerationArtifacts,
  createReviewItem,
  resolveCurriculumContext,
} from "./pipeline";
import type { GenerationConfig } from "@/domain/generation-config";

const curriculum = adaptCurriculum(curriculumData);
const catalog = loadRuleCatalog(rulesData);
const rulesByKey = new Map(
  catalog.rules.map((rule) => [`${rule.id}:${rule.version}`, rule]),
);

export type ReviewBatchData = {
  batch: GenerationBatch;
  items: ActivityReviewItem[];
  decisionHistory: ReviewSessionDecisionHistory;
  modelSelection: AiModelSelection;
  usage: BatchTokenUsage;
};

export type PersistedPlanningContext = {
  batchId: string;
  modelSelection: AiModelSelection;
  selection: CompleteCurriculumSelection;
};

export type ReviewedActivityLibraryBatch = {
  batchId: string;
  completed: boolean;
  createdAt: string;
  lesson: {
    number: number;
    specificObjective: string;
    weekTitle: string;
  };
  reviewedActivities: Array<{
    activity: Activity;
    decision: ReviewDecision;
  }>;
  totalActivities: number;
};

async function repositories() {
  const { db } = await getApplicationDatabase();
  return {
    generations: new GenerationRepository(db),
    runs: new ModelRunRepository(db),
    traceability: new TraceabilityRepository(db),
  };
}

async function persistReport(
  traceability: TraceabilityRepository,
  report: ValidationReport,
): Promise<void> {
  for (const result of report.results) {
    await traceability.saveValidation(result, {
      activityId: result.activityId,
      activityVersion: result.activityVersion,
      ruleId: result.ruleId,
      ruleVersion: result.ruleVersion,
      applicability: result.applicability,
      applicabilityReason:
        result.applicability === "applicable"
          ? "Regra selecionada pelo validador determinístico para este lote."
          : "Regra registrada como não aplicável pelo validador determinístico.",
      validationResultId: result.id,
    });
  }
}

export async function generateAndPersistBatch(input: {
  selection: CompleteCurriculumSelection;
  config: GenerationConfig;
}): Promise<string> {
  const artifacts = await createInitialGenerationArtifacts({ curriculum, ...input });
  const { generations, runs, traceability } = await repositories();

  await generations.createBatch({ ...artifacts.batch, status: "generating" });

  try {
    await runs.save(artifacts.generationRun);
    await generations.createInitialActivityGroup(artifacts.group);

    for (const run of artifacts.validationRuns) {
      await runs.save(run);
    }
    for (const report of artifacts.reports) {
      await persistReport(traceability, report);
    }

    await generations.updateBatchStatus(artifacts.batch.id, "ready_for_review");
  } catch (error) {
    await generations.updateBatchStatus(artifacts.batch.id, "failed").catch(() => undefined);
    throw error;
  }

  return artifacts.batch.id;
}

function reportCreatedAt(activity: Activity, runs: readonly ModelRun[]): string {
  return [...runs]
    .reverse()
    .find((run) => run.stage === "validate" && run.activityId === activity.id)?.createdAt
    ?? new Date().toISOString();
}

function rebuildReport(
  activity: Activity,
  results: ValidationResult[],
  runs: readonly ModelRun[],
): ValidationReport {
  return validationReportSchema.parse({
    activityId: activity.id,
    activityVersion: activity.version,
    results,
    summary: {
      blockingFailures: results.filter((result) => {
        const rule = rulesByKey.get(`${result.ruleId}:${result.ruleVersion}`);
        return result.status === "failed" && rule?.severity === "blocking";
      }).length,
      needsHumanReview: results.filter(
        (result) => result.status === "needs_review" || result.status === "not_evaluated",
      ).length,
    },
    createdAt: reportCreatedAt(activity, runs),
  });
}

function requirePersistedValidationReport(
  activity: Activity,
  results: ValidationResult[],
  runs: readonly ModelRun[],
): ValidationReport {
  const validationRun = [...runs]
    .reverse()
    .find((run) => run.stage === "validate" && run.activityId === activity.id);

  if (
    !validationRun ||
    validationRun.status !== "completed" ||
    validationRun.validatedResponse === undefined
  ) {
    throw new Error("A atividade ainda não possui uma validação concluída. Tente novamente.");
  }

  const validatedReport = validationReportSchema.parse(validationRun.validatedResponse);
  const expectedResultIds = new Set(validatedReport.results.map(({ id }) => id));
  const hasCompletePersistedReport =
    validatedReport.activityId === activity.id &&
    validatedReport.activityVersion === activity.version &&
    expectedResultIds.size > 0 &&
    expectedResultIds.size === results.length &&
    results.every(({ id }) => expectedResultIds.has(id));

  if (!hasCompletePersistedReport) {
    throw new Error("A validação da atividade não foi persistida por completo. Tente novamente.");
  }

  return rebuildReport(activity, results, runs);
}

export async function loadReviewBatch(batchId: string): Promise<ReviewBatchData | undefined> {
  const { generations, runs, traceability } = await repositories();
  const batch = await generations.getBatch(batchId);
  if (
    !batch ||
    (batch.status !== "ready_for_review" && batch.status !== "completed")
  ) return undefined;

  const group = await generations.getCurrentActivityGroup(batchId);
  if (!group) return undefined;
  const modelRuns = await runs.listByBatch(batchId);
  const decisionHistory: Record<string, { decision: "approved" | "rejected"; feedback?: string }[]> = {};
  const items: ActivityReviewItem[] = [];

  for (const activity of group.activities) {
    const results = await traceability.listValidationResults(activity.id, activity.version);
    const report = requirePersistedValidationReport(activity, results, modelRuns);
    const decisions = await traceability.listReviewDecisions(activity.id);
    decisionHistory[activity.id] = decisions.map(({ decision, feedback }) => ({
      decision,
      ...(feedback ? { feedback } : {}),
    }));
    items.push(createReviewItem(activity, report));
  }

  return {
    batch,
    items,
    decisionHistory,
    modelSelection: modelSelectionFromRuns(modelRuns, batch),
    usage: await runs.aggregateBatchUsage(batchId),
  };
}

export async function loadPersistedPlanningContext(
  batchId: string,
): Promise<PersistedPlanningContext | undefined> {
  const { generations, runs } = await repositories();
  const batch = await generations.getBatch(batchId);
  if (
    !batch ||
    (batch.status !== "ready_for_review" && batch.status !== "completed")
  ) return undefined;

  const selection = completeCurriculumSelectionSchema.safeParse(
    batch.normalizedParameters.selection,
  );
  if (!selection.success) return undefined;

  try {
    resolveCurriculumContext(curriculum, selection.data);
  } catch {
    return undefined;
  }

  return {
    batchId: batch.id,
    modelSelection: modelSelectionFromRuns(await runs.listByBatch(batch.id), batch),
    selection: selection.data,
  };
}

export async function loadReviewedActivityLibrary(): Promise<ReviewedActivityLibraryBatch[]> {
  const { generations, traceability } = await repositories();
  const batches = (await generations.listBatches()).filter(
    ({ status }) => status === "ready_for_review" || status === "completed",
  );
  const library: ReviewedActivityLibraryBatch[] = [];

  for (const batch of batches) {
    const group = await generations.getCurrentActivityGroup(batch.id);
    const selection = completeCurriculumSelectionSchema.safeParse(
      batch.normalizedParameters.selection,
    );
    if (!group || !selection.success) continue;

    const theme = curriculum.themes.find(({ id }) => id === selection.data.themeId);
    const skill = theme?.skills.find(({ id }) => id === selection.data.skillId);
    const objective = skill?.objectives.find(({ id }) => id === selection.data.objectiveId);
    const week = objective?.weeks.find(({ id }) => id === selection.data.weekId);
    const lesson = week?.lessons.find(({ id }) => id === selection.data.lessonId);
    if (!week || !lesson) continue;

    const reviewedActivities: ReviewedActivityLibraryBatch["reviewedActivities"] = [];
    for (const activity of group.activities) {
      const decision = (await traceability.listReviewDecisions(activity.id)).at(-1);
      if (decision) reviewedActivities.push({ activity, decision });
    }

    library.push({
      batchId: batch.id,
      completed:
        batch.status === "completed" ||
        (group.activities.length > 0 &&
          group.activities.every(({ status }) => isFinalReviewStatus(status))),
      createdAt: batch.createdAt,
      lesson: {
        number: lesson.number,
        specificObjective: lesson.specificObjective,
        weekTitle: week.title,
      },
      reviewedActivities,
      totalActivities: group.activities.length,
    });
  }

  return library;
}

export async function approveActivity(input: {
  batchId: string;
  activityId: string;
  activityVersion: number;
  feedback?: string;
}): Promise<void> {
  const { generations, runs, traceability } = await repositories();
  const batch = await generations.getBatch(input.batchId);
  if (!batch || batch.status !== "ready_for_review") {
    throw new Error("O lote não está disponível para novas decisões de revisão.");
  }
  const group = await generations.getCurrentActivityGroup(input.batchId);
  const activity = group?.activities.find(({ id }) => id === input.activityId);

  if (!activity || activity.version !== input.activityVersion) {
    throw new Error("A atividade mudou desde que a revisão foi carregada.");
  }

  requirePersistedValidationReport(
    activity,
    await traceability.listValidationResults(activity.id, activity.version),
    await runs.listByBatch(input.batchId),
  );

  await traceability.saveReviewDecision({
    activityId: activity.id,
    activityVersion: activity.version,
    decision: "approved",
    ...(input.feedback?.trim() ? { feedback: input.feedback.trim() } : {}),
    author: "revisor-poc",
    createdAt: new Date().toISOString(),
  });

  await completeBatchIfReviewed(generations, input.batchId);
}

export async function rejectActivity(input: {
  batchId: string;
  activityId: string;
  activityVersion: number;
  feedback?: string;
}): Promise<void> {
  const { generations, runs, traceability } = await repositories();
  const batch = await generations.getBatch(input.batchId);
  if (!batch || batch.status !== "ready_for_review") {
    throw new Error("O lote não está disponível para novas decisões de revisão.");
  }
  const group = await generations.getCurrentActivityGroup(input.batchId);
  const activity = group?.activities.find(({ id }) => id === input.activityId);

  if (!activity || activity.version !== input.activityVersion) {
    throw new Error("A atividade mudou desde que a revisão foi carregada.");
  }

  requirePersistedValidationReport(
    activity,
    await traceability.listValidationResults(activity.id, activity.version),
    await runs.listByBatch(input.batchId),
  );

  await traceability.saveReviewDecision({
    activityId: activity.id,
    activityVersion: activity.version,
    decision: "rejected",
    ...(input.feedback?.trim() ? { feedback: input.feedback.trim() } : {}),
    author: "revisor-poc",
    createdAt: new Date().toISOString(),
  });

  await completeBatchIfReviewed(generations, input.batchId);
}

function generationContextFromRuns(runs: readonly ModelRun[]) {
  const generationRun = runs.find((run) => run.stage === "generate");
  if (!generationRun) {
    throw new Error("O lote não possui uma execução de geração rastreável.");
  }

  return generationModelInputSchema.parse(generationRun.normalizedInput);
}

function modelSelectionFromBatch(batch: GenerationBatch) {
  return aiModelSelectionSchema.parse({
    model: batch.normalizedParameters.model,
    ...(batch.normalizedParameters.reasoningEffort
      ? { reasoningEffort: batch.normalizedParameters.reasoningEffort }
      : {}),
  });
}

function modelSelectionFromRuns(
  runs: readonly ModelRun[],
  batch: GenerationBatch,
): AiModelSelection {
  for (const run of [...runs].reverse()) {
    if (run.stage !== "generate" && run.stage !== "repair") continue;

    const selection = aiModelSelectionSchema.safeParse({
      model: run.model,
      ...(run.reasoningEffort ? { reasoningEffort: run.reasoningEffort } : {}),
    });

    if (selection.success) return selection.data;
  }

  return modelSelectionFromBatch(batch);
}

function isFinalReviewStatus(status: Activity["status"]): boolean {
  return status === "approved" || status === "rejected";
}

async function completeBatchIfReviewed(
  generations: GenerationRepository,
  batchId: string,
): Promise<void> {
  const reviewedGroup = await generations.getCurrentActivityGroup(batchId);
  if (
    reviewedGroup &&
    reviewedGroup.activities.length > 0 &&
    reviewedGroup.activities.every(({ status }) => isFinalReviewStatus(status))
  ) {
    await generations.updateBatchStatus(batchId, "completed");
  }
}

export async function rejectAndRegenerateActivity(input: {
  batchId: string;
  activityId: string;
  activityVersion: number;
  feedback?: string;
  modelSelection?: AiModelSelection;
}): Promise<{ item: ActivityReviewItem; usage: BatchTokenUsage }> {
  const { generations, runs, traceability } = await repositories();
  const batch = await generations.getBatch(input.batchId);
  const group = await generations.getCurrentActivityGroup(input.batchId);

  if (!batch || batch.status !== "ready_for_review" || !group) {
    throw new Error("O lote de revisão não foi encontrado.");
  }

  const currentActivity = group.activities.find(({ id }) => id === input.activityId);
  if (!currentActivity || currentActivity.version !== input.activityVersion) {
    throw new Error("A atividade mudou desde que a revisão foi carregada.");
  }
  if (currentActivity.status === "approved") {
    throw new Error("Uma atividade aprovada não pode ser regenerada.");
  }

  const modelRuns = await runs.listByBatch(batch.id);
  const currentResults = await traceability.listValidationResults(
    currentActivity.id,
    currentActivity.version,
  );
  const currentReport = requirePersistedValidationReport(
    currentActivity,
    currentResults,
    modelRuns,
  );
  const generationContext = generationContextFromRuns(modelRuns);
  const artifacts = await createRegenerationArtifacts({
    group: activityGroupSchema.parse(group),
    currentActivity,
    currentReport,
    curriculumContext: generationContext.curriculum,
    applicableRules: generationContext.applicableRules,
    feedback: input.feedback,
    promptVersion: batch.promptVersion,
    ruleSetVersion: batch.ruleSetVersion,
    modelSelection: input.modelSelection
      ? aiModelSelectionSchema.parse(input.modelSelection)
      : modelSelectionFromBatch(batch),
  });

  await runs.save(artifacts.repairRun);
  await traceability.saveReviewDecision({
    activityId: currentActivity.id,
    activityVersion: currentActivity.version,
    decision: "rejected",
    ...(input.feedback?.trim() ? { feedback: input.feedback.trim() } : {}),
    author: "revisor-poc",
    createdAt: new Date().toISOString(),
  });
  await generations.regenerateActivity(artifacts.replacement);
  await runs.save(artifacts.validationRun);
  await persistReport(traceability, artifacts.report);

  return {
    item: createReviewItem(artifacts.replacement, artifacts.report),
    usage: await runs.aggregateBatchUsage(batch.id),
  };
}
