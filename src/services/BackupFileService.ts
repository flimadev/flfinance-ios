import * as DocumentPicker from 'expo-document-picker';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';

import { maxBackupBytes } from '@/src/domain/backup';

export async function shareTextFile(
  contents: string,
  filename: string,
  mimeType: string,
  dialogTitle: string,
): Promise<void> {
  if (Platform.OS === 'web' || !(await Sharing.isAvailableAsync())) {
    throw new Error('share-unavailable');
  }
  const file = new File(Paths.cache, filename);
  await file.write(contents);
  await Sharing.shareAsync(file.uri, { mimeType, dialogTitle });
}

export async function pickBackupContents(): Promise<string | null> {
  if (Platform.OS === 'web') {
    throw new Error('file-picker-unavailable');
  }
  const result = await DocumentPicker.getDocumentAsync({
    type: ['application/json', 'text/json'],
    copyToCacheDirectory: true,
    multiple: false,
  });
  if (result.canceled) {
    return null;
  }

  const asset = result.assets[0];
  if (!asset) {
    throw new Error('invalid-backup');
  }
  if (asset.size !== undefined && asset.size > maxBackupBytes) {
    throw new Error('backup-too-large');
  }
  const file = new File(asset.uri);
  const info = file.info();
  if (!info.exists) {
    throw new Error('invalid-backup');
  }
  if (typeof info.size === 'number' && info.size > maxBackupBytes) {
    throw new Error('backup-too-large');
  }
  return file.text();
}
