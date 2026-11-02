import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';

import { getNextMonthlyOccurrence } from '@/src/domain/debts';
import type { Account, Transaction } from '@/src/db/schema';
import type { InvoiceWithTotal } from '@/src/services/InvoiceService';
import { getLocalDateString } from '@/src/domain/transactions';
import { ptBR } from '@/src/i18n/pt-BR';
import { getTransactionServices } from '@/src/features/transactions/transactionData';
import { useAppPreferences } from '@/src/preferences/AppPreferencesProvider';
import { PaymentReminderService } from '@/src/services/PaymentReminderService';

export type DebtItem =
  | {
      kind: 'transaction';
      direction: 'payable' | 'receivable';
      id: string;
      description: string;
      accountName: string;
      dueDate: string;
      amountCents: number;
      installmentNumber: number | null;
      installmentTotal: number | null;
    }
  | {
      kind: 'invoice';
      direction: 'payable';
      id: string;
      invoiceId: string;
      description: string;
      accountName: string;
      dueDate: string;
      amountCents: number;
    };

export type RecurringDebtItem = {
  id: string;
  direction: 'payable' | 'receivable';
  description: string;
  accountName: string;
  nextDate: string;
  amountCents: number;
};

type DebtData = {
  debts: DebtItem[];
  recurringDebts: RecurringDebtItem[];
  paymentAccounts: Account[];
};

const emptyDebtData: DebtData = { debts: [], recurringDebts: [], paymentAccounts: [] };

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : ptBR.debts.loadError;
}

function toTransactionDebt(transaction: Transaction, account: Account): DebtItem {
  return {
    kind: 'transaction',
    direction: transaction.kind === 'income' ? 'receivable' : 'payable',
    id: transaction.id,
    description: transaction.description,
    accountName: account.name,
    dueDate: transaction.date,
    amountCents: transaction.amountCents,
    installmentNumber: transaction.installmentNumber,
    installmentTotal: transaction.installmentTotal,
  };
}

function toInvoiceDebt(invoice: InvoiceWithTotal, account: Account): DebtItem {
  const invoiceMonth = new Intl.DateTimeFormat('pt-BR', {
    month: 'long',
    year: 'numeric',
  }).format(
    new Date(
      Number(invoice.billingMonth.slice(0, 4)),
      Number(invoice.billingMonth.slice(5, 7)) - 1,
      1,
    ),
  );

  return {
    kind: 'invoice',
    direction: 'payable',
    id: `invoice-${invoice.id}`,
    invoiceId: invoice.id,
    description: ptBR.cards.invoice(invoiceMonth),
    accountName: account.name,
    dueDate: invoice.dueDate,
    amountCents: invoice.totalCents,
  };
}

export function useDebts() {
  const { preferences } = useAppPreferences();
  const [data, setData] = useState<DebtData>(emptyDebtData);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [operationError, setOperationError] = useState<string | null>(null);
  const [reminderError, setReminderError] = useState<string | null>(null);

  const synchronizeReminders = useCallback(async () => {
    if (preferences.paymentReminderDays === 0) {
      return;
    }

    try {
      await new PaymentReminderService().synchronize(preferences.paymentReminderDays);
      setReminderError(null);
    } catch (syncError) {
      console.error('Não foi possível atualizar os lembretes de vencimento.', syncError);
      setReminderError(ptBR.debts.reminderSyncError);
    }
  }, [preferences.paymentReminderDays]);

  const reload = useCallback(
    async (showLoading = true) => {
      if (showLoading) {
        setLoading(true);
      }

      try {
        const { accountService, invoiceService, recurringService, transactionService } =
          await getTransactionServices();
        const [accounts, transactions, recurringRules] = await Promise.all([
          accountService.list(),
          transactionService.list(),
          recurringService.listActiveRules(),
        ]);
        const accountsById = new Map(accounts.map((account) => [account.id, account]));
        const creditCards = accounts.filter((account) => account.type === 'credit_card');
        const invoiceRows = await Promise.all(
          creditCards.map(async (account) => ({
            account,
            invoices: await invoiceService.listByAccount(account.id),
          })),
        );
        const transactionDebts = transactions
          .filter(
            (transaction) =>
              (transaction.kind === 'expense' || transaction.kind === 'income') &&
              !transaction.isPaid &&
              transaction.invoiceId === null &&
              accountsById.get(transaction.accountId)?.type !== 'credit_card',
          )
          .flatMap((transaction) => {
            const account = accountsById.get(transaction.accountId);
            return account ? [toTransactionDebt(transaction, account)] : [];
          });
        const invoiceDebts = invoiceRows.flatMap(({ account, invoices }) =>
          invoices
            .filter((invoice) => invoice.status === 'open' && invoice.totalCents > 0)
            .map((invoice) => toInvoiceDebt(invoice, account)),
        );
        const today = getLocalDateString(new Date());
        const recurringDebts: RecurringDebtItem[] = recurringRules
          .filter((rule) => rule.kind === 'expense')
          .flatMap((rule) => {
            const account = accountsById.get(rule.accountId);
            const nextDate = getNextMonthlyOccurrence(
              rule.startDate,
              rule.dayOfMonth,
              today,
              rule.endDate,
            );
            return account && nextDate
              ? [
                  {
                    id: rule.id,
                    direction: rule.kind === 'income' ? 'receivable' : 'payable',
                    description: rule.description,
                    accountName: account.name,
                    nextDate,
                    amountCents: rule.amountCents,
                  },
                ]
              : [];
          });

        setData({
          debts: [...transactionDebts, ...invoiceDebts].sort((a, b) =>
            a.dueDate.localeCompare(b.dueDate),
          ),
          recurringDebts: recurringDebts.sort((a, b) => a.nextDate.localeCompare(b.nextDate)),
          paymentAccounts: accounts.filter(
            (account) =>
              account.type !== 'credit_card' &&
              account.archivedAt === null &&
              account.deletedAt === null,
          ),
        });
        setError(null);
        setOperationError(null);
        await synchronizeReminders();
      } catch (loadError) {
        console.error('Não foi possível carregar as dívidas.', loadError);
        setError(getErrorMessage(loadError));
      } finally {
        setLoading(false);
      }
    },
    [synchronizeReminders],
  );

  useFocusEffect(
    useCallback(() => {
      void reload();
    }, [reload]),
  );

  const markTransactionPaid = useCallback(
    async (transactionId: string): Promise<boolean> => {
      try {
        const { transactionService } = await getTransactionServices();
        await transactionService.update(transactionId, { isPaid: true });
        setOperationError(null);
        await reload(false);
        return true;
      } catch (paymentError) {
        console.error('Não foi possível marcar a dívida como paga.', paymentError);
        setOperationError(getErrorMessage(paymentError));
        return false;
      }
    },
    [reload],
  );

  const payInvoice = useCallback(
    async (invoiceId: string, accountId: string): Promise<boolean> => {
      try {
        const { invoiceService } = await getTransactionServices();
        await invoiceService.pay(invoiceId, accountId);
        setOperationError(null);
        await reload(false);
        return true;
      } catch (paymentError) {
        console.error('Não foi possível pagar a fatura.', paymentError);
        setOperationError(getErrorMessage(paymentError));
        return false;
      }
    },
    [reload],
  );

  return {
    ...data,
    loading,
    error,
    operationError,
    reminderError,
    reload,
    markTransactionPaid,
    payInvoice,
  };
}
