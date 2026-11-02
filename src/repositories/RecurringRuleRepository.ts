import { and, eq } from 'drizzle-orm';
import type { BaseSQLiteDatabase } from 'drizzle-orm/sqlite-core';

import { recurringRules, schema, transactions, type RecurringRule } from '@/src/db/schema';

type RuleInsert = typeof recurringRules.$inferInsert;
type TransactionInsert = typeof transactions.$inferInsert;

export interface RecurringRuleRepositoryContract {
  create(rule: RuleInsert): Promise<RecurringRule>;
  listActive(): Promise<RecurringRule[]>;
  generate(
    ruleId: string,
    occurrences: { date: string; transaction: TransactionInsert }[],
    now: number,
    deactivate: boolean,
  ): Promise<number>;
}

export class RecurringRuleRepository<TResult> implements RecurringRuleRepositoryContract {
  constructor(private readonly db: BaseSQLiteDatabase<'sync', TResult, typeof schema>) {}

  async create(rule: RuleInsert): Promise<RecurringRule> {
    const [created] = await this.db.insert(recurringRules).values(rule).returning();
    if (!created) {
      throw new Error('O SQLite não retornou a recorrência recém-criada.');
    }
    return created;
  }

  async listActive(): Promise<RecurringRule[]> {
    return this.db.select().from(recurringRules).where(eq(recurringRules.isActive, true));
  }

  async generate(
    ruleId: string,
    occurrences: { date: string; transaction: TransactionInsert }[],
    now: number,
    deactivate: boolean,
  ): Promise<number> {
    return this.db.transaction((transaction) => {
      let generated = 0;
      let lastGeneratedDate: string | null = null;
      for (const occurrence of occurrences) {
        const inserted = transaction
          .insert(transactions)
          .values(occurrence.transaction)
          .onConflictDoNothing()
          .returning({ id: transactions.id })
          .get();
        if (inserted) {
          generated += 1;
        }
        lastGeneratedDate = occurrence.date;
      }

      const changes: Partial<RuleInsert> = {
        updatedAt: now,
        ...(lastGeneratedDate ? { lastGeneratedDate } : {}),
        ...(deactivate ? { isActive: false } : {}),
      };
      transaction
        .update(recurringRules)
        .set(changes)
        .where(and(eq(recurringRules.id, ruleId), eq(recurringRules.isActive, true)))
        .run();

      return generated;
    });
  }
}
