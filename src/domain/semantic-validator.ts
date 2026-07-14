import type { ZodError } from "zod";

import type { Activity } from "./generation";
import {
  type ApplicableRuleInput,
  type ValidationModelInput,
  validationModelInputSchema,
} from "./model-contracts";
import {
  type ValidationModelOutput,
  type ValidationModelResult,
  validationModelOutputSchema,
} from "./rules";

export interface SemanticEvaluator {
  evaluate(input: ValidationModelInput): ValidationModelOutput;
}

export type MockSemanticEvaluatorSchemaStage = "input" | "output";

export class MockSemanticEvaluatorSchemaError extends Error {
  readonly name = "MockSemanticEvaluatorSchemaError";

  constructor(
    readonly stage: MockSemanticEvaluatorSchemaStage,
    readonly details: readonly string[],
  ) {
    const contract = stage === "input" ? "entrada" : "saída";
    super(`Não foi possível avaliar a atividade: a ${contract} não atende ao contrato.`);
  }
}

type SemanticEvaluation = Pick<
  ValidationModelResult,
  "status" | "evidence" | "explanation" | "confidence"
>;

type ChildAction = {
  canonical: string;
  evidence: string;
};

const childActionPatterns = [
  ["observar", /\bobserv\w*/u],
  ["escutar", /\b(?:escut|ouv)\w*/u],
  ["apontar", /\bapont\w*/u],
  ["separar", /\bsepar\w*/u],
  ["combinar", /\bcombin\w*/u],
  ["repetir", /\brepet\w*/u],
  ["nomear", /\bnome\w*/u],
  ["comparar", /\bcompar\w*/u],
  ["ordenar", /\borden\w*/u],
  ["explicar", /\bexplic\w*/u],
  ["identificar", /\bidentific\w*/u],
  ["sinalizar", /\bsinaliz\w*/u],
  ["classificar", /\bclassific\w*/u],
  ["produzir", /\bprodu\w*/u],
  ["imitar", /\bimit\w*/u],
  ["escolher", /\bescolh\w*/u],
  ["relacionar", /\brelacion\w*/u],
  ["percorrer", /\bpercorr\w*/u],
  ["destacar", /\bdestac\w*/u],
  ["contar", /\bcont\w*/u],
] as const;

function createSchemaError(
  stage: MockSemanticEvaluatorSchemaStage,
  error: ZodError,
): MockSemanticEvaluatorSchemaError {
  return new MockSemanticEvaluatorSchemaError(
    stage,
    error.issues.map((issue) => issue.message),
  );
}

function normalizeText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLocaleLowerCase("pt-BR")
    .replace(/\s+/g, " ");
}

function extractChildAction(activity: Activity): ChildAction | undefined {
  const sentences = activity.description
    .split(/(?<=[.!?;])\s+/u)
    .map((sentence) => sentence.trim())
    .filter(Boolean);
  const childSentence =
    sentences.find((sentence) =>
      /\b(?:a|as|cada)\s+crian[cç]as?\b/iu.test(sentence),
    ) ?? activity.description.trim();
  const normalizedSentence = normalizeText(childSentence);

  for (const [canonical, pattern] of childActionPatterns) {
    if (pattern.test(normalizedSentence)) {
      return { canonical, evidence: childSentence };
    }
  }

  return undefined;
}

function isExplicitlyNotApplicable(rule: ApplicableRuleInput): boolean {
  const reason = normalizeText(rule.applicabilityReason);

  return /\bnao (?:se aplica|e aplicavel|aplicavel)\b/u.test(reason);
}

function isActionVariationRule(rule: ApplicableRuleInput): boolean {
  if (rule.ruleId === "VAR-001") {
    return true;
  }

  const criterion = normalizeText(rule.validationCriterion);

  return (
    criterion.includes("atividades do lote") &&
    criterion.includes("acao") &&
    /\b(?:diferen|vari|repet)\w*/u.test(criterion)
  );
}

function isCurriculumAlignmentRule(rule: ApplicableRuleInput): boolean {
  if (rule.ruleId === "CUR-001") {
    return true;
  }

  const criterion = normalizeText(rule.validationCriterion);

  return criterion.includes("objetivo") && criterion.includes("curricul");
}

function isObservableChildActionRule(rule: ApplicableRuleInput): boolean {
  if (rule.ruleId === "PED-001") {
    return true;
  }

  const criterion = normalizeText(rule.validationCriterion);

  return criterion.includes("acao da crianca") && criterion.includes("habilidade");
}

function evaluateActionVariation(
  input: ValidationModelInput,
): SemanticEvaluation {
  if (input.relatedActivities.length === 0) {
    return {
      status: "not_applicable",
      explanation: "Não há outra atividade no lote com a qual comparar a ação da criança.",
      confidence: 1,
    };
  }

  const action = extractChildAction(input.activity);

  if (!action) {
    return {
      status: "needs_review",
      explanation: "O mock não conseguiu identificar com segurança a ação principal da criança.",
      confidence: 0.5,
    };
  }

  const repeatedActivity = input.relatedActivities.find(
    (relatedActivity) =>
      extractChildAction(relatedActivity)?.canonical === action.canonical,
  );

  if (repeatedActivity) {
    const relatedAction = extractChildAction(repeatedActivity);

    return {
      status: "failed",
      evidence: `Atividade avaliada: "${action.evidence}" Atividade relacionada: "${relatedAction?.evidence ?? repeatedActivity.description}"`,
      explanation: `A ação principal "${action.canonical}" também aparece em ${repeatedActivity.title}.`,
      confidence: 1,
    };
  }

  return {
    status: "passed",
    evidence: action.evidence,
    explanation: `A ação principal "${action.canonical}" difere das ações identificadas nas atividades relacionadas.`,
    confidence: 0.9,
  };
}

function evaluateCurriculumAlignment(
  input: ValidationModelInput,
): SemanticEvaluation {
  const activityText = normalizeText(
    `${input.activity.title} ${input.activity.description}`,
  );
  const objective = normalizeText(input.curriculum.lesson.specificObjective);
  const content = normalizeText(input.curriculum.lesson.content);

  if (activityText.includes(objective) && activityText.includes(content)) {
    return {
      status: "passed",
      evidence: input.activity.description,
      explanation: "A descrição registra literalmente o objetivo específico e o conteúdo curriculares recebidos.",
      confidence: 0.95,
    };
  }

  return {
    status: "needs_review",
    explanation: "O mock não encontrou correspondência literal suficiente para julgar o alinhamento curricular.",
    confidence: 0.5,
  };
}

function evaluateObservableChildAction(
  input: ValidationModelInput,
): SemanticEvaluation {
  const action = extractChildAction(input.activity);

  if (!action) {
    return {
      status: "needs_review",
      explanation: "O mock não conseguiu identificar com segurança uma ação observável da criança.",
      confidence: 0.5,
    };
  }

  return {
    status: "passed",
    evidence: action.evidence,
    explanation: `A descrição explicita a ação observável "${action.canonical}" realizada pela criança.`,
    confidence: 0.9,
  };
}

function evaluateRule(
  rule: ApplicableRuleInput,
  input: ValidationModelInput,
): ValidationModelResult {
  let evaluation: SemanticEvaluation;

  if (isExplicitlyNotApplicable(rule)) {
    evaluation = {
      status: "not_applicable",
      explanation: rule.applicabilityReason,
      confidence: 1,
    };
  } else if (isActionVariationRule(rule)) {
    evaluation = evaluateActionVariation(input);
  } else if (isCurriculumAlignmentRule(rule)) {
    evaluation = evaluateCurriculumAlignment(input);
  } else if (isObservableChildActionRule(rule)) {
    evaluation = evaluateObservableChildAction(input);
  } else {
    evaluation = {
      status: "needs_review",
      explanation: "O critério exige julgamento semântico além das heurísticas previsíveis do mock.",
      confidence: 0.5,
    };
  }

  return {
    ruleId: rule.ruleId,
    ruleVersion: rule.ruleVersion,
    ...evaluation,
  };
}

export function evaluateSemanticsWithMock(
  input: ValidationModelInput,
): ValidationModelOutput {
  const inputResult = validationModelInputSchema.safeParse(input);

  if (!inputResult.success) {
    throw createSchemaError("input", inputResult.error);
  }

  const parsedInput = inputResult.data;
  const results = parsedInput.applicableRules.map((rule) =>
    evaluateRule(rule, parsedInput),
  );
  const outputResult = validationModelOutputSchema.safeParse({
    results,
    summary: {
      blockingFailures: results.filter((result) => result.status === "failed").length,
      needsHumanReview: results.filter(
        (result) => result.status === "needs_review" || result.status === "not_evaluated",
      ).length,
    },
  });

  if (!outputResult.success) {
    throw createSchemaError("output", outputResult.error);
  }

  return outputResult.data;
}

export const mockSemanticEvaluator: SemanticEvaluator = {
  evaluate: evaluateSemanticsWithMock,
};
