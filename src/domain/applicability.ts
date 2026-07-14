import { z } from "zod";

import { applicableRuleInputSchema, type ApplicableRuleInput } from "./model-contracts";
import {
  ruleApplicabilitySchema,
  ruleApplicabilitySignalSchema,
  type RuleApplicabilitySignal,
} from "./rules";
import {
  catalogRuleSchema,
  loadRuleCatalog,
  selectActiveRules,
  type RuleCatalog,
} from "./rules-catalog";
import { identifierSchema, nonEmptyTextSchema, positiveIntegerSchema } from "./shared";

const mutuallyExclusiveOperationSignals = [
  "full_phonemic_synthesis",
  "initial_sound_or_syllable_analysis",
] as const satisfies readonly RuleApplicabilitySignal[];

const signalDescriptions: Record<RuleApplicabilitySignal, string> = {
  introduces_new_phoneme: "introdução de novo fonema",
  relates_sound_and_letter: "relação entre som e letra",
  produces_phoneme: "produção de fonema",
  uses_words: "uso de palavras",
  uses_images: "uso de imagens",
  full_phonemic_synthesis: "síntese fonêmica completa",
  initial_sound_or_syllable_analysis: "análise somente do som ou da sílaba inicial",
  named_game: "atividade denominada jogo",
  multiple_activities: "lote com mais de uma atividade",
  uses_approved_references: "uso de atividades aprovadas como referência",
  conceptual_closing: "fechamento com sistematização conceitual",
  uses_oral_text: "uso de texto oral, cantiga ou parlenda",
  has_editorial_template: "template editorial configurado",
  uses_review_feedback: "processamento de feedback de revisão",
  validates_rules: "validação de regras",
  deterministic_validation: "etapa de validação determinística",
  deterministic_validation_multiple_activities:
    "etapa de validação determinística de lote com múltiplas atividades",
};

export const activityApplicabilityContextSchema = z
  .object({
    signals: z.array(ruleApplicabilitySignalSchema),
  })
  .strict()
  .superRefine((context, refinementContext) => {
    const uniqueSignals = new Set(context.signals);

    if (uniqueSignals.size !== context.signals.length) {
      refinementContext.addIssue({
        code: "custom",
        message: "O contexto de aplicabilidade não pode repetir sinais.",
        path: ["signals"],
      });
    }

    const selectedExclusiveOperations = mutuallyExclusiveOperationSignals.filter((signal) =>
      uniqueSignals.has(signal),
    );

    if (selectedExclusiveOperations.length > 1) {
      refinementContext.addIssue({
        code: "custom",
        message:
          "Síntese fonêmica completa e análise somente do início são operações mutuamente exclusivas.",
        path: ["signals"],
      });
    }
  });

export const ruleApplicabilityDecisionSchema = z
  .object({
    ruleId: identifierSchema,
    ruleVersion: positiveIntegerSchema,
    applicability: ruleApplicabilitySchema,
    applicabilityReason: nonEmptyTextSchema,
    matchedSignals: z.array(ruleApplicabilitySignalSchema),
  })
  .strict()
  .superRefine((decision, context) => {
    if (decision.applicability === "applicable" || decision.matchedSignals.length === 0) {
      return;
    }

    context.addIssue({
      code: "custom",
      message: "Uma regra não aplicável não pode registrar sinais correspondentes.",
      path: ["matchedSignals"],
    });
  });

/**
 * Decide apenas se uma regra pertence ao contexto. Conformidade é avaliada em
 * uma etapa posterior e nunca é inferida desta decisão.
 */
export function evaluateRuleApplicability(
  ruleInput: unknown,
  contextInput: unknown,
): RuleApplicabilityDecision {
  const rule = catalogRuleSchema.parse(ruleInput);
  const context = activityApplicabilityContextSchema.parse(contextInput);

  if (rule.applicability.mode === "always") {
    return ruleApplicabilityDecisionSchema.parse({
      ruleId: rule.id,
      ruleVersion: rule.version,
      applicability: "applicable",
      applicabilityReason: `A regra ${rule.id} é aplicável a toda atividade.`,
      matchedSignals: [],
    });
  }

  const contextSignals = new Set(context.signals);
  const matchedSignals = rule.applicability.signals.filter((signal) =>
    contextSignals.has(signal),
  );
  const applicability = matchedSignals.length > 0 ? "applicable" : "not_applicable";
  const describedSignals = (matchedSignals.length > 0
    ? matchedSignals
    : rule.applicability.signals
  )
    .map((signal) => signalDescriptions[signal])
    .join(" ou ");
  const applicabilityReason =
    applicability === "applicable"
      ? `A regra ${rule.id} é aplicável porque o contexto informa ${describedSignals}.`
      : `A regra ${rule.id} não é aplicável porque o contexto não informa ${describedSignals}.`;

  return ruleApplicabilityDecisionSchema.parse({
    ruleId: rule.id,
    ruleVersion: rule.version,
    applicability,
    applicabilityReason,
    matchedSignals,
  });
}

/** Avalia todas as regras ativas do catálogo, preservando a ordem canônica. */
export function evaluateRuleCatalogApplicability(
  catalogInput: unknown,
  contextInput: unknown,
): RuleApplicabilityDecision[] {
  const catalog = loadRuleCatalog(catalogInput);
  const context = activityApplicabilityContextSchema.parse(contextInput);

  return selectActiveRules(catalog).map((rule) => evaluateRuleApplicability(rule, context));
}

/** Converte somente decisões aplicáveis para o contrato enviado aos modelos. */
export function selectApplicableRuleInputs(
  catalogInput: unknown,
  contextInput: unknown,
): ApplicableRuleInput[] {
  const catalog = loadRuleCatalog(catalogInput);
  const rulesByKey = indexRules(catalog);

  return evaluateRuleCatalogApplicability(catalog, contextInput)
    .filter((decision) => decision.applicability === "applicable")
    .map((decision) => {
      const rule = rulesByKey.get(ruleKey(decision.ruleId, decision.ruleVersion));

      if (!rule) {
        throw new Error(`Regra ativa ausente do catálogo: ${decision.ruleId}:${decision.ruleVersion}.`);
      }

      return applicableRuleInputSchema.parse({
        ruleId: rule.id,
        ruleVersion: rule.version,
        applicabilityReason: decision.applicabilityReason,
        generationInstruction: rule.generationInstruction,
        validationCriterion: rule.validationCriterion,
      });
    });
}

function indexRules(catalog: RuleCatalog): Map<string, RuleCatalog["rules"][number]> {
  return new Map(
    catalog.rules.map((rule) => [ruleKey(rule.id, rule.version), rule]),
  );
}

function ruleKey(ruleId: string, ruleVersion: number): string {
  return `${ruleId}:${ruleVersion}`;
}

export type ActivityApplicabilityContext = z.infer<typeof activityApplicabilityContextSchema>;
export type RuleApplicabilityDecision = z.infer<typeof ruleApplicabilityDecisionSchema>;
