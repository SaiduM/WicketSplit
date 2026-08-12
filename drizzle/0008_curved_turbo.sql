ALTER TABLE `early_access_requests` ADD `approval_token_hash` text;--> statement-breakpoint
ALTER TABLE `early_access_requests` ADD `approval_token_secret` text;--> statement-breakpoint
ALTER TABLE `early_access_requests` ADD `approval_expires_at` text;--> statement-breakpoint
ALTER TABLE `early_access_requests` ADD `approval_used_at` text;--> statement-breakpoint
CREATE INDEX `idx_early_access_approval_token` ON `early_access_requests` (`approval_token_hash`);