import { relations, sql } from 'drizzle-orm';
import { AnySQLiteColumn, check, index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const accountTypes = ['checking', 'savings', 'cash', 'credit_card', 'investment'] as const;

export const transactionKinds = ['expense', 'income', 'transfer'] as const;
export const categoryKinds = ['expense', 'income'] as const;
export const paymentMethods = ['pix', 'debit', 'credit', 'cash', 'boleto', 'transfer'] as const;

export const accounts = sqliteTable(
  'accounts',
  {
    id: text('id').primaryKey().notNull(),
    name: text('name').notNull(),
    type: text('type', { enum: accountTypes }).notNull(),
    initialBalanceCents: integer('initial_balance_cents').notNull().default(0),
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
  ],
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

export const schema = {
  accounts,
  categories,
  transactions,
  appMetadata,
  accountRelations,
  categoryRelations,
  transactionRelations,
};

export type Account = typeof accounts.$inferSelect;
export type Category = typeof categories.$inferSelect;
export type Transaction = typeof transactions.$inferSelect;
