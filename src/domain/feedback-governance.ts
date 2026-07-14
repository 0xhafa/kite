import { z } from "zod";

import {
  type FeedbackProposal,
  feedbackProposalSchema,
  feedbackScopeSchema,
} from "./review";
import {
  ruleApplicabilityDefinitionSchema,
  ruleOriginSchema,
  ruleSeveritySchema,
} from "./rules";
import {
  catalogRuleSchema,
  ruleCatalogSchema,
  type CatalogRule,
  type RuleCatalog,
} from "./rules-catalog";
import { identifierSchema, nonEmptyTextSchema } from "./shared";

export const feedbackScopeDefinitionSchema = z
  .object({
    id: identifierSchema,
    reviewActivityId: identifierSchema,
    normalizedText: nonEmptyTextSchema,
    scope: feedbackScopeSchema,
  })
  .strict();

export const feedbackRuleDraftSchema = z
  .object({
    id: identifierSchema,
    title: nonEmptyTextSchema,
    applicabilityCondition: nonEmptyTextSchema,
    applicability: ruleApplicabilityDefinitionSchema,
    generationInstruction: nonEmptyTextSchema,
    validationCriterion: nonEmptyTextSchema,
    severity: ruleSeveritySchema,
    origin: ruleOriginSchema,
  })
  .strict();

export const feedbackRulePromotionSchema = z
  .object({
    proposal: feedbackProposalSchema,
    rule: feedbackRuleDraftSchema,
    catalog: ruleCatalogSchema,
    confirmed: z.literal(true),
    confirmedBy: nonEmptyTextSchema,
  })
  .strict()
  .superRefine(({ proposal, catalog, rule }, context) => {
    if (proposal.suggestedScope !== "rule_candidate") {
      context.addIssue({
        code: "custom",
        message: "Somente feedback definido como candidato pode ser promovido a regra.",
        path: ["proposal", "suggestedScope"],
      });
    }

    if (proposal.status !== "approved") {
      context.addIssue({
        code: "custom",
        message: "A promoção exige que o candidato tenha sido aprovado.",
        path: ["proposal", "status"],
      });
    }

    if (proposal.createdRuleId || proposal.createdRuleVersion) {
      context.addIssue({
        code: "custom",
        message: "Um feedback já promovido não pode criar outra regra.",
        path: ["proposal", "createdRuleId"],
      });
    }

    if (catalog.rules.some((catalogRule) => catalogRule.id === rule.id)) {
      context.addIssue({
        code: "custom",
        message: "A regra promovida deve possuir um ID ainda não usado no catálogo.",
        path: ["rule", "id"],
      });
    }
  });

export type FeedbackScopeDefinition = z.infer<typeof feedbackScopeDefinitionSchema>;
export type FeedbackRuleDraft = z.infer<typeof feedbackRuleDraftSchema>;
export type FeedbackRulePromotion = z.infer<typeof feedbackRulePromotionSchema>;

export type FeedbackRulePromotionResult = {
  rule: CatalogRule;
  proposal: FeedbackProposal;
  catalog: RuleCatalog;
  confirmedBy: string;
};

/**
 * Registra o escopo escolhido sem inferir aprovação ou criar uma regra.
 */
export function defineFeedbackScope(input: unknown): FeedbackProposal {
  const definition = feedbackScopeDefinitionSchema.parse(input);

  return feedbackProposalSchema.parse({
    id: definition.id,
    reviewActivityId: definition.reviewActivityId,
    normalizedText: definition.normalizedText,
    suggestedScope: definition.scope,
    status: "pending",
  });
}

/**
 * Promove somente um candidato aprovado e confirmado, criando uma nova versão
 * imutável do catálogo e preservando a referência da proposta à regra criada.
 */
export function promoteFeedbackToRule(input: unknown): FeedbackRulePromotionResult {
  const promotion = feedbackRulePromotionSchema.parse(input);
  const rule = catalogRuleSchema.parse({
    ...promotion.rule,
    version: 1,
    description: promotion.proposal.normalizedText,
    status: "active",
  });
  const proposal = feedbackProposalSchema.parse({
    ...promotion.proposal,
    createdRuleId: rule.id,
    createdRuleVersion: rule.version,
  });
  const catalog = ruleCatalogSchema.parse({
    version: promotion.catalog.version + 1,
    rules: [...promotion.catalog.rules, rule],
  });

  return {
    rule,
    proposal,
    catalog,
    confirmedBy: promotion.confirmedBy,
  };
}
