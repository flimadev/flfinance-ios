import {
  backupSchema,
  createTransactionsCsv,
  getUtf8ByteLength,
  maxBackupBytes,
  parseBackup,
} from '@/src/domain/backup';
import type { BackupRepository } from '@/src/repositories/BackupRepository';

export class BackupService<TResult> {
  constructor(private readonly repository: BackupRepository<TResult>) {}

  async createBackup(now = Date.now()): Promise<string> {
    const payload = backupSchema.parse({
      format: 'flfinance-backup',
      version: 1,
      exportedAt: now,
      data: await this.repository.exportAll(),
    });
    const contents = JSON.stringify(payload);
    if (getUtf8ByteLength(contents) > maxBackupBytes) {
      throw new RangeError('backup-too-large');
    }
    return contents;
  }

  async restoreBackup(contents: string): Promise<void> {
    const payload = parseBackup(contents);
    await this.repository.replaceAll(payload.data);
  }

  async createCsv(): Promise<string> {
    return createTransactionsCsv(await this.repository.exportAll());
  }
}
