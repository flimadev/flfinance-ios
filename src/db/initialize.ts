import { migrate } from 'drizzle-orm/expo-sqlite/migrator';

import migrations from '../../drizzle/migrations';
import { getDatabase, type FinanceDatabase } from './client';
import { seedDatabase } from './seed';

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
  return db;
}
