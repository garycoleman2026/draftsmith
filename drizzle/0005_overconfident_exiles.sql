CREATE TABLE `bingo_verification_candidates` (
	`id` text PRIMARY KEY NOT NULL,
	`event_id` text NOT NULL,
	`task_id` text NOT NULL,
	`team_id` text NOT NULL,
	`member_id` text,
	`source_summary` text NOT NULL,
	`confidence` text DEFAULT 'reported' NOT NULL,
	`status` text DEFAULT 'progress' NOT NULL,
	`progress_value` real DEFAULT 0 NOT NULL,
	`target_value` real DEFAULT 1 NOT NULL,
	`summary` text NOT NULL,
	`details_json` text DEFAULT '{}' NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`resolved_at` text,
	FOREIGN KEY (`event_id`) REFERENCES `bingo_events`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`task_id`) REFERENCES `bingo_tasks`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`team_id`) REFERENCES `bingo_teams`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`member_id`) REFERENCES `bingo_team_members`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `bingo_verification_candidates_task_team_unique` ON `bingo_verification_candidates` (`event_id`,`task_id`,`team_id`);--> statement-breakpoint
CREATE INDEX `idx_bingo_verification_candidates_event_status` ON `bingo_verification_candidates` (`event_id`,`status`);--> statement-breakpoint
CREATE INDEX `idx_bingo_verification_candidates_team_status` ON `bingo_verification_candidates` (`team_id`,`status`);--> statement-breakpoint
CREATE TABLE `bingo_verification_events` (
	`id` text PRIMARY KEY NOT NULL,
	`event_id` text NOT NULL,
	`team_id` text NOT NULL,
	`member_id` text,
	`idempotency_key` text NOT NULL,
	`source` text NOT NULL,
	`signal_type` text NOT NULL,
	`payload_json` text NOT NULL,
	`observed_at` text NOT NULL,
	`received_at` text NOT NULL,
	FOREIGN KEY (`event_id`) REFERENCES `bingo_events`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`team_id`) REFERENCES `bingo_teams`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`member_id`) REFERENCES `bingo_team_members`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `bingo_verification_events_idempotency_unique` ON `bingo_verification_events` (`event_id`,`source`,`idempotency_key`);--> statement-breakpoint
CREATE INDEX `idx_bingo_verification_events_event_observed` ON `bingo_verification_events` (`event_id`,`observed_at`);--> statement-breakpoint
CREATE INDEX `idx_bingo_verification_events_team_received` ON `bingo_verification_events` (`team_id`,`received_at`);--> statement-breakpoint
CREATE TABLE `bingo_verification_matches` (
	`id` text PRIMARY KEY NOT NULL,
	`candidate_id` text NOT NULL,
	`verification_event_id` text NOT NULL,
	`task_id` text NOT NULL,
	`team_id` text NOT NULL,
	`member_id` text,
	`value` real NOT NULL,
	`progress_kind` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`candidate_id`) REFERENCES `bingo_verification_candidates`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`verification_event_id`) REFERENCES `bingo_verification_events`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`task_id`) REFERENCES `bingo_tasks`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`team_id`) REFERENCES `bingo_teams`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`member_id`) REFERENCES `bingo_team_members`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `bingo_verification_matches_event_task_unique` ON `bingo_verification_matches` (`verification_event_id`,`task_id`);--> statement-breakpoint
CREATE INDEX `idx_bingo_verification_matches_candidate` ON `bingo_verification_matches` (`candidate_id`);--> statement-breakpoint
ALTER TABLE `bingo_claims` ADD `verification_source` text DEFAULT 'manual' NOT NULL;--> statement-breakpoint
ALTER TABLE `bingo_claims` ADD `verification_confidence` text DEFAULT 'unverified' NOT NULL;--> statement-breakpoint
ALTER TABLE `bingo_claims` ADD `verification_candidate_id` text REFERENCES bingo_verification_candidates(id);--> statement-breakpoint
ALTER TABLE `bingo_completions` ADD `verification_source` text DEFAULT 'manual' NOT NULL;--> statement-breakpoint
ALTER TABLE `bingo_completions` ADD `verification_confidence` text DEFAULT 'unverified' NOT NULL;