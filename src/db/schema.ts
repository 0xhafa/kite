import { sql } from "drizzle-orm";
import {
  check,
  foreignKey,
  index,
  integer,
  primaryKey,
  real,
  sqliteTable,
  text,
  uniqueIndex,
  type AnySQLiteColumn,
} from "drizzle-orm/sqlite-core";

import type { JsonObject } from "../domain/shared";

export const themes = sqliteTable("themes", {
  id: text("id").primaryKey(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  description: text("description"),
  status: text("status", { enum: ["enabled", "disabled"] }).notNull(),
  curriculumVersion: text("curriculum_version").notNull(),
});

export const skills = sqliteTable(
  "skills",
  {
    id: text("id").primaryKey(),
    themeId: text("theme_id")
      .notNull()
      .references(() => themes.id, { onDelete: "restrict" }),
    name: text("name").notNull(),
    description: text("description"),
    position: integer("position").notNull(),
  },
  (table) => [index("skills_theme_position_idx").on(table.themeId, table.position)],
);

export const objectives = sqliteTable(
  "objectives",
  {
    id: text("id").primaryKey(),
    skillId: text("skill_id")
      .notNull()
      .references(() => skills.id, { onDelete: "restrict" }),
    name: text("name").notNull(),
    priorityStatement: text("priority_statement"),
    position: integer("position").notNull(),
  },
  (table) => [index("objectives_skill_position_idx").on(table.skillId, table.position)],
);

export const weeks = sqliteTable(
  "weeks",
  {
    id: text("id").primaryKey(),
    objectiveId: text("objective_id")
      .notNull()
      .references(() => objectives.id, { onDelete: "restrict" }),
    number: integer("number").notNull(),
    title: text("title").notNull(),
    contentSummary: text("content_summary"),
    position: integer("position").notNull(),
  },
  (table) => [
    index("weeks_objective_position_idx").on(table.objectiveId, table.position),
    uniqueIndex("weeks_objective_number_uq").on(table.objectiveId, table.number),
  ],
);

export const lessons = sqliteTable(
  "lessons",
  {
    id: text("id").primaryKey(),
    weekId: text("week_id")
      .notNull()
      .references(() => weeks.id, { onDelete: "restrict" }),
    number: integer("number").notNull(),
    specificObjective: text("specific_objective").notNull(),
    content: text("content").notNull(),
    defaultDurationMinutes: integer("default_duration_minutes"),
    templateId: text("template_id"),
    position: integer("position").notNull(),
  },
  (table) => [
    index("lessons_week_position_idx").on(table.weekId, table.position),
    uniqueIndex("lessons_week_number_uq").on(table.weekId, table.number),
  ],
);

export const generationBatches = sqliteTable(
  "generation_batches",
  {
    id: text("id").primaryKey(),
    lessonId: text("lesson_id")
      .notNull()
      .references(() => lessons.id, { onDelete: "restrict" }),
    themeId: text("theme_id")
      .notNull()
      .references(() => themes.id, { onDelete: "restrict" }),
    curriculumVersion: text("curriculum_version").notNull(),
    requestedDurationMinutes: integer("requested_duration_minutes").notNull(),
    requestedActivityCount: integer("requested_activity_count").notNull(),
    normalizedParameters: text("normalized_parameters", { mode: "json" })
      .$type<JsonObject>()
      .notNull(),
    status: text("status", {
      enum: ["pending", "generating", "ready_for_review", "completed", "failed"],
    }).notNull(),
    createdAt: text("created_at").notNull(),
    promptVersion: text("prompt_version").notNull(),
    ruleSetVersion: text("rule_set_version").notNull(),
    cacheKey: text("cache_key").notNull(),
    cachedFromBatchId: text("cached_from_batch_id").references(
      (): AnySQLiteColumn => generationBatches.id,
      { onDelete: "restrict" },
    ),
  },
  (table) => [
    index("generation_batches_lesson_idx").on(table.lessonId),
    index("generation_batches_cache_key_idx").on(table.cacheKey),
  ],
);

export const modelRuns = sqliteTable(
  "model_runs",
  {
    id: text("id").primaryKey(),
    batchId: text("batch_id")
      .notNull()
      .references(() => generationBatches.id, { onDelete: "restrict" }),
    activityId: text("activity_id"),
    stage: text("stage", { enum: ["plan", "generate", "validate", "repair"] }).notNull(),
    provider: text("provider").notNull(),
    model: text("model").notNull(),
    reasoningEffort: text("reasoning_effort", {
      enum: ["none", "low", "medium", "high", "xhigh", "max"],
    }),
    status: text("status", { enum: ["completed", "failed", "cancelled"] }).notNull(),
    normalizedInput: text("normalized_input", { mode: "json" }).$type<unknown>().notNull(),
    inputHash: text("input_hash").notNull(),
    promptTemplateId: text("prompt_template_id").notNull(),
    promptVersion: text("prompt_version").notNull(),
    renderedPrompt: text("rendered_prompt").notNull(),
    validatedResponse: text("validated_response", { mode: "json" }).$type<unknown>(),
    ruleSetVersion: text("rule_set_version").notNull(),
    cacheKey: text("cache_key").notNull(),
    reusedFromModelRunId: text("reused_from_model_run_id").references(
      (): AnySQLiteColumn => modelRuns.id,
      { onDelete: "restrict" },
    ),
    rawUsage: text("raw_usage", { mode: "json" }).$type<JsonObject>(),
    inputTokens: integer("input_tokens").notNull(),
    outputTokens: integer("output_tokens").notNull(),
    otherTokens: integer("other_tokens").notNull(),
    totalTokens: integer("total_tokens").notNull(),
    latencyMilliseconds: integer("latency_milliseconds").notNull(),
    error: text("error"),
    createdAt: text("created_at").notNull(),
  },
  (table) => [
    index("model_runs_batch_stage_idx").on(table.batchId, table.stage),
    index("model_runs_activity_idx").on(table.activityId),
    index("model_runs_cache_key_idx").on(table.cacheKey),
    check(
      "model_runs_token_total_check",
      sql`${table.totalTokens} = ${table.inputTokens} + ${table.outputTokens} + ${table.otherTokens}`,
    ),
  ],
);

export const activities = sqliteTable(
  "activities",
  {
    id: text("id").primaryKey(),
    batchId: text("batch_id")
      .notNull()
      .references(() => generationBatches.id, { onDelete: "restrict" }),
    logicalActivityId: text("logical_activity_id").notNull(),
    slotIndex: integer("slot_index").notNull(),
    title: text("title").notNull(),
    description: text("description").notNull(),
    durationMinutes: integer("duration_minutes").notNull(),
    status: text("status", {
      enum: ["draft", "approved", "rejected", "superseded"],
    }).notNull(),
    version: integer("version").notNull(),
    replacesActivityId: text("replaces_activity_id").references(
      (): AnySQLiteColumn => activities.id,
      { onDelete: "restrict" },
    ),
    generationRunId: text("generation_run_id")
      .notNull()
      .references(() => modelRuns.id, { onDelete: "restrict" }),
  },
  (table) => [
    uniqueIndex("activities_logical_version_uq").on(table.logicalActivityId, table.version),
    uniqueIndex("activities_batch_slot_version_uq").on(
      table.batchId,
      table.slotIndex,
      table.version,
    ),
    index("activities_batch_status_idx").on(table.batchId, table.status),
  ],
);

export const sources = sqliteTable("sources", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  authors: text("authors", { mode: "json" }).$type<string[]>().notNull(),
  publicationYear: integer("publication_year"),
  locator: text("locator"),
  verifiedAt: text("verified_at"),
});

export const evidenceClaims = sqliteTable(
  "evidence_claims",
  {
    id: text("id").primaryKey(),
    sourceId: text("source_id")
      .notNull()
      .references(() => sources.id, { onDelete: "restrict" }),
    statement: text("statement").notNull(),
    location: text("location").notNull(),
    verificationStatus: text("verification_status", {
      enum: ["pending", "verified", "rejected"],
    }).notNull(),
  },
  (table) => [index("evidence_claims_source_idx").on(table.sourceId)],
);

export const rules = sqliteTable(
  "rules",
  {
    id: text("id").notNull(),
    version: integer("version").notNull(),
    title: text("title").notNull(),
    description: text("description").notNull(),
    applicabilityCondition: text("applicability_condition").notNull(),
    generationInstruction: text("generation_instruction").notNull(),
    validationCriterion: text("validation_criterion").notNull(),
    severity: text("severity", { enum: ["blocking", "advisory"] }).notNull(),
    origin: text("origin", {
      enum: ["direct", "pedagogical_inference", "editorial"],
    }).notNull(),
    status: text("status", { enum: ["draft", "active", "retired"] }).notNull(),
  },
  (table) => [primaryKey({ columns: [table.id, table.version] })],
);

export const ruleSupports = sqliteTable(
  "rule_supports",
  {
    ruleId: text("rule_id").notNull(),
    ruleVersion: integer("rule_version").notNull(),
    evidenceClaimId: text("evidence_claim_id")
      .notNull()
      .references(() => evidenceClaims.id, { onDelete: "restrict" }),
    supportType: text("support_type", {
      enum: ["direct", "inference", "contextual"],
    }).notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.ruleId, table.ruleVersion, table.evidenceClaimId] }),
    foreignKey({
      columns: [table.ruleId, table.ruleVersion],
      foreignColumns: [rules.id, rules.version],
    }).onDelete("restrict"),
  ],
);

export const validationResults = sqliteTable(
  "validation_results",
  {
    id: text("id").primaryKey(),
    activityId: text("activity_id")
      .notNull()
      .references(() => activities.id, { onDelete: "restrict" }),
    activityVersion: integer("activity_version").notNull(),
    ruleId: text("rule_id").notNull(),
    ruleVersion: integer("rule_version").notNull(),
    applicability: text("applicability", {
      enum: ["applicable", "not_applicable"],
    }).notNull(),
    status: text("status", {
      enum: ["passed", "failed", "needs_review", "not_applicable", "not_evaluated"],
    }).notNull(),
    evidence: text("evidence"),
    explanation: text("explanation").notNull(),
    confidence: real("confidence").notNull(),
    evaluatorOrigin: text("evaluator_origin", { enum: ["model", "human", "system"] }).notNull(),
    evaluatorId: text("evaluator_id").notNull(),
  },
  (table) => [
    uniqueIndex("validation_results_activity_rule_uq").on(
      table.activityId,
      table.activityVersion,
      table.ruleId,
      table.ruleVersion,
    ),
    foreignKey({
      columns: [table.ruleId, table.ruleVersion],
      foreignColumns: [rules.id, rules.version],
    }).onDelete("restrict"),
    check("validation_results_confidence_check", sql`${table.confidence} between 0 and 1`),
  ],
);

export const activityRuleApplications = sqliteTable(
  "activity_rule_applications",
  {
    activityId: text("activity_id")
      .notNull()
      .references(() => activities.id, { onDelete: "restrict" }),
    activityVersion: integer("activity_version").notNull(),
    ruleId: text("rule_id").notNull(),
    ruleVersion: integer("rule_version").notNull(),
    applicability: text("applicability", {
      enum: ["applicable", "not_applicable"],
    }).notNull(),
    applicabilityReason: text("applicability_reason").notNull(),
    validationResultId: text("validation_result_id")
      .notNull()
      .unique()
      .references(() => validationResults.id, { onDelete: "restrict" }),
  },
  (table) => [
    primaryKey({ columns: [table.activityId, table.activityVersion, table.ruleId, table.ruleVersion] }),
    foreignKey({
      columns: [table.ruleId, table.ruleVersion],
      foreignColumns: [rules.id, rules.version],
    }).onDelete("restrict"),
  ],
);

export const reviewDecisions = sqliteTable(
  "review_decisions",
  {
    activityId: text("activity_id")
      .notNull()
      .references(() => activities.id, { onDelete: "restrict" }),
    activityVersion: integer("activity_version").notNull(),
    decision: text("decision", { enum: ["approved", "rejected"] }).notNull(),
    feedback: text("feedback"),
    author: text("author").notNull(),
    createdAt: text("created_at").notNull(),
  },
  (table) => [primaryKey({ columns: [table.activityId, table.activityVersion, table.createdAt] })],
);

export const feedbackProposals = sqliteTable(
  "feedback_proposals",
  {
    id: text("id").primaryKey(),
    reviewActivityId: text("review_activity_id")
      .notNull()
      .references(() => activities.id, { onDelete: "restrict" }),
    normalizedText: text("normalized_text").notNull(),
    suggestedScope: text("suggested_scope", {
      enum: ["regeneration", "session_or_sequence", "rule_candidate"],
    }).notNull(),
    status: text("status", { enum: ["pending", "approved", "rejected"] }).notNull(),
    createdRuleId: text("created_rule_id"),
    createdRuleVersion: integer("created_rule_version"),
  },
  (table) => [
    foreignKey({
      columns: [table.createdRuleId, table.createdRuleVersion],
      foreignColumns: [rules.id, rules.version],
    }).onDelete("restrict"),
  ],
);

export const generationCacheEntries = sqliteTable(
  "generation_cache_entries",
  {
    cacheKey: text("cache_key").primaryKey(),
    themeId: text("theme_id")
      .notNull()
      .references(() => themes.id, { onDelete: "restrict" }),
    lessonId: text("lesson_id")
      .notNull()
      .references(() => lessons.id, { onDelete: "restrict" }),
    curriculumVersion: text("curriculum_version").notNull(),
    normalizedParameters: text("normalized_parameters", { mode: "json" })
      .$type<JsonObject>()
      .notNull(),
    promptVersion: text("prompt_version").notNull(),
    ruleSetVersion: text("rule_set_version").notNull(),
    provider: text("provider").notNull(),
    model: text("model").notNull(),
    modelRunId: text("model_run_id")
      .notNull()
      .references(() => modelRuns.id, { onDelete: "restrict" }),
    createdAt: text("created_at").notNull(),
    lastUsedAt: text("last_used_at").notNull(),
  },
  (table) => [index("generation_cache_entries_lookup_idx").on(table.lessonId, table.themeId)],
);
