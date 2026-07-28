CREATE TABLE `api_rate_limits` (
	`rate_key` text PRIMARY KEY NOT NULL,
	`window_start` integer NOT NULL,
	`request_count` integer NOT NULL
);
