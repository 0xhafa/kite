import { and, asc, desc, eq, inArray, ne } from "drizzle-orm";

import {
  type Activity,
  type ActivityGroup,
  type GenerationBatch,
  type GenerationBatchStatus,
  activityGroupSchema,
  activitySchema,
  applyActivityRegeneration,
  generationBatchSchema,
  generationBatchStatusSchema,
} from "../../domain/generation";

import type { KiteDatabase } from "../client";
import {
  activities,
  activityRuleApplications,
  feedbackProposals,
  generationBatches,
  generationCacheEntries,
  modelRuns,
  reviewDecisions,
  validationResults,
} from "../schema";
import { omitNullValues } from "./mappers";

function toBatch(row: typeof generationBatches.$inferSelect): GenerationBatch {
  return generationBatchSchema.parse(omitNullValues(row));
}

function toActivity(row: typeof activities.$inferSelect): Activity {
  return activitySchema.parse(omitNullValues(row));
}

export class GenerationRepository {
  constructor(private readonly db: KiteDatabase) {}

  async createBatch(input: unknown): Promise<GenerationBatch> {
    const batch = generationBatchSchema.parse(input);
    await this.db.insert(generationBatches).values(batch);
    return batch;
  }

  async getBatch(id: string): Promise<GenerationBatch | undefined> {
    const [row] = await this.db
      .select()
      .from(generationBatches)
      .where(eq(generationBatches.id, id))
      .limit(1);

    return row ? toBatch(row) : undefined;
  }

  async listBatches(): Promise<GenerationBatch[]> {
    const rows = await this.db
      .select()
      .from(generationBatches)
      .orderBy(desc(generationBatches.createdAt));

    return rows.map(toBatch);
  }

  async updateBatchStatus(
    id: string,
    input: GenerationBatchStatus,
  ): Promise<void> {
    const status = generationBatchStatusSchema.parse(input);
    const result = await this.db
      .update(generationBatches)
      .set({ status })
      .where(eq(generationBatches.id, id));

    if (result.rowsAffected !== 1) {
      throw new Error(`Lote ${id} não encontrado.`);
    }
  }

  async deleteBatch(id: string): Promise<void> {
    await this.db.transaction(async (transaction) => {
      const [batch] = await transaction
        .select({ id: generationBatches.id })
        .from(generationBatches)
        .where(eq(generationBatches.id, id))
        .limit(1);

      if (!batch) {
        throw new Error(`Lote ${id} não encontrado.`);
      }

      const activityRows = await transaction
        .select({ id: activities.id })
        .from(activities)
        .where(eq(activities.batchId, id));
      const activityIds = activityRows.map(({ id: activityId }) => activityId);
      const runRows = await transaction
        .select({ id: modelRuns.id })
        .from(modelRuns)
        .where(eq(modelRuns.batchId, id));
      const runIds = runRows.map(({ id: runId }) => runId);

      await transaction
        .update(generationBatches)
        .set({ cachedFromBatchId: null })
        .where(eq(generationBatches.cachedFromBatchId, id));

      if (runIds.length > 0) {
        await transaction
          .delete(generationCacheEntries)
          .where(inArray(generationCacheEntries.modelRunId, runIds));
        await transaction
          .update(modelRuns)
          .set({ reusedFromModelRunId: null })
          .where(inArray(modelRuns.reusedFromModelRunId, runIds));
      }

      if (activityIds.length > 0) {
        await transaction
          .delete(feedbackProposals)
          .where(inArray(feedbackProposals.reviewActivityId, activityIds));
        await transaction
          .delete(reviewDecisions)
          .where(inArray(reviewDecisions.activityId, activityIds));
        await transaction
          .delete(activityRuleApplications)
          .where(inArray(activityRuleApplications.activityId, activityIds));
        await transaction
          .delete(validationResults)
          .where(inArray(validationResults.activityId, activityIds));
        await transaction
          .update(activities)
          .set({ replacesActivityId: null })
          .where(inArray(activities.replacesActivityId, activityIds));
        await transaction.delete(activities).where(eq(activities.batchId, id));
      }

      await transaction.delete(modelRuns).where(eq(modelRuns.batchId, id));
      const result = await transaction
        .delete(generationBatches)
        .where(eq(generationBatches.id, id));

      if (result.rowsAffected !== 1) {
        throw new Error(`Lote ${id} não encontrado.`);
      }
    });
  }

  async createInitialActivityGroup(input: unknown): Promise<ActivityGroup> {
    const group = activityGroupSchema.parse(input);
    const batch = await this.getBatch(group.batchId);

    if (!batch) {
      throw new Error(`Lote ${group.batchId} não encontrado.`);
    }
    if (
      batch.requestedDurationMinutes !== group.requestedDurationMinutes ||
      batch.requestedActivityCount !== group.requestedActivityCount
    ) {
      throw new Error("O grupo inicial deve respeitar duração e quantidade solicitadas pelo lote.");
    }
    if (group.activities.some((activity) => activity.version !== 1 || activity.replacesActivityId)) {
      throw new Error("O grupo inicial só pode conter primeiras versões.");
    }

    await this.db.transaction(async (transaction) => {
      const generationRunIds = [
        ...new Set(group.activities.map(({ generationRunId }) => generationRunId)),
      ];
      const runRows = await transaction
        .select({ id: modelRuns.id, batchId: modelRuns.batchId, status: modelRuns.status })
        .from(modelRuns)
        .where(inArray(modelRuns.id, generationRunIds));
      const runsById = new Map(runRows.map((run) => [run.id, run]));

      for (const activity of group.activities) {
        const run = runsById.get(activity.generationRunId);
        if (!run || run.batchId !== group.batchId || run.status !== "completed") {
          throw new Error(`Execução ${activity.generationRunId} não é válida para o lote.`);
        }
      }

      await transaction.insert(activities).values(group.activities);
    });

    return group;
  }

  async getCurrentActivityGroup(batchId: string): Promise<ActivityGroup | undefined> {
    const batch = await this.getBatch(batchId);
    if (!batch) return undefined;

    return (await this.listCurrentActivityGroups([batch]))[0];
  }

  async listCurrentActivityGroups(
    batches: readonly GenerationBatch[],
  ): Promise<ActivityGroup[]> {
    if (batches.length === 0) return [];

    const rows = await this.db
      .select()
      .from(activities)
      .where(
        and(
          inArray(activities.batchId, batches.map(({ id }) => id)),
          ne(activities.status, "superseded"),
        ),
      )
      .orderBy(asc(activities.batchId), asc(activities.slotIndex));
    const activitiesByBatch = new Map<string, Activity[]>();
    for (const activity of rows.map(toActivity)) {
      const batchActivities = activitiesByBatch.get(activity.batchId) ?? [];
      batchActivities.push(activity);
      activitiesByBatch.set(activity.batchId, batchActivities);
    }

    return batches.map((batch) => activityGroupSchema.parse({
      batchId: batch.id,
      requestedDurationMinutes: batch.requestedDurationMinutes,
      requestedActivityCount: batch.requestedActivityCount,
      activities: activitiesByBatch.get(batch.id) ?? [],
    }));
  }

  async listActivityVersions(logicalActivityId: string): Promise<Activity[]> {
    const rows = await this.db
      .select()
      .from(activities)
      .where(eq(activities.logicalActivityId, logicalActivityId))
      .orderBy(asc(activities.version));

    return rows.map(toActivity);
  }

  async regenerateActivity(input: unknown): Promise<Activity> {
    const replacement = activitySchema.parse(input);

    return this.db.transaction(async (transaction) => {
      const [batchRow] = await transaction
        .select()
        .from(generationBatches)
        .where(eq(generationBatches.id, replacement.batchId))
        .limit(1);
      if (!batchRow) throw new Error(`Lote ${replacement.batchId} não encontrado.`);

      const currentRows = await transaction
        .select()
        .from(activities)
        .where(
          and(
            eq(activities.batchId, replacement.batchId),
            ne(activities.status, "superseded"),
          ),
        )
        .orderBy(asc(activities.slotIndex));
      const batch = toBatch(batchRow);
      const group = activityGroupSchema.parse({
        batchId: batch.id,
        requestedDurationMinutes: batch.requestedDurationMinutes,
        requestedActivityCount: batch.requestedActivityCount,
        activities: currentRows.map(toActivity),
      });
      const replacedActivity = group.activities.find(
        ({ id }) => id === replacement.replacesActivityId,
      );

      if (replacedActivity?.status === "approved") {
        throw new Error(
          "A atividade aprovada deve receber uma decisão de rejeição antes da regeneração.",
        );
      }

      applyActivityRegeneration({ group, replacement });

      const [run] = await transaction
        .select({ batchId: modelRuns.batchId, status: modelRuns.status })
        .from(modelRuns)
        .where(eq(modelRuns.id, replacement.generationRunId))
        .limit(1);
      if (!run || run.batchId !== replacement.batchId || run.status !== "completed") {
        throw new Error(`Execução ${replacement.generationRunId} não é válida para o lote.`);
      }

      await transaction.insert(activities).values(replacement);
      const updateResult = await transaction
        .update(activities)
        .set({ status: "superseded" })
        .where(
          and(
            eq(activities.id, replacement.replacesActivityId!),
            ne(activities.status, "approved"),
            ne(activities.status, "superseded"),
          ),
        );

      if (updateResult.rowsAffected !== 1) {
        throw new Error("A versão substituída mudou durante a regeneração.");
      }

      return replacement;
    });
  }
}
