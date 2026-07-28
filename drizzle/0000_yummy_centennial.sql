CREATE TABLE `expenses` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`league_id` integer NOT NULL,
	`game_id` integer,
	`label` text NOT NULL,
	`category` text NOT NULL,
	`amount` real NOT NULL,
	`paid_by_player_id` integer NOT NULL,
	`split_rule` text NOT NULL,
	`incurred_on` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `game_players` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`game_id` integer NOT NULL,
	`player_id` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `games` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`league_id` integer NOT NULL,
	`opponent` text NOT NULL,
	`played_on` text NOT NULL,
	`venue` text
);
--> statement-breakpoint
CREATE TABLE `leagues` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`team_id` integer NOT NULL,
	`name` text NOT NULL,
	`status` text DEFAULT 'active' NOT NULL
);
--> statement-breakpoint
CREATE TABLE `players` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`team_id` integer NOT NULL,
	`name` text NOT NULL,
	`active` integer DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE `teams` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`owner_email` text NOT NULL,
	`created_at` text NOT NULL
);
