CREATE TABLE `app_settings` (
	`id` integer PRIMARY KEY NOT NULL,
	`judge_model` text DEFAULT 'mistral-small-latest' NOT NULL,
	`judge_temperature` real DEFAULT 0 NOT NULL,
	`updated_at` integer NOT NULL
);
