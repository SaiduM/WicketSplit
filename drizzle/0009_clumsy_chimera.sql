DROP INDEX `idx_early_access_approval_token`;--> statement-breakpoint
CREATE UNIQUE INDEX `idx_early_access_approval_token` ON `early_access_requests` (`approval_token_hash`);