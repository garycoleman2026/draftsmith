CREATE TABLE `bingo_runelite_batches` (
	`id` text PRIMARY KEY NOT NULL,
	`device_id` text NOT NULL,
	`batch_key` text NOT NULL,
	`event_count` integer NOT NULL,
	`accepted_count` integer NOT NULL,
	`duplicate_count` integer NOT NULL,
	`rejected_count` integer NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`device_id`) REFERENCES `bingo_runelite_devices`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `bingo_runelite_batches_device_key_unique` ON `bingo_runelite_batches` (`device_id`,`batch_key`);--> statement-breakpoint
CREATE INDEX `idx_bingo_runelite_batches_device_created` ON `bingo_runelite_batches` (`device_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `bingo_runelite_devices` (
	`id` text PRIMARY KEY NOT NULL,
	`event_id` text NOT NULL,
	`team_id` text NOT NULL,
	`member_id` text NOT NULL,
	`pairing_id` text NOT NULL,
	`token_hash` text NOT NULL,
	`device_name` text NOT NULL,
	`plugin_version` text NOT NULL,
	`scopes_json` text NOT NULL,
	`disclosure_version` integer DEFAULT 1 NOT NULL,
	`last_rsn` text NOT NULL,
	`last_seen_at` text NOT NULL,
	`expires_at` text NOT NULL,
	`revoked_at` text,
	`revoked_by` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`event_id`) REFERENCES `bingo_events`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`team_id`) REFERENCES `bingo_teams`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`member_id`) REFERENCES `bingo_team_members`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`pairing_id`) REFERENCES `bingo_runelite_pairings`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `bingo_runelite_devices_pairing_unique` ON `bingo_runelite_devices` (`pairing_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `bingo_runelite_devices_token_hash_unique` ON `bingo_runelite_devices` (`token_hash`);--> statement-breakpoint
CREATE INDEX `idx_bingo_runelite_devices_event` ON `bingo_runelite_devices` (`event_id`);--> statement-breakpoint
CREATE INDEX `idx_bingo_runelite_devices_team` ON `bingo_runelite_devices` (`team_id`);--> statement-breakpoint
CREATE INDEX `idx_bingo_runelite_devices_member` ON `bingo_runelite_devices` (`member_id`);--> statement-breakpoint
CREATE INDEX `idx_bingo_runelite_devices_expires` ON `bingo_runelite_devices` (`expires_at`);--> statement-breakpoint
CREATE TABLE `bingo_runelite_integrations` (
	`event_id` text PRIMARY KEY NOT NULL,
	`enabled` integer DEFAULT false NOT NULL,
	`scopes_json` text DEFAULT '[]' NOT NULL,
	`disclosure_version` integer DEFAULT 1 NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`event_id`) REFERENCES `bingo_events`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `bingo_runelite_pairings` (
	`id` text PRIMARY KEY NOT NULL,
	`event_id` text NOT NULL,
	`team_id` text NOT NULL,
	`member_id` text NOT NULL,
	`code_hash` text NOT NULL,
	`issued_by` text NOT NULL,
	`expires_at` text NOT NULL,
	`consumed_at` text,
	`revoked_at` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`event_id`) REFERENCES `bingo_events`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`team_id`) REFERENCES `bingo_teams`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`member_id`) REFERENCES `bingo_team_members`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `bingo_runelite_pairings_code_hash_unique` ON `bingo_runelite_pairings` (`code_hash`);--> statement-breakpoint
CREATE INDEX `idx_bingo_runelite_pairings_event_member` ON `bingo_runelite_pairings` (`event_id`,`member_id`);--> statement-breakpoint
CREATE INDEX `idx_bingo_runelite_pairings_expires` ON `bingo_runelite_pairings` (`expires_at`);