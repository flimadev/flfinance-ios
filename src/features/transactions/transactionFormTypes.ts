import type { CreateTransactionInput } from '@/src/domain/financeSchemas';

export type TransactionFormInput = CreateTransactionInput & {
  installmentCount?: number;
  recurring?: boolean;
};
