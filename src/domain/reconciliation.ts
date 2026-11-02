import type { Account, Transaction } from '@/src/db/schema';

export type ReconciliationSummary = {
  calculatedBalanceCents: number;
  statementBalanceCents: number;
  differenceCents: number;
};

function addSafe(total: number, amount: number): number {
  const result = total + amount;
  if (!Number.isSafeInteger(result)) {
    throw new RangeError('O saldo conciliado excede o limite seguro de centavos.');
  }
  return result;
}

export function summarizeReconciliation(
  account: Account,
  transactions: Transaction[],
  asOfDate: string,
  statementBalanceCents: number,
): ReconciliationSummary {
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(asOfDate) ||
    !Number.isSafeInteger(statementBalanceCents)
  ) {
    throw new RangeError('Informe uma data e um saldo válidos para conciliação.');
  }

  const calculatedBalanceCents = transactions
    .filter(
      (transaction) =>
        transaction.deletedAt === null &&
        transaction.reconciledAt !== null &&
        transaction.date <= asOfDate,
    )
    .reduce((balance, transaction) => {
      if (transaction.accountId === account.id) {
        return addSafe(
          balance,
          transaction.kind === 'income'
            ? transaction.amountCents
            : -transaction.amountCents,
        );
      }
      if (
        transaction.kind === 'transfer' &&
        transaction.transferAccountId === account.id
      ) {
        return addSafe(balance, transaction.amountCents);
      }
      return balance;
    }, account.initialBalanceCents);

  return {
    calculatedBalanceCents,
    statementBalanceCents,
    differenceCents: addSafe(statementBalanceCents, -calculatedBalanceCents),
  };
}
