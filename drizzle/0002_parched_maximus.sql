CREATE TABLE `audit_events` (
	`id` text PRIMARY KEY NOT NULL,
	`draft_id` text,
	`clan_id` text,
	`actor_user_id` text,
	`actor_type` text NOT NULL,
	`actor_reference` text,
	`event_type` text NOT NULL,
	`metadata_json` text,
	`request_id` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`draft_id`) REFERENCES `drafts`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`clan_id`) REFERENCES `clans`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`actor_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `idx_audit_events_draft_id` ON `audit_events` (`draft_id`);--> statement-breakpoint
CREATE INDEX `idx_audit_events_clan_id` ON `audit_events` (`clan_id`);--> statement-breakpoint
CREATE INDEX `idx_audit_events_created_at` ON `audit_events` (`created_at`);--> statement-breakpoint
CREATE TABLE `clan_memberships` (
	`clan_id` text NOT NULL,
	`user_id` text NOT NULL,
	`role` text DEFAULT 'member' NOT NULL,
	`created_at` text NOT NULL,
	PRIMARY KEY(`clan_id`, `user_id`),
	FOREIGN KEY (`clan_id`) REFERENCES `clans`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_clan_memberships_user_id` ON `clan_memberships` (`user_id`);--> statement-breakpoint
CREATE TABLE `clans` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`slug` text NOT NULL,
	`created_by_user_id` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`created_by_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `clans_slug_unique` ON `clans` (`slug`);--> statement-breakpoint
CREATE TABLE `draft_access_tokens` (
	`id` text PRIMARY KEY NOT NULL,
	`draft_id` text NOT NULL,
	`token_hash` text NOT NULL,
	`purpose` text DEFAULT 'manage' NOT NULL,
	`created_by_user_id` text,
	`expires_at` text,
	`revoked_at` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`draft_id`) REFERENCES `drafts`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`created_by_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `draft_access_tokens_hash_unique` ON `draft_access_tokens` (`token_hash`);--> statement-breakpoint
CREATE INDEX `idx_draft_access_tokens_draft_id` ON `draft_access_tokens` (`draft_id`);--> statement-breakpoint
CREATE TABLE `draft_runs` (
	`id` text PRIMARY KEY NOT NULL,
	`draft_id` text NOT NULL,
	`run_number` integer NOT NULL,
	`source` text DEFAULT 'generated' NOT NULL,
	`seed` text NOT NULL,
	`configuration_json` text NOT NULL,
	`result_json` text NOT NULL,
	`fairness_json` text NOT NULL,
	`created_by_user_id` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`draft_id`) REFERENCES `drafts`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`created_by_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `draft_runs_draft_number_unique` ON `draft_runs` (`draft_id`,`run_number`);--> statement-breakpoint
CREATE INDEX `idx_draft_runs_draft_id` ON `draft_runs` (`draft_id`);--> statement-breakpoint
CREATE TABLE `event_templates` (
	`id` text PRIMARY KEY NOT NULL,
	`clan_id` text NOT NULL,
	`name` text NOT NULL,
	`configuration_json` text NOT NULL,
	`created_by_user_id` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`clan_id`) REFERENCES `clans`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`created_by_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_event_templates_clan_id` ON `event_templates` (`clan_id`);--> statement-breakpoint
CREATE TABLE `live_turn_actions` (
	`id` text PRIMARY KEY NOT NULL,
	`draft_id` text NOT NULL,
	`captain_id` text NOT NULL,
	`turn_number` integer NOT NULL,
	`action` text NOT NULL,
	`player_ids_json` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`draft_id`) REFERENCES `drafts`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`captain_id`) REFERENCES `captains`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `live_turn_actions_draft_turn_unique` ON `live_turn_actions` (`draft_id`,`turn_number`);--> statement-breakpoint
CREATE INDEX `idx_live_turn_actions_draft_id` ON `live_turn_actions` (`draft_id`);--> statement-breakpoint
CREATE TABLE `oauth_states` (
	`id` text PRIMARY KEY NOT NULL,
	`state_hash` text NOT NULL,
	`verifier` text NOT NULL,
	`return_to` text DEFAULT '/dashboard' NOT NULL,
	`expires_at` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `oauth_states_state_hash_unique` ON `oauth_states` (`state_hash`);--> statement-breakpoint
CREATE INDEX `idx_oauth_states_expires_at` ON `oauth_states` (`expires_at`);--> statement-breakpoint
CREATE TABLE `player_insight_cache` (
	`normalized_name` text PRIMARY KEY NOT NULL,
	`display_name` text NOT NULL,
	`payload_json` text NOT NULL,
	`fetched_at` text NOT NULL,
	`expires_at` text NOT NULL,
	`stale_at` text NOT NULL,
	`failure_count` integer DEFAULT 0 NOT NULL,
	`last_error` text
);
--> statement-breakpoint
CREATE INDEX `idx_player_insight_cache_expires_at` ON `player_insight_cache` (`expires_at`);--> statement-breakpoint
CREATE TABLE `ranking_revisions` (
	`id` text PRIMARY KEY NOT NULL,
	`captain_id` text NOT NULL,
	`revision` integer NOT NULL,
	`rankings_json` text NOT NULL,
	`submitted_at` text NOT NULL,
	FOREIGN KEY (`captain_id`) REFERENCES `captains`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `ranking_revisions_captain_revision_unique` ON `ranking_revisions` (`captain_id`,`revision`);--> statement-breakpoint
CREATE INDEX `idx_ranking_revisions_captain_id` ON `ranking_revisions` (`captain_id`);--> statement-breakpoint
CREATE TABLE `rate_limits` (
	`key` text PRIMARY KEY NOT NULL,
	`count` integer DEFAULT 0 NOT NULL,
	`window_started_at` text NOT NULL,
	`expires_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_rate_limits_expires_at` ON `rate_limits` (`expires_at`);--> statement-breakpoint
CREATE TABLE `sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`token_hash` text NOT NULL,
	`expires_at` text NOT NULL,
	`created_at` text NOT NULL,
	`last_seen_at` text NOT NULL,
	`revoked_at` text,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `sessions_token_hash_unique` ON `sessions` (`token_hash`);--> statement-breakpoint
CREATE INDEX `idx_sessions_user_id` ON `sessions` (`user_id`);--> statement-breakpoint
CREATE INDEX `idx_sessions_expires_at` ON `sessions` (`expires_at`);--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`discord_id` text,
	`email` text,
	`username` text NOT NULL,
	`display_name` text,
	`avatar_hash` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_discord_id_unique` ON `users` (`discord_id`);--> statement-breakpoint
CREATE TABLE `webhook_deliveries` (
	`id` text PRIMARY KEY NOT NULL,
	`integration_id` text NOT NULL,
	`event_type` text NOT NULL,
	`payload_json` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`attempts` integer DEFAULT 0 NOT NULL,
	`response_code` integer,
	`last_error` text,
	`created_at` text NOT NULL,
	`delivered_at` text,
	FOREIGN KEY (`integration_id`) REFERENCES `webhook_integrations`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_webhook_deliveries_integration_id` ON `webhook_deliveries` (`integration_id`);--> statement-breakpoint
CREATE INDEX `idx_webhook_deliveries_status` ON `webhook_deliveries` (`status`);--> statement-breakpoint
CREATE TABLE `webhook_integrations` (
	`id` text PRIMARY KEY NOT NULL,
	`draft_id` text,
	`clan_id` text,
	`kind` text DEFAULT 'discord' NOT NULL,
	`encrypted_url` text NOT NULL,
	`enabled_events_json` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`draft_id`) REFERENCES `drafts`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`clan_id`) REFERENCES `clans`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_webhook_integrations_draft_id` ON `webhook_integrations` (`draft_id`);--> statement-breakpoint
CREATE INDEX `idx_webhook_integrations_clan_id` ON `webhook_integrations` (`clan_id`);--> statement-breakpoint
ALTER TABLE `drafts` ADD `admin_token_hash` text;--> statement-breakpoint
ALTER TABLE `drafts` ADD `public_slug` text;--> statement-breakpoint
ALTER TABLE `drafts` ADD `clan_id` text REFERENCES `clans`(`id`) ON DELETE set null;--> statement-breakpoint
ALTER TABLE `drafts` ADD `owner_user_id` text REFERENCES `users`(`id`) ON DELETE set null;--> statement-breakpoint
ALTER TABLE `drafts` ADD `signup_token_hash` text;--> statement-breakpoint
ALTER TABLE `drafts` ADD `registration_capacity` integer DEFAULT 120 NOT NULL;--> statement-breakpoint
ALTER TABLE `drafts` ADD `signup_approval_mode` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `drafts` ADD `registration_deadline` text;--> statement-breakpoint
ALTER TABLE `drafts` ADD `ranking_deadline` text;--> statement-breakpoint
ALTER TABLE `drafts` ADD `answers_visibility` text DEFAULT 'captains' NOT NULL;--> statement-breakpoint
ALTER TABLE `drafts` ADD `balance_preset` text DEFAULT 'consensus' NOT NULL;--> statement-breakpoint
ALTER TABLE `drafts` ADD `balance_weights_json` text;--> statement-breakpoint
ALTER TABLE `drafts` ADD `live_order` text DEFAULT 'snake' NOT NULL;--> statement-breakpoint
ALTER TABLE `drafts` ADD `live_pick_seconds` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `drafts` ADD `live_auto_pick` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `drafts` ADD `live_paused_at` text;--> statement-breakpoint
ALTER TABLE `drafts` ADD `live_turn_started_at` text;--> statement-breakpoint
ALTER TABLE `drafts` ADD `live_revision` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `drafts` ADD `archived_at` text;--> statement-breakpoint
CREATE UNIQUE INDEX `drafts_admin_token_hash_unique` ON `drafts` (`admin_token_hash`);--> statement-breakpoint
CREATE UNIQUE INDEX `drafts_signup_token_hash_unique` ON `drafts` (`signup_token_hash`);--> statement-breakpoint
CREATE UNIQUE INDEX `drafts_public_slug_unique` ON `drafts` (`public_slug`);--> statement-breakpoint
CREATE INDEX `idx_drafts_clan_id` ON `drafts` (`clan_id`);--> statement-breakpoint
CREATE INDEX `idx_drafts_owner_user_id` ON `drafts` (`owner_user_id`);--> statement-breakpoint
CREATE INDEX `idx_drafts_status` ON `drafts` (`status`);--> statement-breakpoint
ALTER TABLE `captains` ADD `token_hash` text;--> statement-breakpoint
ALTER TABLE `captains` ADD `ranking_revision` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `captains` ADD `rankings_frozen_at` text;--> statement-breakpoint
CREATE UNIQUE INDEX `captains_token_hash_unique` ON `captains` (`token_hash`);--> statement-breakpoint
ALTER TABLE `draft_constraints` ADD `enforcement` text DEFAULT 'hard' NOT NULL;--> statement-breakpoint
ALTER TABLE `draft_constraints` ADD `penalty` integer DEFAULT 100 NOT NULL;--> statement-breakpoint
ALTER TABLE `players` ADD `normalized_name` text;--> statement-breakpoint
ALTER TABLE `players` ADD `signup_status` text DEFAULT 'approved' NOT NULL;--> statement-breakpoint
ALTER TABLE `players` ADD `participant_token_hash` text;--> statement-breakpoint
ALTER TABLE `players` ADD `updated_at` text;--> statement-breakpoint
ALTER TABLE `players` ADD `withdrawn_at` text;--> statement-breakpoint
CREATE UNIQUE INDEX `players_participant_token_hash_unique` ON `players` (`participant_token_hash`);--> statement-breakpoint
CREATE UNIQUE INDEX `players_draft_normalized_unique` ON `players` (`draft_id`,`normalized_name`);--> statement-breakpoint
ALTER TABLE `survey_questions` ADD `visibility` text DEFAULT 'captains' NOT NULL;--> statement-breakpoint
ALTER TABLE `survey_questions` ADD `balance_metric` text;--> statement-breakpoint
ALTER TABLE `survey_questions` ADD `balance_weight` integer DEFAULT 0 NOT NULL;
