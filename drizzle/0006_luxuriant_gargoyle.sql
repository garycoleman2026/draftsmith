DROP INDEX `bingo_verification_events_idempotency_unique`;--> statement-breakpoint
CREATE UNIQUE INDEX `bingo_verification_events_idempotency_unique` ON `bingo_verification_events` (`event_id`,`team_id`,`source`,`idempotency_key`);--> statement-breakpoint
CREATE UNIQUE INDEX `bingo_claims_verification_candidate_unique` ON `bingo_claims` (`verification_candidate_id`);