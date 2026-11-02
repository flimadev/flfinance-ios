import * as DocumentPicker from 'expo-document-picker';
import { File } from 'expo-file-system';
import { Platform } from 'react-native';

import {
  maxStatementFileBytes,
  parseStatementFile,
  type ParsedStatement,
} from '@/src/domain/statementImport';

export type PickedStatement = {
  name: string;
  statement: ParsedStatement;
};

export async function pickStatementFile(): Promise<PickedStatement | null> {
  if (Platform.OS === 'web') {
    throw new Error('file-picker-unavailable');
  }
  const result = await DocumentPicker.getDocumentAsync({
    type: ['*/*'],
    copyToCacheDirectory: true,
    multiple: false,
  });
  if (result.canceled) {
    return null;
  }

  const asset = result.assets[0];
  if (!asset) {
    throw new Error('invalid-statement-file');
  }
  if (asset.size !== undefined && asset.size > maxStatementFileBytes) {
    throw new RangeError('statement-file-too-large');
  }
  const file = new File(asset.uri);
  const info = file.info();
  if (!info.exists) {
    throw new Error('invalid-statement-file');
  }
  if (typeof info.size === 'number' && info.size > maxStatementFileBytes) {
    throw new RangeError('statement-file-too-large');
  }

  const extension = asset.name.split('.').pop()?.toLowerCase();
  const contents =
    extension === 'xlsx'
      ? new Uint8Array(await file.arrayBuffer())
      : await file.text();
  return {
    name: asset.name,
    statement: parseStatementFile(asset.name, contents),
  };
}
