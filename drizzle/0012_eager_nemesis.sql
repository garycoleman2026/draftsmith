CREATE TABLE `clan_invites` (
	`id` text PRIMARY KEY NOT NULL,
	`clan_id` text NOT NULL,
	`token_hash` text NOT NULL,
	`role` text DEFAULT 'member' NOT NULL,
	`created_by_user_id` text NOT NULL,
	`expires_at` text NOT NULL,
	`max_uses` integer DEFAULT 50 NOT NULL,
	`use_count` integer DEFAULT 0 NOT NULL,
	`revoked_at` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`clan_id`) REFERENCES `clans`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`created_by_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `clan_invites_token_hash_unique` ON `clan_invites` (`token_hash`);--> statement-breakpoint
CREATE INDEX `idx_clan_invites_clan_id` ON `clan_invites` (`clan_id`);--> statement-breakpoint
CREATE INDEX `idx_clan_invites_expires_at` ON `clan_invites` (`expires_at`);