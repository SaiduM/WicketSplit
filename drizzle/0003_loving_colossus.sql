CREATE TABLE `team_member_access` (
	`team_id` integer PRIMARY KEY NOT NULL,
	`token_hash` text NOT NULL,
	`pin_hash` text NOT NULL,
	`created_by` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `team_member_access_token_hash_unique` ON `team_member_access` (`token_hash`);