CREATE TABLE `bingo_manual_progress` (
	`id` text PRIMARY KEY NOT NULL,
	`event_id` text NOT NULL,
	`task_id` text NOT NULL,
	`team_id` text NOT NULL,
	`member_id` text,
	`progress_value` real DEFAULT 0 NOT NULL,
	`target_value` real DEFAULT 1 NOT NULL,
	`note` text DEFAULT '' NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`event_id`) REFERENCES `bingo_events`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`task_id`) REFERENCES `bingo_tasks`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`team_id`) REFERENCES `bingo_teams`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`member_id`) REFERENCES `bingo_team_members`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `bingo_manual_progress_task_team_unique` ON `bingo_manual_progress` (`event_id`,`task_id`,`team_id`);--> statement-breakpoint
CREATE INDEX `idx_bingo_manual_progress_event_team` ON `bingo_manual_progress` (`event_id`,`team_id`);