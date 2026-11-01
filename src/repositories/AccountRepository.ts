import { and, asc, eq, isNull } from 'drizzle-orm';
import type { BaseSQLiteDatabase } from 'drizzle-orm/sqlite-core';

import { accounts, schema, type Account } from '@/src/db/schema';

type AccountInsert = typeof accounts.$inferInsert;

export interface AccountRepositoryContract {
  create(account: AccountInsert): Promise<Account>;
  findById(id: string): Promise<Account | undefined>;
  list(): Promise<Account[]>;
  update(id: string, values: Partial<AccountInsert>): Promise<Account | undefined>;
  remove(id: string, deletedAt: number): Promise<boolean>;
}

export class AccountRepository<TResult> implements AccountRepositoryContract {
  constructor(private readonly db: BaseSQLiteDatabase<'sync', TResult, typeof schema>) {}

  async create(account: AccountInsert): Promise<Account> {
    const [created] = await this.db.insert(accounts).values(account).returning();
    if (!created) {
      throw new Error('O SQLite não retornou a conta recém-criada.');
    }

    return created;
  }

  async findById(id: string): Promise<Account | undefined> {
    const [account] = await this.db.select().from(accounts).where(eq(accounts.id, id));
    return account;
  }

  async list(): Promise<Account[]> {
    return this.db
      .select()
      .from(accounts)
      .where(isNull(accounts.deletedAt))
      .orderBy(asc(accounts.name));
  }

  async update(id: string, values: Partial<AccountInsert>): Promise<Account | undefined> {
    const [updated] = await this.db
      .update(accounts)
      .set(values)
      .where(and(eq(accounts.id, id), isNull(accounts.deletedAt)))
      .returning();
    return updated;
  }

  async remove(id: string, deletedAt: number): Promise<boolean> {
    const [removed] = await this.db
      .update(accounts)
      .set({ deletedAt, updatedAt: deletedAt })
      .where(and(eq(accounts.id, id), isNull(accounts.deletedAt)))
      .returning({ id: accounts.id });
    return removed !== undefined;
  }
}
