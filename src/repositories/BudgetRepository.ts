import { and, eq } from 'drizzle-orm';
import type { BaseSQLiteDatabase } from 'drizzle-orm/sqlite-core';

import { budgets, schema, type Budget } from '@/src/db/schema';

type BudgetInsert = typeof budgets.$inferInsert;

export interface BudgetRepositoryContract {
  create(budget: BudgetInsert): Promise<Budget>;
  findByCategoryAndMonth(categoryId: string, month: string): Promise<Budget | undefined>;
  listByMonth(month: string): Promise<Budget[]>;
  update(
    id: string,
    values: Pick<BudgetInsert, 'amountCents' | 'updatedAt'>,
  ): Promise<Budget | undefined>;
}

export class BudgetRepository<TResult> implements BudgetRepositoryContract {
  constructor(private readonly db: BaseSQLiteDatabase<'sync', TResult, typeof schema>) {}

  async create(budget: BudgetInsert): Promise<Budget> {
    const [created] = await this.db.insert(budgets).values(budget).returning();
    if (!created) {
      throw new Error('O SQLite não retornou o orçamento recém-criado.');
    }

    return created;
  }

  async findByCategoryAndMonth(categoryId: string, month: string): Promise<Budget | undefined> {
    const [budget] = await this.db
      .select()
      .from(budgets)
      .where(and(eq(budgets.categoryId, categoryId), eq(budgets.month, month)));
    return budget;
  }

  async listByMonth(month: string): Promise<Budget[]> {
    return this.db.select().from(budgets).where(eq(budgets.month, month));
  }

  async update(
    id: string,
    values: Pick<BudgetInsert, 'amountCents' | 'updatedAt'>,
  ): Promise<Budget | undefined> {
    const [updated] = await this.db
      .update(budgets)
      .set(values)
      .where(eq(budgets.id, id))
      .returning();
    return updated;
  }
}
