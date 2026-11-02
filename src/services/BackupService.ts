import {
  backupSchema,
  createTransactionsCsv,
  getUtf8ByteLength,
  maxBackupBytes,
  parseBackup,
} from '@/src/domain/backup';
import type { BackupRepository } from '@/src/repositories/BackupRepository';
import type { BackupData, BackupPayload } from '@/src/domain/backup';
import type { AttachmentFileStore } from './AttachmentFileStore';

export class BackupService<TResult> {
  constructor(
    private readonly repository: BackupRepository<TResult>,
    private readonly attachmentFiles?: AttachmentFileStore,
  ) {}

  async createBackup(now = Date.now()): Promise<string> {
    const data = await this.repository.exportAll();
    const attachments: BackupPayload['data']['attachments'] = [];
    let estimatedBytes = getUtf8ByteLength(JSON.stringify({ ...data, attachments: [] }));
    for (const attachment of data.attachments) {
      if (!this.attachmentFiles) throw new Error('attachment-store-unavailable');
      const contentBase64 = await this.attachmentFiles.readBase64(attachment.uri);
      estimatedBytes += getUtf8ByteLength(contentBase64);
      if (estimatedBytes > maxBackupBytes) throw new RangeError('backup-too-large');
      attachments.push({ ...attachment, contentBase64 });
    }
    const payload = backupSchema.parse({
      format: 'flfinance-backup',
      version: 3,
      exportedAt: now,
      data: { ...data, attachments },
    });
    const contents = JSON.stringify(payload);
    if (getUtf8ByteLength(contents) > maxBackupBytes) {
      throw new RangeError('backup-too-large');
    }
    return contents;
  }

  async restoreBackup(contents: string): Promise<void> {
    const payload = parseBackup(contents);
    const currentData = await this.repository.exportAll();
    const transactionIds = new Set(payload.data.transactions.map((transaction) => transaction.id));
    const tagIds = new Set(payload.data.tags.map((tag) => tag.id));
    if (
      payload.data.transactionTags.some(
        (relation) => !transactionIds.has(relation.transactionId) || !tagIds.has(relation.tagId),
      ) ||
      payload.data.attachments.some((attachment) => !transactionIds.has(attachment.transactionId))
    ) {
      throw new Error('invalid-backup');
    }

    const restoredAttachments: BackupData['attachments'] = [];
    try {
      for (const attachment of payload.data.attachments) {
        if (!this.attachmentFiles) throw new Error('attachment-store-unavailable');
        const { contentBase64, ...metadata } = attachment;
        const restored = await this.attachmentFiles.restoreBase64(
          contentBase64,
          metadata.id,
          metadata.mimeType,
        );
        if (restored.sizeBytes !== metadata.sizeBytes) {
          await this.attachmentFiles.remove(restored.uri);
          throw new Error('invalid-backup');
        }
        restoredAttachments.push({ ...metadata, uri: restored.uri });
      }
    } catch (error) {
      if (this.attachmentFiles) {
        const cleanupResults = await Promise.allSettled(
          restoredAttachments.map((attachment) => this.attachmentFiles?.remove(attachment.uri)),
        );
        const cleanupErrors = cleanupResults.flatMap((result) =>
          result.status === 'rejected' ? [result.reason] : [],
        );
        if (cleanupErrors.length > 0) {
          throw new AggregateError(
            [error, ...cleanupErrors],
            'Não foi possível preparar o backup nem limpar todos os anexos temporários.',
          );
        }
      }
      throw error;
    }
    try {
      await this.repository.replaceAll({
        ...payload.data,
        attachments: restoredAttachments,
      });
    } catch (error) {
      if (this.attachmentFiles) {
        const cleanupResults = await Promise.allSettled(
          restoredAttachments.map((attachment) => this.attachmentFiles?.remove(attachment.uri)),
        );
        const cleanupErrors = cleanupResults.flatMap((result) =>
          result.status === 'rejected' ? [result.reason] : [],
        );
        if (cleanupErrors.length > 0) {
          throw new AggregateError(
            [error, ...cleanupErrors],
            'Não foi possível restaurar o backup nem limpar todos os anexos temporários.',
          );
        }
      }
      throw error;
    }
    if (this.attachmentFiles) {
      const restoredUris = new Set(restoredAttachments.map((attachment) => attachment.uri));
      for (const oldAttachment of currentData.attachments) {
        if (!restoredUris.has(oldAttachment.uri)) {
          await this.attachmentFiles.remove(oldAttachment.uri);
        }
      }
    }
  }

  async createCsv(): Promise<string> {
    return createTransactionsCsv(await this.repository.exportAll());
  }
}
