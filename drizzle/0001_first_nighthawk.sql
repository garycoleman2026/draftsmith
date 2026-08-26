CREATE TABLE `draft_constraints` (
	`id` text PRIMARY KEY NOT NULL,
	`draft_id` text NOT NULL,
	`constraint_type` text NOT NULL,
	`player_a_id` text NOT NULL,
	`player_b_id` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`draft_id`) REFERENCES `drafts`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`player_a_id`) REFERENCES `players`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`player_b_id`) REFERENCES `players`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_draft_constraints_draft_id` ON `draft_constraints` (`draft_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `draft_constraints_pair_unique` ON `draft_constraints` (`draft_id`,`constraint_type`,`player_a_id`,`player_b_id`);--> statement-breakpoint
CREATE TABLE `live_picks` (
	`id` text PRIMARY KEY NOT NULL,
	`draft_id` text NOT NULL,
	`captain_id` text NOT NULL,
	`player_id` text NOT NULL,
	`pick_number` integer NOT NULL,
	`turn_number` integer NOT NULL,
	`picked_at` text NOT NULL,
	FOREIGN KEY (`draft_id`) REFERENCES `drafts`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`captain_id`) REFERENCES `captains`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`player_id`) REFERENCES `players`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_live_picks_draft_id` ON `live_picks` (`draft_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `live_picks_player_unique` ON `live_picks` (`draft_id`,`player_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `live_picks_number_unique` ON `live_picks` (`draft_id`,`pick_number`);--> statement-breakpoint
CREATE TABLE `survey_answers` (
	`question_id` text NOT NULL,
	`player_id` text NOT NULL,
	`value` text NOT NULL,
	PRIMARY KEY(`question_id`, `player_id`),
	FOREIGN KEY (`question_id`) REFERENCES `survey_questions`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`player_id`) REFERENCES `players`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_survey_answers_player_id` ON `survey_answers` (`player_id`);--> statement-breakpoint
CREATE TABLE `survey_questions` (
	`id` text PRIMARY KEY NOT NULL,
	`draft_id` text NOT NULL,
	`label` text NOT NULL,
	`field_type` text NOT NULL,
	`required` integer DEFAULT false NOT NULL,
	`options_json` text,
	`sort_order` integer NOT NULL,
	FOREIGN KEY (`draft_id`) REFERENCES `drafts`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_survey_questions_draft_id` ON `survey_questions` (`draft_id`);--> statement-breakpoint
ALTER TABLE `drafts` ADD `roster_mode` text DEFAULT 'import' NOT NULL;--> statement-breakpoint
ALTER TABLE `drafts` ADD `signup_token` text;--> statement-breakpoint
ALTER TABLE `drafts` ADD `registration_open` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `drafts` ADD `live_started_at` text;--> statement-breakpoint
CREATE UNIQUE INDEX `drafts_signup_token_unique` ON `drafts` (`signup_token`);--> statement-breakpoint
ALTER TABLE `players` ADD `source` text DEFAULT 'import' NOT NULL;--> statement-breakpoint
ALTER TABLE `players` ADD `created_at` text;--> statement-breakpoint
ALTER TABLE `rankings` ADD `score` integer;