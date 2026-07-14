import { and, asc, eq, ne } from "drizzle-orm";

import {
  type Activity,
  type ActivityGroup,
  type GenerationBatch,
  activityGroupSchema,
  activitySchema,
  applyActivityRegeneration,
  generationBatchSchema,
} from "../../domain/generation";

import type { KiteDatabase } from "../client";
import { activities, generationBatches, modelRuns } from "../schema";
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
      for (const activity of group.activities) {
        const [run] = await transaction
          .select({ batchId: modelRuns.batchId, status: modelRuns.status })
          .from(modelRuns)
          .where(eq(modelRuns.id, activity.generationRunId))
          .limit(1);

        if (!run || run.batchId !== group.batchId || run.status !== "completed") {
          throw new Error(`Execução ${activity.generationRunId} não é válida para o lote.`);
        }

        await transaction.insert(activities).values(activity);
      }
    });

    return group;
  }

  async getCurrentActivityGroup(batchId: string): Promise<ActivityGroup | undefined> {
    const batch = await this.getBatch(batchId);
    if (!batch) return undefined;

    const rows = await this.db
      .select()
      .from(activities)
      .where(and(eq(activities.batchId, batchId), ne(activities.status, "superseded")))
      .orderBy(asc(activities.slotIndex));

    return activityGroupSchema.parse({
      batchId,
      requestedDurationMinutes: batch.requestedDurationMinutes,
      requestedActivityCount: batch.requestedActivityCount,
      activities: rows.map(toActivity),
    });
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
