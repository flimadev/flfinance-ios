CREATE TABLE `budgets` (
	`id` text PRIMARY KEY NOT NULL,
	`category_id` text NOT NULL,
	`month` text NOT NULL,
	`amount_cents` integer NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`category_id`) REFERENCES `categories`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "budgets_positive_amount_check" CHECK("budgets"."amount_cents" > 0),
	CONSTRAINT "budgets_month_check" CHECK("budgets"."month" glob '[0-9][0-9][0-9][0-9]-[0-9][0-9]')
);
--> statement-breakpoint
CREATE UNIQUE INDEX `budgets_category_month_unique` ON `budgets` (`category_id`,`month`);--> statement-breakpoint
CREATE INDEX `budgets_month_idx` ON `budgets` (`month`);