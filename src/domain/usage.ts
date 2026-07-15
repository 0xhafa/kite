import { z } from "zod";

import {
  AI_MODEL_PRICING_VERSION,
  estimateAiUsageCostUsd,
  reasoningEffortSchema,
} from "./ai-models";
import {
  type JsonObject,
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

const tokenUsageAliases = {
  input: [
    "input_tokens",
    "inputTokens",
    "input_token_count",
    "inputTokenCount",
    "prompt_tokens",
    "promptTokens",
    "prompt_token_count",
    "promptTokenCount",
  ],
  output: [
    "output_tokens",
    "outputTokens",
    "output_token_count",
    "outputTokenCount",
    "completion_tokens",
    "completionTokens",
    "completion_token_count",
    "completionTokenCount",
  ],
  other: ["other_tokens", "otherTokens", "other_token_count", "otherTokenCount"],
  total: ["total_tokens", "totalTokens", "total_token_count", "totalTokenCount"],
} as const;

const knownTokenUsageKeys = new Set<string>(Object.values(tokenUsageAliases).flat());

function readTokenCount(
  rawUsage: JsonObject,
  aliases: readonly string[],
): number | undefined {
  for (const alias of aliases) {
    const value = rawUsage[alias];

    if (typeof value === "number" && Number.isInteger(value) && value >= 0) {
      return value;
    }
  }

  return undefined;
}

function sumAdditionalTokenTypes(rawUsage: JsonObject): number {
  return Object.entries(rawUsage).reduce((total, [key, value]) => {
    const isAdditionalTokenType =
      !knownTokenUsageKeys.has(key) && /(?:tokens?|token_?count)$/iu.test(key);

    return isAdditionalTokenType &&
      typeof value === "number" &&
      Number.isInteger(value) &&
      value >= 0
      ? total + value
      : total;
  }, 0);
}

export function normalizeTokenUsage(rawUsage?: JsonObject): TokenUsage {
  if (!rawUsage) {
    return tokenUsageSchema.parse({
      inputTokens: 0,
      outputTokens: 0,
      otherTokens: 0,
      totalTokens: 0,
    });
  }

  const inputTokens = readTokenCount(rawUsage, tokenUsageAliases.input) ?? 0;
  const outputTokens = readTokenCount(rawUsage, tokenUsageAliases.output) ?? 0;
  const explicitOtherTokens = readTokenCount(rawUsage, tokenUsageAliases.other) ?? 0;
  const reportedTotalTokens = readTokenCount(rawUsage, tokenUsageAliases.total);
  const additionalTokenTypes = sumAdditionalTokenTypes(rawUsage);
  const unclassifiedReportedTokens = Math.max(
    (reportedTotalTokens ?? 0) - inputTokens - outputTokens,
    0,
  );
  const otherTokens = Math.max(
    explicitOtherTokens + additionalTokenTypes,
    unclassifiedReportedTokens,
  );

  return tokenUsageSchema.parse({
    inputTokens,
    outputTokens,
    otherTokens,
    totalTokens: inputTokens + outputTokens + otherTokens,
  });
}

export const modelRunSchema = z
  .object({
    id: identifierSchema,
    batchId: identifierSchema,
    activityId: identifierSchema.optional(),
    stage: modelRunStageSchema,
    provider: nonEmptyTextSchema,
    model: nonEmptyTextSchema,
    reasoningEffort: reasoningEffortSchema.optional(),
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
    estimatedCostUsd: z.number().nonnegative().nullable(),
    pricingVersion: nonEmptyTextSchema,
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
  let estimatedCostUsd = 0;
  let hasUnpricedRun = false;

  parsedRuns.forEach((run) => {
    if (run.batchId !== parsedBatchId) {
      throw new Error(`A execução ${run.id} não pertence ao lote ${parsedBatchId}.`);
    }

    byStage[run.stage] += run.tokenUsage.totalTokens;
    if (!run.reusedFromModelRunId) {
      callCount += 1;
    }

    const runCost = estimateAiUsageCostUsd({
      provider: run.provider,
      model: run.model,
      inputTokens: run.tokenUsage.inputTokens,
      outputTokens: run.tokenUsage.outputTokens,
      otherTokens: run.tokenUsage.otherTokens,
    });

    if (runCost === undefined) {
      hasUnpricedRun = true;
    } else {
      estimatedCostUsd += runCost;
    }
  });

  return batchTokenUsageSchema.parse({
    batchId: parsedBatchId,
    byStage,
    totalTokens: Object.values(byStage).reduce((total, value) => total + value, 0),
    callCount,
    estimatedCostUsd: hasUnpricedRun ? null : estimatedCostUsd,
    pricingVersion: AI_MODEL_PRICING_VERSION,
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
