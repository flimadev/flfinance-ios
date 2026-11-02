import { strFromU8, unzipSync } from 'fflate';

import { getUtf8ByteLength } from '@/src/domain/backup';

export type StatementImportRow = {
  date: string;
  description: string;
  kind: 'expense' | 'income';
  amountCents: number;
};

export type StatementTable = {
  format: 'csv' | 'xlsx';
  headers: string[];
  rows: string[][];
  mapping: StatementColumnMapping;
};

export type ParsedStatement =
  | { format: 'ofx'; rows: StatementImportRow[] }
  | StatementTable;

export type StatementColumnMapping = {
  dateColumn: number;
  descriptionColumn: number;
  amountColumn: number;
  kindColumn: number | null;
  amountInCents: boolean;
};

export const maxStatementFileBytes = 10 * 1024 * 1024;
const maxStatementRows = 10_000;
const maxXlsxExpandedBytes = 25 * 1024 * 1024;

function assertStatementSize(byteLength: number): void {
  if (byteLength > maxStatementFileBytes) {
    throw new RangeError('statement-file-too-large');
  }
}

function normalizeHeader(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

export function inferStatementMapping(headers: string[]): StatementColumnMapping {
  const normalized = headers.map(normalizeHeader);
  const findColumn = (patterns: string[]): number =>
    normalized.findIndex((header) => patterns.some((pattern) => header.includes(pattern)));
  const dateColumn = findColumn(['data', 'date', 'dtposted']);
  const descriptionColumn = findColumn(['descricao', 'historico', 'memo', 'name', 'payee']);
  const amountColumn = findColumn(['valorcentavos', 'amountcents', 'valor', 'amount', 'trnamt']);
  const kindColumn = findColumn(['tipo', 'kind', 'trntype']);

  return {
    dateColumn: dateColumn < 0 ? 0 : dateColumn,
    descriptionColumn: descriptionColumn < 0 ? Math.min(1, headers.length - 1) : descriptionColumn,
    amountColumn: amountColumn < 0 ? Math.min(2, headers.length - 1) : amountColumn,
    kindColumn: kindColumn < 0 ? null : kindColumn,
    amountInCents:
      amountColumn >= 0 &&
      ['valorcentavos', 'amountcents'].some((pattern) => normalized[amountColumn]?.includes(pattern)),
  };
}

function detectCsvDelimiter(firstLine: string): string {
  const candidates = [',', ';', '\t'];
  return candidates.reduce((selected, candidate) => {
    const count = firstLine.split(candidate).length;
    return count > firstLine.split(selected).length ? candidate : selected;
  }, ',');
}

export function parseCsvTable(contents: string): string[][] {
  const text = contents.startsWith('\uFEFF') ? contents.slice(1) : contents;
  if (getUtf8ByteLength(text) > maxStatementFileBytes) {
    throw new RangeError('statement-file-too-large');
  }
  const delimiter = detectCsvDelimiter(text.split(/\r?\n/, 1)[0] ?? '');
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index] ?? '';
    const next = text[index + 1] ?? '';
    if (quoted) {
      if (character === '"' && next === '"') {
        cell += '"';
        index += 1;
      } else if (character === '"') {
        quoted = false;
      } else {
        cell += character;
      }
    } else if (character === '"' && cell.length === 0) {
      quoted = true;
    } else if (character === delimiter) {
      row.push(cell);
      cell = '';
    } else if (character === '\n' || character === '\r') {
      if (character === '\r' && next === '\n') {
        index += 1;
      }
      row.push(cell);
      if (row.some((value) => value.length > 0)) {
        rows.push(row);
        if (rows.length > maxStatementRows + 1) {
          throw new RangeError('statement-too-many-rows');
        }
      }
      row = [];
      cell = '';
    } else {
      cell += character;
    }
  }

  if (quoted) {
    throw new Error('invalid-statement-file');
  }
  row.push(cell);
  if (row.some((value) => value.length > 0)) {
    rows.push(row);
  }
  if (rows.length < 2 || rows.length > maxStatementRows + 1) {
    throw new Error('invalid-statement-file');
  }
  return rows;
}

function decodeXmlText(value: string): string {
  return value.replace(
    /&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos);/gi,
    (entity, value: string) => {
      if (value.startsWith('#x')) {
        return String.fromCodePoint(Number.parseInt(value.slice(2), 16));
      }
      if (value.startsWith('#')) {
        return String.fromCodePoint(Number.parseInt(value.slice(1), 10));
      }
      return {
        amp: '&',
        lt: '<',
        gt: '>',
        quot: '"',
        apos: "'",
      }[value.toLowerCase()] ?? entity;
    },
  );
}

function readLittleEndianUint32(bytes: Uint8Array, offset: number): number {
  return (
    (bytes[offset] ?? 0) |
    ((bytes[offset + 1] ?? 0) << 8) |
    ((bytes[offset + 2] ?? 0) << 16) |
    ((bytes[offset + 3] ?? 0) << 24)
  ) >>> 0;
}

function getUncompressedZipSize(bytes: Uint8Array): number {
  let endOffset = -1;
  const searchStart = Math.max(0, bytes.length - 65_557);
  for (let offset = bytes.length - 22; offset >= searchStart; offset -= 1) {
    if (
      bytes[offset] === 0x50 &&
      bytes[offset + 1] === 0x4b &&
      bytes[offset + 2] === 0x05 &&
      bytes[offset + 3] === 0x06
    ) {
      endOffset = offset;
      break;
    }
  }
  if (endOffset < 0) {
    throw new Error('invalid-statement-file');
  }

  const entryCount = (bytes[endOffset + 10] ?? 0) | ((bytes[endOffset + 11] ?? 0) << 8);
  const directorySize = readLittleEndianUint32(bytes, endOffset + 12);
  let offset = readLittleEndianUint32(bytes, endOffset + 16);
  const directoryEnd = offset + directorySize;
  let total = 0;

  for (let index = 0; index < entryCount; index += 1) {
    if (
      bytes[offset] !== 0x50 ||
      bytes[offset + 1] !== 0x4b ||
      bytes[offset + 2] !== 0x01 ||
      bytes[offset + 3] !== 0x02 ||
      offset + 46 > directoryEnd
    ) {
      throw new Error('invalid-statement-file');
    }
    const uncompressedSize = readLittleEndianUint32(bytes, offset + 24);
    if (uncompressedSize === 0xffffffff) {
      throw new RangeError('statement-file-too-large');
    }
    total += uncompressedSize;
    if (total > maxXlsxExpandedBytes) {
      throw new RangeError('statement-file-too-large');
    }
    const nameLength = (bytes[offset + 28] ?? 0) | ((bytes[offset + 29] ?? 0) << 8);
    const extraLength = (bytes[offset + 30] ?? 0) | ((bytes[offset + 31] ?? 0) << 8);
    const commentLength = (bytes[offset + 32] ?? 0) | ((bytes[offset + 33] ?? 0) << 8);
    offset += 46 + nameLength + extraLength + commentLength;
  }
  if (offset > directoryEnd) {
    throw new Error('invalid-statement-file');
  }
  return total;
}

function getXmlAttribute(attributes: string, name: string): string | null {
  const match = new RegExp(`(?:^|\\s)${name}="([^"]*)"`, 'i').exec(attributes);
  return match?.[1] ?? null;
}

function parseXlsxTable(bytes: Uint8Array): string[][] {
  assertStatementSize(bytes.byteLength);
  if (getUncompressedZipSize(bytes) > maxXlsxExpandedBytes) {
    throw new RangeError('statement-file-too-large');
  }
  const files = unzipSync(bytes);
  const readFile = (name: string): string => {
    const contents = files[name];
    if (!contents) {
      throw new Error('invalid-statement-file');
    }
    return strFromU8(contents);
  };
  const workbook = readFile('xl/workbook.xml');
  const relationshipId = /<sheet\b[^>]*\br:id="([^"]+)"/i.exec(workbook)?.[1];
  if (!relationshipId) {
    throw new Error('invalid-statement-file');
  }
  const relationships = readFile('xl/_rels/workbook.xml.rels');
  const relationship = [...relationships.matchAll(/<Relationship\b([^>]*)\/?>/gi)]
    .map((match) => match[1] ?? '')
    .find((attributes) => getXmlAttribute(attributes, 'Id') === relationshipId);
  const target = relationship ? getXmlAttribute(relationship, 'Target') : null;
  if (!target || target.includes('..')) {
    throw new Error('invalid-statement-file');
  }
  const sheetPath = target.startsWith('/') ? target.slice(1) : `xl/${target}`;
  const worksheet = readFile(sheetPath);
  const sharedStrings = files['xl/sharedStrings.xml']
    ? [...strFromU8(files['xl/sharedStrings.xml']).matchAll(/<si\b[^>]*>([\s\S]*?)<\/si>/gi)].map(
        (match) =>
          [...(match[1] ?? '').matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>/gi)]
            .map((text) => decodeXmlText(text[1] ?? ''))
            .join(''),
      )
    : [];
  const rows: string[][] = [];
  const columnIndex = (reference: string): number => {
    const letters = /^[A-Z]+/i.exec(reference)?.[0].toUpperCase();
    if (!letters) {
      throw new Error('invalid-statement-file');
    }
    const index =
      [...letters].reduce((value, letter) => value * 26 + letter.charCodeAt(0) - 64, 0) - 1;
    if (index >= 100) {
      throw new Error('invalid-statement-file');
    }
    return index;
  };

  for (const rowMatch of worksheet.matchAll(/<row\b[^>]*>([\s\S]*?)<\/row>/gi)) {
    const row: string[] = [];
    for (const cellMatch of (rowMatch[1] ?? '').matchAll(/<c\b([^>]*)>([\s\S]*?)<\/c>/gi)) {
      const attributes = cellMatch[1] ?? '';
      const body = cellMatch[2] ?? '';
      const reference = getXmlAttribute(attributes, 'r');
      if (!reference) {
        throw new Error('invalid-statement-file');
      }
      const index = columnIndex(reference);
      const type = getXmlAttribute(attributes, 't');
      let value = '';
      if (type === 'inlineStr') {
        value = [...body.matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>/gi)]
          .map((text) => decodeXmlText(text[1] ?? ''))
          .join('');
      } else {
        value = /<v\b[^>]*>([\s\S]*?)<\/v>/i.exec(body)?.[1] ?? '';
        if (type === 's') {
          value = sharedStrings[Number(value)] ?? '';
        } else {
          value = decodeXmlText(value);
        }
      }
      row[index] = value;
    }
    if (row.some((value) => value !== undefined && value.length > 0)) {
      rows.push(row.map((value) => value ?? ''));
      if (rows.length > maxStatementRows + 1) {
        throw new RangeError('statement-too-many-rows');
      }
    }
  }
  if (rows.length < 2) {
    throw new Error('invalid-statement-file');
  }
  return rows;
}

function parseLocalDate(value: string): string {
  const trimmed = value.trim();
  const compact = /^(\d{4})(\d{2})(\d{2})/.exec(trimmed);
  const normalized = compact
    ? `${compact[1]}-${compact[2]}-${compact[3]}`
    : /^(\d{2})\/(\d{2})\/(\d{4})$/.test(trimmed)
      ? `${trimmed.slice(6, 10)}-${trimmed.slice(3, 5)}-${trimmed.slice(0, 2)}`
      : /^(\d{4}-\d{2}-\d{2})/.exec(trimmed)?.[1] ?? trimmed;
  const date = new Date(`${normalized}T00:00:00.000Z`);
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(normalized) ||
    Number.isNaN(date.getTime()) ||
    date.toISOString().slice(0, 10) !== normalized
  ) {
    throw new Error('invalid-statement-date');
  }
  return normalized;
}

function parseAmountCents(value: string, amountInCents: boolean): number {
  let normalized = value.trim().replace(/[\sR$]/g, '');
  let negative = false;
  if (normalized.startsWith('(') && normalized.endsWith(')')) {
    negative = true;
    normalized = normalized.slice(1, -1);
  }
  if (normalized.startsWith('-')) {
    negative = true;
    normalized = normalized.slice(1);
  } else if (normalized.startsWith('+')) {
    normalized = normalized.slice(1);
  }

  if (amountInCents) {
    if (!/^\d+$/.test(normalized)) {
      throw new Error('invalid-statement-amount');
    }
    const cents = Number(normalized);
    if (!Number.isSafeInteger(cents)) {
      throw new RangeError('statement-amount-too-large');
    }
    return negative ? -cents : cents;
  }

  const commaIndex = normalized.lastIndexOf(',');
  const dotIndex = normalized.lastIndexOf('.');
  let whole = normalized;
  let fraction = '';
  if (commaIndex > dotIndex) {
    whole = normalized.slice(0, commaIndex).replaceAll('.', '');
    fraction = normalized.slice(commaIndex + 1);
  } else if (dotIndex >= 0) {
    whole = normalized.slice(0, dotIndex).replaceAll(',', '');
    fraction = normalized.slice(dotIndex + 1);
  }
  if (!/^\d+$/.test(whole) || (fraction !== '' && !/^\d{1,2}$/.test(fraction))) {
    throw new Error('invalid-statement-amount');
  }
  const cents = Number(whole) * 100 + Number(fraction.padEnd(2, '0') || 0);
  if (!Number.isSafeInteger(cents)) {
    throw new RangeError('statement-amount-too-large');
  }
  return negative ? -cents : cents;
}

function parseKind(value: string, signedAmountCents: number): 'expense' | 'income' {
  const normalized = normalizeHeader(value);
  if (['expense', 'despesa', 'debit', 'debito', 'payment'].includes(normalized)) {
    return 'expense';
  }
  if (['income', 'receita', 'credit', 'credito', 'deposit'].includes(normalized)) {
    return 'income';
  }
  if (normalized === 'ofx') {
    throw new Error('invalid-statement-kind');
  }
  return signedAmountCents < 0 ? 'expense' : 'income';
}

export function mapStatementRows(
  rows: string[][],
  mapping: StatementColumnMapping,
): StatementImportRow[] {
  const imported = rows.slice(1).map((row) => {
    const dateValue = row[mapping.dateColumn];
    const descriptionValue = row[mapping.descriptionColumn];
    const amountValue = row[mapping.amountColumn];
    if (!dateValue || !descriptionValue?.trim() || amountValue === undefined) {
      throw new Error('invalid-statement-row');
    }
    const signedAmountCents = parseAmountCents(amountValue, mapping.amountInCents);
    if (signedAmountCents === 0) {
      throw new Error('invalid-statement-amount');
    }
    const kindValue =
      mapping.kindColumn === null ? '' : (row[mapping.kindColumn] ?? '');
    return {
      date: parseLocalDate(dateValue),
      description: descriptionValue.trim().slice(0, 120),
      amountCents: Math.abs(signedAmountCents),
      kind: parseKind(kindValue, signedAmountCents),
    };
  });
  if (imported.length === 0 || imported.length > maxStatementRows) {
    throw new Error('invalid-statement-file');
  }
  return imported;
}

export function parseOfx(contents: string): StatementImportRow[] {
  if (getUtf8ByteLength(contents) > maxStatementFileBytes) {
    throw new RangeError('statement-file-too-large');
  }
  const transactions = [...contents.matchAll(/<STMTTRN\b[^>]*>([\s\S]*?)(?:<\/STMTTRN>|(?=<STMTTRN\b)|$)/gi)];
  if (transactions.length === 0 || transactions.length > maxStatementRows) {
    throw new Error('invalid-statement-file');
  }
  return transactions.map((match) => {
    const block = match[1] ?? '';
    const readTag = (tag: string) =>
      decodeXmlText(
        new RegExp(`<${tag}\\b[^>]*>([^<\\r\\n]*)`, 'i').exec(block)?.[1]?.trim() ?? '',
      );
    const date = readTag('DTPOSTED');
    const amount = readTag('TRNAMT');
    const description = readTag('NAME') || readTag('MEMO');
    if (!date || !amount || !description) {
      throw new Error('invalid-statement-row');
    }
    const signedAmountCents = parseAmountCents(amount, false);
    if (signedAmountCents === 0) {
      throw new Error('invalid-statement-amount');
    }
    return {
      date: parseLocalDate(date),
      description: description.slice(0, 120),
      amountCents: Math.abs(signedAmountCents),
      kind: parseKind(readTag('TRNTYPE'), signedAmountCents),
    };
  });
}

export function parseStatementFile(
  fileName: string,
  contents: string | Uint8Array,
): ParsedStatement {
  const extension = fileName.split('.').pop()?.toLowerCase();
  if (extension === 'ofx' || extension === 'qfx') {
    if (typeof contents !== 'string') {
      throw new Error('invalid-statement-file');
    }
    return { format: 'ofx', rows: parseOfx(contents) };
  }
  if (extension === 'csv') {
    if (typeof contents !== 'string') {
      throw new Error('invalid-statement-file');
    }
    const rows = parseCsvTable(contents);
    return {
      format: 'csv',
      headers: rows[0] ?? [],
      rows,
      mapping: inferStatementMapping(rows[0] ?? []),
    };
  }
  if (extension === 'xlsx') {
    if (!(contents instanceof Uint8Array)) {
      throw new Error('invalid-statement-file');
    }
    const rows = parseXlsxTable(contents);
    return {
      format: 'xlsx',
      headers: rows[0] ?? [],
      rows,
      mapping: inferStatementMapping(rows[0] ?? []),
    };
  }
  throw new Error('unsupported-statement-format');
}
