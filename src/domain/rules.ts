import { z } from "zod";

import {
  identifierSchema,
  nonEmptyTextSchema,
  nonNegativeIntegerSchema,
  positiveIntegerSchema,
  timestampSchema,
} from "./shared";

export const sourceSchema = z
  .object({
    id: identifierSchema,
    title: nonEmptyTextSchema,
    authors: z.array(nonEmptyTextSchema).min(1),
    publicationYear: positiveIntegerSchema.optional(),
    locator: nonEmptyTextSchema.optional(),
    verifiedAt: timestampSchema.optional(),
  })
  .strict();

export const evidenceClaimVerificationStatusSchema = z.enum(["pending", "verified", "rejected"]);

export const evidenceClaimSchema = z
  .object({
    id: identifierSchema,
    sourceId: identifierSchema,
    statement: nonEmptyTextSchema,
    location: nonEmptyTextSchema,
    verificationStatus: evidenceClaimVerificationStatusSchema,
  })
  .strict();

export const ruleSeveritySchema = z.enum(["blocking", "advisory"]);
export const ruleOriginSchema = z.enum(["direct", "pedagogical_inference", "editorial"]);
export const ruleStatusSchema = z.enum(["draft", "active", "retired"]);

export const ruleSchema = z
  .object({
    id: identifierSchema,
    version: positiveIntegerSchema,
    title: nonEmptyTextSchema,
    description: nonEmptyTextSchema,
    applicabilityCondition: nonEmptyTextSchema,
    generationInstruction: nonEmptyTextSchema,
    validationCriterion: nonEmptyTextSchema,
    severity: ruleSeveritySchema,
    origin: ruleOriginSchema,
    status: ruleStatusSchema,
  })
  .strict();

export const ruleSupportTypeSchema = z.enum(["direct", "inference", "contextual"]);

export const ruleSupportSchema = z
  .object({
    ruleId: identifierSchema,
    ruleVersion: positiveIntegerSchema,
    evidenceClaimId: identifierSchema,
    supportType: ruleSupportTypeSchema,
  })
  .strict();

export const ruleApplicabilitySchema = z.enum(["applicable", "not_applicable"]);
export const validationStatusSchema = z.enum([
  "passed",
  "failed",
  "needs_review",
  "not_applicable",
  "not_evaluated",
]);
export const evaluatorOriginSchema = z.enum(["model", "human", "system"]);

export const validationResultSchema = z
  .object({
    id: identifierSchema,
    activityId: identifierSchema,
    activityVersion: positiveIntegerSchema,
    ruleId: identifierSchema,
    ruleVersion: positiveIntegerSchema,
    applicability: ruleApplicabilitySchema,
    status: validationStatusSchema,
    evidence: nonEmptyTextSchema.optional(),
    explanation: nonEmptyTextSchema,
    confidence: z.number().min(0).max(1),
    evaluatorOrigin: evaluatorOriginSchema,
    evaluatorId: identifierSchema,
  })
  .strict()
  .superRefine((result, context) => {
    if (result.status === "passed" && !result.evidence) {
      context.addIssue({
        code: "custom",
        message: "Uma regra aprovada precisa registrar evidência.",
        path: ["evidence"],
      });
    }

    if (result.status === "not_applicable" && result.applicability !== "not_applicable") {
      context.addIssue({
        code: "custom",
        message: "O status not_applicable exige aplicabilidade correspondente.",
        path: ["applicability"],
      });
    }

    if (result.applicability === "not_applicable" && result.status !== "not_applicable") {
      context.addIssue({
        code: "custom",
        message: "Uma regra não aplicável deve usar o status not_applicable.",
        path: ["status"],
      });
    }
  });

export const activityRuleApplicationSchema = z
  .object({
    activityId: identifierSchema,
    activityVersion: positiveIntegerSchema,
    ruleId: identifierSchema,
    ruleVersion: positiveIntegerSchema,
    applicability: ruleApplicabilitySchema,
    applicabilityReason: nonEmptyTextSchema,
    validationResultId: identifierSchema,
  })
  .strict();

export const validationSummarySchema = z
  .object({
    blockingFailures: nonNegativeIntegerSchema,
    needsHumanReview: nonNegativeIntegerSchema,
  })
  .strict();

export const validationReportSchema = z
  .object({
    activityId: identifierSchema,
    activityVersion: positiveIntegerSchema,
    results: z.array(validationResultSchema),
    summary: validationSummarySchema,
    createdAt: timestampSchema,
  })
  .strict()
  .superRefine((report, context) => {
    const evaluatedRules = new Set<string>();
    let needsHumanReview = 0;

    report.results.forEach((result, index) => {
      if (result.activityId !== report.activityId) {
        context.addIssue({
          code: "custom",
          message: "O resultado deve pertencer à atividade do relatório.",
          path: ["results", index, "activityId"],
        });
      }

      if (result.activityVersion !== report.activityVersion) {
        context.addIssue({
          code: "custom",
          message: "O resultado deve usar a versão da atividade do relatório.",
          path: ["results", index, "activityVersion"],
        });
      }

      const ruleKey = `${result.ruleId}:${result.ruleVersion}`;
      if (evaluatedRules.has(ruleKey)) {
        context.addIssue({
          code: "custom",
          message: "Cada versão de regra deve aparecer uma única vez no relatório.",
          path: ["results", index, "ruleId"],
        });
      }
      evaluatedRules.add(ruleKey);

      if (result.status === "needs_review" || result.status === "not_evaluated") {
        needsHumanReview += 1;
      }
    });

    if (report.summary.needsHumanReview !== needsHumanReview) {
      context.addIssue({
        code: "custom",
        message: "O resumo deve refletir os resultados que exigem revisão humana.",
        path: ["summary", "needsHumanReview"],
      });
    }
  });

export const validationModelResultSchema = z
  .object({
    ruleId: identifierSchema,
    ruleVersion: positiveIntegerSchema,
    status: validationStatusSchema,
    evidence: nonEmptyTextSchema.optional(),
    explanation: nonEmptyTextSchema,
    confidence: z.number().min(0).max(1),
  })
  .strict()
  .superRefine((result, context) => {
    if (result.status === "passed" && !result.evidence) {
      context.addIssue({
        code: "custom",
        message: "O avaliador não pode aprovar uma regra sem evidência.",
        path: ["evidence"],
      });
    }
  });

export const validationModelOutputSchema = z
  .object({
    results: z.array(validationModelResultSchema),
    summary: validationSummarySchema,
  })
  .strict()
  .superRefine((output, context) => {
    const needsHumanReview = output.results.filter(
      (result) => result.status === "needs_review" || result.status === "not_evaluated",
    ).length;

    if (output.summary.needsHumanReview !== needsHumanReview) {
      context.addIssue({
        code: "custom",
        message: "O resumo do avaliador não corresponde aos resultados.",
        path: ["summary", "needsHumanReview"],
      });
    }
  });

export type Source = z.infer<typeof sourceSchema>;
export type EvidenceClaimVerificationStatus = z.infer<
  typeof evidenceClaimVerificationStatusSchema
>;
export type EvidenceClaim = z.infer<typeof evidenceClaimSchema>;
export type RuleSeverity = z.infer<typeof ruleSeveritySchema>;
export type RuleOrigin = z.infer<typeof ruleOriginSchema>;
export type RuleStatus = z.infer<typeof ruleStatusSchema>;
export type Rule = z.infer<typeof ruleSchema>;
export type RuleSupportType = z.infer<typeof ruleSupportTypeSchema>;
export type RuleSupport = z.infer<typeof ruleSupportSchema>;
export type RuleApplicability = z.infer<typeof ruleApplicabilitySchema>;
export type ValidationStatus = z.infer<typeof validationStatusSchema>;
export type EvaluatorOrigin = z.infer<typeof evaluatorOriginSchema>;
export type ValidationResult = z.infer<typeof validationResultSchema>;
export type ActivityRuleApplication = z.infer<typeof activityRuleApplicationSchema>;
export type ValidationSummary = z.infer<typeof validationSummarySchema>;
export type ValidationReport = z.infer<typeof validationReportSchema>;
export type ValidationModelResult = z.infer<typeof validationModelResultSchema>;
export type ValidationModelOutput = z.infer<typeof validationModelOutputSchema>;
