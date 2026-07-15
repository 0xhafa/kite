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
      "openai/gpt-oss-20b",
    ]);
  });

  it("define um modelo inicial válido para cada provedor", () => {
    expect(getDefaultAiModelForProvider("openai").id).toBe("gpt-5.6-sol");
    expect(getDefaultAiModelForProvider("gemini").id).toBe("gemini-3.5-flash");
    expect(getDefaultAiModelForProvider("groq").id).toBe("openai/gpt-oss-20b");
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
        model: "openai/gpt-oss-20b",
        reasoningEffort: "medium",
      }).success,
    ).toBe(true);
    expect(
      aiModelSelectionSchema.safeParse({
        model: "gpt-5.6-sol",
        reasoningEffort: "default",
      }).success,
    ).toBe(false);
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
  });
});
