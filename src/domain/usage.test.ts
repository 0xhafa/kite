import { describe, expect, it } from "vitest";

import {
  type ModelRun,
  aggregateBatchTokenUsage,
  modelRunSchema,
  normalizeTokenUsage,
  tokenUsageSchema,
} from "./usage";

function createRun(overrides: Partial<ModelRun> = {}): ModelRun {
  return {
    id: "run-1",
    batchId: "batch-1",
    stage: "generate",
    provider: "provider-example",
    model: "model-example",
    status: "completed",
    normalizedInput: { lessonId: "lesson-1" },
    inputHash: "hash-1",
    promptTemplateId: "generation",
    promptVersion: "1.0",
    renderedPrompt: "Gere atividades estruturadas.",
    validatedResponse: { activities: [] },
    ruleSetVersion: "1.0",
    cacheKey: "cache-1",
    tokenUsage: {
      inputTokens: 60,
      outputTokens: 40,
      otherTokens: 0,
      totalTokens: 100,
    },
    latencyMilliseconds: 300,
    createdAt: "2026-07-14T12:00:00.000Z",
    ...overrides,
  };
}

describe("observabilidade de tokens", () => {
  it("exige que o total de cada execução corresponda às partes", () => {
    expect(
      tokenUsageSchema.safeParse({
        inputTokens: 20,
        outputTokens: 10,
        otherTokens: 1,
        totalTokens: 30,
      }).success,
    ).toBe(false);
  });

  it("normaliza aliases do provedor e preserva tokens não classificados", () => {
    expect(
      normalizeTokenUsage({
        prompt_tokens: 80,
        completion_tokens: 20,
        total_tokens: 115,
      }),
    ).toEqual({
      inputTokens: 80,
      outputTokens: 20,
      otherTokens: 15,
      totalTokens: 115,
    });
  });

  it("soma tipos extras quando o provedor não informa um total", () => {
    expect(
      normalizeTokenUsage({
        inputTokens: 25,
        outputTokens: 10,
        reasoning_tokens: 7,
        audio_token_count: 3,
      }),
    ).toEqual({
      inputTokens: 25,
      outputTokens: 10,
      otherTokens: 10,
      totalTokens: 45,
    });
  });

  it("usa zero para tipos ausentes sem interromper o fluxo", () => {
    expect(normalizeTokenUsage({ input_tokens: 12 })).toEqual({
      inputTokens: 12,
      outputTokens: 0,
      otherTokens: 0,
      totalTokens: 12,
    });
    expect(normalizeTokenUsage()).toEqual({
      inputTokens: 0,
      outputTokens: 0,
      otherTokens: 0,
      totalTokens: 0,
    });
  });

  it("agrega tokens por etapa e por lote", () => {
    const runs = [
      createRun(),
      createRun({
        id: "run-2",
        stage: "validate",
        tokenUsage: { inputTokens: 30, outputTokens: 20, otherTokens: 0, totalTokens: 50 },
      }),
      createRun({
        id: "run-3",
        reusedFromModelRunId: "run-1",
        tokenUsage: { inputTokens: 0, outputTokens: 0, otherTokens: 0, totalTokens: 0 },
      }),
    ];

    expect(aggregateBatchTokenUsage("batch-1", runs)).toEqual({
      batchId: "batch-1",
      byStage: { plan: 0, generate: 100, validate: 50, repair: 0 },
      totalTokens: 150,
      callCount: 2,
      estimatedCostUsd: null,
      pricingVersion: "multi-provider-standard-2026-07-15-v3",
    });
  });

  it("estima o custo pelas tarifas do modelo e considera outros tokens como saída", () => {
    const usage = aggregateBatchTokenUsage("batch-1", [
      createRun({
        provider: "openai",
        model: "gpt-5.6-luna",
        tokenUsage: {
          inputTokens: 1_000_000,
          outputTokens: 500_000,
          otherTokens: 500_000,
          totalTokens: 2_000_000,
        },
      }),
    ]);

    expect(usage.estimatedCostUsd).toBe(7);
  });

  it("não contabiliza reutilização como nova chamada", () => {
    expect(
      modelRunSchema.safeParse(
        createRun({
          reusedFromModelRunId: "run-original",
        }),
      ).success,
    ).toBe(false);
  });
});
