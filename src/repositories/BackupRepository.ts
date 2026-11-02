import type { BaseSQLiteDatabase } from 'drizzle-orm/sqlite-core';

import {
  accounts,
  appMetadata,
  attachments,
  budgets,
  categories,
  invoices,
  recurringRules,
  schema,
  tags,
  transactions,
  transactionTags,
} from '@/src/db/schema';
import type { BackupData } from '@/src/domain/backup';

const seedMarker = 'initial_seed_v1';
const insertBatchSize = 500;

function runBatches<T>(rows: T[], insert: (batch: T[]) => void): void {
  for (let offset = 0; offset < rows.length; offset += insertBatchSize) {
    insert(rows.slice(offset, offset + insertBatchSize));
  }
}

export class BackupRepository<TResult> {
  constructor(private readonly db: BaseSQLiteDatabase<'sync', TResult, typeof schema>) {}

  async exportAll(): Promise<BackupData> {
    return this.db.transaction((transaction) => ({
      accounts: transaction.select().from(accounts).all(),
      categories: transaction.select().from(categories).all(),
      transactions: transaction.select().from(transactions).all(),
      invoices: transaction.select().from(invoices).all(),
      recurringRules: transaction.select().from(recurringRules).all(),
      budgets: transaction.select().from(budgets).all(),
      tags: transaction.select().from(tags).all(),
      transactionTags: transaction.select().from(transactionTags).all(),
      attachments: transaction.select().from(attachments).all(),
      appMetadata: transaction.select().from(appMetadata).all(),
    }));
  }

  async replaceAll(data: BackupData): Promise<void> {
    this.db.transaction((transaction) => {
      transaction.delete(transactions).run();
      transaction.delete(tags).run();
      transaction.delete(attachments).run();
      transaction.delete(transactionTags).run();
      transaction.delete(invoices).run();
      transaction.delete(recurringRules).run();
      transaction.delete(budgets).run();
      transaction.delete(categories).run();
      transaction.delete(accounts).run();
      transaction.delete(appMetadata).run();

      runBatches(data.accounts, (batch) => {
        transaction.insert(accounts).values(batch).run();
      });
      const insertedCategoryIds = new Set<string>();
      let pendingCategories = data.categories.slice();
      while (pendingCategories.length > 0) {
        const readyCategories = pendingCategories.filter(
          (category) => category.parentId === null || insertedCategoryIds.has(category.parentId),
        );
        if (readyCategories.length === 0) {
          throw new Error('O backup contém uma hierarquia de categorias inválida.');
        }
        runBatches(readyCategories, (batch) => {
          transaction.insert(categories).values(batch).run();
        });
        for (const category of readyCategories) insertedCategoryIds.add(category.id);
        const readyIds = new Set(readyCategories.map((category) => category.id));
        pendingCategories = pendingCategories.filter((category) => !readyIds.has(category.id));
      }
      runBatches(data.invoices, (batch) => {
        transaction.insert(invoices).values(batch).run();
      });
      runBatches(data.recurringRules, (batch) => {
        transaction.insert(recurringRules).values(batch).run();
      });
      runBatches(data.transactions, (batch) => {
        transaction.insert(transactions).values(batch).run();
      });
      runBatches(data.tags, (batch) => {
        transaction.insert(tags).values(batch).run();
      });
      runBatches(data.transactionTags, (batch) => {
        transaction.insert(transactionTags).values(batch).run();
      });
      runBatches(data.attachments, (batch) => {
        transaction.insert(attachments).values(batch).run();
      });
      runBatches(data.budgets, (batch) => {
        transaction.insert(budgets).values(batch).run();
      });

      const metadata = new Map(data.appMetadata.map((entry) => [entry.key, entry.value]));
      if (!metadata.has(seedMarker)) {
        metadata.set(seedMarker, String(Date.now()));
      }
      runBatches(
        [...metadata].map(([key, value]) => ({ key, value })),
        (batch) => {
          transaction.insert(appMetadata).values(batch).run();
        },
      );
    });
  }
}
