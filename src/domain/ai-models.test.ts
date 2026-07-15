import { describe, expect, it } from "vitest";

import {
  aiModelSelectionSchema,
  estimateAiUsageCostUsd,
  getAiModelsForProvider,
  getDefaultAiModelForProvider,
} from "./ai-models";

describe("catálogo multiprovedor de modelos", () => {
  it("mantém modelos separados por provedor", () => {
    expect(getAiModelsForProvider("openai").map(({ id }) => id)).toContain(
      "gpt-5.6-sol",
    );
    expect(getAiModelsForProvider("gemini").map(({ id }) => id)).toEqual([
      "gemini-3.5-flash",
    ]);
    expect(getAiModelsForProvider("groq").map(({ id }) => id)).toEqual([
      "qwen/qwen3.6-27b",
    ]);
    expect(getAiModelsForProvider("xai").map(({ id }) => id)).toEqual([
      "grok-4.3",
    ]);
  });

  it("define um modelo inicial válido para cada provedor", () => {
    expect(getDefaultAiModelForProvider("openai").id).toBe("gpt-5.6-sol");
    expect(getDefaultAiModelForProvider("gemini").id).toBe("gemini-3.5-flash");
    expect(getDefaultAiModelForProvider("groq").id).toBe("qwen/qwen3.6-27b");
    expect(getDefaultAiModelForProvider("xai").id).toBe("grok-4.3");
  });

  it("rejeita esforços que o modelo selecionado não oferece", () => {
    expect(
      aiModelSelectionSchema.safeParse({
        model: "gemini-3.5-flash",
        reasoningEffort: "xhigh",
      }).success,
    ).toBe(false);
    expect(
      aiModelSelectionSchema.safeParse({
        model: "qwen/qwen3.6-27b",
        reasoningEffort: "default",
      }).success,
    ).toBe(true);
    expect(
      aiModelSelectionSchema.safeParse({
        model: "gpt-5.6-sol",
        reasoningEffort: "default",
      }).success,
    ).toBe(false);
    expect(
      aiModelSelectionSchema.safeParse({
        model: "grok-4.3",
        reasoningEffort: "high",
      }).success,
    ).toBe(true);
  });

  it("estima o preço pago de referência para modelos com camada gratuita", () => {
    expect(
      estimateAiUsageCostUsd({
        provider: "gemini",
        model: "gemini-3.5-flash",
        inputTokens: 1_000_000,
        outputTokens: 1_000_000,
        otherTokens: 0,
      }),
    ).toBe(10.5);

    expect(
      estimateAiUsageCostUsd({
        provider: "xai",
        model: "grok-4.3",
        inputTokens: 1_000_000,
        outputTokens: 1_000_000,
        otherTokens: 0,
      }),
    ).toBe(3.75);
  });
});
