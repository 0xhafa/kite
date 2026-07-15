import { describe, expect, it } from "vitest";

import type { Activity } from "./generation";
import type {
  GenerationModelInput,
  RepairModelInput,
} from "./model-contracts";
import {
  MockGeneratorSchemaError,
  generateMockBatch,
  generateMockRepair,
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

const currentActivity: Activity = {
  id: "activity-2-v1",
  batchId: "batch-1",
  logicalActivityId: "activity-2",
  slotIndex: 1,
  title: "Olhar de investigador",
  description: "A criança observa exemplos do som inicial.",
  durationMinutes: 15,
  status: "rejected",
  version: 1,
  generationRunId: "run-2",
};

const preservedActivity: Activity = {
  id: "activity-1-v1",
  batchId: "batch-1",
  logicalActivityId: "activity-1",
  slotIndex: 0,
  title: "Ouvidos atentos",
  description: "A criança escuta sons conhecidos.",
  durationMinutes: 10,
  status: "approved",
  version: 1,
  generationRunId: "run-1",
};

function createRepairInput(
  overrides: Partial<RepairModelInput> = {},
): RepairModelInput {
  const generationInput = createInput();

  return {
    currentActivity,
    requiredDurationMinutes: currentActivity.durationMinutes,
    validationFailures: [
      {
        ruleId: "PED-001",
        ruleVersion: 1,
        status: "failed",
        explanation: "A dinâmica repete uma atividade do lote.",
        confidence: 1,
      },
    ],
    feedback: "Propor uma dinâmica diferente.",
    preservedActivities: [preservedActivity],
    curriculum: generationInput.curriculum,
    applicableRules: generationInput.applicableRules,
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
      expect(output.plan.slots).toHaveLength(activityCount);
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
    const actions = output.plan.slots.map(
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

describe("reparo mock pontual", () => {
  it("preserva posição e duração sem alterar as atividades preservadas", () => {
    const input = createRepairInput();
    const preservedSnapshot = structuredClone(input.preservedActivities);
    const output = generateMockRepair(input);

    expect(output.activity).toMatchObject({
      slotIndex: currentActivity.slotIndex,
      durationMinutes: currentActivity.durationMinutes,
    });
    expect(input.preservedActivities).toEqual(preservedSnapshot);
  });

  it("considera a rejeitada e as preservadas ao escolher outra dinâmica", () => {
    const output = generateMockRepair(createRepairInput());

    expect(output.activity.title).toBe("Aponte a pista");
    expect(output.activity.title).not.toBe(currentActivity.title);
    expect(output.activity.title).not.toBe(preservedActivity.title);
  });

  it("mantém a duração total do grupo e considera regras sem declarar atendimento", () => {
    const input = createRepairInput({
      applicableRules: [
        ...createInput().applicableRules,
        ...createInput().applicableRules,
      ],
    });
    const output = generateMockRepair(input);
    const previousTotal = input.preservedActivities.reduce(
      (total, activity) => total + activity.durationMinutes,
      input.currentActivity.durationMinutes,
    );
    const repairedTotal = input.preservedActivities.reduce(
      (total, activity) => total + activity.durationMinutes,
      output.activity.durationMinutes,
    );

    expect(repairedTotal).toBe(previousTotal);
    expect(output.activity.consideredRuleIds).toEqual(["PED-001"]);
    expect(output.uncertainties).toEqual([]);
  });

  it("é determinístico", () => {
    const input = createRepairInput();

    expect(generateMockRepair(input)).toEqual(generateMockRepair(input));
  });

  it("converte entrada de reparo inválida em erro tipado", () => {
    const input = createRepairInput({ requiredDurationMinutes: 14 });

    expect(() => generateMockRepair(input)).toThrowError(
      MockGeneratorSchemaError,
    );

    try {
      generateMockRepair(input);
      throw new Error("A duração inválida deveria falhar.");
    } catch (error) {
      expect(error).toMatchObject({ stage: "input" });
    }
  });
});
