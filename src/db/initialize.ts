import { migrate } from 'drizzle-orm/expo-sqlite/migrator';

import migrations from '../../drizzle/migrations';
import { getDatabase, type FinanceDatabase } from './client';
import { seedDatabase } from './seed';
import { AccountRepository } from '@/src/repositories/AccountRepository';
import { CategoryRepository } from '@/src/repositories/CategoryRepository';
import { RecurringRuleRepository } from '@/src/repositories/RecurringRuleRepository';
import { RecurringService } from '@/src/services/RecurringService';
import { getLocalDateString } from '@/src/domain/transactions';

let initializationPromise: Promise<FinanceDatabase> | undefined;

export function initializeDatabase(): Promise<FinanceDatabase> {
  if (!initializationPromise) {
    initializationPromise = prepareDatabase().catch((error: unknown) => {
      initializationPromise = undefined;
      throw error;
    });
  }

  return initializationPromise;
}

async function prepareDatabase(): Promise<FinanceDatabase> {
  const db = await getDatabase();
  await migrate(db, migrations);
  seedDatabase(db);
  const recurringService = new RecurringService(
    new RecurringRuleRepository(db),
    new AccountRepository(db),
    new CategoryRepository(db),
  );
  await recurringService.generateDue(getLocalDateString(new Date()));
  return db;
}
