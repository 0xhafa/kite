import { and, asc, eq } from "drizzle-orm";

import {
  type ActivityRuleApplication,
  type EvidenceClaim,
  type Rule,
  type RuleSupport,
  type Source,
  type ValidationResult,
  activityRuleApplicationSchema,
  evidenceClaimSchema,
  ruleSchema,
  ruleSupportSchema,
  sourceSchema,
  validationResultSchema,
} from "../../domain/rules";
import {
  type FeedbackProposal,
  type ReviewDecision,
  feedbackProposalSchema,
  reviewDecisionSchema,
} from "../../domain/review";

import type { KiteDatabase } from "../client";
import {
  activities,
  activityRuleApplications,
  evidenceClaims,
  feedbackProposals,
  reviewDecisions,
  ruleSupports,
  rules,
  sources,
  validationResults,
} from "../schema";
import { omitNullValues } from "./mappers";

export class TraceabilityRepository {
  constructor(private readonly db: KiteDatabase) {}

  async saveSource(input: unknown): Promise<Source> {
    const source = sourceSchema.parse(input);
    await this.db.insert(sources).values(source);
    return source;
  }

  async saveEvidenceClaim(input: unknown): Promise<EvidenceClaim> {
    const claim = evidenceClaimSchema.parse(input);
    await this.db.insert(evidenceClaims).values(claim);
    return claim;
  }

  async saveRule(input: unknown): Promise<Rule> {
    const rule = ruleSchema.parse(input);
    await this.db.insert(rules).values(rule);
    return rule;
  }

  async saveRuleSupport(input: unknown): Promise<RuleSupport> {
    const support = ruleSupportSchema.parse(input);
    await this.db.insert(ruleSupports).values(support);
    return support;
  }

  async saveValidation(
    resultInput: unknown,
    applicationInput: unknown,
  ): Promise<{ result: ValidationResult; application: ActivityRuleApplication }> {
    const result = validationResultSchema.parse(resultInput);
    const application = activityRuleApplicationSchema.parse(applicationInput);

    if (
      application.validationResultId !== result.id ||
      application.activityId !== result.activityId ||
      application.activityVersion !== result.activityVersion ||
      application.ruleId !== result.ruleId ||
      application.ruleVersion !== result.ruleVersion ||
      application.applicability !== result.applicability
    ) {
      throw new Error("A aplicação de regra deve corresponder exatamente ao resultado validado.");
    }

    await this.db.transaction(async (transaction) => {
      const [activity] = await transaction
        .select({ version: activities.version })
        .from(activities)
        .where(eq(activities.id, result.activityId))
        .limit(1);
      if (!activity || activity.version !== result.activityVersion) {
        throw new Error("A validação deve referenciar uma versão existente da atividade.");
      }

      await transaction.insert(validationResults).values(result);
      await transaction.insert(activityRuleApplications).values(application);
    });

    return { result, application };
  }

  async listValidationResults(activityId: string, activityVersion: number): Promise<ValidationResult[]> {
    const rows = await this.db
      .select()
      .from(validationResults)
      .where(
        and(
          eq(validationResults.activityId, activityId),
          eq(validationResults.activityVersion, activityVersion),
        ),
      )
      .orderBy(asc(validationResults.ruleId), asc(validationResults.ruleVersion));
    return rows.map((row) => validationResultSchema.parse(omitNullValues(row)));
  }

  async saveReviewDecision(input: unknown): Promise<ReviewDecision> {
    const decision = reviewDecisionSchema.parse(input);

    await this.db.transaction(async (transaction) => {
      const [activity] = await transaction
        .select({ version: activities.version, status: activities.status })
        .from(activities)
        .where(eq(activities.id, decision.activityId))
        .limit(1);

      if (!activity || activity.version !== decision.activityVersion) {
        throw new Error("A decisão deve referenciar uma versão existente da atividade.");
      }
      if (activity.status === "superseded") {
        throw new Error("Uma versão substituída não pode receber nova decisão.");
      }

      await transaction.insert(reviewDecisions).values(decision);
      await transaction
        .update(activities)
        .set({ status: decision.decision })
        .where(eq(activities.id, decision.activityId));
    });

    return decision;
  }

  async saveFeedbackProposal(input: unknown): Promise<FeedbackProposal> {
    const proposal = feedbackProposalSchema.parse(input);
    await this.db.insert(feedbackProposals).values(proposal);
    return proposal;
  }
}
