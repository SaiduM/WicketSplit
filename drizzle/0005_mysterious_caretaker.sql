CREATE TABLE IF NOT EXISTS `shared_teams` (
	`team_id` integer PRIMARY KEY NOT NULL,
	`payload` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `team_invites` (
	`token_hash` text PRIMARY KEY NOT NULL,
	`team_id` integer NOT NULL,
	`player_id` integer NOT NULL,
	`created_by` text NOT NULL,
	`expires_at` text NOT NULL,
	`accepted_by` text,
	`accepted_at` text,
	`invite_role` text DEFAULT 'member' NOT NULL,
	`intended_email` text
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_team_invites_team_player_pending` ON `team_invites` (`team_id`,`player_id`,`accepted_by`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_team_invites_team_email_pending` ON `team_invites` (`team_id`,`intended_email`,`accepted_by`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_team_invites_expiry` ON `team_invites` (`expires_at`);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `team_memberships` (
	`team_id` integer NOT NULL,
	`email` text NOT NULL,
	`role` text NOT NULL,
	`player_id` integer,
	`joined_at` text NOT NULL,
	PRIMARY KEY(`team_id`, `email`)
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_team_memberships_email_joined` ON `team_memberships` (`email`,`joined_at`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_team_memberships_team_role_joined` ON `team_memberships` (`team_id`,`role`,`joined_at`,`email`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_team_memberships_team_player` ON `team_memberships` (`team_id`,`player_id`);--> statement-breakpoint
PRAGMA optimize;
