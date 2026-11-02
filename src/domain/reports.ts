import type {
  Account,
  Category,
  RecurringRule,
  Tag,
  Transaction,
  TransactionTag,
} from '@/src/db/schema';
import { getMonthlyOccurrenceDates, addMonthsToDate } from '@/src/domain/cardBilling';
import type { DashboardPeriod } from '@/src/domain/dashboard';

const maxReportMonths = 60;

export type ReportKindFilter = 'all' | Transaction['kind'];

export type FinancialReportFilters = {
  period: DashboardPeriod;
  accountId: string | null;
  categoryId: string | null;
  uncategorizedOnly: boolean;
  tagId: string | null;
  kind: ReportKindFilter;
};

export type FinancialReportCategory = {
  categoryId: string | null;
  kind: 'income' | 'expense';
  name: string;
  color: string | null;
  amountCents: number;
};

export type FinancialReportMonth = {
  month: string;
  incomeCents: number;
  expenseCents: number;
  netCents: number;
};

export type FinancialReportTransaction = {
  transaction: Transaction;
  accountName: string;
  transferAccountName: string | null;
  categoryName: string | null;
  tagNames: string[];
};

export type FinancialReport = {
  period: DashboardPeriod;
  incomeCents: number;
  expenseCents: number;
  netCents: number;
  projectedBalanceCents: number;
  months: FinancialReportMonth[];
  categories: FinancialReportCategory[];
  transactions: FinancialReportTransaction[];
};

export type BuildFinancialReportInput = {
  accounts: Account[];
  categories: Category[];
  transactions: Transaction[];
  recurringRules: RecurringRule[];
  tags: Tag[];
  transactionTags: TransactionTag[];
  filters: FinancialReportFilters;
  uncategorizedLabel: string;
  missingCategoryLabel: string;
  missingAccountLabel: string;
};

function addSafe(total: number, amount: number): number {
  const result = total + amount;
  if (!Number.isSafeInteger(result)) {
    throw new RangeError('O total do relatório excede o limite seguro de centavos.');
  }
  return result;
}

function getMonthIndex(date: string): number {
  addMonthsToDate(date, 0);
  return Number(date.slice(0, 4)) * 12 + Number(date.slice(5, 7)) - 1;
}

function getMonthKey(monthIndex: number): string {
  const year = Math.floor(monthIndex / 12);
  const month = (monthIndex % 12) + 1;
  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}`;
}

function getPeriodMonths(period: DashboardPeriod): string[] {
  const fromMonth = getMonthIndex(period.fromDate);
  const toMonth = getMonthIndex(period.toDate);
  if (period.fromDate > period.toDate) {
    throw new RangeError('O início do período deve ser anterior ao fim.');
  }
  if (toMonth - fromMonth + 1 > maxReportMonths) {
    throw new RangeError('O relatório pode abranger no máximo 60 meses.');
  }

  return Array.from({ length: toMonth - fromMonth + 1 }, (_, index) =>
    getMonthKey(fromMonth + index),
  );
}

function applyTransactionToBalance(
  balanceCents: number,
  transaction: Transaction,
  includedAccountIds: Set<string>,
): number {
  if (transaction.kind === 'income' && includedAccountIds.has(transaction.accountId)) {
    return addSafe(balanceCents, transaction.amountCents);
  }
  if (transaction.kind === 'expense' && includedAccountIds.has(transaction.accountId)) {
    return addSafe(balanceCents, -transaction.amountCents);
  }
  if (transaction.kind === 'transfer') {
    const afterSource = includedAccountIds.has(transaction.accountId)
      ? addSafe(balanceCents, -transaction.amountCents)
      : balanceCents;
    return transaction.transferAccountId && includedAccountIds.has(transaction.transferAccountId)
      ? addSafe(afterSource, transaction.amountCents)
      : afterSource;
  }
  return balanceCents;
}

function projectPeriodEndBalance(
  accounts: Account[],
  transactions: Transaction[],
  recurringRules: RecurringRule[],
  period: DashboardPeriod,
  accountId: string | null,
): number {
  const includedAccounts = accounts.filter(
    (account) => account.deletedAt === null && (!accountId || account.id === accountId),
  );
  const includedAccountIds = new Set(includedAccounts.map((account) => account.id));
  let projectedBalance = includedAccounts.reduce(
    (total, account) => addSafe(total, account.initialBalanceCents),
    0,
  );
  const activeTransactions = transactions.filter((transaction) => transaction.deletedAt === null);

  for (const transaction of activeTransactions) {
    if (transaction.date < period.fromDate && transaction.isPaid) {
      projectedBalance = applyTransactionToBalance(
        projectedBalance,
        transaction,
        includedAccountIds,
      );
    } else if (transaction.date >= period.fromDate && transaction.date <= period.toDate) {
      projectedBalance = applyTransactionToBalance(
        projectedBalance,
        transaction,
        includedAccountIds,
      );
    }
  }

  const existingRecurringDates = new Set(
    activeTransactions
      .filter((transaction) => transaction.recurringId !== null)
      .map((transaction) => `${transaction.recurringId}:${transaction.date}`),
  );

  for (const rule of recurringRules) {
    if (!rule.isActive || !includedAccountIds.has(rule.accountId)) {
      continue;
    }
    const occurrences = getMonthlyOccurrenceDates(
      rule.startDate,
      rule.dayOfMonth,
      period.toDate,
      rule.lastGeneratedDate,
      rule.endDate,
    );
    for (const date of occurrences) {
      if (date < period.fromDate || existingRecurringDates.has(`${rule.id}:${date}`)) {
        continue;
      }
      projectedBalance = addSafe(
        projectedBalance,
        rule.kind === 'income' ? rule.amountCents : -rule.amountCents,
      );
    }
  }

  return projectedBalance;
}

export function buildFinancialReport(input: BuildFinancialReportInput): FinancialReport {
  const months = getPeriodMonths(input.filters.period).map((month) => ({
    month,
    incomeCents: 0,
    expenseCents: 0,
    netCents: 0,
  }));
  const monthsByKey = new Map(months.map((month) => [month.month, month]));
  const accountsById = new Map(input.accounts.map((account) => [account.id, account]));
  const categoriesById = new Map(input.categories.map((category) => [category.id, category]));
  const tagsById = new Map(input.tags.map((tag) => [tag.id, tag]));
  const tagsByTransactionId = new Map<string, Set<string>>();

  for (const relation of input.transactionTags) {
    const tagIds = tagsByTransactionId.get(relation.transactionId) ?? new Set<string>();
    tagIds.add(relation.tagId);
    tagsByTransactionId.set(relation.transactionId, tagIds);
  }

  const activeTransactions = input.transactions.filter((transaction) => {
    if (
      transaction.deletedAt !== null ||
      transaction.date < input.filters.period.fromDate ||
      transaction.date > input.filters.period.toDate
    ) {
      return false;
    }
    if (
      input.filters.accountId &&
      transaction.accountId !== input.filters.accountId &&
      transaction.transferAccountId !== input.filters.accountId
    ) {
      return false;
    }
    if (input.filters.categoryId && transaction.categoryId !== input.filters.categoryId) {
      return false;
    }
    if (input.filters.uncategorizedOnly && transaction.categoryId !== null) {
      return false;
    }
    if (input.filters.kind !== 'all' && transaction.kind !== input.filters.kind) {
      return false;
    }
    if (input.filters.tagId && !tagsByTransactionId.get(transaction.id)?.has(input.filters.tagId)) {
      return false;
    }
    return true;
  });

  const categoryTotals = new Map<string, FinancialReportCategory>();
  const reportTransactions: FinancialReportTransaction[] = [];
  let incomeCents = 0;
  let expenseCents = 0;

  for (const transaction of activeTransactions) {
    const month = monthsByKey.get(transaction.date.slice(0, 7));
    if (transaction.kind === 'income') {
      incomeCents = addSafe(incomeCents, transaction.amountCents);
      if (month) {
        month.incomeCents = addSafe(month.incomeCents, transaction.amountCents);
      }
    } else if (transaction.kind === 'expense') {
      expenseCents = addSafe(expenseCents, transaction.amountCents);
      if (month) {
        month.expenseCents = addSafe(month.expenseCents, transaction.amountCents);
      }
    }

    if (transaction.kind !== 'transfer') {
      const category = transaction.categoryId
        ? categoriesById.get(transaction.categoryId)
        : undefined;
      const key = `${transaction.kind}:${category?.id ?? 'uncategorized'}`;
      const current = categoryTotals.get(key);
      categoryTotals.set(key, {
        categoryId: category?.id ?? null,
        kind: transaction.kind,
        name: category?.name ?? input.uncategorizedLabel,
        color: category?.color ?? null,
        amountCents: addSafe(current?.amountCents ?? 0, transaction.amountCents),
      });
    }

    const tagNames = [...(tagsByTransactionId.get(transaction.id) ?? [])]
      .map((tagId) => tagsById.get(tagId)?.name)
      .filter((name): name is string => name !== undefined)
      .sort((first, second) => first.localeCompare(second, 'pt-BR'));
    reportTransactions.push({
      transaction,
      accountName: accountsById.get(transaction.accountId)?.name ?? input.missingAccountLabel,
      transferAccountName: transaction.transferAccountId
        ? (accountsById.get(transaction.transferAccountId)?.name ?? input.missingAccountLabel)
        : null,
      categoryName: transaction.categoryId
        ? (categoriesById.get(transaction.categoryId)?.name ?? input.missingCategoryLabel)
        : null,
      tagNames,
    });
  }

  for (const month of months) {
    month.netCents = addSafe(month.incomeCents, -month.expenseCents);
  }

  const sortedCategories = [...categoryTotals.values()].sort(
    (first, second) =>
      second.amountCents - first.amountCents ||
      first.kind.localeCompare(second.kind) ||
      first.name.localeCompare(second.name, 'pt-BR'),
  );
  reportTransactions.sort(
    (first, second) =>
      second.transaction.date.localeCompare(first.transaction.date) ||
      second.transaction.createdAt - first.transaction.createdAt ||
      first.transaction.id.localeCompare(second.transaction.id),
  );

  return {
    period: input.filters.period,
    incomeCents,
    expenseCents,
    netCents: addSafe(incomeCents, -expenseCents),
    projectedBalanceCents: projectPeriodEndBalance(
      input.accounts,
      input.transactions,
      input.recurringRules,
      input.filters.period,
      input.filters.accountId,
    ),
    months,
    categories: sortedCategories,
    transactions: reportTransactions,
  };
}
