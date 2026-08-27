CREATE TABLE `bingo_activity` (
	`id` text PRIMARY KEY NOT NULL,
	`event_id` text NOT NULL,
	`team_id` text,
	`task_id` text,
	`activity_type` text NOT NULL,
	`message` text NOT NULL,
	`metadata_json` text,
	`visible_at` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`event_id`) REFERENCES `bingo_events`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`team_id`) REFERENCES `bingo_teams`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`task_id`) REFERENCES `bingo_tasks`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `idx_bingo_activity_event_visible` ON `bingo_activity` (`event_id`,`visible_at`);--> statement-breakpoint
CREATE TABLE `bingo_claims` (
	`id` text PRIMARY KEY NOT NULL,
	`event_id` text NOT NULL,
	`task_id` text NOT NULL,
	`team_id` text NOT NULL,
	`member_id` text,
	`claimed_by_name` text NOT NULL,
	`note` text DEFAULT '' NOT NULL,
	`evidence_url` text,
	`evidence_upload_id` text,
	`status` text DEFAULT 'pending' NOT NULL,
	`review_note` text,
	`score_awarded` integer DEFAULT 0 NOT NULL,
	`submitted_at` text NOT NULL,
	`reviewed_at` text,
	`approved_at` text,
	FOREIGN KEY (`event_id`) REFERENCES `bingo_events`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`task_id`) REFERENCES `bingo_tasks`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`team_id`) REFERENCES `bingo_teams`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`member_id`) REFERENCES `bingo_team_members`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`evidence_upload_id`) REFERENCES `bingo_evidence_uploads`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `idx_bingo_claims_event_status` ON `bingo_claims` (`event_id`,`status`);--> statement-breakpoint
CREATE INDEX `idx_bingo_claims_task_team` ON `bingo_claims` (`task_id`,`team_id`);--> statement-breakpoint
CREATE INDEX `idx_bingo_claims_submitted_at` ON `bingo_claims` (`submitted_at`);--> statement-breakpoint
CREATE TABLE `bingo_completions` (
	`id` text PRIMARY KEY NOT NULL,
	`event_id` text NOT NULL,
	`task_id` text NOT NULL,
	`team_id` text NOT NULL,
	`claim_id` text NOT NULL,
	`completion_number` integer DEFAULT 1 NOT NULL,
	`global_lock_key` text,
	`points` integer NOT NULL,
	`completed_at` text NOT NULL,
	FOREIGN KEY (`event_id`) REFERENCES `bingo_events`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`task_id`) REFERENCES `bingo_tasks`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`team_id`) REFERENCES `bingo_teams`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`claim_id`) REFERENCES `bingo_claims`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `bingo_completions_claim_unique` ON `bingo_completions` (`claim_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `bingo_completions_team_number_unique` ON `bingo_completions` (`task_id`,`team_id`,`completion_number`);--> statement-breakpoint
CREATE UNIQUE INDEX `bingo_completions_global_lock_unique` ON `bingo_completions` (`global_lock_key`);--> statement-breakpoint
CREATE INDEX `idx_bingo_completions_event_id` ON `bingo_completions` (`event_id`);--> statement-breakpoint
CREATE INDEX `idx_bingo_completions_team_id` ON `bingo_completions` (`team_id`);--> statement-breakpoint
CREATE TABLE `bingo_events` (
	`id` text PRIMARY KEY NOT NULL,
	`draft_id` text NOT NULL,
	`title` text NOT NULL,
	`public_slug` text NOT NULL,
	`mode` text DEFAULT 'points' NOT NULL,
	`board_scope` text DEFAULT 'shared' NOT NULL,
	`grid_size` integer DEFAULT 5 NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`win_condition` text DEFAULT 'points' NOT NULL,
	`target_value` integer DEFAULT 0 NOT NULL,
	`requires_review` integer DEFAULT true NOT NULL,
	`public_spectator` integer DEFAULT true NOT NULL,
	`spectator_delay_seconds` integer DEFAULT 0 NOT NULL,
	`start_at` text,
	`end_at` text,
	`started_at` text,
	`ended_at` text,
	`baseline_status` text DEFAULT 'idle' NOT NULL,
	`revision` integer DEFAULT 0 NOT NULL,
	`rules_json` text,
	`created_by_user_id` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`draft_id`) REFERENCES `drafts`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`created_by_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `bingo_events_public_slug_unique` ON `bingo_events` (`public_slug`);--> statement-breakpoint
CREATE INDEX `idx_bingo_events_draft_id` ON `bingo_events` (`draft_id`);--> statement-breakpoint
CREATE INDEX `idx_bingo_events_status` ON `bingo_events` (`status`);--> statement-breakpoint
CREATE TABLE `bingo_evidence_uploads` (
	`id` text PRIMARY KEY NOT NULL,
	`event_id` text NOT NULL,
	`team_id` text NOT NULL,
	`object_key` text NOT NULL,
	`filename` text NOT NULL,
	`content_type` text NOT NULL,
	`size_bytes` integer NOT NULL,
	`created_at` text NOT NULL,
	`consumed_at` text,
	FOREIGN KEY (`event_id`) REFERENCES `bingo_events`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`team_id`) REFERENCES `bingo_teams`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `bingo_evidence_object_key_unique` ON `bingo_evidence_uploads` (`object_key`);--> statement-breakpoint
CREATE INDEX `idx_bingo_evidence_event_team` ON `bingo_evidence_uploads` (`event_id`,`team_id`);--> statement-breakpoint
CREATE TABLE `bingo_player_snapshots` (
	`id` text PRIMARY KEY NOT NULL,
	`event_id` text NOT NULL,
	`member_id` text NOT NULL,
	`phase` text NOT NULL,
	`source_state` text NOT NULL,
	`payload_json` text NOT NULL,
	`captured_at` text NOT NULL,
	FOREIGN KEY (`event_id`) REFERENCES `bingo_events`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`member_id`) REFERENCES `bingo_team_members`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `bingo_snapshots_member_phase_unique` ON `bingo_player_snapshots` (`member_id`,`phase`);--> statement-breakpoint
CREATE INDEX `idx_bingo_snapshots_event_phase` ON `bingo_player_snapshots` (`event_id`,`phase`);--> statement-breakpoint
CREATE TABLE `bingo_tasks` (
	`id` text PRIMARY KEY NOT NULL,
	`event_id` text NOT NULL,
	`title` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`points` integer DEFAULT 0 NOT NULL,
	`category` text DEFAULT 'General' NOT NULL,
	`difficulty` text DEFAULT 'medium' NOT NULL,
	`verification_mode` text DEFAULT 'manual' NOT NULL,
	`repeatable` integer DEFAULT false NOT NULL,
	`max_completions` integer DEFAULT 1 NOT NULL,
	`hidden` integer DEFAULT false NOT NULL,
	`free_space` integer DEFAULT false NOT NULL,
	`icon_key` text DEFAULT 'scroll' NOT NULL,
	`sort_order` integer NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`event_id`) REFERENCES `bingo_events`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `bingo_tasks_event_order_unique` ON `bingo_tasks` (`event_id`,`sort_order`);--> statement-breakpoint
CREATE INDEX `idx_bingo_tasks_event_id` ON `bingo_tasks` (`event_id`);--> statement-breakpoint
CREATE TABLE `bingo_team_members` (
	`id` text PRIMARY KEY NOT NULL,
	`team_id` text NOT NULL,
	`player_id` text,
	`display_name` text NOT NULL,
	`normalized_name` text NOT NULL,
	`role` text DEFAULT 'member' NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`team_id`) REFERENCES `bingo_teams`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`player_id`) REFERENCES `players`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `bingo_members_team_name_unique` ON `bingo_team_members` (`team_id`,`normalized_name`);--> statement-breakpoint
CREATE INDEX `idx_bingo_members_team_id` ON `bingo_team_members` (`team_id`);--> statement-breakpoint
CREATE INDEX `idx_bingo_members_player_id` ON `bingo_team_members` (`player_id`);--> statement-breakpoint
CREATE TABLE `bingo_teams` (
	`id` text PRIMARY KEY NOT NULL,
	`event_id` text NOT NULL,
	`source_team_index` integer NOT NULL,
	`name` text NOT NULL,
	`color` text NOT NULL,
	`emblem` text NOT NULL,
	`access_token_hash` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`event_id`) REFERENCES `bingo_events`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `bingo_teams_event_index_unique` ON `bingo_teams` (`event_id`,`source_team_index`);--> statement-breakpoint
CREATE UNIQUE INDEX `bingo_teams_access_hash_unique` ON `bingo_teams` (`access_token_hash`);--> statement-breakpoint
CREATE INDEX `idx_bingo_teams_event_id` ON `bingo_teams` (`event_id`);--> statement-breakpoint
CREATE TABLE `bingo_templates` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_draft_id` text,
	`clan_id` text,
	`owner_user_id` text,
	`name` text NOT NULL,
	`mode` text NOT NULL,
	`board_scope` text NOT NULL,
	`configuration_json` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`owner_draft_id`) REFERENCES `drafts`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`clan_id`) REFERENCES `clans`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`owner_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `idx_bingo_templates_owner_draft` ON `bingo_templates` (`owner_draft_id`);--> statement-breakpoint
CREATE INDEX `idx_bingo_templates_clan_id` ON `bingo_templates` (`clan_id`);