import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { eq } from 'drizzle-orm';

import migrations from '../drizzle/migrations';
import {
  accounts as accountsTable,
  categories as categoriesTable,
  schema,
  transactions as transactionsTable,
} from '../src/db/schema';
import { DomainRuleError, ValidationError } from '../src/domain/errors';
import { AccountRepository } from '../src/repositories/AccountRepository';
import { CategoryRepository } from '../src/repositories/CategoryRepository';
import { TransactionRepository } from '../src/repositories/TransactionRepository';
import { AccountService } from '../src/services/AccountService';
import { CategoryService } from '../src/services/CategoryService';
import { TransactionService } from '../src/services/TransactionService';
import { seedDatabase } from '../src/db/seed';

function createTestDatabase() {
  const client = new Database(':memory:');
  client.pragma('foreign_keys = ON');
  const db = drizzle(client, { schema });

  Object.values(migrations.migrations).forEach((migration) => {
    migration.split('--> statement-breakpoint').forEach((statement) => {
      client.exec(statement);
    });
  });

  return { client, db };
}

describe('finance services', () => {
  let database: ReturnType<typeof createTestDatabase>;
  let accounts: AccountService;
  let categories: CategoryService;
  let transactionService: TransactionService;
  let nextId: number;
  const now = 1_750_000_000_000;

  beforeEach(() => {
    database = createTestDatabase();
    nextId = 0;
    const options = {
      createId: () => `test-${++nextId}`,
      now: () => now + nextId,
    };
    const accountRepository = new AccountRepository(database.db);
    const categoryRepository = new CategoryRepository(database.db);
    const transactionRepository = new TransactionRepository(database.db);
    accounts = new AccountService(accountRepository, options);
    categories = new CategoryService(categoryRepository, options);
    transactionService = new TransactionService(
      transactionRepository,
      accountRepository,
      categoryRepository,
      options,
    );
  });

  afterEach(() => {
    database.client.close();
  });

  it('creates and lists accounts, categories, and transactions in integer cents', async () => {
    const account = await accounts.create({
      name: 'Conta principal',
      type: 'checking',
      initialBalanceCents: 25_050,
      color: '#147A58',
      icon: 'building.columns.fill',
    });
    const category = await categories.create({
      name: 'Mercado',
      kind: 'expense',
      icon: 'cart.fill',
      color: '#147A58',
    });
    const transaction = await transactionService.create({
      accountId: account.id,
      categoryId: category.id,
      kind: 'expense',
      amountCents: 1_299,
      date: '2025-06-18',
      description: 'Feira da semana',
      paymentMethod: 'pix',
    });

    expect(transaction.amountCents).toBe(1_299);
    expect(transaction.date).toBe('2025-06-18');
    await expect(accounts.list()).resolves.toHaveLength(1);
    await expect(categories.list()).resolves.toHaveLength(1);
    await expect(transactionService.list()).resolves.toHaveLength(1);
  });

  it('rejects fractional amounts and invalid local dates independently', async () => {
    const account = await accounts.create({
      name: 'Dinheiro',
      type: 'cash',
      initialBalanceCents: 0,
      color: '#147A58',
      icon: 'wallet.bifold.fill',
    });

    await expect(
      transactionService.create({
        accountId: account.id,
        kind: 'expense',
        amountCents: 12.5,
        date: '2025-02-28',
        description: 'Inválido',
      }),
    ).rejects.toBeInstanceOf(ValidationError);

    await expect(
      transactionService.create({
        accountId: account.id,
        kind: 'expense',
        amountCents: 125,
        date: '2025-02-31',
        description: 'Data inválida',
      }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it('enforces transfer and category rules before writing', async () => {
    const account = await accounts.create({
      name: 'Conta principal',
      type: 'checking',
      initialBalanceCents: 0,
      color: '#147A58',
      icon: 'building.columns.fill',
    });
    const expenseCategory = await categories.create({
      name: 'Mercado',
      kind: 'expense',
      icon: 'cart.fill',
      color: '#147A58',
    });

    await expect(
      transactionService.create({
        accountId: account.id,
        categoryId: expenseCategory.id,
        kind: 'income',
        amountCents: 100,
        date: '2025-06-18',
        description: 'Categoria incompatível',
      }),
    ).rejects.toBeInstanceOf(DomainRuleError);

    await expect(
      transactionService.create({
        accountId: account.id,
        kind: 'transfer',
        transferAccountId: account.id,
        amountCents: 100,
        date: '2025-06-18',
        description: 'Transferência inválida',
      }),
    ).rejects.toBeInstanceOf(DomainRuleError);

    expect(database.db.select().from(transactionsTable).all()).toHaveLength(0);
  });

  it('updates records and soft deletes transactions without erasing history', async () => {
    const account = await accounts.create({
      name: 'Conta principal',
      type: 'checking',
      initialBalanceCents: 0,
      color: '#147A58',
      icon: 'building.columns.fill',
    });
    const transaction = await transactionService.create({
      accountId: account.id,
      kind: 'expense',
      amountCents: 5_000,
      date: '2025-06-18',
      description: 'Compra',
    });

    await expect(accounts.update(account.id, { name: 'Conta diária' })).resolves.toMatchObject({
      name: 'Conta diária',
    });
    await expect(
      transactionService.update(transaction.id, { amountCents: 4_500 }),
    ).resolves.toMatchObject({ amountCents: 4_500 });
    await transactionService.remove(transaction.id);

    await expect(transactionService.list()).resolves.toHaveLength(0);
    expect(
      database.db
        .select()
        .from(transactionsTable)
        .where(eq(transactionsTable.id, transaction.id))
        .get()?.deletedAt,
    ).toEqual(now + 2);

    await transactionService.restore(transaction.id);
    await expect(transactionService.list()).resolves.toHaveLength(1);
  });

  it('creates transfers between distinct accounts and includes both sides in account filters', async () => {
    const source = await accounts.create({
      name: 'Conta corrente',
      type: 'checking',
      initialBalanceCents: 0,
      color: '#147A58',
      icon: 'building.columns.fill',
    });
    const destination = await accounts.create({
      name: 'Poupança',
      type: 'savings',
      initialBalanceCents: 0,
      color: '#5071A5',
      icon: 'building.2.fill',
    });

    const transfer = await transactionService.create({
      accountId: source.id,
      transferAccountId: destination.id,
      kind: 'transfer',
      amountCents: 5_000,
      date: '2025-06-18',
      description: 'Reserva mensal',
      paymentMethod: 'transfer',
    });

    expect(transfer.transferAccountId).toBe(destination.id);
    await expect(transactionService.list({ accountId: destination.id })).resolves.toHaveLength(1);
  });

  it('filters transaction history and seeds defaults only once', async () => {
    const account = await accounts.create({
      name: 'Conta principal',
      type: 'checking',
      initialBalanceCents: 0,
      color: '#147A58',
      icon: 'building.columns.fill',
    });
    await transactionService.create({
      accountId: account.id,
      kind: 'expense',
      amountCents: 100,
      date: '2025-06-18',
      description: 'Mercado local',
    });
    await transactionService.create({
      accountId: account.id,
      kind: 'expense',
      amountCents: 200,
      date: '2025-06-19',
      description: 'Farmácia',
    });

    await expect(
      transactionService.list({ fromDate: '2025-06-19', query: 'Farmácia' }),
    ).resolves.toHaveLength(1);
    await expect(
      transactionService.list({ fromDate: '2025-06-20', toDate: '2025-06-19' }),
    ).rejects.toBeInstanceOf(ValidationError);

    let seedId = 0;
    const seedOptions = { createId: () => `seed-${++seedId}`, now: () => now };
    seedDatabase(database.db, seedOptions);
    seedDatabase(database.db, seedOptions);
    expect(database.db.select().from(accountsTable).all()).toHaveLength(2);
    expect(database.db.select().from(categoriesTable).all()).toHaveLength(9);
  });
});
