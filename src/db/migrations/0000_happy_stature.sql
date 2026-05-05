CREATE TABLE `unanswered_queries` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` text NOT NULL,
	`question_text` text NOT NULL,
	`timestamp` integer NOT NULL
);
