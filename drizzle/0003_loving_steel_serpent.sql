CREATE TABLE `attachments` (
	`id` text PRIMARY KEY NOT NULL,
	`transaction_id` text NOT NULL,
	`uri` text NOT NULL,
	`mime_type` text NOT NULL,
	`file_name` text,
	`size_bytes` integer NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`transaction_id`) REFERENCES `transactions`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `attachments_transaction_id_idx` ON `attachments` (`transaction_id`);--> statement-breakpoint
CREATE TABLE `tags` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`color` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `tags_name_unique` ON `tags` (`name`);--> statement-breakpoint
CREATE TABLE `transaction_tags` (
	`transaction_id` text NOT NULL,
	`tag_id` text NOT NULL,
	FOREIGN KEY (`transaction_id`) REFERENCES `transactions`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`tag_id`) REFERENCES `tags`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `transaction_tags_pair_unique` ON `transaction_tags` (`transaction_id`,`tag_id`);--> statement-breakpoint
CREATE INDEX `transaction_tags_tag_id_idx` ON `transaction_tags` (`tag_id`);