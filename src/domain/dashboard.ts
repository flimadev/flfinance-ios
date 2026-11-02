import type { Account, Category, Transaction } from '@/src/db/schema';

export type DashboardPeriod = {
  fromDate: string;
  toDate: string;
};

export type DashboardCategoryTotal = {
  categoryId: string | null;
  name: string;
  color: string | null;
  amountCents: number;
};

export type DashboardSummary = {
  balanceCents: number;
  incomeCents: number;
  expenseCents: number;
  categories: DashboardCategoryTotal[];
  recentTransactions: Transaction[];
};

const categoryLimit = 5;

function addSafe(total: number, amount: number): number {
  const result = total + amount;
  if (!Number.isSafeInteger(result)) {
    throw new RangeError('O total do dashboard excede o limite seguro de centavos.');
  }
  return result;
}

export function getMonthPeriod(
  referenceDate: Date,
  monthOffset = 0,
  monthStartDay = 1,
): DashboardPeriod {
  if (!Number.isInteger(monthStartDay) || monthStartDay < 1 || monthStartDay > 28) {
    throw new RangeError('O dia de início do mês deve estar entre 1 e 28.');
  }
  const anchor = new Date(referenceDate.getFullYear(), referenceDate.getMonth(), 1);
  if (referenceDate.getDate() < monthStartDay) {
    anchor.setMonth(anchor.getMonth() - 1);
  }
  anchor.setMonth(anchor.getMonth() + monthOffset);
  const start = new Date(anchor.getFullYear(), anchor.getMonth(), monthStartDay);
  const end = new Date(anchor.getFullYear(), anchor.getMonth() + 1, monthStartDay - 1);
  const formatLocalDate = (date: Date) => {
    const year = String(date.getFullYear()).padStart(4, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };
  return {
    fromDate: formatLocalDate(start),
    toDate: formatLocalDate(end),
  };
}

export function summarizeDashboard(
  accounts: Account[],
  categories: Category[],
  transactions: Transaction[],
  period: DashboardPeriod,
  today: string,
): DashboardSummary {
  const activeAccounts = new Set(
    accounts.filter((account) => account.deletedAt === null).map((account) => account.id),
  );
  const categoryById = new Map(
    categories
      .filter((category) => category.deletedAt === null)
      .map((category) => [category.id, category]),
  );

  const balanceCents = accounts
    .filter((account) => account.deletedAt === null)
    .reduce((total, account) => addSafe(total, account.initialBalanceCents), 0);

  const categoryTotals = new Map<string, DashboardCategoryTotal>();
  let incomeCents = 0;
  let expenseCents = 0;
  let currentBalanceCents = balanceCents;

  for (const transaction of transactions) {
    const inPeriod = transaction.date >= period.fromDate && transaction.date <= period.toDate;

    if (inPeriod && transaction.kind === 'income') {
      incomeCents = addSafe(incomeCents, transaction.amountCents);
    } else if (inPeriod && transaction.kind === 'expense') {
      expenseCents = addSafe(expenseCents, transaction.amountCents);
      const category = transaction.categoryId
        ? categoryById.get(transaction.categoryId)
        : undefined;
      const key = category?.id ?? 'uncategorized';
      const total = categoryTotals.get(key);

      categoryTotals.set(key, {
        categoryId: category?.id ?? null,
        name: category?.name ?? 'Sem categoria',
        color: category?.color ?? null,
        amountCents: addSafe(total?.amountCents ?? 0, transaction.amountCents),
      });
    }

    if (
      transaction.date <= today &&
      transaction.isPaid &&
      activeAccounts.has(transaction.accountId)
    ) {
      if (transaction.kind === 'income') {
        currentBalanceCents = addSafe(currentBalanceCents, transaction.amountCents);
      } else if (transaction.kind === 'expense') {
        currentBalanceCents = addSafe(currentBalanceCents, -transaction.amountCents);
      }
    }
  }

  const sortedCategories = [...categoryTotals.values()].sort(
    (first, second) =>
      second.amountCents - first.amountCents || first.name.localeCompare(second.name, 'pt-BR'),
  );
  const topCategories = sortedCategories.slice(0, categoryLimit);
  const otherAmountCents = sortedCategories
    .slice(categoryLimit)
    .reduce((total, category) => addSafe(total, category.amountCents), 0);

  if (otherAmountCents > 0) {
    topCategories.push({
      categoryId: null,
      name: 'Outras categorias',
      color: null,
      amountCents: otherAmountCents,
    });
  }

  const recentTransactions = transactions
    .filter(
      (transaction) => transaction.date >= period.fromDate && transaction.date <= period.toDate,
    )
    .slice()
    .sort(
      (first, second) =>
        second.date.localeCompare(first.date) ||
        second.createdAt - first.createdAt ||
        first.id.localeCompare(second.id),
    )
    .slice(0, 5);

  return {
    balanceCents: currentBalanceCents,
    incomeCents,
    expenseCents,
    categories: topCategories,
    recentTransactions,
  };
}
