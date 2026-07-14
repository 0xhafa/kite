import { describe, expect, it } from "vitest";

import {
  type ModelRun,
  aggregateBatchTokenUsage,
  modelRunSchema,
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
    });
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
