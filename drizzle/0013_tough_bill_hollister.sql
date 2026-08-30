CREATE TABLE `bingo_event_access_tokens` (
	`id` text PRIMARY KEY NOT NULL,
	`event_id` text NOT NULL,
	`token_hash` text NOT NULL,
	`role` text DEFAULT 'organizer' NOT NULL,
	`created_by_user_id` text,
	`expires_at` text,
	`revoked_at` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`event_id`) REFERENCES `bingo_events`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`created_by_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `bingo_event_access_tokens_hash_unique` ON `bingo_event_access_tokens` (`token_hash`);--> statement-breakpoint
CREATE INDEX `idx_bingo_event_access_tokens_event` ON `bingo_event_access_tokens` (`event_id`);--> statement-breakpoint
CREATE INDEX `idx_bingo_event_access_tokens_expires` ON `bingo_event_access_tokens` (`expires_at`);--> statement-breakpoint
CREATE TABLE `bingo_event_collaborators` (
	`event_id` text NOT NULL,
	`user_id` text NOT NULL,
	`role` text DEFAULT 'scorekeeper' NOT NULL,
	`invited_by_user_id` text,
	`created_at` text NOT NULL,
	PRIMARY KEY(`event_id`, `user_id`),
	FOREIGN KEY (`event_id`) REFERENCES `bingo_events`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`invited_by_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `idx_bingo_event_collaborators_user` ON `bingo_event_collaborators` (`user_id`);--> statement-breakpoint
CREATE TABLE `bingo_event_invites` (
	`id` text PRIMARY KEY NOT NULL,
	`event_id` text NOT NULL,
	`token_hash` text NOT NULL,
	`role` text DEFAULT 'scorekeeper' NOT NULL,
	`created_by_user_id` text NOT NULL,
	`expires_at` text NOT NULL,
	`max_uses` integer DEFAULT 10 NOT NULL,
	`use_count` integer DEFAULT 0 NOT NULL,
	`revoked_at` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`event_id`) REFERENCES `bingo_events`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`created_by_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `bingo_event_invites_token_hash_unique` ON `bingo_event_invites` (`token_hash`);--> statement-breakpoint
CREATE INDEX `idx_bingo_event_invites_event` ON `bingo_event_invites` (`event_id`);--> statement-breakpoint
CREATE INDEX `idx_bingo_event_invites_expires` ON `bingo_event_invites` (`expires_at`);--> statement-breakpoint
ALTER TABLE `bingo_events` ADD `paused_at` text;