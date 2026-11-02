import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';

import type { Account, Transaction } from '@/src/db/schema';
import type { StatementImportRow } from '@/src/domain/statementImport';
import { ptBR } from '@/src/i18n/pt-BR';
import { getTransactionServices } from '@/src/features/transactions/transactionData';

type ImportData = {
  accounts: Account[];
  transactions: Transaction[];
};

const emptyData: ImportData = { accounts: [], transactions: [] };

export function useStatementImport() {
  const [data, setData] = useState(emptyData);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const { accountService, transactionService } = await getTransactionServices();
      const [accounts, transactions] = await Promise.all([
        accountService.list(),
        transactionService.list(),
      ]);
      setData({ accounts, transactions });
      setError(null);
    } catch (loadError) {
      console.error('Não foi possível carregar as contas para importar o extrato.', loadError);
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

  const importRows = useCallback(
    async (rows: StatementImportRow[], accountId: string) => {
      const { transactionService } = await getTransactionServices();
      const result = await transactionService.importMany(
        rows.map((row) => ({
          accountId,
          categoryId: null,
          kind: row.kind,
          amountCents: row.amountCents,
          date: row.date,
          description: row.description,
          isPaid: true,
        })),
      );
      await reload();
      return result;
    },
    [reload],
  );

  return {
    ...data,
    loading,
    error,
    reload,
    importRows,
  };
}
