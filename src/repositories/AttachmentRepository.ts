import { asc, eq } from 'drizzle-orm';
import type { BaseSQLiteDatabase } from 'drizzle-orm/sqlite-core';

import { attachments, schema, type Attachment } from '@/src/db/schema';

type AttachmentInsert = typeof attachments.$inferInsert;

export interface AttachmentRepositoryContract {
  create(attachment: AttachmentInsert): Promise<Attachment>;
  findById(id: string): Promise<Attachment | undefined>;
  listForTransaction(transactionId: string): Promise<Attachment[]>;
  listAll(): Promise<Attachment[]>;
  remove(id: string): Promise<Attachment | undefined>;
}

export class AttachmentRepository<TResult> implements AttachmentRepositoryContract {
  constructor(private readonly db: BaseSQLiteDatabase<'sync', TResult, typeof schema>) {}

  async create(attachment: AttachmentInsert): Promise<Attachment> {
    const [created] = await this.db.insert(attachments).values(attachment).returning();
    if (!created) throw new Error('O SQLite não retornou o anexo recém-criado.');
    return created;
  }

  async findById(id: string): Promise<Attachment | undefined> {
    const [attachment] = await this.db.select().from(attachments).where(eq(attachments.id, id));
    return attachment;
  }

  async listForTransaction(transactionId: string): Promise<Attachment[]> {
    return this.db
      .select()
      .from(attachments)
      .where(eq(attachments.transactionId, transactionId))
      .orderBy(asc(attachments.createdAt));
  }

  async listAll(): Promise<Attachment[]> {
    return this.db.select().from(attachments);
  }

  async remove(id: string): Promise<Attachment | undefined> {
    const [removed] = await this.db.delete(attachments).where(eq(attachments.id, id)).returning();
    return removed;
  }
}
