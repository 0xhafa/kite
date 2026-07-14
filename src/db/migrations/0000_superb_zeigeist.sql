CREATE TABLE `activities` (
	`id` text PRIMARY KEY NOT NULL,
	`batch_id` text NOT NULL,
	`logical_activity_id` text NOT NULL,
	`slot_index` integer NOT NULL,
	`title` text NOT NULL,
	`description` text NOT NULL,
	`duration_minutes` integer NOT NULL,
	`status` text NOT NULL,
	`version` integer NOT NULL,
	`replaces_activity_id` text,
	`generation_run_id` text NOT NULL,
	FOREIGN KEY (`batch_id`) REFERENCES `generation_batches`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`replaces_activity_id`) REFERENCES `activities`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`generation_run_id`) REFERENCES `model_runs`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE UNIQUE INDEX `activities_logical_version_uq` ON `activities` (`logical_activity_id`,`version`);--> statement-breakpoint
CREATE UNIQUE INDEX `activities_batch_slot_version_uq` ON `activities` (`batch_id`,`slot_index`,`version`);--> statement-breakpoint
CREATE INDEX `activities_batch_status_idx` ON `activities` (`batch_id`,`status`);--> statement-breakpoint
CREATE TABLE `activity_rule_applications` (
	`activity_id` text NOT NULL,
	`activity_version` integer NOT NULL,
	`rule_id` text NOT NULL,
	`rule_version` integer NOT NULL,
	`applicability` text NOT NULL,
	`applicability_reason` text NOT NULL,
	`validation_result_id` text NOT NULL,
	PRIMARY KEY(`activity_id`, `activity_version`, `rule_id`, `rule_version`),
	FOREIGN KEY (`activity_id`) REFERENCES `activities`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`validation_result_id`) REFERENCES `validation_results`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`rule_id`,`rule_version`) REFERENCES `rules`(`id`,`version`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE UNIQUE INDEX `activity_rule_applications_validation_result_id_unique` ON `activity_rule_applications` (`validation_result_id`);--> statement-breakpoint
CREATE TABLE `evidence_claims` (
	`id` text PRIMARY KEY NOT NULL,
	`source_id` text NOT NULL,
	`statement` text NOT NULL,
	`location` text NOT NULL,
	`verification_status` text NOT NULL,
	FOREIGN KEY (`source_id`) REFERENCES `sources`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE INDEX `evidence_claims_source_idx` ON `evidence_claims` (`source_id`);--> statement-breakpoint
CREATE TABLE `feedback_proposals` (
	`id` text PRIMARY KEY NOT NULL,
	`review_activity_id` text NOT NULL,
	`normalized_text` text NOT NULL,
	`suggested_scope` text NOT NULL,
	`status` text NOT NULL,
	`created_rule_id` text,
	`created_rule_version` integer,
	FOREIGN KEY (`review_activity_id`) REFERENCES `activities`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`created_rule_id`,`created_rule_version`) REFERENCES `rules`(`id`,`version`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE TABLE `generation_batches` (
	`id` text PRIMARY KEY NOT NULL,
	`lesson_id` text NOT NULL,
	`theme_id` text NOT NULL,
	`curriculum_version` text NOT NULL,
	`requested_duration_minutes` integer NOT NULL,
	`requested_activity_count` integer NOT NULL,
	`normalized_parameters` text NOT NULL,
	`status` text NOT NULL,
	`created_at` text NOT NULL,
	`prompt_version` text NOT NULL,
	`rule_set_version` text NOT NULL,
	`cache_key` text NOT NULL,
	`cached_from_batch_id` text,
	FOREIGN KEY (`lesson_id`) REFERENCES `lessons`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`theme_id`) REFERENCES `themes`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`cached_from_batch_id`) REFERENCES `generation_batches`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE INDEX `generation_batches_lesson_idx` ON `generation_batches` (`lesson_id`);--> statement-breakpoint
CREATE INDEX `generation_batches_cache_key_idx` ON `generation_batches` (`cache_key`);--> statement-breakpoint
CREATE TABLE `generation_cache_entries` (
	`cache_key` text PRIMARY KEY NOT NULL,
	`theme_id` text NOT NULL,
	`lesson_id` text NOT NULL,
	`curriculum_version` text NOT NULL,
	`normalized_parameters` text NOT NULL,
	`prompt_version` text NOT NULL,
	`rule_set_version` text NOT NULL,
	`provider` text NOT NULL,
	`model` text NOT NULL,
	`model_run_id` text NOT NULL,
	`created_at` text NOT NULL,
	`last_used_at` text NOT NULL,
	FOREIGN KEY (`theme_id`) REFERENCES `themes`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`lesson_id`) REFERENCES `lessons`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`model_run_id`) REFERENCES `model_runs`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE INDEX `generation_cache_entries_lookup_idx` ON `generation_cache_entries` (`lesson_id`,`theme_id`);--> statement-breakpoint
CREATE TABLE `lessons` (
	`id` text PRIMARY KEY NOT NULL,
	`week_id` text NOT NULL,
	`number` integer NOT NULL,
	`specific_objective` text NOT NULL,
	`content` text NOT NULL,
	`default_duration_minutes` integer,
	`template_id` text,
	`position` integer NOT NULL,
	FOREIGN KEY (`week_id`) REFERENCES `weeks`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE INDEX `lessons_week_position_idx` ON `lessons` (`week_id`,`position`);--> statement-breakpoint
CREATE UNIQUE INDEX `lessons_week_number_uq` ON `lessons` (`week_id`,`number`);--> statement-breakpoint
CREATE TABLE `model_runs` (
	`id` text PRIMARY KEY NOT NULL,
	`batch_id` text NOT NULL,
	`activity_id` text,
	`stage` text NOT NULL,
	`provider` text NOT NULL,
	`model` text NOT NULL,
	`status` text NOT NULL,
	`normalized_input` text NOT NULL,
	`input_hash` text NOT NULL,
	`prompt_template_id` text NOT NULL,
	`prompt_version` text NOT NULL,
	`rendered_prompt` text NOT NULL,
	`validated_response` text,
	`rule_set_version` text NOT NULL,
	`cache_key` text NOT NULL,
	`reused_from_model_run_id` text,
	`raw_usage` text,
	`input_tokens` integer NOT NULL,
	`output_tokens` integer NOT NULL,
	`other_tokens` integer NOT NULL,
	`total_tokens` integer NOT NULL,
	`latency_milliseconds` integer NOT NULL,
	`error` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`batch_id`) REFERENCES `generation_batches`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`reused_from_model_run_id`) REFERENCES `model_runs`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "model_runs_token_total_check" CHECK("model_runs"."total_tokens" = "model_runs"."input_tokens" + "model_runs"."output_tokens" + "model_runs"."other_tokens")
);
--> statement-breakpoint
CREATE INDEX `model_runs_batch_stage_idx` ON `model_runs` (`batch_id`,`stage`);--> statement-breakpoint
CREATE INDEX `model_runs_activity_idx` ON `model_runs` (`activity_id`);--> statement-breakpoint
CREATE INDEX `model_runs_cache_key_idx` ON `model_runs` (`cache_key`);--> statement-breakpoint
CREATE TABLE `objectives` (
	`id` text PRIMARY KEY NOT NULL,
	`skill_id` text NOT NULL,
	`name` text NOT NULL,
	`priority_statement` text,
	`position` integer NOT NULL,
	FOREIGN KEY (`skill_id`) REFERENCES `skills`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE INDEX `objectives_skill_position_idx` ON `objectives` (`skill_id`,`position`);--> statement-breakpoint
CREATE TABLE `review_decisions` (
	`activity_id` text NOT NULL,
	`activity_version` integer NOT NULL,
	`decision` text NOT NULL,
	`feedback` text,
	`author` text NOT NULL,
	`created_at` text NOT NULL,
	PRIMARY KEY(`activity_id`, `activity_version`, `created_at`),
	FOREIGN KEY (`activity_id`) REFERENCES `activities`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE TABLE `rule_supports` (
	`rule_id` text NOT NULL,
	`rule_version` integer NOT NULL,
	`evidence_claim_id` text NOT NULL,
	`support_type` text NOT NULL,
	PRIMARY KEY(`rule_id`, `rule_version`, `evidence_claim_id`),
	FOREIGN KEY (`evidence_claim_id`) REFERENCES `evidence_claims`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`rule_id`,`rule_version`) REFERENCES `rules`(`id`,`version`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE TABLE `rules` (
	`id` text NOT NULL,
	`version` integer NOT NULL,
	`title` text NOT NULL,
	`description` text NOT NULL,
	`applicability_condition` text NOT NULL,
	`generation_instruction` text NOT NULL,
	`validation_criterion` text NOT NULL,
	`severity` text NOT NULL,
	`origin` text NOT NULL,
	`status` text NOT NULL,
	PRIMARY KEY(`id`, `version`)
);
--> statement-breakpoint
CREATE TABLE `skills` (
	`id` text PRIMARY KEY NOT NULL,
	`theme_id` text NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`position` integer NOT NULL,
	FOREIGN KEY (`theme_id`) REFERENCES `themes`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE INDEX `skills_theme_position_idx` ON `skills` (`theme_id`,`position`);--> statement-breakpoint
CREATE TABLE `sources` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`authors` text NOT NULL,
	`publication_year` integer,
	`locator` text,
	`verified_at` text
);
--> statement-breakpoint
CREATE TABLE `themes` (
	`id` text PRIMARY KEY NOT NULL,
	`slug` text NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`status` text NOT NULL,
	`curriculum_version` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `themes_slug_unique` ON `themes` (`slug`);--> statement-breakpoint
CREATE TABLE `validation_results` (
	`id` text PRIMARY KEY NOT NULL,
	`activity_id` text NOT NULL,
	`activity_version` integer NOT NULL,
	`rule_id` text NOT NULL,
	`rule_version` integer NOT NULL,
	`applicability` text NOT NULL,
	`status` text NOT NULL,
	`evidence` text,
	`explanation` text NOT NULL,
	`confidence` real NOT NULL,
	`evaluator_origin` text NOT NULL,
	`evaluator_id` text NOT NULL,
	FOREIGN KEY (`activity_id`) REFERENCES `activities`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`rule_id`,`rule_version`) REFERENCES `rules`(`id`,`version`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "validation_results_confidence_check" CHECK("validation_results"."confidence" between 0 and 1)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `validation_results_activity_rule_uq` ON `validation_results` (`activity_id`,`activity_version`,`rule_id`,`rule_version`);--> statement-breakpoint
CREATE TABLE `weeks` (
	`id` text PRIMARY KEY NOT NULL,
	`objective_id` text NOT NULL,
	`number` integer NOT NULL,
	`title` text NOT NULL,
	`content_summary` text,
	`position` integer NOT NULL,
	FOREIGN KEY (`objective_id`) REFERENCES `objectives`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE INDEX `weeks_objective_position_idx` ON `weeks` (`objective_id`,`position`);--> statement-breakpoint
CREATE UNIQUE INDEX `weeks_objective_number_uq` ON `weeks` (`objective_id`,`number`);