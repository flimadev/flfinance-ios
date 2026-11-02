import { addDatabaseChangeListener } from 'expo-sqlite';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { Platform } from 'react-native';

import type { Budget, Category, Transaction } from '@/src/db/schema';
import { getMonthPeriod } from '@/src/domain/dashboard';
import type { CreateBudgetInput } from '@/src/domain/financeSchemas';
import { ptBR } from '@/src/i18n/pt-BR';
import { getTransactionServices } from '@/src/features/transactions/transactionData';

type BudgetData = {
  budgets: Budget[];
  categories: Category[];
  transactions: Transaction[];
};

const emptyData: BudgetData = { budgets: [], categories: [], transactions: [] };

function getMonthBounds(month: string, monthStartDay: number) {
  const [year, monthNumber] = month.split('-').map(Number);
  return getMonthPeriod(new Date(year, monthNumber - 1, monthStartDay), 0, monthStartDay);
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : ptBR.errors.unexpected;
}

export function useBudgets(month: string, monthStartDay = 1) {
  const [data, setData] = useState<BudgetData>(emptyData);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const requestId = useRef(0);

  const reload = useCallback(
    async (showLoading = true) => {
      const currentRequestId = ++requestId.current;
      if (showLoading) {
        setLoading(true);
      }

      try {
        const services = await getTransactionServices();
        const bounds = getMonthBounds(month, monthStartDay);
        const [budgets, categories, transactions] = await Promise.all([
          services.budgetService.listByMonth(month),
          services.categoryService.list(),
          services.transactionService.list(bounds),
        ]);
        if (currentRequestId === requestId.current) {
          setData({ budgets, categories, transactions });
          setError(null);
        }
      } catch (loadError) {
        console.error('Não foi possível carregar os orçamentos.', loadError);
        if (currentRequestId === requestId.current) {
          setError(getErrorMessage(loadError));
        }
      } finally {
        if (currentRequestId === requestId.current) {
          setLoading(false);
        }
      }
    },
    [month, monthStartDay],
  );

  useFocusEffect(
    useCallback(() => {
      void reload();
    }, [reload]),
  );

  useEffect(() => {
    if (Platform.OS === 'web') {
      return;
    }

    const subscription = addDatabaseChangeListener(({ tableName }) => {
      if (tableName === 'budgets' || tableName === 'transactions' || tableName === 'categories') {
        void reload(false);
      }
    });

    return () => subscription.remove();
  }, [reload]);

  const saveBudget = useCallback(
    async (input: CreateBudgetInput) => {
      const { budgetService } = await getTransactionServices();
      const budget = await budgetService.save(input);
      await reload(false);
      return budget;
    },
    [reload],
  );

  return { ...data, loading, error, reload, saveBudget };
}
