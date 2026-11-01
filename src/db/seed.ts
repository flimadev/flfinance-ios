import * as Crypto from 'expo-crypto';
import { eq } from 'drizzle-orm';
import type { BaseSQLiteDatabase } from 'drizzle-orm/sqlite-core';

import { appMetadata, accounts, categories, schema } from './schema';

type SeedOptions = {
  createId?: () => string;
  now?: () => number;
};

const seedMarker = 'initial_seed_v1';

const defaultCategories = [
  { name: 'Mercado', kind: 'expense', icon: 'cart.fill', color: '#147A58' },
  { name: 'Moradia', kind: 'expense', icon: 'house.fill', color: '#5071A5' },
  { name: 'Transporte', kind: 'expense', icon: 'car.fill', color: '#D68B2C' },
  { name: 'Alimentação', kind: 'expense', icon: 'fork.knife', color: '#B36C4B' },
  { name: 'Saúde', kind: 'expense', icon: 'cross.case.fill', color: '#B33E42' },
  { name: 'Lazer', kind: 'expense', icon: 'gamecontroller.fill', color: '#8466B2' },
  { name: 'Salário', kind: 'income', icon: 'briefcase.fill', color: '#18764F' },
  { name: 'Investimentos', kind: 'income', icon: 'chart.line.uptrend.xyaxis', color: '#5071A5' },
  { name: 'Outros', kind: 'income', icon: 'ellipsis.circle.fill', color: '#58675E' },
] as const;

export function seedDatabase<TResult>(
  db: BaseSQLiteDatabase<'sync', TResult, typeof schema>,
  options: SeedOptions = {},
): void {
  const createId = options.createId ?? Crypto.randomUUID;
  const now = (options.now ?? Date.now)();

  db.transaction((transaction) => {
    const existingSeed = transaction
      .select()
      .from(appMetadata)
      .where(eq(appMetadata.key, seedMarker))
      .get();

    if (existingSeed) {
      return;
    }

    transaction
      .insert(accounts)
      .values({
        id: createId(),
        name: 'Carteira',
        type: 'cash',
        initialBalanceCents: 0,
        color: '#147A58',
        icon: 'wallet.bifold.fill',
        currency: 'BRL',
        createdAt: now,
        updatedAt: now,
      })
      .run();

    transaction
      .insert(categories)
      .values(
        defaultCategories.map((category, index) => ({
          ...category,
          id: createId(),
          sortOrder: index,
          createdAt: now,
          updatedAt: now,
        })),
      )
      .run();

    transaction
      .insert(appMetadata)
      .values({ key: seedMarker, value: String(now) })
      .run();
  });
}
