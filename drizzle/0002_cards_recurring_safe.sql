ALTER TABLE `accounts` ADD `closing_day` integer
	CONSTRAINT "accounts_closing_day_check"
	CHECK("closing_day" is null or "closing_day" between 1 and 31);
--> statement-breakpoint
ALTER TABLE `accounts` ADD `due_day` integer
	CONSTRAINT "accounts_due_day_check"
	CHECK("due_day" is null or "due_day" between 1 and 31);
--> statement-breakpoint
CREATE TABLE `invoices` (
	`id` text PRIMARY KEY NOT NULL,
	`account_id` text NOT NULL,
	`billing_month` text NOT NULL,
	`due_date` text NOT NULL,
	`status` text DEFAULT 'open' NOT NULL,
	`paid_at` integer,
	`payment_account_id` text,
	`payment_transaction_id` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`account_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`payment_account_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "invoices_month_check" CHECK("invoices"."billing_month" glob '[0-9][0-9][0-9][0-9]-[0-9][0-9]'),
	CONSTRAINT "invoices_status_check" CHECK("invoices"."status" in ('open', 'paid'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `invoices_account_month_unique` ON `invoices` (`account_id`,`billing_month`);--> statement-breakpoint
CREATE INDEX `invoices_due_date_idx` ON `invoices` (`due_date`);--> statement-breakpoint
CREATE TABLE `recurring_rules` (
	`id` text PRIMARY KEY NOT NULL,
	`account_id` text NOT NULL,
	`category_id` text,
	`kind` text NOT NULL,
	`amount_cents` integer NOT NULL,
	`description` text NOT NULL,
	`payment_method` text,
	`start_date` text NOT NULL,
	`end_date` text,
	`day_of_month` integer NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	`last_generated_date` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`account_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`category_id`) REFERENCES `categories`(`id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT "recurring_rules_positive_amount_check" CHECK("recurring_rules"."amount_cents" > 0),
	CONSTRAINT "recurring_rules_day_check" CHECK("recurring_rules"."day_of_month" between 1 and 31),
	CONSTRAINT "recurring_rules_dates_check" CHECK("recurring_rules"."end_date" is null or "recurring_rules"."end_date" >= "recurring_rules"."start_date")
);
--> statement-breakpoint
CREATE INDEX `recurring_rules_active_idx` ON `recurring_rules` (`is_active`);--> statement-breakpoint
CREATE UNIQUE INDEX `transactions_recurring_date_unique` ON `transactions` (`recurring_id`,`date`);
