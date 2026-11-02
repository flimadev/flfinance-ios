import { useCallback, useMemo, useState } from 'react';
import { useFocusEffect } from 'expo-router';

import type {
  Account,
  Category,
  RecurringRule,
  Tag,
  Transaction,
  TransactionTag,
} from '@/src/db/schema';
import { buildFinancialReport, type FinancialReportFilters } from '@/src/domain/reports';
import { ptBR } from '@/src/i18n/pt-BR';
import { getTransactionServices } from '@/src/features/transactions/transactionData';

type ReportsData = {
  accounts: Account[];
  categories: Category[];
  transactions: Transaction[];
  recurringRules: RecurringRule[];
  tags: Tag[];
  transactionTags: TransactionTag[];
};

const emptyData: ReportsData = {
  accounts: [],
  categories: [],
  transactions: [],
  recurringRules: [],
  tags: [],
  transactionTags: [],
};

export function useReports(filters: FinancialReportFilters) {
  const [data, setData] = useState(emptyData);
  const [loading, setLoading] = useState(true);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const { accountService, categoryService, recurringService, tagService, transactionService } =
        await getTransactionServices();
      const [accounts, categories, transactions, recurringRules, tags, transactionTags] =
        await Promise.all([
          accountService.list(),
          categoryService.list(),
          transactionService.list(),
          recurringService.listActiveRules(),
          tagService.list(),
          tagService.listAssociations(),
        ]);
      setData({ accounts, categories, transactions, recurringRules, tags, transactionTags });
      setError(null);
    } catch (loadError) {
      console.error('Não foi possível carregar os relatórios.', loadError);
      setError(loadError instanceof Error ? loadError.message : ptBR.errors.unexpected);
    } finally {
      setHasLoaded(true);
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void reload();
    }, [reload]),
  );

  const result = useMemo(() => {
    if (!hasLoaded || error) {
      return { report: null, reportError: null };
    }
    try {
      return {
        report: buildFinancialReport({
          ...data,
          filters,
          uncategorizedLabel: ptBR.reports.uncategorized,
          missingCategoryLabel: ptBR.reports.category,
          missingAccountLabel: ptBR.reports.account,
        }),
        reportError: null,
      };
    } catch (reportError) {
      console.error('Não foi possível calcular os relatórios.', reportError);
      return {
        report: null,
        reportError: reportError instanceof Error ? reportError.message : ptBR.errors.unexpected,
      };
    }
  }, [data, error, filters, hasLoaded]);

  return {
    ...data,
    ...result,
    loading,
    error,
    reload,
  };
}
