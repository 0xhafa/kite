import { describe, expect, it } from "vitest";

import type { GenerationModelInput } from "./model-contracts";
import {
  MockGeneratorSchemaError,
  generateMockBatch,
} from "./mock-generator";

function createInput(
  overrides: Partial<GenerationModelInput> = {},
): GenerationModelInput {
  return {
    curriculum: {
      themeId: "fonemas",
      curriculumVersion: "fixture-1.0",
      skillId: "habilidade-1",
      objectiveId: "objetivo-1",
      objectiveName: "Consciência fonológica",
      weekId: "semana-1",
      lesson: {
        id: "aula-1",
        number: 1,
        specificObjective: "Identificar o som inicial das palavras",
        content: "som inicial /f/",
      },
    },
    progressionContext: ["A turma já comparou sons do ambiente."],
    totalDurationMinutes: 25,
    activityCount: 3,
    applicableRules: [
      {
        ruleId: "PED-001",
        ruleVersion: 1,
        applicabilityReason: "A ação da criança deve estar explícita.",
        generationInstruction: "Usar um verbo observável.",
        validationCriterion: "A descrição explicita uma ação observável.",
      },
    ],
    preservedActivities: [],
    localFeedback: [],
    editorialTemplateVersion: "generation-1",
    ...overrides,
  };
}

describe("gerador mock estruturado", () => {
  it.each([
    { totalDurationMinutes: 5, activityCount: 1 },
    { totalDurationMinutes: 25, activityCount: 3 },
    { totalDurationMinutes: 120, activityCount: 10 },
  ])(
    "retorna um lote válido para $totalDurationMinutes minutos e $activityCount atividades",
    ({ totalDurationMinutes, activityCount }) => {
      const output = generateMockBatch(
        createInput({ totalDurationMinutes, activityCount }),
      );

      expect(output.activities).toHaveLength(activityCount);
      expect(output.plan.activities).toHaveLength(activityCount);
      expect(output.plan.totalDurationMinutes).toBe(totalDurationMinutes);
      expect(
        output.activities.reduce(
          (total, activity) => total + activity.durationMinutes,
          0,
        ),
      ).toBe(totalDurationMinutes);
    },
  );

  it("usa ações diferentes em cada posição da fixture", () => {
    const output = generateMockBatch(
      createInput({ totalDurationMinutes: 30, activityCount: 10 }),
    );
    const actions = output.plan.activities.map(
      (activity) => activity.primaryChildAction,
    );

    expect(new Set(actions).size).toBe(actions.length);
    expect(new Set(output.activities.map((activity) => activity.title)).size).toBe(
      output.activities.length,
    );
  });

  it("considera as regras aplicáveis sem declarar que foram atendidas", () => {
    const output = generateMockBatch(createInput());

    expect(
      output.activities.every((activity) =>
        activity.consideredRuleIds.includes("PED-001"),
      ),
    ).toBe(true);
    expect(output.uncertainties).toEqual([]);
  });

  it("é determinístico e não depende de integração externa", () => {
    const input = createInput();

    expect(generateMockBatch(input)).toEqual(generateMockBatch(input));
  });

  it("converte falhas de schema em erro tipado e mensagem em português", () => {
    const invalidInput = createInput({
      totalDurationMinutes: 5,
      activityCount: 6,
    });

    expect(() => generateMockBatch(invalidInput)).toThrowError(
      MockGeneratorSchemaError,
    );

    try {
      generateMockBatch(invalidInput);
      throw new Error("A configuração inválida deveria falhar.");
    } catch (error) {
      expect(error).toBeInstanceOf(MockGeneratorSchemaError);
      expect(error).toMatchObject({ stage: "input" });
      expect((error as Error).message).toContain(
        "a entrada não atende ao contrato",
      );
    }
  });
});
