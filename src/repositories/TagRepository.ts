import { asc, eq } from 'drizzle-orm';
import type { BaseSQLiteDatabase } from 'drizzle-orm/sqlite-core';

import { schema, tags, transactionTags, type Tag, type TransactionTag } from '@/src/db/schema';

type TagInsert = typeof tags.$inferInsert;

export interface TagRepositoryContract {
  create(tag: TagInsert): Promise<Tag>;
  list(): Promise<Tag[]>;
  findByName(name: string): Promise<Tag | undefined>;
  listForTransaction(transactionId: string): Promise<Tag[]>;
  listAssociations(): Promise<TransactionTag[]>;
  replaceForTransaction(transactionId: string, tagIds: string[]): Promise<void>;
}

export class TagRepository<TResult> implements TagRepositoryContract {
  constructor(private readonly db: BaseSQLiteDatabase<'sync', TResult, typeof schema>) {}

  async create(tag: TagInsert): Promise<Tag> {
    const [created] = await this.db.insert(tags).values(tag).returning();
    if (!created) throw new Error('O SQLite não retornou a tag recém-criada.');
    return created;
  }

  async list(): Promise<Tag[]> {
    return this.db.select().from(tags).orderBy(asc(tags.name));
  }

  async findByName(name: string): Promise<Tag | undefined> {
    const [tag] = await this.db.select().from(tags).where(eq(tags.name, name));
    return tag;
  }

  async listForTransaction(transactionId: string): Promise<Tag[]> {
    const rows = await this.db
      .select({ tag: tags })
      .from(transactionTags)
      .innerJoin(tags, eq(transactionTags.tagId, tags.id))
      .where(eq(transactionTags.transactionId, transactionId))
      .orderBy(asc(tags.name));
    return rows.map(({ tag }) => tag);
  }

  async listAssociations(): Promise<TransactionTag[]> {
    return this.db.select().from(transactionTags);
  }

  async replaceForTransaction(transactionId: string, tagIds: string[]): Promise<void> {
    this.db.transaction((transaction) => {
      transaction
        .delete(transactionTags)
        .where(eq(transactionTags.transactionId, transactionId))
        .run();
      if (tagIds.length > 0) {
        transaction
          .insert(transactionTags)
          .values(tagIds.map((tagId) => ({ transactionId, tagId })))
          .run();
      }
    });
  }
}
