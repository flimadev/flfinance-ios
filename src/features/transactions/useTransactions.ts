import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';

import type { Account, Category, Transaction } from '@/src/db/schema';
import type { UpdateTransactionInput } from '@/src/domain/financeSchemas';
import { getLocalDateString } from '@/src/domain/transactions';
import { ptBR } from '@/src/i18n/pt-BR';
import { getTransactionServices } from './transactionData';
import type { TransactionFormInput } from './transactionFormTypes';

type DataState = {
  accounts: Account[];
  categories: Category[];
  transactions: Transaction[];
};

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : ptBR.errors.unexpected;
}

export function useTransactions() {
  const [data, setData] = useState<DataState>({
    accounts: [],
    categories: [],
    transactions: [],
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async (showLoading = true) => {
    if (showLoading) {
      setLoading(true);
    }

    try {
      const { accountService, categoryService, transactionService } =
        await getTransactionServices();
      const [accounts, categories, transactions] = await Promise.all([
        accountService.list(),
        categoryService.list(),
        transactionService.list(),
      ]);
      setData({ accounts, categories, transactions });
      setError(null);
    } catch (loadError) {
      console.error('Não foi possível carregar os lançamentos.', loadError);
      setError(getErrorMessage(loadError));
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void reload();
    }, [reload]),
  );

  const create = useCallback(
    async (input: TransactionFormInput) => {
      const { installmentCount, recurring, ...transactionInput } = input;
      const services = await getTransactionServices();
      let transaction: Transaction | null;
      if (installmentCount !== undefined) {
        const created = await services.cardService.createInstallmentPurchase({
          accountId: transactionInput.accountId,
          categoryId: transactionInput.categoryId ?? null,
          amountCents: transactionInput.amountCents,
          date: transactionInput.date,
          description: transactionInput.description,
          installmentCount: installmentCount ?? 1,
        });
        transaction = created[0] ?? null;
      } else if (recurring && transactionInput.kind !== 'transfer') {
        await services.recurringService.createRule({
          accountId: transactionInput.accountId,
          categoryId: transactionInput.categoryId ?? null,
          kind: transactionInput.kind,
          amountCents: transactionInput.amountCents,
          description: transactionInput.description,
          paymentMethod: transactionInput.paymentMethod,
          startDate: transactionInput.date,
          frequency: 'monthly',
        });
        await services.recurringService.generateDue(getLocalDateString(new Date()));
        transaction = null;
      } else if (recurring) {
        throw new Error('Transferências não podem ser recorrentes.');
      } else {
        transaction = await services.transactionService.create(transactionInput);
      }
      await reload(false);
      return transaction;
    },
    [reload],
  );

  const update = useCallback(
    async (id: string, input: UpdateTransactionInput) => {
      const { transactionService } = await getTransactionServices();
      const transaction = await transactionService.update(id, input);
      await reload(false);
      return transaction;
    },
    [reload],
  );

  const remove = useCallback(
    async (id: string) => {
      const { transactionService } = await getTransactionServices();
      await transactionService.remove(id);
      await reload(false);
    },
    [reload],
  );

  const restore = useCallback(
    async (id: string) => {
      const { transactionService } = await getTransactionServices();
      await transactionService.restore(id);
      await reload(false);
    },
    [reload],
  );

  return { ...data, loading, error, reload, create, update, remove, restore };
}
