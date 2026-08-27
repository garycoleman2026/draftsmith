CREATE TABLE `bingo_wom_integrations` (
	`event_id` text PRIMARY KEY NOT NULL,
	`group_id` integer,
	`sync_interval_hours` integer DEFAULT 6 NOT NULL,
	`auto_sync` integer DEFAULT false NOT NULL,
	`status` text DEFAULT 'idle' NOT NULL,
	`baseline_run_id` text,
	`last_sync_at` text,
	`next_sync_at` text,
	`last_error` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`event_id`) REFERENCES `bingo_events`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`baseline_run_id`) REFERENCES `bingo_wom_sync_runs`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `idx_bingo_wom_integrations_next_sync` ON `bingo_wom_integrations` (`next_sync_at`);--> statement-breakpoint
CREATE TABLE `bingo_wom_sync_runs` (
	`id` text PRIMARY KEY NOT NULL,
	`event_id` text NOT NULL,
	`phase` text NOT NULL,
	`status` text DEFAULT 'running' NOT NULL,
	`source_mode` text NOT NULL,
	`total_count` integer DEFAULT 0 NOT NULL,
	`captured_count` integer DEFAULT 0 NOT NULL,
	`failed_count` integer DEFAULT 0 NOT NULL,
	`reconcile_offset` integer DEFAULT 0 NOT NULL,
	`signals_count` integer DEFAULT 0 NOT NULL,
	`last_request_at` text,
	`error_summary` text,
	`started_at` text NOT NULL,
	`completed_at` text,
	FOREIGN KEY (`event_id`) REFERENCES `bingo_events`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_bingo_wom_sync_runs_event_started` ON `bingo_wom_sync_runs` (`event_id`,`started_at`);--> statement-breakpoint
CREATE INDEX `idx_bingo_wom_sync_runs_event_status` ON `bingo_wom_sync_runs` (`event_id`,`status`);--> statement-breakpoint
ALTER TABLE `bingo_player_snapshots` ADD `sync_run_id` text REFERENCES bingo_wom_sync_runs(id);--> statement-breakpoint
ALTER TABLE `bingo_player_snapshots` ADD `schema_version` integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE `bingo_player_snapshots` ADD `provider_updated_at` text;--> statement-breakpoint
CREATE UNIQUE INDEX `bingo_snapshots_run_member_unique` ON `bingo_player_snapshots` (`sync_run_id`,`member_id`);--> statement-breakpoint
CREATE INDEX `idx_bingo_snapshots_sync_run` ON `bingo_player_snapshots` (`sync_run_id`);