CREATE TABLE `qna_items` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`question` text NOT NULL,
	`answer` text,
	`source_document` text,
	`status` text DEFAULT 'unanswered' NOT NULL,
	`created_at` integer NOT NULL
);
