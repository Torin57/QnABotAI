CREATE TABLE `doc_chunks` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`document_id` integer NOT NULL,
	`idx` integer NOT NULL,
	`text` text NOT NULL,
	`start_seconds` integer,
	FOREIGN KEY (`document_id`) REFERENCES `documents`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `documents` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`file_name` text NOT NULL,
	`created_at` integer NOT NULL
);
