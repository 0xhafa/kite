import { describe, expect, it } from "vitest";

import { defaultAiModelSelection } from "./ai-models";
import {
  DEFAULT_ACTIVITY_COUNT,
  DEFAULT_DURATION_MINUTES,
  MAX_ACTIVITY_COUNT,
  defaultGenerationConfig,
  estimateActivityDistribution,
  generationConfigSchema,
  serializeGenerationConfig,
} from "./generation-config";

describe("configuração da geração", () => {
  it("adota 25 minutos como duração padrão", () => {
    expect(defaultGenerationConfig).toEqual({
      requestedDurationMinutes: DEFAULT_DURATION_MINUTES,
      requestedActivityCount: DEFAULT_ACTIVITY_COUNT,
      ...defaultAiModelSelection,
    });
  });

  it("valida duração personalizada e reserva ao menos um minuto por atividade", () => {
    expect(
      generationConfigSchema.safeParse({
        requestedDurationMinutes: 40,
        requestedActivityCount: 4,
        ...defaultAiModelSelection,
      }).success,
    ).toBe(true);
    expect(
      generationConfigSchema.safeParse({
        requestedDurationMinutes: 0,
        requestedActivityCount: 3,
        ...defaultAiModelSelection,
      }).success,
    ).toBe(false);
    expect(
      generationConfigSchema.safeParse({
        requestedDurationMinutes: 5,
        requestedActivityCount: 6,
        ...defaultAiModelSelection,
      }).success,
    ).toBe(false);
  });

  it("limita a quantidade configurável de atividades", () => {
    expect(
      generationConfigSchema.safeParse({
        requestedDurationMinutes: 25,
        requestedActivityCount: 1,
        ...defaultAiModelSelection,
      }).success,
    ).toBe(true);
    expect(
      generationConfigSchema.safeParse({
        requestedDurationMinutes: 25,
        requestedActivityCount: MAX_ACTIVITY_COUNT + 1,
        ...defaultAiModelSelection,
      }).success,
    ).toBe(false);
  });

  it("distribui o resto em minutos inteiros e preserva o total solicitado", () => {
    const distribution = estimateActivityDistribution({
      requestedDurationMinutes: 25,
      requestedActivityCount: 3,
      ...defaultAiModelSelection,
    });

    expect(distribution).toEqual([
      { slotIndex: 0, durationMinutes: 9 },
      { slotIndex: 1, durationMinutes: 8 },
      { slotIndex: 2, durationMinutes: 8 },
    ]);
    expect(distribution.reduce((total, item) => total + item.durationMinutes, 0)).toBe(25);
  });

  it("serializa somente o contrato tipado e estrito", () => {
    expect(
      serializeGenerationConfig({
        requestedDurationMinutes: 30,
        requestedActivityCount: 4,
        ...defaultAiModelSelection,
      }),
    ).toEqual({
      requestedDurationMinutes: 30,
      requestedActivityCount: 4,
      ...defaultAiModelSelection,
    });
    expect(() =>
      serializeGenerationConfig({
        requestedDurationMinutes: 30,
        requestedActivityCount: 4,
        ...defaultAiModelSelection,
        curriculumObjective: "não pertence à configuração",
      }),
    ).toThrow();
  });

  it("valida o esforço conforme o modelo selecionado", () => {
    expect(
      generationConfigSchema.safeParse({
        requestedDurationMinutes: 25,
        requestedActivityCount: 3,
        model: "gpt-5.6-terra",
        reasoningEffort: "low",
      }).success,
    ).toBe(true);
    expect(
      generationConfigSchema.safeParse({
        requestedDurationMinutes: 25,
        requestedActivityCount: 3,
        model: "gpt-4.1-mini",
        reasoningEffort: "high",
      }).success,
    ).toBe(false);
  });
});
