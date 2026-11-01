import { z } from 'zod';

import { accountTypes, categoryKinds, paymentMethods, transactionKinds } from '@/src/db/schema';

const nameSchema = z.string().trim().min(1).max(80);
const colorSchema = z.string().regex(/^#[0-9A-Fa-f]{6}$/);
const iconSchema = z.string().trim().min(1).max(80);
const idSchema = z.string().trim().min(1).max(80);
const moneySchema = z.number().int().safe();

export const createAccountSchema = z.object({
  name: nameSchema,
  type: z.enum(accountTypes),
  initialBalanceCents: moneySchema,
  color: colorSchema,
  icon: iconSchema,
  currency: z.literal('BRL').default('BRL'),
});

export const updateAccountSchema = createAccountSchema
  .partial()
  .refine((value) => Object.keys(value).length > 0);

export const createCategorySchema = z.object({
  name: nameSchema,
  kind: z.enum(categoryKinds),
  icon: iconSchema,
  color: colorSchema,
  parentId: idSchema.nullable().optional(),
  sortOrder: z.number().int().safe().default(0),
});

export const updateCategorySchema = createCategorySchema
  .partial()
  .refine((value) => Object.keys(value).length > 0);

const localDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((value) => {
    const date = new Date(`${value}T00:00:00.000Z`);
    return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
  });

const transactionFieldsSchema = z.object({
  accountId: idSchema,
  categoryId: idSchema.nullable().optional(),
  kind: z.enum(transactionKinds),
  amountCents: moneySchema.positive(),
  date: localDateSchema,
  description: z.string().trim().min(1).max(120),
  notes: z.string().trim().max(1000).nullable().optional(),
  paymentMethod: z.enum(paymentMethods).nullable().optional(),
  transferAccountId: idSchema.nullable().optional(),
  installmentGroupId: idSchema.nullable().optional(),
  installmentNumber: z.number().int().safe().positive().nullable().optional(),
  installmentTotal: z.number().int().safe().positive().nullable().optional(),
  invoiceId: idSchema.nullable().optional(),
  recurringId: idSchema.nullable().optional(),
  isPaid: z.boolean().default(true),
});

export const createTransactionSchema = transactionFieldsSchema.superRefine(
  (transaction, context) => {
    const { installmentNumber, installmentTotal } = transaction;
    if (!(
      (installmentNumber == null && installmentTotal == null) ||
      (installmentNumber !== undefined &&
        installmentNumber !== null &&
        installmentTotal !== undefined &&
        installmentTotal !== null &&
        installmentNumber <= installmentTotal)
    )) {
      context.addIssue({
        code: 'custom',
        path: ['installmentNumber'],
        message: 'Informe o número e o total de parcelas em uma ordem válida.',
      });
    }

    const isTransfer = transaction.kind === 'transfer';
    const hasTransferAccount = Boolean(transaction.transferAccountId);

    if (isTransfer !== hasTransferAccount) {
      context.addIssue({
        code: 'custom',
        path: ['transferAccountId'],
        message: 'Informe a conta de destino somente para transferências.',
      });
    }

    if (isTransfer && transaction.categoryId) {
      context.addIssue({
        code: 'custom',
        path: ['categoryId'],
        message: 'Transferências não usam categoria.',
      });
    }

    if (transaction.paymentMethod === 'transfer' && transaction.kind !== 'transfer') {
      context.addIssue({
        code: 'custom',
        path: ['paymentMethod'],
        message: 'A forma de pagamento transferência exige uma transferência.',
      });
    }
  },
);

export const updateTransactionSchema = transactionFieldsSchema
  .partial()
  .refine((value) => Object.keys(value).length > 0);

export const transactionFiltersSchema = z
  .object({
    accountId: idSchema.optional(),
    categoryId: idSchema.optional(),
    fromDate: localDateSchema.optional(),
    toDate: localDateSchema.optional(),
    query: z.string().trim().max(120).optional(),
  })
  .refine(
    ({ fromDate, toDate }) => fromDate === undefined || toDate === undefined || fromDate <= toDate,
    { path: ['toDate'], message: 'O fim do período deve ser posterior ao início.' },
  );

export type CreateAccountInput = z.input<typeof createAccountSchema>;
export type UpdateAccountInput = z.input<typeof updateAccountSchema>;
export type CreateCategoryInput = z.input<typeof createCategorySchema>;
export type UpdateCategoryInput = z.input<typeof updateCategorySchema>;
export type CreateTransactionInput = z.input<typeof createTransactionSchema>;
export type UpdateTransactionInput = z.input<typeof updateTransactionSchema>;
export type TransactionFilters = z.input<typeof transactionFiltersSchema>;
