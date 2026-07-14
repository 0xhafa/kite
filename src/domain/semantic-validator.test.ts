import { describe, expect, it } from "vitest";

import type { Activity } from "./generation";
import type {
  ApplicableRuleInput,
  ValidationModelInput,
} from "./model-contracts";
import {
  MockSemanticEvaluatorSchemaError,
  type SemanticEvaluator,
  evaluateSemanticsWithMock,
  mockSemanticEvaluator,
} from "./semantic-validator";

const activity: Activity = {
  id: "activity-1-v1",
  batchId: "batch-1",
  logicalActivityId: "activity-1",
  slotIndex: 0,
  title: "Ouvidos atentos",
  description:
    "A criança escuta palavras e sinaliza quando reconhece o som inicial /f/ para explorar som inicial /f/, conforme o objetivo curricular: Identificar o som inicial das palavras.",
  durationMinutes: 10,
  status: "draft",
  version: 1,
  generationRunId: "run-1",
};

const relatedActivity: Activity = {
  id: "activity-2-v1",
  batchId: "batch-1",
  logicalActivityId: "activity-2",
  slotIndex: 1,
  title: "Sons escondidos",
  description: "Cada criança ouve cartões sonoros e escolhe os que começam com /f/.",
  durationMinutes: 15,
  status: "draft",
  version: 1,
  generationRunId: "run-1",
};

const rules = {
  curriculum: {
    ruleId: "CUR-001",
    ruleVersion: 1,
    applicabilityReason: "A regra é aplicável a toda atividade.",
    generationInstruction: "Preservar objetivo e conteúdo.",
    validationCriterion: "O objetivo e o conteúdo curriculares permanecem alinhados.",
  },
  childAction: {
    ruleId: "PED-001",
    ruleVersion: 1,
    applicabilityReason: "A regra é aplicável a toda atividade.",
    generationInstruction: "Explicitar a ação da criança.",
    validationCriterion: "A ação da criança pratica diretamente a habilidade.",
  },
  variation: {
    ruleId: "VAR-001",
    ruleVersion: 1,
    applicabilityReason: "A regra é aplicável ao lote com duas atividades.",
    generationInstruction: "Variar as ações do lote.",
    validationCriterion:
      "As atividades do lote apresentam diferenças observáveis na ação central da criança.",
  },
  uncertain: {
    ruleId: "AGE-003",
    ruleVersion: 1,
    applicabilityReason: "A regra é aplicável a toda atividade.",
    generationInstruction: "Controlar a carga cognitiva.",
    validationCriterion: "A carga cognitiva é adequada para crianças de 4 anos.",
  },
  notApplicable: {
    ruleId: "PLAY-003",
    ruleVersion: 1,
    applicabilityReason: "A regra não se aplica porque a atividade não é um jogo.",
    generationInstruction: "Descrever as regras do jogo.",
    validationCriterion: "O jogo tem regra e dinâmica executável.",
  },
} as const satisfies Record<string, ApplicableRuleInput>;

function createInput(
  overrides: Partial<ValidationModelInput> = {},
): ValidationModelInput {
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
    activity,
    relatedActivities: [relatedActivity],
    applicableRules: Object.values(rules),
    progressionContext: ["A turma já comparou sons do ambiente."],
    ...overrides,
  };
}

function consumeEvaluator(
  evaluator: SemanticEvaluator,
  input: ValidationModelInput,
) {
  return evaluator.evaluate(input);
}

describe("avaliador semântico mock", () => {
  it("retorna todos os status previstos com resumo coerente", () => {
    const output = evaluateSemanticsWithMock(createInput());

    expect(output.results.map((result) => result.status)).toEqual([
      "passed",
      "passed",
      "failed",
      "needs_review",
      "not_applicable",
    ]);
    expect(output.summary).toEqual({
      blockingFailures: 1,
      needsHumanReview: 1,
    });
  });

  it("inclui evidência extraída da atividade em todo resultado aprovado", () => {
    const output = evaluateSemanticsWithMock(createInput());
    const passedResults = output.results.filter(
      (result) => result.status === "passed",
    );

    expect(passedResults).not.toHaveLength(0);
    expect(passedResults.every((result) => Boolean(result.evidence))).toBe(true);
    expect(
      passedResults.every((result) =>
        activity.description.includes(result.evidence ?? ""),
      ),
    ).toBe(true);
  });

  it("sinaliza repetição semântica da ação mesmo com descrições diferentes", () => {
    const result = evaluateSemanticsWithMock(
      createInput({ applicableRules: [rules.variation] }),
    ).results[0];

    expect(activity.description).not.toBe(relatedActivity.description);
    expect(result).toMatchObject({
      ruleId: "VAR-001",
      status: "failed",
      confidence: 1,
    });
    expect(result.explanation).toContain('ação principal "escutar"');
    expect(result.evidence).toContain(relatedActivity.description);
  });

  it("aprova variação quando identifica ações diferentes", () => {
    const distinctRelatedActivity = {
      ...relatedActivity,
      description: "A criança aponta a figura que começa com /f/.",
    };
    const result = evaluateSemanticsWithMock(
      createInput({
        relatedActivities: [distinctRelatedActivity],
        applicableRules: [rules.variation],
      }),
    ).results[0];

    expect(result).toMatchObject({
      ruleId: "VAR-001",
      status: "passed",
      evidence: activity.description,
    });
  });

  it("marca variação como não aplicável quando não há atividade relacionada", () => {
    const result = evaluateSemanticsWithMock(
      createInput({
        relatedActivities: [],
        applicableRules: [rules.variation],
      }),
    ).results[0];

    expect(result).toMatchObject({
      ruleId: "VAR-001",
      status: "not_applicable",
    });
  });

  it("pode ser consumido apenas pela interface, sem conhecer o mock", () => {
    const input = createInput();

    expect(consumeEvaluator(mockSemanticEvaluator, input)).toEqual(
      evaluateSemanticsWithMock(input),
    );
  });

  it("é determinístico e não modifica a entrada", () => {
    const input = createInput();
    const snapshot = structuredClone(input);

    expect(evaluateSemanticsWithMock(input)).toEqual(
      evaluateSemanticsWithMock(input),
    );
    expect(input).toEqual(snapshot);
  });

  it("converte entrada inválida em erro tipado", () => {
    const input = createInput({ progressionContext: [""] });

    expect(() => evaluateSemanticsWithMock(input)).toThrowError(
      MockSemanticEvaluatorSchemaError,
    );

    try {
      evaluateSemanticsWithMock(input);
      throw new Error("A entrada inválida deveria falhar.");
    } catch (error) {
      expect(error).toMatchObject({ stage: "input" });
    }
  });
});
