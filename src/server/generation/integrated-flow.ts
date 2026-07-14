import curriculumData from "../../../data/curriculum.json";
import rulesData from "../../../data/rules.json";
import { adaptCurriculum } from "@/domain/curriculum-adapter";
import {
  activityGroupSchema,
  type Activity,
  type GenerationBatch,
} from "@/domain/generation";
import { generationModelInputSchema } from "@/domain/model-contracts";
import type { ActivityReviewItem } from "@/domain/review";
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
  type CompleteCurriculumSelection,
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
  usage: BatchTokenUsage;
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
  const artifacts = createInitialGenerationArtifacts({ curriculum, ...input });
  const { generations, runs, traceability } = await repositories();

  await generations.createBatch(artifacts.batch);
  await runs.save(artifacts.generationRun);
  await generations.createInitialActivityGroup(artifacts.group);

  for (const run of artifacts.validationRuns) {
    await runs.save(run);
  }
  for (const report of artifacts.reports) {
    await persistReport(traceability, report);
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

export async function loadReviewBatch(batchId: string): Promise<ReviewBatchData | undefined> {
  const { generations, runs, traceability } = await repositories();
  const batch = await generations.getBatch(batchId);
  if (!batch) return undefined;

  const group = await generations.getCurrentActivityGroup(batchId);
  if (!group) return undefined;
  const modelRuns = await runs.listByBatch(batchId);
  const decisionHistory: Record<string, { decision: "approved" | "rejected"; feedback?: string }[]> = {};
  const items: ActivityReviewItem[] = [];

  for (const activity of group.activities) {
    const results = await traceability.listValidationResults(activity.id, activity.version);
    const report = rebuildReport(activity, results, modelRuns);
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
    usage: await runs.aggregateBatchUsage(batchId),
  };
}

export async function approveActivity(input: {
  batchId: string;
  activityId: string;
  activityVersion: number;
  feedback?: string;
}): Promise<void> {
  const { generations, traceability } = await repositories();
  const group = await generations.getCurrentActivityGroup(input.batchId);
  const activity = group?.activities.find(({ id }) => id === input.activityId);

  if (!activity || activity.version !== input.activityVersion) {
    throw new Error("A atividade mudou desde que a revisão foi carregada.");
  }

  await traceability.saveReviewDecision({
    activityId: activity.id,
    activityVersion: activity.version,
    decision: "approved",
    ...(input.feedback?.trim() ? { feedback: input.feedback.trim() } : {}),
    author: "revisor-poc",
    createdAt: new Date().toISOString(),
  });
}

function generationContextFromRuns(runs: readonly ModelRun[]) {
  const generationRun = runs.find((run) => run.stage === "generate");
  if (!generationRun) {
    throw new Error("O lote não possui uma execução de geração rastreável.");
  }

  return generationModelInputSchema.parse(generationRun.normalizedInput);
}

export async function rejectAndRegenerateActivity(input: {
  batchId: string;
  activityId: string;
  activityVersion: number;
  feedback?: string;
}): Promise<{ item: ActivityReviewItem; usage: BatchTokenUsage }> {
  const { generations, runs, traceability } = await repositories();
  const batch = await generations.getBatch(input.batchId);
  const group = await generations.getCurrentActivityGroup(input.batchId);

  if (!batch || !group) {
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
  const currentReport = rebuildReport(currentActivity, currentResults, modelRuns);
  const generationContext = generationContextFromRuns(modelRuns);
  const artifacts = createRegenerationArtifacts({
    group: activityGroupSchema.parse(group),
    currentActivity,
    currentReport,
    curriculumContext: generationContext.curriculum,
    applicableRules: generationContext.applicableRules,
    feedback: input.feedback,
    promptVersion: batch.promptVersion,
    ruleSetVersion: batch.ruleSetVersion,
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
