import { z } from "zod";

import rulesData from "../../data/rules.json";
import {
  evaluateRuleApplicability,
  type RuleApplicabilityDecision,
} from "./applicability";
import { activitySchema } from "./generation";
import {
  type ValidationReport,
  type ValidationResult,
  type RuleApplicabilitySignal,
  validationReportSchema,
  validationResultSchema,
} from "./rules";
import {
  loadRuleCatalog,
  type CatalogRule,
} from "./rules-catalog";
import {
  identifierSchema,
  positiveIntegerSchema,
  timestampSchema,
} from "./shared";

const DETERMINISTIC_EVALUATOR_ID = "deterministic-validator-v1";
const ruleCatalog = loadRuleCatalog(rulesData);
const rulesById = new Map(ruleCatalog.rules.map((rule) => [rule.id, rule]));
const rulesByKey = new Map(
  ruleCatalog.rules.map((rule) => [`${rule.id}:${rule.version}`, rule]),
);

const structuralRules = {
  activitySchema: requireActiveRule("DET-001"),
  requiredContent: requireActiveRule("DET-002"),
  duration: requireActiveRule("TIME-001"),
  quantity: requireActiveRule("DET-003"),
  literalRepetition: requireActiveRule("DET-004"),
} as const;

const activityCandidateSchema = z
  .object({
    id: identifierSchema,
    version: positiveIntegerSchema,
  })
  .passthrough();

const activityGroupCandidateSchema = z
  .object({
    batchId: identifierSchema,
    requestedDurationMinutes: positiveIntegerSchema,
    requestedActivityCount: positiveIntegerSchema,
    activities: z.array(activityCandidateSchema),
  })
  .passthrough()
  .superRefine((group, context) => {
    const identities = new Set<string>();

    group.activities.forEach((activity, index) => {
      const identity = `${activity.id}:${activity.version}`;

      if (identities.has(identity)) {
        context.addIssue({
          code: "custom",
          message: "Cada versão de atividade deve aparecer uma única vez no lote avaliado.",
          path: ["activities", index],
        });
      }

      identities.add(identity);
    });
  });

type ActivityCandidate = z.infer<typeof activityCandidateSchema>;
type ActivityGroupCandidate = z.infer<typeof activityGroupCandidateSchema>;

export type DeterministicValidationOptions = {
  createdAt: string;
};

export type DeterministicBatchBlockingFailure = Pick<
  ValidationResult,
  "ruleId" | "ruleVersion" | "status" | "evidence" | "explanation" | "confidence"
>;

/**
 * Um lote vazio não possui identidade de atividade para um ValidationReport
 * persistível. O chamador deve converter esta falha tipada em estado bloqueado
 * antes da persistência ou exibição do lote.
 */
export class EmptyActivityGroupValidationError extends Error {
  readonly name = "EmptyActivityGroupValidationError";
  readonly blockingFailures = 1;
  readonly failure: DeterministicBatchBlockingFailure;

  constructor(requestedActivityCount: number) {
    super("O lote vazio não pode produzir relatórios de validação por atividade.");
    this.failure = {
      ruleId: structuralRules.quantity.id,
      ruleVersion: structuralRules.quantity.version,
      status: "failed",
      evidence: `Quantidade encontrada: 0; solicitada: ${requestedActivityCount}.`,
      explanation: "O lote não contém nenhuma atividade para validar ou persistir.",
      confidence: 1,
    };
  }
}

/**
 * Avalia apenas regras cujo critério é integralmente estrutural. A entrada
 * mantém `id` e `version` obrigatórios porque todo resultado precisa ser
 * persistível e vinculado à versão exata que foi julgada; os demais campos são
 * avaliados sem um parse antecipado que esconderia falhas por regra.
 *
 * @throws {EmptyActivityGroupValidationError} quando o lote não possui uma
 * atividade à qual vincular o relatório persistível.
 */
export function validateActivityGroupDeterministically(
  input: unknown,
  options: DeterministicValidationOptions,
): ValidationReport[] {
  const group = activityGroupCandidateSchema.parse(input);

  if (group.activities.length === 0) {
    throw new EmptyActivityGroupValidationError(group.requestedActivityCount);
  }

  const createdAt = timestampSchema.parse(options.createdAt);
  const decisions = evaluateStructuralApplicability(group);
  const durationEvaluation = evaluateDuration(group);
  const quantityEvaluation = evaluateQuantity(group);
  const repetitionEvaluation = evaluateLiteralRepetitions(group.activities);

  return [...group.activities]
    .sort(compareCandidates)
    .map((activity) => {
      const results = [
        evaluateActivitySchema(activity, group.batchId, decisions.activitySchema),
        evaluateRequiredContent(activity, decisions.requiredContent),
        createResult(
          activity,
          structuralRules.duration,
          decisions.duration,
          durationEvaluation,
        ),
        createResult(
          activity,
          structuralRules.quantity,
          decisions.quantity,
          quantityEvaluation,
        ),
        evaluateLiteralRepetition(
          activity,
          repetitionEvaluation,
          decisions.literalRepetition,
        ),
      ];

      return validationReportSchema.parse({
        activityId: activity.id,
        activityVersion: activity.version,
        results,
        summary: {
          blockingFailures: results.filter(isBlockingFailure).length,
          needsHumanReview: results.filter(
            (result) => result.status === "needs_review" || result.status === "not_evaluated",
          ).length,
        },
        createdAt,
      });
    });
}

type Evaluation = Pick<
  ValidationResult,
  "status" | "evidence" | "explanation" | "confidence"
>;

type StructuralApplicability = {
  [RuleName in keyof typeof structuralRules]: RuleApplicabilityDecision;
};

function evaluateStructuralApplicability(
  group: ActivityGroupCandidate,
): StructuralApplicability {
  const signals: RuleApplicabilitySignal[] = ["deterministic_validation"];

  if (group.activities.length > 1) {
    signals.push("deterministic_validation_multiple_activities");
  }

  return {
    activitySchema: evaluateRuleApplicability(structuralRules.activitySchema, { signals }),
    requiredContent: evaluateRuleApplicability(structuralRules.requiredContent, { signals }),
    duration: evaluateRuleApplicability(structuralRules.duration, { signals }),
    quantity: evaluateRuleApplicability(structuralRules.quantity, { signals }),
    literalRepetition: evaluateRuleApplicability(structuralRules.literalRepetition, { signals }),
  };
}

function evaluateRequiredContent(
  activity: ActivityCandidate,
  decision: RuleApplicabilityDecision,
): ValidationResult {
  const missingFields = ["title", "description"].filter(
    (field) => typeof activity[field] !== "string" || activity[field].trim().length === 0,
  );

  if (missingFields.length > 0) {
    return createResult(activity, structuralRules.requiredContent, decision, {
      status: "failed",
      evidence: `Campos ausentes ou vazios: ${missingFields.join(", ")}.`,
      explanation: "A atividade não contém todos os campos textuais obrigatórios.",
      confidence: 1,
    });
  }

  return createResult(activity, structuralRules.requiredContent, decision, {
    status: "passed",
    evidence: "Os campos estruturais title e description contêm texto não vazio.",
    explanation: "A presença dos campos textuais obrigatórios foi confirmada estruturalmente.",
    confidence: 1,
  });
}

function evaluateActivitySchema(
  activity: ActivityCandidate,
  expectedBatchId: string,
  decision: RuleApplicabilityDecision,
): ValidationResult {
  const parsedActivity = activitySchema.safeParse(activity);
  const issues = parsedActivity.success
    ? []
    : parsedActivity.error.issues.map((issue) => formatIssue(issue.path, issue.message));

  if (activity.batchId !== expectedBatchId) {
    issues.push(`batchId: deve corresponder ao lote ${expectedBatchId}`);
  }

  if (issues.length > 0) {
    return createResult(activity, structuralRules.activitySchema, decision, {
      status: "failed",
      evidence: `Problemas estruturais: ${issues.join("; ")}.`,
      explanation: "A atividade não atende integralmente ao schema persistível.",
      confidence: 1,
    });
  }

  return createResult(activity, structuralRules.activitySchema, decision, {
    status: "passed",
    evidence: `A atividade ${activity.id}, versão ${activity.version}, foi aceita por activitySchema e pertence ao lote ${expectedBatchId}.`,
    explanation: "O contrato estrutural persistível da atividade foi atendido.",
    confidence: 1,
  });
}

function evaluateDuration(group: ActivityGroupCandidate): Evaluation {
  const invalidDurationActivityIds: string[] = [];
  let totalDurationMinutes = 0;

  group.activities.forEach((activity) => {
    if (!isPositiveInteger(activity.durationMinutes)) {
      invalidDurationActivityIds.push(activity.id);
      return;
    }

    totalDurationMinutes += activity.durationMinutes;
  });

  const durationMatches =
    invalidDurationActivityIds.length === 0 &&
    totalDurationMinutes === group.requestedDurationMinutes;
  const evidence = [
    `Duração somada: ${totalDurationMinutes}; solicitada: ${group.requestedDurationMinutes} minutos.`,
    invalidDurationActivityIds.length > 0
      ? `Atividades sem duração inteira positiva: ${invalidDurationActivityIds.join(", ")}.`
      : "Todas as atividades declaram duração inteira positiva.",
  ].join(" ");

  if (!durationMatches) {
    return {
      status: "failed",
      evidence,
      explanation: "A duração individual ou a soma do lote diverge da configuração.",
      confidence: 1,
    };
  }

  return {
    status: "passed",
    evidence,
    explanation: "As durações individual e total correspondem à configuração.",
    confidence: 1,
  };
}

function evaluateQuantity(group: ActivityGroupCandidate): Evaluation {
  const actualActivityCount = group.activities.length;
  const evidence =
    `Quantidade encontrada: ${actualActivityCount}; ` +
    `solicitada: ${group.requestedActivityCount}.`;

  if (actualActivityCount !== group.requestedActivityCount) {
    return {
      status: "failed",
      evidence,
      explanation: "A quantidade de atividades diverge da configuração do lote.",
      confidence: 1,
    };
  }

  return {
    status: "passed",
    evidence,
    explanation: "A quantidade de atividades corresponde à configuração do lote.",
    confidence: 1,
  };
}

type RepetitionEvaluation = {
  comparableActivityIds: Set<string>;
  duplicatedActivityIds: Set<string>;
};

function evaluateLiteralRepetitions(
  activities: readonly ActivityCandidate[],
): RepetitionEvaluation {
  const comparableActivityIds = new Set<string>();
  const duplicatedActivityIds = new Set<string>();
  const activitiesByLiteralValue = new Map<string, string[]>();

  activities.forEach((activity) => {
    const title = normalizedText(activity.title);
    const description = normalizedText(activity.description);

    if (!title || !description) {
      return;
    }

    comparableActivityIds.add(activity.id);

    for (const value of [`title:${title}`, `description:${description}`]) {
      const matchingActivityIds = activitiesByLiteralValue.get(value) ?? [];
      matchingActivityIds.push(activity.id);
      activitiesByLiteralValue.set(value, matchingActivityIds);
    }
  });

  activitiesByLiteralValue.forEach((activityIds) => {
    if (activityIds.length > 1) {
      activityIds.forEach((activityId) => duplicatedActivityIds.add(activityId));
    }
  });

  return { comparableActivityIds, duplicatedActivityIds };
}

function evaluateLiteralRepetition(
  activity: ActivityCandidate,
  evaluation: RepetitionEvaluation,
  decision: RuleApplicabilityDecision,
): ValidationResult {
  if (!evaluation.comparableActivityIds.has(activity.id)) {
    return createResult(activity, structuralRules.literalRepetition, decision, {
      status: "not_evaluated",
      evidence: "Título ou descrição ausente impediu a comparação literal.",
      explanation: "A repetição só pode ser verificada depois de preencher os campos textuais.",
      confidence: 1,
    });
  }

  if (evaluation.duplicatedActivityIds.has(activity.id)) {
    return createResult(activity, structuralRules.literalRepetition, decision, {
      status: "failed",
      evidence: "O título ou a descrição normalizados se repetem literalmente em outra atividade do lote.",
      explanation: "Foi detectada uma duplicação literal simples no lote.",
      confidence: 1,
    });
  }

  return createResult(activity, structuralRules.literalRepetition, decision, {
    status: "passed",
    evidence: "Título e descrição normalizados são únicos entre as atividades comparáveis do lote.",
    explanation: "Nenhuma duplicação literal simples foi encontrada para esta atividade.",
    confidence: 1,
  });
}

function createResult(
  activity: ActivityCandidate,
  rule: CatalogRule,
  decision: RuleApplicabilityDecision,
  evaluation: Evaluation,
): ValidationResult {
  const applicabilityEvaluation =
    decision.applicability === "not_applicable"
      ? {
          applicability: "not_applicable" as const,
          status: "not_applicable" as const,
          explanation: decision.applicabilityReason,
          confidence: 1,
        }
      : {
          applicability: "applicable" as const,
          ...evaluation,
        };

  return validationResultSchema.parse({
    id: deterministicResultId(activity.id, activity.version, rule.id, rule.version),
    activityId: activity.id,
    activityVersion: activity.version,
    ruleId: rule.id,
    ruleVersion: rule.version,
    ...applicabilityEvaluation,
    evaluatorOrigin: "system",
    evaluatorId: DETERMINISTIC_EVALUATOR_ID,
  });
}

function isBlockingFailure(result: ValidationResult): boolean {
  const rule = rulesByKey.get(`${result.ruleId}:${result.ruleVersion}`);
  return result.status === "failed" && rule?.severity === "blocking";
}

function requireActiveRule(ruleId: string): CatalogRule {
  const rule = rulesById.get(ruleId);

  if (!rule || rule.status !== "active") {
    throw new Error(`Regra estrutural ativa ausente do catálogo: ${ruleId}.`);
  }

  return rule;
}

function compareCandidates(first: ActivityCandidate, second: ActivityCandidate): number {
  const firstSlot = isNonNegativeInteger(first.slotIndex)
    ? first.slotIndex
    : Number.MAX_SAFE_INTEGER;
  const secondSlot = isNonNegativeInteger(second.slotIndex)
    ? second.slotIndex
    : Number.MAX_SAFE_INTEGER;

  return (
    firstSlot - secondSlot ||
    first.id.localeCompare(second.id, "pt-BR") ||
    first.version - second.version
  );
}

function formatIssue(path: PropertyKey[], message: string): string {
  const formattedPath = path.length > 0 ? path.map(String).join(".") : "atividade";
  return `${formattedPath}: ${message}`;
}

function normalizedText(value: unknown): string | undefined {
  if (typeof value !== "string" || value.trim().length === 0) {
    return undefined;
  }

  return value.trim().replace(/\s+/g, " ").toLocaleLowerCase("pt-BR");
}

function isPositiveInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value > 0;
}

function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0;
}

function deterministicResultId(
  activityId: string,
  activityVersion: number,
  ruleId: string,
  ruleVersion: number,
): string {
  const identity = `${activityId}:${activityVersion}:${ruleId}:${ruleVersion}`;
  const forwardHash = stableHash(identity);
  const reverseHash = stableHash([...identity].reverse().join(""));
  return `det-validation-${ruleId.toLocaleLowerCase("pt-BR")}-${forwardHash}${reverseHash}`;
}

function stableHash(value: string): string {
  let hash = 2_166_136_261;

  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16_777_619);
  }

  return (hash >>> 0).toString(36);
}
