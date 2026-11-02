import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';

import migrations from '../drizzle/migrations';
import { schema } from '../src/db/schema';
import { getLocalDateString } from '../src/domain/transactions';
import { AccountRepository } from '../src/repositories/AccountRepository';
import { CategoryRepository } from '../src/repositories/CategoryRepository';
import { InvoiceRepository } from '../src/repositories/InvoiceRepository';
import { RecurringRuleRepository } from '../src/repositories/RecurringRuleRepository';
import { TransactionRepository } from '../src/repositories/TransactionRepository';
import { AccountService } from '../src/services/AccountService';
import { CardService } from '../src/services/CardService';
import { CategoryService } from '../src/services/CategoryService';
import { InvoiceService } from '../src/services/InvoiceService';
import { RecurringService } from '../src/services/RecurringService';

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

describe('credit card and recurring services', () => {
  let database: ReturnType<typeof createTestDatabase>;
  let accounts: AccountService;
  let categories: CategoryService;
  let cards: CardService;
  let invoices: InvoiceService;
  let recurring: RecurringService;
  let nextId: number;
  const now = Date.UTC(2025, 0, 15, 12);

  beforeEach(() => {
    database = createTestDatabase();
    nextId = 0;
    const options = {
      createId: () => `test-${++nextId}`,
      now: () => now,
    };
    const accountRepository = new AccountRepository(database.db);
    const categoryRepository = new CategoryRepository(database.db);
    const invoiceRepository = new InvoiceRepository(database.db);
    const recurringRepository = new RecurringRuleRepository(database.db);
    const transactionRepository = new TransactionRepository(database.db);

    accounts = new AccountService(accountRepository, options);
    categories = new CategoryService(categoryRepository, options);
    cards = new CardService(invoiceRepository, accountRepository, categoryRepository, options);
    invoices = new InvoiceService(
      invoiceRepository,
      accountRepository,
      transactionRepository,
      options,
    );
    recurring = new RecurringService(
      recurringRepository,
      accountRepository,
      categoryRepository,
      options,
    );
  });

  afterEach(() => {
    database.client.close();
  });

  it('upgrades an existing account table without rebuilding or losing account data', () => {
    const client = new Database(':memory:');
    client.pragma('foreign_keys = ON');
    const migrationSql = Object.values(migrations.migrations);
    migrationSql.slice(0, 2).forEach((migration) => {
      migration.split('--> statement-breakpoint').forEach((statement) => {
        client.exec(statement);
      });
    });
    client
      .prepare(
        `INSERT INTO accounts
          (id, name, type, initial_balance_cents, color, icon, currency, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        'existing-account',
        'Conta existente',
        'checking',
        12_500,
        '#147A58',
        'wallet',
        'BRL',
        1,
        1,
      );

    migrationSql[2].split('--> statement-breakpoint').forEach((statement) => {
      client.exec(statement);
    });

    expect(
      client
        .prepare('SELECT id, name, initial_balance_cents, closing_day, due_day FROM accounts')
        .get(),
    ).toEqual({
      id: 'existing-account',
      name: 'Conta existente',
      initial_balance_cents: 12_500,
      closing_day: null,
      due_day: null,
    });
    expect(client.pragma('foreign_key_check')).toEqual([]);
    expect(() =>
      client.prepare('UPDATE accounts SET closing_day = 32 WHERE id = ?').run('existing-account'),
    ).toThrow();
    client.close();
  });

  async function createCard() {
    return accounts.create({
      name: 'Cartão principal',
      type: 'credit_card',
      initialBalanceCents: 0,
      color: '#147A58',
      icon: 'creditcard.fill',
      closingDay: 31,
      dueDay: 10,
    });
  }

  async function createExpenseCategory() {
    return categories.create({
      name: 'Mercado',
      kind: 'expense',
      icon: 'cart.fill',
      color: '#147A58',
    });
  }

  it('creates linked installments and reuses an invoice for the same billing month', async () => {
    const card = await createCard();
    const category = await createExpenseCategory();
    const created = await cards.createInstallmentPurchase({
      accountId: card.id,
      categoryId: category.id,
      amountCents: 10_000,
      date: '2025-12-31',
      description: 'Compra de fim de ano',
      installmentCount: 3,
    });

    expect(created).toHaveLength(3);
    expect(created.map((item) => item.amountCents)).toEqual([3_334, 3_333, 3_333]);
    expect(created.every((item) => item.invoiceId !== null)).toBe(true);
    expect(new Set(created.map((item) => item.invoiceId)).size).toBe(3);
    await expect(invoices.listByAccount(card.id)).resolves.toHaveLength(3);
  });

  it('pays an invoice using a current-date transfer and is idempotent', async () => {
    const card = await createCard();
    const category = await createExpenseCategory();
    const paymentAccount = await accounts.create({
      name: 'Conta corrente',
      type: 'checking',
      initialBalanceCents: 50_000,
      color: '#147A58',
      icon: 'building.columns.fill',
    });
    const [purchase] = await cards.createInstallmentPurchase({
      accountId: card.id,
      categoryId: category.id,
      amountCents: 4_500,
      date: '2025-01-31',
      description: 'Compra à vista',
      installmentCount: 1,
    });
    const invoice = (await invoices.listByAccount(card.id))[0];

    const paid = await invoices.pay(invoice.id, paymentAccount.id);
    const paidAgain = await invoices.pay(invoice.id, paymentAccount.id);
    const transactions = await new TransactionRepository(database.db).list({});

    expect(paid.status).toBe('paid');
    expect(paid.paymentAccountId).toBe(paymentAccount.id);
    expect(paidAgain.paymentTransactionId).toBe(paid.paymentTransactionId);
    expect(transactions).toHaveLength(2);
    expect(transactions.find((item) => item.id === purchase.id)?.isPaid).toBe(true);
    expect(transactions.find((item) => item.kind === 'transfer')).toMatchObject({
      accountId: paymentAccount.id,
      transferAccountId: card.id,
      date: getLocalDateString(new Date(now)),
      amountCents: 4_500,
    });
  });

  it('generates monthly rules once, handling month ends and reruns idempotently', async () => {
    const account = await accounts.create({
      name: 'Conta corrente',
      type: 'checking',
      initialBalanceCents: 0,
      color: '#147A58',
      icon: 'building.columns.fill',
    });
    const category = await createExpenseCategory();
    await recurring.createRule({
      accountId: account.id,
      categoryId: category.id,
      kind: 'expense',
      amountCents: 1_250,
      description: 'Assinatura mensal',
      startDate: '2024-01-31',
      frequency: 'monthly',
    });

    await expect(recurring.generateDue('2024-04-30')).resolves.toBe(4);
    await expect(recurring.generateDue('2024-04-30')).resolves.toBe(0);
    const created = await new TransactionRepository(database.db).list({});
    expect(created.map((item) => item.date).sort()).toEqual([
      '2024-01-31',
      '2024-02-29',
      '2024-03-31',
      '2024-04-30',
    ]);
  });
});
