import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';

import type { Account, Category, Transaction } from '@/src/db/schema';
import { ptBR } from '@/src/i18n/pt-BR';
import { getTransactionServices } from '@/src/features/transactions/transactionData';

type DashboardData = {
  accounts: Account[];
  categories: Category[];
  transactions: Transaction[];
};

const emptyData: DashboardData = {
  accounts: [],
  categories: [],
  transactions: [],
};

export function useDashboard() {
  const [data, setData] = useState(emptyData);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
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
      console.error('Não foi possível carregar o dashboard.', loadError);
      setError(loadError instanceof Error ? loadError.message : ptBR.errors.unexpected);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void reload();
    }, [reload]),
  );

  return { ...data, loading, error, reload };
}
