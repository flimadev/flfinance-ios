import * as Crypto from 'expo-crypto';
import { Directory, File, Paths } from 'expo-file-system';

export interface AttachmentFileStore {
  copyIntoStore(
    sourceUri: string,
    attachmentId: string,
    mimeType: string,
  ): Promise<{ uri: string; sizeBytes: number }>;
  readBase64(uri: string): Promise<string>;
  restoreBase64(
    content: string,
    attachmentId: string,
    mimeType: string,
  ): Promise<{ uri: string; sizeBytes: number }>;
  remove(uri: string): Promise<void>;
}

export class ExpoAttachmentFileStore implements AttachmentFileStore {
  private readonly directory = new Directory(Paths.document, 'attachments');

  async copyIntoStore(
    sourceUri: string,
    attachmentId: string,
    mimeType: string,
  ): Promise<{ uri: string; sizeBytes: number }> {
    this.directory.create({ intermediates: true, idempotent: true });
    const source = new File(sourceUri);
    const sourceInfo = source.info();
    if (!sourceInfo.exists || typeof sourceInfo.size !== 'number' || sourceInfo.size <= 0) {
      throw new Error('attachment-file-unavailable');
    }
    if (sourceInfo.size > 5 * 1024 * 1024) throw new Error('attachment-too-large');
    const destination = this.makeFile(attachmentId, mimeType);
    try {
      await source.copy(destination);
    } catch (error) {
      if (destination.info().exists) destination.delete();
      throw error;
    }
    return { uri: destination.uri, sizeBytes: sourceInfo.size };
  }

  async readBase64(uri: string): Promise<string> {
    return new File(uri).base64();
  }

  async restoreBase64(
    content: string,
    attachmentId: string,
    mimeType: string,
  ): Promise<{ uri: string; sizeBytes: number }> {
    this.directory.create({ intermediates: true, idempotent: true });
    const destination = this.makeFile(`${attachmentId}-${Crypto.randomUUID()}`, mimeType);
    try {
      await destination.write(content, { encoding: 'base64' });
    } catch (error) {
      if (destination.info().exists) destination.delete();
      throw error;
    }
    const sizeBytes = destination.info().size;
    if (typeof sizeBytes !== 'number') throw new Error('attachment-file-unavailable');
    return { uri: destination.uri, sizeBytes };
  }

  async remove(uri: string): Promise<void> {
    const file = new File(uri);
    if (file.info().exists) file.delete();
  }

  private makeFile(attachmentId: string, mimeType: string): File {
    const extension =
      mimeType === 'image/png'
        ? 'png'
        : mimeType === 'image/webp'
          ? 'webp'
          : mimeType === 'image/heic'
            ? 'heic'
            : 'jpg';
    return new File(this.directory, `${attachmentId}.${extension}`);
  }
}
