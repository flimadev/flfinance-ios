import { and, asc, desc, eq, gte, isNotNull, isNull, lte, like, or } from 'drizzle-orm';
import type { BaseSQLiteDatabase } from 'drizzle-orm/sqlite-core';

import { schema, transactions, type Transaction } from '@/src/db/schema';
import type { TransactionFilters } from '@/src/domain/financeSchemas';

type TransactionInsert = typeof transactions.$inferInsert;

export interface TransactionRepositoryContract {
  create(transaction: TransactionInsert): Promise<Transaction>;
  findById(id: string): Promise<Transaction | undefined>;
  list(filters: TransactionFilters): Promise<Transaction[]>;
  update(id: string, values: Partial<TransactionInsert>): Promise<Transaction | undefined>;
  remove(id: string, deletedAt: number): Promise<boolean>;
  restore(id: string, updatedAt: number): Promise<boolean>;
}

export class TransactionRepository<TResult> implements TransactionRepositoryContract {
  constructor(private readonly db: BaseSQLiteDatabase<'sync', TResult, typeof schema>) {}

  async create(transaction: TransactionInsert): Promise<Transaction> {
    const [created] = await this.db.insert(transactions).values(transaction).returning();
    if (!created) {
      throw new Error('O SQLite não retornou a transação recém-criada.');
    }

    return created;
  }

  async findById(id: string): Promise<Transaction | undefined> {
    const [transaction] = await this.db.select().from(transactions).where(eq(transactions.id, id));
    return transaction;
  }

  async list(filters: TransactionFilters): Promise<Transaction[]> {
    const conditions = [isNull(transactions.deletedAt)];

    if (filters.accountId) {
      const accountMatch = or(
        eq(transactions.accountId, filters.accountId),
        eq(transactions.transferAccountId, filters.accountId),
      );
      if (accountMatch) {
        conditions.push(accountMatch);
      }
    }
    if (filters.categoryId) {
      conditions.push(eq(transactions.categoryId, filters.categoryId));
    }
    if (filters.fromDate) {
      conditions.push(gte(transactions.date, filters.fromDate));
    }
    if (filters.toDate) {
      conditions.push(lte(transactions.date, filters.toDate));
    }
    if (filters.query) {
      const search = `%${filters.query}%`;
      const textMatch = or(
        like(transactions.description, search),
        like(transactions.notes, search),
      );
      if (textMatch) {
        conditions.push(textMatch);
      }
    }

    return this.db
      .select()
      .from(transactions)
      .where(and(...conditions))
      .orderBy(desc(transactions.date), desc(transactions.createdAt), asc(transactions.id));
  }

  async update(id: string, values: Partial<TransactionInsert>): Promise<Transaction | undefined> {
    const [updated] = await this.db
      .update(transactions)
      .set(values)
      .where(and(eq(transactions.id, id), isNull(transactions.deletedAt)))
      .returning();
    return updated;
  }

  async remove(id: string, deletedAt: number): Promise<boolean> {
    const [removed] = await this.db
      .update(transactions)
      .set({ deletedAt, updatedAt: deletedAt })
      .where(and(eq(transactions.id, id), isNull(transactions.deletedAt)))
      .returning({ id: transactions.id });
    return removed !== undefined;
  }

  async restore(id: string, updatedAt: number): Promise<boolean> {
    const [restored] = await this.db
      .update(transactions)
      .set({ deletedAt: null, updatedAt })
      .where(and(eq(transactions.id, id), isNotNull(transactions.deletedAt)))
      .returning({ id: transactions.id });
    return restored !== undefined;
  }
}
