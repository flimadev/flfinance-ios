CREATE TABLE `accounts` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`type` text NOT NULL,
	`initial_balance_cents` integer DEFAULT 0 NOT NULL,
	`color` text NOT NULL,
	`icon` text NOT NULL,
	`currency` text DEFAULT 'BRL' NOT NULL,
	`archived_at` integer,
	`deleted_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	CONSTRAINT "accounts_type_check" CHECK("accounts"."type" in ('checking', 'savings', 'cash', 'credit_card', 'investment'))
);
--> statement-breakpoint
CREATE TABLE `app_metadata` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `categories` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`kind` text NOT NULL,
	`icon` text NOT NULL,
	`color` text NOT NULL,
	`parent_id` text,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`archived_at` integer,
	`deleted_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`parent_id`) REFERENCES `categories`(`id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT "categories_kind_check" CHECK("categories"."kind" in ('expense', 'income'))
);
--> statement-breakpoint
CREATE INDEX `categories_parent_id_idx` ON `categories` (`parent_id`);--> statement-breakpoint
CREATE INDEX `categories_kind_sort_order_idx` ON `categories` (`kind`,`sort_order`);--> statement-breakpoint
CREATE TABLE `transactions` (
	`id` text PRIMARY KEY NOT NULL,
	`account_id` text NOT NULL,
	`category_id` text,
	`kind` text NOT NULL,
	`amount_cents` integer NOT NULL,
	`date` text NOT NULL,
	`description` text NOT NULL,
	`notes` text,
	`payment_method` text,
	`transfer_account_id` text,
	`installment_group_id` text,
	`installment_number` integer,
	`installment_total` integer,
	`invoice_id` text,
	`recurring_id` text,
	`is_paid` integer DEFAULT true NOT NULL,
	`deleted_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`account_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`category_id`) REFERENCES `categories`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`transfer_account_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "transactions_kind_check" CHECK("transactions"."kind" in ('expense', 'income', 'transfer')),
	CONSTRAINT "transactions_positive_amount_check" CHECK("transactions"."amount_cents" > 0),
	CONSTRAINT "transactions_payment_method_check" CHECK("transactions"."payment_method" is null or "transactions"."payment_method" in ('pix', 'debit', 'credit', 'cash', 'boleto', 'transfer')),
	CONSTRAINT "transactions_installment_check" CHECK(("transactions"."installment_number" is null and "transactions"."installment_total" is null) or ("transactions"."installment_number" >= 1 and "transactions"."installment_total" >= "transactions"."installment_number"))
);
--> statement-breakpoint
CREATE INDEX `transactions_date_idx` ON `transactions` (`date`);--> statement-breakpoint
CREATE INDEX `transactions_account_date_idx` ON `transactions` (`account_id`,`date`);--> statement-breakpoint
CREATE INDEX `transactions_category_date_idx` ON `transactions` (`category_id`,`date`);--> statement-breakpoint
CREATE INDEX `transactions_invoice_idx` ON `transactions` (`invoice_id`);