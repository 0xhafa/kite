import { and, asc, eq, inArray } from "drizzle-orm";

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
    return (await this.saveValidations([{ result: resultInput, application: applicationInput }]))[0]!;
  }

  async saveValidations(
    inputs: readonly { result: unknown; application: unknown }[],
  ): Promise<Array<{ result: ValidationResult; application: ActivityRuleApplication }>> {
    if (inputs.length === 0) return [];

    const parsed = inputs.map(({ result, application }) => ({
      result: validationResultSchema.parse(result),
      application: activityRuleApplicationSchema.parse(application),
    }));

    for (const { result, application } of parsed) {
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
    }

    await this.db.transaction(async (transaction) => {
      const activityIds = [...new Set(parsed.map(({ result }) => result.activityId))];
      const activityRows = await transaction
        .select({ id: activities.id, version: activities.version })
        .from(activities)
        .where(inArray(activities.id, activityIds));
      const versionsByActivity = new Map(
        activityRows.map(({ id, version }) => [id, version]),
      );

      for (const { result } of parsed) {
        if (versionsByActivity.get(result.activityId) !== result.activityVersion) {
          throw new Error("A validação deve referenciar uma versão existente da atividade.");
        }
      }

      await transaction.insert(validationResults).values(parsed.map(({ result }) => result));
      await transaction
        .insert(activityRuleApplications)
        .values(parsed.map(({ application }) => application));
    });

    return parsed;
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

  async listValidationResultsByActivities(
    activityIds: readonly string[],
  ): Promise<ValidationResult[]> {
    if (activityIds.length === 0) return [];

    const rows = await this.db
      .select()
      .from(validationResults)
      .where(inArray(validationResults.activityId, [...activityIds]))
      .orderBy(
        asc(validationResults.activityId),
        asc(validationResults.ruleId),
        asc(validationResults.ruleVersion),
      );
    return rows.map((row) => validationResultSchema.parse(omitNullValues(row)));
  }

  async saveReviewDecision(input: unknown): Promise<ReviewDecision> {
    const decision = reviewDecisionSchema.parse(withoutBlankFeedback(input));

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

  async listReviewDecisions(activityId: string): Promise<ReviewDecision[]> {
    return this.listReviewDecisionsByActivities([activityId]);
  }

  async listReviewDecisionsByActivities(
    activityIds: readonly string[],
  ): Promise<ReviewDecision[]> {
    if (activityIds.length === 0) return [];

    const rows = await this.db
      .select()
      .from(reviewDecisions)
      .where(inArray(reviewDecisions.activityId, [...activityIds]))
      .orderBy(asc(reviewDecisions.activityId), asc(reviewDecisions.createdAt));

    return rows.map((row) => reviewDecisionSchema.parse(omitNullValues(row)));
  }

  async saveFeedbackProposal(input: unknown): Promise<FeedbackProposal> {
    const proposal = feedbackProposalSchema.parse(input);
    await this.db.insert(feedbackProposals).values(proposal);
    return proposal;
  }
}

function withoutBlankFeedback(input: unknown): unknown {
  if (
    typeof input !== "object" ||
    input === null ||
    Array.isArray(input) ||
    !("feedback" in input) ||
    typeof input.feedback !== "string" ||
    input.feedback.trim().length > 0
  ) {
    return input;
  }

  const decision = { ...(input as Record<string, unknown>) };
  delete decision.feedback;
  return decision;
}
