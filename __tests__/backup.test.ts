import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';

import migrations from '../drizzle/migrations';
import {
  accounts,
  appMetadata,
  budgets,
  categories,
  invoices,
  recurringRules,
  schema,
  tags,
  transactions,
  transactionTags,
  attachments,
} from '../src/db/schema';
import { createTransactionsCsv, parseBackup, type BackupData } from '../src/domain/backup';
import { BackupRepository } from '../src/repositories/BackupRepository';
import { BackupService } from '../src/services/BackupService';
import type { AttachmentFileStore } from '../src/services/AttachmentFileStore';

const now = Date.UTC(2026, 4, 20);
const emptyData: BackupData = {
  accounts: [],
  categories: [],
  transactions: [],
  invoices: [],
  recurringRules: [],
  budgets: [],
  tags: [],
  transactionTags: [],
  attachments: [],
  appMetadata: [],
};

function createTestDatabase() {
  const client = new Database(':memory:');
  client.pragma('foreign_keys = ON');
  const db = drizzle(client, { schema });
  Object.values(migrations.migrations).forEach((migration) => {
    migration.split('--> statement-breakpoint').forEach((statement) => client.exec(statement));
  });
  return { client, db };
}

describe('backup validation and export', () => {
  it('rejects malformed or unsupported backup files', () => {
    expect(() => parseBackup('{')).toThrow('invalid-backup');
    expect(() =>
      parseBackup(JSON.stringify({ format: 'flfinance-backup', version: 2, data: emptyData })),
    ).toThrow('invalid-backup');
  });

  it('upgrades valid version 1 backups when restoring', () => {
    const legacy = {
      format: 'flfinance-backup',
      version: 1,
      exportedAt: now,
      data: {
        accounts: [],
        categories: [],
        transactions: [],
        invoices: [],
        recurringRules: [],
        budgets: [],
        appMetadata: [],
      },
    };

    expect(parseBackup(JSON.stringify(legacy))).toMatchObject({
      version: 2,
      data: { tags: [], transactionTags: [], attachments: [] },
    });
  });

  it('exports active transactions as safely quoted CSV with exact cents', () => {
    const data: BackupData = {
      ...emptyData,
      accounts: [
        {
          id: 'account-1',
          name: 'Conta',
          type: 'checking',
          initialBalanceCents: 0,
          closingDay: null,
          dueDay: null,
          color: '#147A58',
          icon: 'wallet',
          currency: 'BRL',
          archivedAt: null,
          deletedAt: null,
          createdAt: now,
          updatedAt: now,
        },
      ],
      transactions: [
        {
          id: 'transaction-1',
          accountId: 'account-1',
          categoryId: null,
          kind: 'expense',
          amountCents: 2599,
          date: '2026-05-20',
          description: '=cmd,"teste"',
          notes: null,
          paymentMethod: null,
          transferAccountId: null,
          installmentGroupId: null,
          installmentNumber: null,
          installmentTotal: null,
          invoiceId: null,
          recurringId: null,
          isPaid: true,
          deletedAt: null,
          createdAt: now,
          updatedAt: now,
        },
      ],
    };

    const csv = createTransactionsCsv(data);
    expect(csv).toContain('"data","tipo","descricao"');
    expect(csv).toContain(`"'=cmd,""teste"""`);
    expect(csv).toContain('"-2599"');
  });
});

describe('backup restoration', () => {
  let database: ReturnType<typeof createTestDatabase>;
  let backupService: BackupService<unknown>;
  let fileStore: AttachmentFileStore;

  beforeEach(async () => {
    database = createTestDatabase();
    fileStore = {
      copyIntoStore: jest.fn(async () => ({
        uri: 'file:///attachments/copied.jpg',
        sizeBytes: 4,
      })),
      readBase64: jest.fn(async () => 'ZmFrZQ=='),
      restoreBase64: jest.fn(async (_contents, id) => ({
        uri: `file:///restored/${id}.jpg`,
        sizeBytes: 4,
      })),
      remove: jest.fn(async () => {}),
    };
    backupService = new BackupService(new BackupRepository(database.db), fileStore);
    await database.db.insert(accounts).values({
      id: 'account-1',
      name: 'Conta principal',
      type: 'checking',
      initialBalanceCents: 12345,
      color: '#147A58',
      icon: 'wallet',
      currency: 'BRL',
      createdAt: now,
      updatedAt: now,
    });
    await database.db.insert(categories).values({
      id: 'category-1',
      name: 'Mercado',
      kind: 'expense',
      icon: 'cart',
      color: '#147A58',
      createdAt: now,
      updatedAt: now,
    });
    await database.db.insert(invoices).values({
      id: 'invoice-1',
      accountId: 'account-1',
      billingMonth: '2026-05',
      dueDate: '2026-05-30',
      status: 'open',
      createdAt: now,
      updatedAt: now,
    });
    await database.db.insert(recurringRules).values({
      id: 'recurring-1',
      accountId: 'account-1',
      categoryId: 'category-1',
      kind: 'expense',
      amountCents: 1000,
      description: 'Assinatura',
      startDate: '2026-05-20',
      dayOfMonth: 20,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    });
    await database.db.insert(transactions).values({
      id: 'transaction-1',
      accountId: 'account-1',
      categoryId: 'category-1',
      kind: 'expense',
      amountCents: 2599,
      date: '2026-05-20',
      description: 'Compra',
      isPaid: true,
      createdAt: now,
      updatedAt: now,
    });
    await database.db.insert(tags).values({
      id: 'tag-1',
      name: 'Casa',
      color: '#5071A5',
      createdAt: now,
      updatedAt: now,
    });
    await database.db.insert(transactionTags).values({
      transactionId: 'transaction-1',
      tagId: 'tag-1',
    });
    await database.db.insert(attachments).values({
      id: 'attachment-1',
      transactionId: 'transaction-1',
      uri: 'file:///attachments/receipt.jpg',
      mimeType: 'image/jpeg',
      fileName: 'receipt.jpg',
      sizeBytes: 4,
      createdAt: now,
    });
    await database.db.insert(budgets).values({
      id: 'budget-1',
      categoryId: 'category-1',
      month: '2026-05',
      amountCents: 10000,
      createdAt: now,
      updatedAt: now,
    });
    await database.db.insert(appMetadata).values({ key: 'initial_seed_v1', value: 'ready' });
  });

  afterEach(() => {
    database.client.close();
  });

  it('restores every finance table in a fresh database', async () => {
    const contents = await backupService.createBackup(now);
    const payload = JSON.parse(contents) as { data: { accounts: unknown[] } };
    expect(payload.data.accounts).toHaveLength(1);

    const freshDatabase = createTestDatabase();
    try {
      const restoredFileStore: AttachmentFileStore = {
        ...fileStore,
        restoreBase64: jest.fn(async (_contents, id) => ({
          uri: `file:///restored/${id}.jpg`,
          sizeBytes: 4,
        })),
      };
      const freshBackupService = new BackupService(
        new BackupRepository(freshDatabase.db),
        restoredFileStore,
      );
      await freshBackupService.restoreBackup(contents);

      const restored = await new BackupRepository(freshDatabase.db).exportAll();
      expect(restored.accounts).toHaveLength(1);
      expect(restored.accounts[0]?.initialBalanceCents).toBe(12345);
      expect(restored.categories).toHaveLength(1);
      expect(restored.transactions).toHaveLength(1);
      expect(restored.invoices).toHaveLength(1);
      expect(restored.recurringRules).toHaveLength(1);
      expect(restored.budgets).toHaveLength(1);
      expect(restored.tags).toHaveLength(1);
      expect(restored.transactionTags).toHaveLength(1);
      expect(restored.attachments).toMatchObject([
        { id: 'attachment-1', uri: 'file:///restored/attachment-1.jpg' },
      ]);
      expect(restoredFileStore.restoreBase64).toHaveBeenCalledWith(
        'ZmFrZQ==',
        'attachment-1',
        'image/jpeg',
      );
      expect(restored.appMetadata).toEqual([{ key: 'initial_seed_v1', value: 'ready' }]);
    } finally {
      freshDatabase.client.close();
    }
  });

  it('leaves existing data intact when database constraints reject imported rows', async () => {
    const contents = await backupService.createBackup(now);
    const payload = JSON.parse(contents) as {
      data: { transactions: { accountId: string }[] };
    };
    const transaction = payload.data.transactions[0];
    if (!transaction) throw new Error('Expected exported transaction fixture.');
    transaction.accountId = 'missing-account';

    await expect(
      backupService.restoreBackup(
        JSON.stringify({
          format: 'flfinance-backup',
          version: 2,
          exportedAt: now,
          data: payload.data,
        }),
      ),
    ).rejects.toThrow();

    const restored = await new BackupRepository(database.db).exportAll();
    expect(restored.accounts.map(({ id }) => id)).toEqual(['account-1']);
    expect(restored.transactions.map(({ id }) => id)).toEqual(['transaction-1']);
  });

  it('keeps the seed marker when a valid backup omits internal metadata', async () => {
    const payload = parseBackup(await backupService.createBackup(now));
    await backupService.restoreBackup(
      JSON.stringify({
        ...payload,
        data: { ...payload.data, appMetadata: [] },
      }),
    );

    const metadata = await database.db.select().from(appMetadata);
    expect(metadata).toEqual([{ key: 'initial_seed_v1', value: expect.any(String) }]);
  });
});
