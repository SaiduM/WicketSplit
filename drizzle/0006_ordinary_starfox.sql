CREATE TABLE IF NOT EXISTS `workspace_credits` (
	`team_id` integer NOT NULL,
	`league_id` integer NOT NULL,
	`record_id` integer NOT NULL,
	`event_date` text DEFAULT '' NOT NULL,
	`payload` text NOT NULL,
	`sort_order` integer NOT NULL,
	PRIMARY KEY(`team_id`, `league_id`, `record_id`)
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_workspace_credits_league_date` ON `workspace_credits` (`team_id`,`league_id`,`event_date`,`sort_order`);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `workspace_expenses` (
	`team_id` integer NOT NULL,
	`league_id` integer NOT NULL,
	`record_id` integer NOT NULL,
	`event_date` text DEFAULT '' NOT NULL,
	`payload` text NOT NULL,
	`sort_order` integer NOT NULL,
	PRIMARY KEY(`team_id`, `league_id`, `record_id`)
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_workspace_expenses_league_date` ON `workspace_expenses` (`team_id`,`league_id`,`event_date`,`sort_order`);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `workspace_games` (
	`team_id` integer NOT NULL,
	`league_id` integer NOT NULL,
	`record_id` integer NOT NULL,
	`event_date` text DEFAULT '' NOT NULL,
	`payload` text NOT NULL,
	`sort_order` integer NOT NULL,
	PRIMARY KEY(`team_id`, `league_id`, `record_id`)
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_workspace_games_league_date` ON `workspace_games` (`team_id`,`league_id`,`event_date`,`sort_order`);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `workspace_leagues` (
	`team_id` integer NOT NULL,
	`league_id` integer NOT NULL,
	`name` text NOT NULL,
	`season` text NOT NULL,
	`status` text NOT NULL,
	`cricclubs` text,
	`sort_order` integer NOT NULL,
	PRIMARY KEY(`team_id`, `league_id`)
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_workspace_leagues_team_sort` ON `workspace_leagues` (`team_id`,`sort_order`);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `workspace_payments` (
	`team_id` integer NOT NULL,
	`league_id` integer NOT NULL,
	`record_id` integer NOT NULL,
	`event_date` text DEFAULT '' NOT NULL,
	`payload` text NOT NULL,
	`sort_order` integer NOT NULL,
	PRIMARY KEY(`team_id`, `league_id`, `record_id`)
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_workspace_payments_league_date` ON `workspace_payments` (`team_id`,`league_id`,`event_date`,`sort_order`);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `workspace_players` (
	`team_id` integer NOT NULL,
	`player_id` integer NOT NULL,
	`payload` text NOT NULL,
	`sort_order` integer NOT NULL,
	PRIMARY KEY(`team_id`, `player_id`)
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_workspace_players_team_sort` ON `workspace_players` (`team_id`,`sort_order`);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `workspace_teams` (
	`team_id` integer PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`sport` text NOT NULL,
	`cricclubs` text,
	`version` integer DEFAULT 1 NOT NULL,
	`updated_at` text NOT NULL
);--> statement-breakpoint
PRAGMA optimize;
