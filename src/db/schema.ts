import { relations, sql } from 'drizzle-orm';
import {
  AnySQLiteColumn,
  check,
  index,
  integer,
  sqliteTable,
  text,
  uniqueIndex,
} from 'drizzle-orm/sqlite-core';

export const accountTypes = ['checking', 'savings', 'cash', 'credit_card', 'investment'] as const;

export const transactionKinds = ['expense', 'income', 'transfer'] as const;
export const categoryKinds = ['expense', 'income'] as const;
export const paymentMethods = ['pix', 'debit', 'credit', 'cash', 'boleto', 'transfer'] as const;
export const attachmentMimeTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/heic'] as const;

export const accounts = sqliteTable(
  'accounts',
  {
    id: text('id').primaryKey().notNull(),
    name: text('name').notNull(),
    type: text('type', { enum: accountTypes }).notNull(),
    initialBalanceCents: integer('initial_balance_cents').notNull().default(0),
    closingDay: integer('closing_day'),
    dueDay: integer('due_day'),
    color: text('color').notNull(),
    icon: text('icon').notNull(),
    currency: text('currency').notNull().default('BRL'),
    archivedAt: integer('archived_at'),
    deletedAt: integer('deleted_at'),
    createdAt: integer('created_at').notNull(),
    updatedAt: integer('updated_at').notNull(),
  },
  (table) => [
    check(
      'accounts_type_check',
      sql`${table.type} in ('checking', 'savings', 'cash', 'credit_card', 'investment')`,
    ),
    check(
      'accounts_closing_day_check',
      sql`${table.closingDay} is null or ${table.closingDay} between 1 and 31`,
    ),
    check(
      'accounts_due_day_check',
      sql`${table.dueDay} is null or ${table.dueDay} between 1 and 31`,
    ),
  ],
);

export const categories = sqliteTable(
  'categories',
  {
    id: text('id').primaryKey().notNull(),
    name: text('name').notNull(),
    kind: text('kind', { enum: categoryKinds }).notNull(),
    icon: text('icon').notNull(),
    color: text('color').notNull(),
    parentId: text('parent_id').references((): AnySQLiteColumn => categories.id, {
      onDelete: 'set null',
    }),
    sortOrder: integer('sort_order').notNull().default(0),
    archivedAt: integer('archived_at'),
    deletedAt: integer('deleted_at'),
    createdAt: integer('created_at').notNull(),
    updatedAt: integer('updated_at').notNull(),
  },
  (table) => [
    check('categories_kind_check', sql`${table.kind} in ('expense', 'income')`),
    index('categories_parent_id_idx').on(table.parentId),
    index('categories_kind_sort_order_idx').on(table.kind, table.sortOrder),
  ],
);

export const transactions = sqliteTable(
  'transactions',
  {
    id: text('id').primaryKey().notNull(),
    accountId: text('account_id')
      .notNull()
      .references(() => accounts.id, { onDelete: 'restrict' }),
    categoryId: text('category_id').references(() => categories.id, { onDelete: 'set null' }),
    kind: text('kind', { enum: transactionKinds }).notNull(),
    amountCents: integer('amount_cents').notNull(),
    date: text('date').notNull(),
    description: text('description').notNull(),
    notes: text('notes'),
    paymentMethod: text('payment_method', { enum: paymentMethods }),
    transferAccountId: text('transfer_account_id').references(() => accounts.id, {
      onDelete: 'restrict',
    }),
    installmentGroupId: text('installment_group_id'),
    installmentNumber: integer('installment_number'),
    installmentTotal: integer('installment_total'),
    invoiceId: text('invoice_id'),
    recurringId: text('recurring_id'),
    isPaid: integer('is_paid', { mode: 'boolean' }).notNull().default(true),
    deletedAt: integer('deleted_at'),
    createdAt: integer('created_at').notNull(),
    updatedAt: integer('updated_at').notNull(),
  },
  (table) => [
    check('transactions_kind_check', sql`${table.kind} in ('expense', 'income', 'transfer')`),
    check('transactions_positive_amount_check', sql`${table.amountCents} > 0`),
    check(
      'transactions_payment_method_check',
      sql`${table.paymentMethod} is null or ${table.paymentMethod} in ('pix', 'debit', 'credit', 'cash', 'boleto', 'transfer')`,
    ),
    check(
      'transactions_installment_check',
      sql`(${table.installmentNumber} is null and ${table.installmentTotal} is null) or (${table.installmentNumber} >= 1 and ${table.installmentTotal} >= ${table.installmentNumber})`,
    ),
    index('transactions_date_idx').on(table.date),
    index('transactions_account_date_idx').on(table.accountId, table.date),
    index('transactions_category_date_idx').on(table.categoryId, table.date),
    index('transactions_invoice_idx').on(table.invoiceId),
    uniqueIndex('transactions_recurring_date_unique').on(table.recurringId, table.date),
  ],
);

export const invoices = sqliteTable(
  'invoices',
  {
    id: text('id').primaryKey().notNull(),
    accountId: text('account_id')
      .notNull()
      .references(() => accounts.id, { onDelete: 'restrict' }),
    billingMonth: text('billing_month').notNull(),
    dueDate: text('due_date').notNull(),
    status: text('status', { enum: ['open', 'paid'] })
      .notNull()
      .default('open'),
    paidAt: integer('paid_at'),
    paymentAccountId: text('payment_account_id').references(() => accounts.id, {
      onDelete: 'restrict',
    }),
    paymentTransactionId: text('payment_transaction_id'),
    createdAt: integer('created_at').notNull(),
    updatedAt: integer('updated_at').notNull(),
  },
  (table) => [
    check(
      'invoices_month_check',
      sql`${table.billingMonth} glob '[0-9][0-9][0-9][0-9]-[0-9][0-9]'`,
    ),
    check('invoices_status_check', sql`${table.status} in ('open', 'paid')`),
    uniqueIndex('invoices_account_month_unique').on(table.accountId, table.billingMonth),
    index('invoices_due_date_idx').on(table.dueDate),
  ],
);

export const recurringRules = sqliteTable(
  'recurring_rules',
  {
    id: text('id').primaryKey().notNull(),
    accountId: text('account_id')
      .notNull()
      .references(() => accounts.id, { onDelete: 'restrict' }),
    categoryId: text('category_id').references(() => categories.id, { onDelete: 'set null' }),
    kind: text('kind', { enum: ['expense', 'income'] }).notNull(),
    amountCents: integer('amount_cents').notNull(),
    description: text('description').notNull(),
    paymentMethod: text('payment_method', { enum: paymentMethods }),
    startDate: text('start_date').notNull(),
    endDate: text('end_date'),
    dayOfMonth: integer('day_of_month').notNull(),
    isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
    lastGeneratedDate: text('last_generated_date'),
    createdAt: integer('created_at').notNull(),
    updatedAt: integer('updated_at').notNull(),
  },
  (table) => [
    check('recurring_rules_positive_amount_check', sql`${table.amountCents} > 0`),
    check('recurring_rules_day_check', sql`${table.dayOfMonth} between 1 and 31`),
    check(
      'recurring_rules_dates_check',
      sql`${table.endDate} is null or ${table.endDate} >= ${table.startDate}`,
    ),
    index('recurring_rules_active_idx').on(table.isActive),
  ],
);

export const budgets = sqliteTable(
  'budgets',
  {
    id: text('id').primaryKey().notNull(),
    categoryId: text('category_id')
      .notNull()
      .references(() => categories.id, { onDelete: 'restrict' }),
    month: text('month').notNull(),
    amountCents: integer('amount_cents').notNull(),
    createdAt: integer('created_at').notNull(),
    updatedAt: integer('updated_at').notNull(),
  },
  (table) => [
    check('budgets_positive_amount_check', sql`${table.amountCents} > 0`),
    check('budgets_month_check', sql`${table.month} glob '[0-9][0-9][0-9][0-9]-[0-9][0-9]'`),
    uniqueIndex('budgets_category_month_unique').on(table.categoryId, table.month),
    index('budgets_month_idx').on(table.month),
  ],
);

export const tags = sqliteTable(
  'tags',
  {
    id: text('id').primaryKey().notNull(),
    name: text('name').notNull(),
    color: text('color').notNull(),
    createdAt: integer('created_at').notNull(),
    updatedAt: integer('updated_at').notNull(),
  },
  (table) => [uniqueIndex('tags_name_unique').on(table.name)],
);

export const transactionTags = sqliteTable(
  'transaction_tags',
  {
    transactionId: text('transaction_id')
      .notNull()
      .references(() => transactions.id, { onDelete: 'cascade' }),
    tagId: text('tag_id')
      .notNull()
      .references(() => tags.id, { onDelete: 'cascade' }),
  },
  (table) => [
    uniqueIndex('transaction_tags_pair_unique').on(table.transactionId, table.tagId),
    index('transaction_tags_tag_id_idx').on(table.tagId),
  ],
);

export const attachments = sqliteTable(
  'attachments',
  {
    id: text('id').primaryKey().notNull(),
    transactionId: text('transaction_id')
      .notNull()
      .references(() => transactions.id, { onDelete: 'cascade' }),
    uri: text('uri').notNull(),
    mimeType: text('mime_type', { enum: attachmentMimeTypes }).notNull(),
    fileName: text('file_name'),
    sizeBytes: integer('size_bytes').notNull(),
    createdAt: integer('created_at').notNull(),
  },
  (table) => [index('attachments_transaction_id_idx').on(table.transactionId)],
);

export const appMetadata = sqliteTable('app_metadata', {
  key: text('key').primaryKey().notNull(),
  value: text('value').notNull(),
});

export const accountRelations = relations(accounts, ({ many }) => ({
  transactions: many(transactions),
}));

export const categoryRelations = relations(categories, ({ many, one }) => ({
  transactions: many(transactions),
  parent: one(categories, {
    fields: [categories.parentId],
    references: [categories.id],
    relationName: 'category_parent',
  }),
  children: many(categories, { relationName: 'category_parent' }),
}));

export const transactionRelations = relations(transactions, ({ one }) => ({
  account: one(accounts, {
    fields: [transactions.accountId],
    references: [accounts.id],
  }),
  category: one(categories, {
    fields: [transactions.categoryId],
    references: [categories.id],
  }),
  transferAccount: one(accounts, {
    fields: [transactions.transferAccountId],
    references: [accounts.id],
    relationName: 'transfer_account',
  }),
}));

export const budgetRelations = relations(budgets, ({ one }) => ({
  category: one(categories, {
    fields: [budgets.categoryId],
    references: [categories.id],
  }),
}));

export const invoiceRelations = relations(invoices, ({ one }) => ({
  account: one(accounts, { fields: [invoices.accountId], references: [accounts.id] }),
  paymentAccount: one(accounts, {
    fields: [invoices.paymentAccountId],
    references: [accounts.id],
    relationName: 'invoice_payment_account',
  }),
}));

export const recurringRuleRelations = relations(recurringRules, ({ one }) => ({
  account: one(accounts, { fields: [recurringRules.accountId], references: [accounts.id] }),
  category: one(categories, { fields: [recurringRules.categoryId], references: [categories.id] }),
}));

export const tagRelations = relations(tags, ({ many }) => ({
  transactions: many(transactionTags),
}));

export const transactionTagRelations = relations(transactionTags, ({ one }) => ({
  transaction: one(transactions, {
    fields: [transactionTags.transactionId],
    references: [transactions.id],
  }),
  tag: one(tags, {
    fields: [transactionTags.tagId],
    references: [tags.id],
  }),
}));

export const attachmentRelations = relations(attachments, ({ one }) => ({
  transaction: one(transactions, {
    fields: [attachments.transactionId],
    references: [transactions.id],
  }),
}));

export const schema = {
  accounts,
  categories,
  transactions,
  invoices,
  recurringRules,
  budgets,
  tags,
  transactionTags,
  attachments,
  appMetadata,
  accountRelations,
  categoryRelations,
  transactionRelations,
  budgetRelations,
  invoiceRelations,
  recurringRuleRelations,
  tagRelations,
  transactionTagRelations,
  attachmentRelations,
};

export type Account = typeof accounts.$inferSelect;
export type Category = typeof categories.$inferSelect;
export type Transaction = typeof transactions.$inferSelect;
export type Budget = typeof budgets.$inferSelect;
export type Invoice = typeof invoices.$inferSelect;
export type RecurringRule = typeof recurringRules.$inferSelect;
export type Tag = typeof tags.$inferSelect;
export type TransactionTag = typeof transactionTags.$inferSelect;
export type Attachment = typeof attachments.$inferSelect;
