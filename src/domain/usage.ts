import { z } from "zod";

import {
  identifierSchema,
  jsonObjectSchema,
  nonEmptyTextSchema,
  nonNegativeIntegerSchema,
  timestampSchema,
} from "./shared";

export const modelRunStageSchema = z.enum(["plan", "generate", "validate", "repair"]);
export const modelRunStatusSchema = z.enum(["completed", "failed", "cancelled"]);

export const tokenUsageSchema = z
  .object({
    inputTokens: nonNegativeIntegerSchema,
    outputTokens: nonNegativeIntegerSchema,
    otherTokens: nonNegativeIntegerSchema,
    totalTokens: nonNegativeIntegerSchema,
  })
  .strict()
  .superRefine((usage, context) => {
    const calculatedTotal = usage.inputTokens + usage.outputTokens + usage.otherTokens;

    if (usage.totalTokens !== calculatedTotal) {
      context.addIssue({
        code: "custom",
        message: "O total de tokens deve ser a soma de entrada, saída e outros.",
        path: ["totalTokens"],
      });
    }
  });

export const modelRunSchema = z
  .object({
    id: identifierSchema,
    batchId: identifierSchema,
    activityId: identifierSchema.optional(),
    stage: modelRunStageSchema,
    provider: nonEmptyTextSchema,
    model: nonEmptyTextSchema,
    status: modelRunStatusSchema,
    normalizedInput: z.json(),
    inputHash: nonEmptyTextSchema,
    promptTemplateId: identifierSchema,
    promptVersion: nonEmptyTextSchema,
    renderedPrompt: nonEmptyTextSchema,
    validatedResponse: z.json().optional(),
    ruleSetVersion: nonEmptyTextSchema,
    cacheKey: nonEmptyTextSchema,
    reusedFromModelRunId: identifierSchema.optional(),
    rawUsage: jsonObjectSchema.optional(),
    tokenUsage: tokenUsageSchema,
    latencyMilliseconds: nonNegativeIntegerSchema,
    error: nonEmptyTextSchema.optional(),
    createdAt: timestampSchema,
  })
  .strict()
  .superRefine((run, context) => {
    if (run.reusedFromModelRunId === run.id) {
      context.addIssue({
        code: "custom",
        message: "Uma execução não pode reutilizar a si própria.",
        path: ["reusedFromModelRunId"],
      });
    }

    if (run.status === "completed" && run.validatedResponse === undefined) {
      context.addIssue({
        code: "custom",
        message: "Uma execução concluída deve possuir resposta validada.",
        path: ["validatedResponse"],
      });
    }

    if (run.status === "completed" && run.error) {
      context.addIssue({
        code: "custom",
        message: "Uma execução concluída não pode possuir erro.",
        path: ["error"],
      });
    }

    if (run.status !== "completed" && !run.error) {
      context.addIssue({
        code: "custom",
        message: "Uma execução sem sucesso deve registrar erro ou motivo do cancelamento.",
        path: ["error"],
      });
    }

    if (run.reusedFromModelRunId) {
      if (run.status !== "completed" || run.validatedResponse === undefined) {
        context.addIssue({
          code: "custom",
          message: "Somente uma resposta concluída e validada pode ser reutilizada.",
          path: ["reusedFromModelRunId"],
        });
      }

      if (run.tokenUsage.totalTokens !== 0) {
        context.addIssue({
          code: "custom",
          message: "A reutilização não pode contabilizar uma nova chamada ao modelo.",
          path: ["tokenUsage", "totalTokens"],
        });
      }
    }
  });

const tokenUsageByStageSchema = z
  .object({
    plan: nonNegativeIntegerSchema,
    generate: nonNegativeIntegerSchema,
    validate: nonNegativeIntegerSchema,
    repair: nonNegativeIntegerSchema,
  })
  .strict();

export const batchTokenUsageSchema = z
  .object({
    batchId: identifierSchema,
    byStage: tokenUsageByStageSchema,
    totalTokens: nonNegativeIntegerSchema,
    callCount: nonNegativeIntegerSchema,
  })
  .strict()
  .superRefine((usage, context) => {
    const calculatedTotal = Object.values(usage.byStage).reduce((total, value) => total + value, 0);

    if (usage.totalTokens !== calculatedTotal) {
      context.addIssue({
        code: "custom",
        message: "O total do lote deve ser a soma dos tokens de todas as etapas.",
        path: ["totalTokens"],
      });
    }
  });

export function aggregateBatchTokenUsage(
  batchId: string,
  runs: ReadonlyArray<ModelRun>,
): BatchTokenUsage {
  const parsedBatchId = identifierSchema.parse(batchId);
  const parsedRuns = runs.map((run) => modelRunSchema.parse(run));
  const byStage: Record<ModelRunStage, number> = {
    plan: 0,
    generate: 0,
    validate: 0,
    repair: 0,
  };
  let callCount = 0;

  parsedRuns.forEach((run) => {
    if (run.batchId !== parsedBatchId) {
      throw new Error(`A execução ${run.id} não pertence ao lote ${parsedBatchId}.`);
    }

    byStage[run.stage] += run.tokenUsage.totalTokens;
    if (!run.reusedFromModelRunId) {
      callCount += 1;
    }
  });

  return batchTokenUsageSchema.parse({
    batchId: parsedBatchId,
    byStage,
    totalTokens: Object.values(byStage).reduce((total, value) => total + value, 0),
    callCount,
  });
}

export const generationCacheEntrySchema = z
  .object({
    cacheKey: nonEmptyTextSchema,
    themeId: identifierSchema,
    lessonId: identifierSchema,
    curriculumVersion: nonEmptyTextSchema,
    normalizedParameters: jsonObjectSchema,
    promptVersion: nonEmptyTextSchema,
    ruleSetVersion: nonEmptyTextSchema,
    provider: nonEmptyTextSchema,
    model: nonEmptyTextSchema,
    modelRunId: identifierSchema,
    createdAt: timestampSchema,
    lastUsedAt: timestampSchema,
  })
  .strict()
  .superRefine((entry, context) => {
    if (Date.parse(entry.lastUsedAt) < Date.parse(entry.createdAt)) {
      context.addIssue({
        code: "custom",
        message: "O último uso do cache não pode ser anterior à criação.",
        path: ["lastUsedAt"],
      });
    }
  });

export type ModelRunStage = z.infer<typeof modelRunStageSchema>;
export type ModelRunStatus = z.infer<typeof modelRunStatusSchema>;
export type TokenUsage = z.infer<typeof tokenUsageSchema>;
export type ModelRun = z.infer<typeof modelRunSchema>;
export type BatchTokenUsage = z.infer<typeof batchTokenUsageSchema>;
export type GenerationCacheEntry = z.infer<typeof generationCacheEntrySchema>;
