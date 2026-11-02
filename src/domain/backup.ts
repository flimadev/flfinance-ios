import { z } from 'zod';

import {
  accountTypes,
  attachmentMimeTypes,
  categoryKinds,
  paymentMethods,
  transactionKinds,
  type Account,
  type Attachment,
  type Budget,
  type Category,
  type Invoice,
  type RecurringRule,
  type Tag,
  type Transaction,
  type TransactionTag,
} from '@/src/db/schema';

const id = z.string().min(1).max(100);
const timestamp = z.number().int().safe();
const cents = z.number().int().safe();
const nullableTimestamp = timestamp.nullable();
const nullableId = id.nullable();
const date = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((value) => {
    const parsed = new Date(`${value}T00:00:00.000Z`);
    return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
  });
const month = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/);

const accountSchema = z
  .object({
    id,
    name: z.string().min(1).max(120),
    type: z.enum(accountTypes),
    initialBalanceCents: cents,
    closingDay: z.number().int().min(1).max(31).nullable(),
    dueDay: z.number().int().min(1).max(31).nullable(),
    color: z.string().min(1).max(30),
    icon: z.string().min(1).max(100),
    currency: z.literal('BRL'),
    archivedAt: nullableTimestamp,
    deletedAt: nullableTimestamp,
    createdAt: timestamp,
    updatedAt: timestamp,
  })
  .strict();

const categorySchema = z
  .object({
    id,
    name: z.string().min(1).max(120),
    kind: z.enum(categoryKinds),
    icon: z.string().min(1).max(100),
    color: z.string().min(1).max(30),
    parentId: nullableId,
    sortOrder: z.number().int().safe(),
    archivedAt: nullableTimestamp,
    deletedAt: nullableTimestamp,
    createdAt: timestamp,
    updatedAt: timestamp,
  })
  .strict();

const transactionSchema = z
  .object({
    id,
    accountId: id,
    categoryId: nullableId,
    kind: z.enum(transactionKinds),
    amountCents: cents.positive(),
    date,
    description: z.string().min(1).max(120),
    notes: z.string().max(1000).nullable(),
    paymentMethod: z.enum(paymentMethods).nullable(),
    transferAccountId: nullableId,
    installmentGroupId: nullableId,
    installmentNumber: z.number().int().positive().nullable(),
    installmentTotal: z.number().int().positive().nullable(),
    invoiceId: nullableId,
    recurringId: nullableId,
    isPaid: z.boolean(),
    deletedAt: nullableTimestamp,
    createdAt: timestamp,
    updatedAt: timestamp,
  })
  .strict();

const invoiceSchema = z
  .object({
    id,
    accountId: id,
    billingMonth: month,
    dueDate: date,
    status: z.enum(['open', 'paid']),
    paidAt: nullableTimestamp,
    paymentAccountId: nullableId,
    paymentTransactionId: nullableId,
    createdAt: timestamp,
    updatedAt: timestamp,
  })
  .strict();

const recurringRuleSchema = z
  .object({
    id,
    accountId: id,
    categoryId: nullableId,
    kind: z.enum(['expense', 'income']),
    amountCents: cents.positive(),
    description: z.string().min(1).max(120),
    paymentMethod: z.enum(paymentMethods).nullable(),
    startDate: date,
    endDate: date.nullable(),
    dayOfMonth: z.number().int().min(1).max(31),
    isActive: z.boolean(),
    lastGeneratedDate: date.nullable(),
    createdAt: timestamp,
    updatedAt: timestamp,
  })
  .strict();

const budgetSchema = z
  .object({
    id,
    categoryId: id,
    month,
    amountCents: cents.positive(),
    createdAt: timestamp,
    updatedAt: timestamp,
  })
  .strict();

const backupDataV1Schema = z
  .object({
    accounts: z.array(accountSchema).max(100_000),
    categories: z.array(categorySchema).max(100_000),
    transactions: z.array(transactionSchema).max(500_000),
    invoices: z.array(invoiceSchema).max(100_000),
    recurringRules: z.array(recurringRuleSchema).max(100_000),
    budgets: z.array(budgetSchema).max(100_000),
    appMetadata: z.array(z.object({ key: id, value: z.string().max(10_000) }).strict()).max(10_000),
  })
  .strict();

const tagSchema = z
  .object({
    id,
    name: z.string().min(1).max(80),
    color: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
    createdAt: timestamp,
    updatedAt: timestamp,
  })
  .strict();

const transactionTagSchema = z.object({ transactionId: id, tagId: id }).strict();

const attachmentSchema = z
  .object({
    id,
    transactionId: id,
    uri: z.string().min(1).max(2048),
    mimeType: z.enum(attachmentMimeTypes),
    fileName: z.string().max(255).nullable(),
    sizeBytes: z
      .number()
      .int()
      .positive()
      .max(5 * 1024 * 1024),
    createdAt: timestamp,
    contentBase64: z.string().min(1).max(7_000_000),
  })
  .strict();

const backupDataSchema = backupDataV1Schema
  .extend({
    tags: z.array(tagSchema).max(10_000),
    transactionTags: z.array(transactionTagSchema).max(500_000),
    attachments: z.array(attachmentSchema).max(10_000),
  })
  .strict();

const legacyBackupSchema = z
  .object({
    format: z.literal('flfinance-backup'),
    version: z.literal(1),
    exportedAt: timestamp,
    data: backupDataV1Schema,
  })
  .strict();

export const backupSchema = z
  .object({
    format: z.literal('flfinance-backup'),
    version: z.literal(2),
    exportedAt: timestamp,
    data: backupDataSchema,
  })
  .strict();

export type BackupData = {
  accounts: Account[];
  categories: Category[];
  transactions: Transaction[];
  invoices: Invoice[];
  recurringRules: RecurringRule[];
  budgets: Budget[];
  tags: Tag[];
  transactionTags: TransactionTag[];
  appMetadata: { key: string; value: string }[];
  attachments: Attachment[];
};
export type BackupPayload = z.infer<typeof backupSchema>;

export const maxBackupBytes = 25 * 1024 * 1024;

export function getUtf8ByteLength(text: string): number {
  let bytes = 0;
  for (const character of text) {
    const codePoint = character.codePointAt(0) ?? 0;
    bytes += codePoint <= 0x7f ? 1 : codePoint <= 0x7ff ? 2 : codePoint <= 0xffff ? 3 : 4;
  }
  return bytes;
}

export function parseBackup(text: string): BackupPayload {
  const bytes = getUtf8ByteLength(text);
  if (bytes > maxBackupBytes) {
    throw new RangeError('backup-too-large');
  }
  let value: unknown;
  try {
    value = JSON.parse(text.startsWith('\uFEFF') ? text.slice(1) : text);
  } catch {
    throw new Error('invalid-backup');
  }
  const parsed = backupSchema.safeParse(value);
  if (parsed.success) {
    return parsed.data;
  }
  const legacy = legacyBackupSchema.safeParse(value);
  if (!legacy.success) {
    throw new Error('invalid-backup');
  }
  return {
    format: legacy.data.format,
    version: 2,
    exportedAt: legacy.data.exportedAt,
    data: {
      ...legacy.data.data,
      tags: [],
      transactionTags: [],
      attachments: [],
    },
  };
}

function csvCell(value: string | number): string {
  const text = String(value);
  const safeText =
    typeof value === 'string' && /^[\s\u0000-\u001f]*[-=+@]/.test(text) ? `'${text}` : text;
  return `"${safeText.replaceAll('"', '""')}"`;
}

export function createTransactionsCsv(data: BackupData): string {
  const accounts = new Map(data.accounts.map((account) => [account.id, account.name]));
  const categories = new Map(data.categories.map((category) => [category.id, category.name]));
  const rows = [
    [
      'data',
      'tipo',
      'descricao',
      'conta',
      'conta_destino',
      'categoria',
      'valor_centavos',
      'status',
    ],
    ...data.transactions
      .filter((transaction) => transaction.deletedAt === null)
      .sort(
        (first, second) =>
          first.date.localeCompare(second.date) || first.id.localeCompare(second.id),
      )
      .map((transaction) => [
        transaction.date,
        transaction.kind,
        transaction.description,
        accounts.get(transaction.accountId) ?? '',
        transaction.transferAccountId ? (accounts.get(transaction.transferAccountId) ?? '') : '',
        transaction.categoryId ? (categories.get(transaction.categoryId) ?? '') : '',
        transaction.kind === 'expense' ? -transaction.amountCents : transaction.amountCents,
        transaction.isPaid ? 'pago' : 'pendente',
      ]),
  ];
  return `\uFEFF${rows.map((row) => row.map(csvCell).join(',')).join('\r\n')}`;
}
