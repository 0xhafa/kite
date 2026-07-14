import { z } from "zod";

import { activitySchema } from "./generation";
import { validationReportSchema } from "./rules";
import {
  identifierSchema,
  nonEmptyTextSchema,
  positiveIntegerSchema,
  timestampSchema,
} from "./shared";

export const reviewDecisionTypeSchema = z.enum(["approved", "rejected"]);

export const reviewDecisionSchema = z
  .object({
    activityId: identifierSchema,
    activityVersion: positiveIntegerSchema,
    decision: reviewDecisionTypeSchema,
    feedback: nonEmptyTextSchema.optional(),
    author: nonEmptyTextSchema,
    createdAt: timestampSchema,
  })
  .strict();

export const feedbackScopeSchema = z.enum([
  "regeneration",
  "session_or_sequence",
  "rule_candidate",
]);
export const feedbackProposalStatusSchema = z.enum(["pending", "approved", "rejected"]);

export const feedbackProposalSchema = z
  .object({
    id: identifierSchema,
    reviewActivityId: identifierSchema,
    normalizedText: nonEmptyTextSchema,
    suggestedScope: feedbackScopeSchema,
    status: feedbackProposalStatusSchema,
    createdRuleId: identifierSchema.optional(),
    createdRuleVersion: positiveIntegerSchema.optional(),
  })
  .strict()
  .superRefine((proposal, context) => {
    const hasCreatedRule = Boolean(proposal.createdRuleId || proposal.createdRuleVersion);
    const canCreateRule = proposal.suggestedScope === "rule_candidate" && proposal.status === "approved";

    if (hasCreatedRule && !canCreateRule) {
      context.addIssue({
        code: "custom",
        message: "Somente um candidato a regra aprovado pode referenciar uma regra criada.",
        path: ["createdRuleId"],
      });
    }

    if (Boolean(proposal.createdRuleId) !== Boolean(proposal.createdRuleVersion)) {
      context.addIssue({
        code: "custom",
        message: "A regra criada deve informar ID e versão em conjunto.",
        path: ["createdRuleVersion"],
      });
    }
  });

export const activityReviewItemSchema = z
  .object({
    activity: activitySchema,
    validationReport: validationReportSchema,
  })
  .strict()
  .superRefine(({ activity, validationReport }, context) => {
    if (validationReport.activityId !== activity.id) {
      context.addIssue({
        code: "custom",
        message: "O relatório deve pertencer à atividade exibida.",
        path: ["validationReport", "activityId"],
      });
    }

    if (validationReport.activityVersion !== activity.version) {
      context.addIssue({
        code: "custom",
        message: "O relatório deve validar a versão exibida da atividade.",
        path: ["validationReport", "activityVersion"],
      });
    }
  });

export type ReviewDecisionType = z.infer<typeof reviewDecisionTypeSchema>;
export type ReviewDecision = z.infer<typeof reviewDecisionSchema>;
export type FeedbackScope = z.infer<typeof feedbackScopeSchema>;
export type FeedbackProposalStatus = z.infer<typeof feedbackProposalStatusSchema>;
export type FeedbackProposal = z.infer<typeof feedbackProposalSchema>;
export type ActivityReviewItem = z.infer<typeof activityReviewItemSchema>;
