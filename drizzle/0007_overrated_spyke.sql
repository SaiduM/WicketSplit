CREATE TABLE `early_access_requests` (
	`email` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`team_name` text NOT NULL,
	`note` text DEFAULT '' NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`requested_at` text NOT NULL,
	`reviewed_at` text,
	`reviewed_by` text
);
--> statement-breakpoint
CREATE INDEX `idx_early_access_status_requested` ON `early_access_requests` (`status`,`requested_at`);