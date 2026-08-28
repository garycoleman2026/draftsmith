CREATE TABLE `bingo_template_votes` (
	`template_id` text NOT NULL,
	`voter_hash` text NOT NULL,
	`vote` integer NOT NULL CHECK (`vote` IN (-1, 1)),
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	PRIMARY KEY(`template_id`, `voter_hash`),
	FOREIGN KEY (`template_id`) REFERENCES `bingo_templates`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
UPDATE `bingo_tasks` SET `difficulty` = 'expert' WHERE `difficulty` = 'legendary';
