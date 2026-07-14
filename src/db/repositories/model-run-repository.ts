import { asc, eq } from "drizzle-orm";

import {
  type BatchTokenUsage,
  type GenerationCacheEntry,
  type ModelRun,
  aggregateBatchTokenUsage,
  generationCacheEntrySchema,
  modelRunSchema,
} from "../../domain/usage";

import type { KiteDatabase } from "../client";
import { activities, generationBatches, generationCacheEntries, modelRuns } from "../schema";
import { omitNullValues } from "./mappers";

function toModelRun(row: typeof modelRuns.$inferSelect): ModelRun {
  const { inputTokens, outputTokens, otherTokens, totalTokens, ...run } = row;

  return modelRunSchema.parse({
    ...omitNullValues(run),
    tokenUsage: {
      inputTokens,
      outputTokens,
      otherTokens,
      totalTokens,
    },
  });
}

function toCacheEntry(row: typeof generationCacheEntries.$inferSelect): GenerationCacheEntry {
  return generationCacheEntrySchema.parse(row);
}

export class ModelRunRepository {
  constructor(private readonly db: KiteDatabase) {}

  async save(input: unknown): Promise<ModelRun> {
    const run = modelRunSchema.parse(input);

    if (run.activityId) {
      const [activity] = await this.db
        .select({ batchId: activities.batchId })
        .from(activities)
        .where(eq(activities.id, run.activityId))
        .limit(1);
      if (!activity || activity.batchId !== run.batchId) {
        throw new Error("A execução deve referenciar uma atividade existente no mesmo lote.");
      }
    }

    if (run.reusedFromModelRunId) {
      const original = await this.get(run.reusedFromModelRunId);
      if (!original || original.status !== "completed" || original.validatedResponse === undefined) {
        throw new Error("A execução original precisa estar concluída e validada para ser reutilizada.");
      }
      if (original.reusedFromModelRunId) {
        throw new Error("A reutilização deve apontar diretamente para a execução original.");
      }
    }

    await this.db.insert(modelRuns).values({
      id: run.id,
      batchId: run.batchId,
      activityId: run.activityId,
      stage: run.stage,
      provider: run.provider,
      model: run.model,
      status: run.status,
      normalizedInput: run.normalizedInput,
      inputHash: run.inputHash,
      promptTemplateId: run.promptTemplateId,
      promptVersion: run.promptVersion,
      renderedPrompt: run.renderedPrompt,
      validatedResponse: run.validatedResponse,
      ruleSetVersion: run.ruleSetVersion,
      cacheKey: run.cacheKey,
      reusedFromModelRunId: run.reusedFromModelRunId,
      rawUsage: run.rawUsage,
      inputTokens: run.tokenUsage.inputTokens,
      outputTokens: run.tokenUsage.outputTokens,
      otherTokens: run.tokenUsage.otherTokens,
      totalTokens: run.tokenUsage.totalTokens,
      latencyMilliseconds: run.latencyMilliseconds,
      error: run.error,
      createdAt: run.createdAt,
    });

    return run;
  }

  async get(id: string): Promise<ModelRun | undefined> {
    const [row] = await this.db.select().from(modelRuns).where(eq(modelRuns.id, id)).limit(1);
    return row ? toModelRun(row) : undefined;
  }

  async listByBatch(batchId: string): Promise<ModelRun[]> {
    const rows = await this.db
      .select()
      .from(modelRuns)
      .where(eq(modelRuns.batchId, batchId))
      .orderBy(asc(modelRuns.createdAt));
    return rows.map(toModelRun);
  }

  async aggregateBatchUsage(batchId: string): Promise<BatchTokenUsage> {
    return aggregateBatchTokenUsage(batchId, await this.listByBatch(batchId));
  }

  async saveCacheEntry(input: unknown): Promise<GenerationCacheEntry> {
    const entry = generationCacheEntrySchema.parse(input);
    const run = await this.get(entry.modelRunId);

    if (!run || run.status !== "completed" || run.validatedResponse === undefined) {
      throw new Error("O cache só pode apontar para uma execução concluída e validada.");
    }
    if (run.reusedFromModelRunId) {
      throw new Error("O cache deve apontar para a execução original, não para uma reutilização.");
    }

    const [batch] = await this.db
      .select()
      .from(generationBatches)
      .where(eq(generationBatches.id, run.batchId))
      .limit(1);
    if (
      !batch ||
      batch.themeId !== entry.themeId ||
      batch.lessonId !== entry.lessonId ||
      batch.curriculumVersion !== entry.curriculumVersion ||
      JSON.stringify(batch.normalizedParameters) !== JSON.stringify(entry.normalizedParameters) ||
      batch.promptVersion !== entry.promptVersion ||
      batch.ruleSetVersion !== entry.ruleSetVersion ||
      run.cacheKey !== entry.cacheKey ||
      run.provider !== entry.provider ||
      run.model !== entry.model
    ) {
      throw new Error("A entrada de cache deve corresponder ao lote e à execução originais.");
    }

    await this.db.insert(generationCacheEntries).values(entry);
    return entry;
  }

  async findCacheEntry(
    cacheKey: string,
    lastUsedAt?: string,
  ): Promise<GenerationCacheEntry | undefined> {
    if (lastUsedAt) {
      const current = await this.findCacheEntry(cacheKey);
      if (!current) return undefined;

      const updated = generationCacheEntrySchema.parse({ ...current, lastUsedAt });
      await this.db
        .update(generationCacheEntries)
        .set({ lastUsedAt: updated.lastUsedAt })
        .where(eq(generationCacheEntries.cacheKey, cacheKey));
      return updated;
    }

    const [row] = await this.db
      .select()
      .from(generationCacheEntries)
      .where(eq(generationCacheEntries.cacheKey, cacheKey))
      .limit(1);
    return row ? toCacheEntry(row) : undefined;
  }
}
