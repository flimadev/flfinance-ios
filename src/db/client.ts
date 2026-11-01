import { drizzle } from 'drizzle-orm/expo-sqlite';
import type { ExpoSQLiteDatabase } from 'drizzle-orm/expo-sqlite';

import { schema } from './schema';

export type FinanceDatabase = ExpoSQLiteDatabase<typeof schema>;

let databasePromise: Promise<FinanceDatabase> | undefined;

export function getDatabase(): Promise<FinanceDatabase> {
  if (!databasePromise) {
    databasePromise = openDatabase().catch((error: unknown) => {
      databasePromise = undefined;
      throw error;
    });
  }

  return databasePromise;
}

async function openDatabase(): Promise<FinanceDatabase> {
  const SQLite = await import('expo-sqlite');
  const client = await SQLite.openDatabaseAsync('flfinance.db');
  await client.execAsync('PRAGMA foreign_keys = ON;');
  return drizzle(client, { schema });
}
