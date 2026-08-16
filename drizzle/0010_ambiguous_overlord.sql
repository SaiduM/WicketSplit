CREATE TABLE `feedback_reports` (
	`id` text PRIMARY KEY NOT NULL,
	`reporter_email` text,
	`team_id` integer,
	`category` text NOT NULL,
	`message` text NOT NULL,
	`page_url` text,
	`status` text DEFAULT 'open' NOT NULL,
	`created_at` text NOT NULL,
	`resolved_at` text
);
--> statement-breakpoint
CREATE INDEX `idx_feedback_reports_status_created` ON `feedback_reports` (`status`,`created_at`);--> statement-breakpoint
CREATE TABLE `team_restore_points` (
	`id` text PRIMARY KEY NOT NULL,
	`team_id` integer NOT NULL,
	`payload` text NOT NULL,
	`created_by` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_team_restore_points_team_created` ON `team_restore_points` (`team_id`,`created_at`);