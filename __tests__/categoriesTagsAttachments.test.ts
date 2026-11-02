import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';

import migrations from '../drizzle/migrations';
import { accounts, categories, schema, transactions } from '../src/db/schema';
import { AttachmentRepository } from '../src/repositories/AttachmentRepository';
import { CategoryRepository } from '../src/repositories/CategoryRepository';
import { TagRepository } from '../src/repositories/TagRepository';
import type { AttachmentFileStore } from '../src/services/AttachmentFileStore';
import { AttachmentService } from '../src/services/AttachmentService';
import { CategoryService } from '../src/services/CategoryService';
import { TagService } from '../src/services/TagService';
import { TransactionRepository } from '../src/repositories/TransactionRepository';

const now = Date.UTC(2026, 4, 20);

function createTestDatabase() {
  const client = new Database(':memory:');
  client.pragma('foreign_keys = ON');
  const db = drizzle(client, { schema });
  Object.values(migrations.migrations).forEach((migration) => {
    migration.split('--> statement-breakpoint').forEach((statement) => client.exec(statement));
  });
  return { client, db };
}

describe('categories, tags, and attachments', () => {
  let database: ReturnType<typeof createTestDatabase>;

  beforeEach(async () => {
    database = createTestDatabase();
    await database.db.insert(accounts).values({
      id: 'account-1',
      name: 'Conta principal',
      type: 'checking',
      initialBalanceCents: 0,
      color: '#147A58',
      icon: 'wallet',
      currency: 'BRL',
      createdAt: now,
      updatedAt: now,
    });
    await database.db.insert(categories).values([
      {
        id: 'parent',
        name: 'Casa',
        kind: 'expense',
        icon: 'house.fill',
        color: '#147A58',
        sortOrder: 0,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: 'child',
        name: 'Aluguel',
        kind: 'expense',
        icon: 'building.2.fill',
        color: '#5071A5',
        parentId: 'parent',
        sortOrder: 0,
        createdAt: now,
        updatedAt: now,
      },
    ]);
    await database.db.insert(transactions).values({
      id: 'transaction-1',
      accountId: 'account-1',
      categoryId: 'child',
      kind: 'expense',
      amountCents: 1000,
      date: '2026-05-20',
      description: 'Aluguel',
      isPaid: true,
      createdAt: now,
      updatedAt: now,
    });
  });

  afterEach(() => {
    database.client.close();
  });

  it('archives and restores a category subtree', async () => {
    const service = new CategoryService(new CategoryRepository(database.db), {
      now: () => now + 1,
    });

    await service.archive('parent');
    let rows = await new CategoryRepository(database.db).list();
    expect(rows.filter((category) => category.archivedAt !== null)).toHaveLength(2);

    await service.restore('parent');
    rows = await new CategoryRepository(database.db).list();
    expect(rows.every((category) => category.archivedAt === null)).toBe(true);
  });

  it('filters transactions by an associated tag', async () => {
    const repository = new TagRepository(database.db);
    const service = new TagService(repository, {
      createId: () => 'tag-travel',
      now: () => now,
    });
    const tag = await service.create({ name: 'Viagem', color: '#5071A5' });
    await service.setForTransaction({ transactionId: 'transaction-1', tagIds: [tag.id] });

    const transactionRepository = new TransactionRepository(database.db);
    await expect(transactionRepository.list({ tagId: tag.id })).resolves.toHaveLength(1);
    await expect(transactionRepository.list({ tagId: 'missing' })).resolves.toHaveLength(0);
  });

  it('copies image files into managed storage and removes them with their records', async () => {
    const fileStore: AttachmentFileStore = {
      copyIntoStore: jest.fn(async () => ({
        uri: 'file:///documents/attachments/image.jpg',
        sizeBytes: 1024,
      })),
      readBase64: jest.fn(async () => 'aW1hZ2U='),
      restoreBase64: jest.fn(async () => ({
        uri: 'file:///documents/attachments/restored.jpg',
        sizeBytes: 4,
      })),
      remove: jest.fn(async () => {}),
    };
    const service = new AttachmentService(new AttachmentRepository(database.db), fileStore, {
      createId: () => 'attachment-1',
      now: () => now,
    });

    const attachment = await service.add({
      transactionId: 'transaction-1',
      sourceUri: 'file:///picker/photo.jpg',
      mimeType: 'image/jpeg',
      fileName: 'photo.jpg',
      sizeBytes: 1024,
    });
    expect(attachment.uri).toBe('file:///documents/attachments/image.jpg');
    await expect(service.listForTransaction('transaction-1')).resolves.toHaveLength(1);

    await service.remove(attachment.id);
    expect(fileStore.remove).toHaveBeenCalledWith(attachment.uri);
    await expect(service.listForTransaction('transaction-1')).resolves.toHaveLength(0);
  });

  it('rejects attachments above the supported size limit', async () => {
    const fileStore: AttachmentFileStore = {
      copyIntoStore: jest.fn(async () => ({ uri: 'file:///documents/image.jpg', sizeBytes: 10 })),
      readBase64: jest.fn(async () => ''),
      restoreBase64: jest.fn(async () => ({ uri: '', sizeBytes: 0 })),
      remove: jest.fn(async () => {}),
    };
    const service = new AttachmentService(new AttachmentRepository(database.db), fileStore);

    await expect(
      service.add({
        transactionId: 'transaction-1',
        sourceUri: 'file:///picker/photo.jpg',
        mimeType: 'image/jpeg',
        sizeBytes: 5 * 1024 * 1024 + 1,
      }),
    ).rejects.toThrow();
    expect(fileStore.copyIntoStore).not.toHaveBeenCalled();
  });
});
