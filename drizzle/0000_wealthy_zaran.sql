CREATE TABLE `captains` (
	`id` text PRIMARY KEY NOT NULL,
	`draft_id` text NOT NULL,
	`player_id` text NOT NULL,
	`team_index` integer NOT NULL,
	`token` text NOT NULL,
	`submitted_at` text,
	FOREIGN KEY (`draft_id`) REFERENCES `drafts`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`player_id`) REFERENCES `players`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `captains_token_unique` ON `captains` (`token`);--> statement-breakpoint
CREATE UNIQUE INDEX `captains_draft_team_unique` ON `captains` (`draft_id`,`team_index`);--> statement-breakpoint
CREATE UNIQUE INDEX `captains_draft_player_unique` ON `captains` (`draft_id`,`player_id`);--> statement-breakpoint
CREATE INDEX `idx_captains_draft_id` ON `captains` (`draft_id`);--> statement-breakpoint
CREATE TABLE `drafts` (
	`id` text PRIMARY KEY NOT NULL,
	`admin_token` text NOT NULL,
	`title` text NOT NULL,
	`draft_type` text NOT NULL,
	`team_count` integer NOT NULL,
	`status` text DEFAULT 'collecting' NOT NULL,
	`result_json` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `drafts_admin_token_unique` ON `drafts` (`admin_token`);--> statement-breakpoint
CREATE TABLE `players` (
	`id` text PRIMARY KEY NOT NULL,
	`draft_id` text NOT NULL,
	`name` text NOT NULL,
	`sort_order` integer NOT NULL,
	FOREIGN KEY (`draft_id`) REFERENCES `drafts`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_players_draft_id` ON `players` (`draft_id`);--> statement-breakpoint
CREATE TABLE `rankings` (
	`captain_id` text NOT NULL,
	`player_id` text NOT NULL,
	`rank` integer NOT NULL,
	`avoid` integer DEFAULT false NOT NULL,
	PRIMARY KEY(`captain_id`, `player_id`),
	FOREIGN KEY (`captain_id`) REFERENCES `captains`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`player_id`) REFERENCES `players`(`id`) ON UPDATE no action ON DELETE cascade
);
