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
import {
  aggregateBatchTokenUsage,
  type BatchTokenUsage,
  type ModelRun,
} from "@/domain/usage";
import {
  GenerationRepository,
  ModelRunRepository,
  TraceabilityRepository,
} from "@/db/repositories";

import { getApplicationDatabase } from "../application-database";
import {
  createInitialGenerationArtifacts,
  createPendingGenerationBatch,
  createRegenerationArtifacts,
  createReviewItem,
  resolveCurriculumContext,
  type InitialGenerationArtifacts,
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

export type ReviewPageBatchData =
  | { status: "missing" }
  | { status: "generating"; modelSelection: AiModelSelection }
  | { status: "failed" }
  | { status: "ready"; data: ReviewBatchData };

export type PersistedPlanningContext = {
  batchId: string;
  modelSelection: AiModelSelection;
  selection: CompleteCurriculumSelection;
};

export type ReviewedActivityLibraryBatch = {
  batchId: string;
  completed: boolean;
  createdAt: string;
  usage: BatchTokenUsage;
  theme: {
    id: string;
    name: string;
  };
  skill: {
    id: string;
    name: string;
  };
  objective: {
    id: string;
    name: string;
  };
  week: {
    id: string;
    number: number;
    title: string;
  };
  lesson: {
    id: string;
    number: number;
    specificObjective: string;
  };
  reviewedActivities: Array<{
    activity: Activity;
    decision: ReviewDecision;
  }>;
  totalActivities: number;
};

export type GenerationRequestInput = {
  selection: CompleteCurriculumSelection;
  config: GenerationConfig;
};

export type PersistedGenerationRequest = GenerationRequestInput & {
  batchId: string;
  createdAt: string;
};

async function repositories() {
  const { db } = await getApplicationDatabase();
  return {
    generations: new GenerationRepository(db),
    runs: new ModelRunRepository(db),
    traceability: new TraceabilityRepository(db),
  };
}

async function persistReports(
  traceability: TraceabilityRepository,
  reports: readonly ValidationReport[],
): Promise<void> {
  await traceability.saveValidations(reports.flatMap(({ results }) => results).map((result) => ({
    result,
    application: {
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
    },
  })));
}

export async function createPersistedGenerationRequest(
  input: GenerationRequestInput,
): Promise<PersistedGenerationRequest> {
  const batch = createPendingGenerationBatch({ curriculum, ...input });
  const { generations } = await repositories();
  await generations.createBatch(batch);

  return {
    ...input,
    batchId: batch.id,
    createdAt: batch.createdAt,
  };
}

export async function generateArtifactsForPersistedBatch(
  input: PersistedGenerationRequest,
): Promise<InitialGenerationArtifacts> {
  const { generations } = await repositories();
  const batch = await generations.getBatch(input.batchId);

  if (!batch) {
    throw new Error("O lote pendente não foi encontrado.");
  }
  if (batch.status === "ready_for_review" || batch.status === "completed") {
    throw new Error("O lote já foi gerado.");
  }

  try {
    await generations.updateBatchStatus(batch.id, "generating");
    return await createInitialGenerationArtifacts(
      { curriculum, selection: input.selection, config: input.config },
      { batchId: input.batchId, createdAt: input.createdAt },
    );
  } catch (error) {
    await generations.updateBatchStatus(batch.id, "failed").catch(() => undefined);
    throw error;
  }
}

export async function persistInitialGenerationArtifacts(
  artifacts: InitialGenerationArtifacts,
): Promise<string> {
  const { generations, runs, traceability } = await repositories();
  let batch = await generations.getBatch(artifacts.batch.id);

  if (batch?.status === "ready_for_review" || batch?.status === "completed") {
    return artifacts.batch.id;
  }

  const existingRuns = batch ? await runs.listByBatch(batch.id) : [];
  if (batch && (batch.status === "failed" || existingRuns.length > 0)) {
    await generations.deleteBatch(batch.id);
    batch = undefined;
  }
  if (!batch) {
    await generations.createBatch({ ...artifacts.batch, status: "generating" });
  }

  try {
    await runs.save(artifacts.generationRun);
    await generations.createInitialActivityGroup(artifacts.group);

    await runs.saveMany(artifacts.validationRuns);
    await persistReports(traceability, artifacts.reports);

    await generations.updateBatchStatus(artifacts.batch.id, "ready_for_review");
  } catch (error) {
    await generations.updateBatchStatus(artifacts.batch.id, "failed").catch(() => undefined);
    throw error;
  }

  return artifacts.batch.id;
}

export async function generateAndPersistBatch(
  input: GenerationRequestInput,
): Promise<string> {
  const persistedInput = await createPersistedGenerationRequest(input);
  const artifacts = await generateArtifactsForPersistedBatch(persistedInput);
  return persistInitialGenerationArtifacts(artifacts);
}

export async function markGenerationBatchFailed(batchId: string): Promise<void> {
  const { generations } = await repositories();
  const batch = await generations.getBatch(batchId);

  if (batch && batch.status !== "ready_for_review" && batch.status !== "completed") {
    await generations.updateBatchStatus(batch.id, "failed");
  }
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

async function rebuildReviewBatch(
  batch: GenerationBatch,
  generations: GenerationRepository,
  runs: ModelRunRepository,
  traceability: TraceabilityRepository,
): Promise<ReviewBatchData | undefined> {
  const [[group], modelRuns] = await Promise.all([
    generations.listCurrentActivityGroups([batch]),
    runs.listByBatch(batch.id),
  ]);
  if (!group) return undefined;
  const activityIds = group.activities.map(({ id }) => id);
  const [validationResults, reviewDecisions] = await Promise.all([
    traceability.listValidationResultsByActivities(activityIds),
    traceability.listReviewDecisionsByActivities(activityIds),
  ]);
  const resultsByActivity = groupBy(validationResults, ({ activityId }) => activityId);
  const decisionsByActivity = groupBy(reviewDecisions, ({ activityId }) => activityId);
  const decisionHistory: Record<string, { decision: "approved" | "rejected"; feedback?: string }[]> = {};
  const items: ActivityReviewItem[] = [];

  for (const activity of group.activities) {
    const results = (resultsByActivity.get(activity.id) ?? []).filter(
      ({ activityVersion }) => activityVersion === activity.version,
    );
    const report = requirePersistedValidationReport(activity, results, modelRuns);
    const decisions = decisionsByActivity.get(activity.id) ?? [];
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
    usage: aggregateBatchTokenUsage(batch.id, modelRuns),
  };
}

export async function loadReviewBatch(batchId: string): Promise<ReviewBatchData | undefined> {
  const { generations, runs, traceability } = await repositories();
  const batch = await generations.getBatch(batchId);
  if (
    !batch ||
    (batch.status !== "ready_for_review" && batch.status !== "completed")
  ) return undefined;

  return rebuildReviewBatch(batch, generations, runs, traceability);
}

export async function loadReviewPageBatch(batchId: string): Promise<ReviewPageBatchData> {
  const { generations, runs, traceability } = await repositories();
  const batch = await generations.getBatch(batchId);

  if (!batch) return { status: "missing" };
  if (batch.status === "pending" || batch.status === "generating") {
    return {
      status: "generating",
      modelSelection: modelSelectionFromBatch(batch),
    };
  }
  if (batch.status === "failed") return { status: "failed" };

  const data = await rebuildReviewBatch(batch, generations, runs, traceability);
  return data ? { status: "ready", data } : { status: "missing" };
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
  const { generations, runs, traceability } = await repositories();
  const batches = (await generations.listBatches()).filter(
    ({ status }) => status === "ready_for_review" || status === "completed",
  );
  if (batches.length === 0) return [];

  const [groups, modelRuns] = await Promise.all([
    generations.listCurrentActivityGroups(batches),
    runs.listByBatches(batches.map(({ id }) => id)),
  ]);
  const groupsByBatch = new Map(groups.map((group) => [group.batchId, group]));
  const runsByBatch = groupBy(modelRuns, ({ batchId }) => batchId);
  const activities = groups.flatMap(({ activities: batchActivities }) => batchActivities);
  const reviewDecisions = await traceability.listReviewDecisionsByActivities(
    activities.map(({ id }) => id),
  );
  const decisionsByActivity = groupBy(reviewDecisions, ({ activityId }) => activityId);
  const library: ReviewedActivityLibraryBatch[] = [];

  for (const batch of batches) {
    const group = groupsByBatch.get(batch.id);
    const selection = completeCurriculumSelectionSchema.safeParse(
      batch.normalizedParameters.selection,
    );
    if (!group || !selection.success) continue;

    const theme = curriculum.themes.find(({ id }) => id === selection.data.themeId);
    const skill = theme?.skills.find(({ id }) => id === selection.data.skillId);
    const objective = skill?.objectives.find(({ id }) => id === selection.data.objectiveId);
    const week = objective?.weeks.find(({ id }) => id === selection.data.weekId);
    const lesson = week?.lessons.find(({ id }) => id === selection.data.lessonId);
    if (!theme || !skill || !objective || !week || !lesson) continue;

    const reviewedActivities: ReviewedActivityLibraryBatch["reviewedActivities"] = [];
    for (const activity of group.activities) {
      const decision = decisionsByActivity.get(activity.id)?.at(-1);
      if (decision) reviewedActivities.push({ activity, decision });
    }

    const batchRuns = runsByBatch.get(batch.id) ?? [];

    library.push({
      batchId: batch.id,
      completed:
        batch.status === "completed" ||
        (group.activities.length > 0 &&
          group.activities.every(({ status }) => isFinalReviewStatus(status))),
      createdAt: batch.createdAt,
      usage: aggregateBatchTokenUsage(batch.id, batchRuns),
      theme: {
        id: theme.id,
        name: theme.name,
      },
      skill: {
        id: skill.id,
        name: skill.name,
      },
      objective: {
        id: objective.id,
        name: objective.name,
      },
      week: {
        id: week.id,
        number: week.number,
        title: week.title,
      },
      lesson: {
        id: lesson.id,
        number: lesson.number,
        specificObjective: lesson.specificObjective,
      },
      reviewedActivities,
      totalActivities: group.activities.length,
    });
  }

  return library;
}

function groupBy<T, K>(
  values: readonly T[],
  keyFor: (value: T) => K,
): Map<K, T[]> {
  const grouped = new Map<K, T[]>();
  for (const value of values) {
    const key = keyFor(value);
    const group = grouped.get(key) ?? [];
    group.push(value);
    grouped.set(key, group);
  }
  return grouped;
}

export async function deletePersistedBatch(batchId: string): Promise<void> {
  const { generations } = await repositories();
  await generations.deleteBatch(batchId);
}

export async function approveActivity(input: {
  batchId: string;
  activityId: string;
  activityVersion: number;
  feedback?: string;
}): Promise<void> {
  const { generations, runs, traceability } = await repositories();
  const batch = await generations.getBatch(input.batchId);
  if (
    !batch ||
    (batch.status !== "ready_for_review" && batch.status !== "completed")
  ) {
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
  const previousDecisions = await traceability.listReviewDecisions(activity.id);

  await traceability.saveReviewDecision({
    activityId: activity.id,
    activityVersion: activity.version,
    decision: "approved",
    ...(input.feedback?.trim() ? { feedback: input.feedback.trim() } : {}),
    author: "revisor-poc",
    createdAt: nextReviewDecisionCreatedAt(previousDecisions),
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
  if (
    !batch ||
    (batch.status !== "ready_for_review" && batch.status !== "completed")
  ) {
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
  const previousDecisions = await traceability.listReviewDecisions(activity.id);

  await traceability.saveReviewDecision({
    activityId: activity.id,
    activityVersion: activity.version,
    decision: "rejected",
    ...(input.feedback?.trim() ? { feedback: input.feedback.trim() } : {}),
    author: "revisor-poc",
    createdAt: nextReviewDecisionCreatedAt(previousDecisions),
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

function nextReviewDecisionCreatedAt(
  decisions: readonly { createdAt: string }[],
): string {
  const latestTimestamp = decisions.reduce(
    (latest, decision) => Math.max(latest, Date.parse(decision.createdAt)),
    Number.NEGATIVE_INFINITY,
  );
  return new Date(Math.max(Date.now(), latestTimestamp + 1)).toISOString();
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

  if (
    !batch ||
    (batch.status !== "ready_for_review" && batch.status !== "completed") ||
    !group
  ) {
    throw new Error("O lote de revisão não foi encontrado.");
  }

  const currentActivity = group.activities.find(({ id }) => id === input.activityId);
  if (!currentActivity || currentActivity.version !== input.activityVersion) {
    throw new Error("A atividade mudou desde que a revisão foi carregada.");
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
  const previousDecisions = await traceability.listReviewDecisions(currentActivity.id);

  await runs.save(artifacts.repairRun);
  await traceability.saveReviewDecision({
    activityId: currentActivity.id,
    activityVersion: currentActivity.version,
    decision: "rejected",
    ...(input.feedback?.trim() ? { feedback: input.feedback.trim() } : {}),
    author: "revisor-poc",
    createdAt: nextReviewDecisionCreatedAt(previousDecisions),
  });
  await generations.regenerateActivity(artifacts.replacement);
  await runs.save(artifacts.validationRun);
  await persistReports(traceability, [artifacts.report]);
  if (batch.status === "completed") {
    await generations.updateBatchStatus(batch.id, "ready_for_review");
  }

  return {
    item: createReviewItem(artifacts.replacement, artifacts.report),
    usage: await runs.aggregateBatchUsage(batch.id),
  };
}
