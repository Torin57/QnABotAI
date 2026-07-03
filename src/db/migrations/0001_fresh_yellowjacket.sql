CREATE TABLE `bot_log` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`question` text NOT NULL,
	`candidates` text,
	`verdict` text NOT NULL,
	`answer` text,
	`created_at` integer NOT NULL
);
