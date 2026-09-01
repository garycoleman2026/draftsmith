CREATE TABLE `bingo_runelite_diagnostics` (
	`id` text PRIMARY KEY NOT NULL,
	`event_id` text NOT NULL,
	`team_id` text NOT NULL,
	`member_id` text NOT NULL,
	`device_id` text NOT NULL,
	`kind` text NOT NULL,
	`status` text NOT NULL,
	`summary` text NOT NULL,
	`details_json` text DEFAULT '{}' NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`event_id`) REFERENCES `bingo_events`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`team_id`) REFERENCES `bingo_teams`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`member_id`) REFERENCES `bingo_team_members`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`device_id`) REFERENCES `bingo_runelite_devices`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_bingo_runelite_diagnostics_event_created` ON `bingo_runelite_diagnostics` (`event_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `idx_bingo_runelite_diagnostics_device_created` ON `bingo_runelite_diagnostics` (`device_id`,`created_at`);--> statement-breakpoint
ALTER TABLE `bingo_runelite_devices` ADD `last_overlay_at` text;