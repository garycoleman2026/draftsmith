CREATE TABLE `bingo_template_ratings` (
	`template_id` text NOT NULL,
	`rater_hash` text NOT NULL,
	`rating` integer NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	PRIMARY KEY(`template_id`, `rater_hash`),
	FOREIGN KEY (`template_id`) REFERENCES `bingo_templates`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_bingo_template_ratings_template` ON `bingo_template_ratings` (`template_id`);--> statement-breakpoint
ALTER TABLE `bingo_events` ADD `public_listed` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `bingo_templates` ADD `public_slug` text;--> statement-breakpoint
ALTER TABLE `bingo_templates` ADD `visibility` text DEFAULT 'private' NOT NULL;--> statement-breakpoint
ALTER TABLE `bingo_templates` ADD `summary` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `bingo_templates` ADD `category` text DEFAULT 'General' NOT NULL;--> statement-breakpoint
ALTER TABLE `bingo_templates` ADD `tags_json` text DEFAULT '[]' NOT NULL;--> statement-breakpoint
ALTER TABLE `bingo_templates` ADD `clone_count` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `bingo_templates` ADD `rating_count` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `bingo_templates` ADD `rating_total` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `bingo_templates` ADD `published_at` text;--> statement-breakpoint
CREATE UNIQUE INDEX `bingo_templates_public_slug_unique` ON `bingo_templates` (`public_slug`);--> statement-breakpoint
CREATE INDEX `idx_bingo_templates_visibility_updated` ON `bingo_templates` (`visibility`,`updated_at`);--> statement-breakpoint
CREATE INDEX `idx_bingo_templates_category_visibility` ON `bingo_templates` (`category`,`visibility`);--> statement-breakpoint
ALTER TABLE `clans` ADD `description` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `clans` ADD `public_listing` integer DEFAULT false NOT NULL;