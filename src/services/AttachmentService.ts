import { attachmentMimeTypes, type Attachment } from '@/src/db/schema';
import { z } from 'zod';

import type { AttachmentRepositoryContract } from '@/src/repositories/AttachmentRepository';
import {
  createServiceId,
  getServiceTimestamp,
  parseInput,
  type ServiceOptions,
} from './serviceUtils';
import type { AttachmentFileStore } from './AttachmentFileStore';

const createAttachmentSchema = z.object({
  id: z.string().trim().min(1).max(80).optional(),
  transactionId: z.string().trim().min(1).max(80),
  sourceUri: z.string().min(1).max(2048),
  mimeType: z.enum(attachmentMimeTypes),
  fileName: z.string().trim().max(255).nullable().optional(),
  sizeBytes: z
    .number()
    .int()
    .positive()
    .max(5 * 1024 * 1024),
});

export type CreateAttachmentInput = z.input<typeof createAttachmentSchema>;
export type AttachmentMimeType = z.infer<typeof createAttachmentSchema>['mimeType'];

export class AttachmentService {
  constructor(
    private readonly repository: AttachmentRepositoryContract,
    private readonly fileStore: AttachmentFileStore,
    private readonly options: ServiceOptions = {},
  ) {}

  async add(input: CreateAttachmentInput): Promise<Attachment> {
    const values = parseInput(createAttachmentSchema, input);
    const id = values.id ?? createServiceId(this.options);
    if (values.id) {
      const existing = await this.repository.findById(id);
      if (existing) {
        if (
          existing.transactionId === values.transactionId &&
          existing.mimeType === values.mimeType &&
          existing.fileName === (values.fileName ?? null) &&
          existing.sizeBytes === values.sizeBytes
        ) {
          return existing;
        }
        throw new Error('attachment-id-conflict');
      }
    }
    const stored = await this.fileStore.copyIntoStore(values.sourceUri, id, values.mimeType);
    if (stored.sizeBytes <= 0 || stored.sizeBytes > 5 * 1024 * 1024) {
      await this.fileStore.remove(stored.uri);
      throw new Error('attachment-too-large');
    }
    try {
      return await this.repository.create({
        id,
        transactionId: values.transactionId,
        uri: stored.uri,
        mimeType: values.mimeType,
        fileName: values.fileName ?? null,
        sizeBytes: stored.sizeBytes,
        createdAt: getServiceTimestamp(this.options),
      });
    } catch (error) {
      await this.fileStore.remove(stored.uri);
      throw error;
    }
  }

  async listForTransaction(transactionId: string): Promise<Attachment[]> {
    return this.repository.listForTransaction(transactionId);
  }

  async listAll(): Promise<Attachment[]> {
    return this.repository.listAll();
  }

  async remove(id: string): Promise<void> {
    const attachment = await this.repository.remove(id);
    if (attachment) await this.fileStore.remove(attachment.uri);
  }
}
