import type { Account, Category, RecurringRule, Tag, Transaction } from '../src/db/schema';
import {
  buildFinancialReport,
  type BuildFinancialReportInput,
  type FinancialReportFilters,
} from '../src/domain/reports';

function createAccount(id: string, initialBalanceCents = 0): Account {
  return {
    id,
    name: id === 'account-1' ? 'Conta principal' : 'Poupança',
    type: 'checking',
    initialBalanceCents,
    closingDay: null,
    dueDay: null,
    color: '#147A58',
    icon: 'building.columns.fill',
    currency: 'BRL',
    archivedAt: null,
    deletedAt: null,
    createdAt: 1,
    updatedAt: 1,
  };
}

function createCategory(id: string, kind: Category['kind'] = 'expense'): Category {
  return {
    id,
    name: id === 'food' ? 'Alimentação' : 'Salário',
    kind,
    icon: 'tag.fill',
    color: '#147A58',
    parentId: null,
    sortOrder: 0,
    archivedAt: null,
    deletedAt: null,
    createdAt: 1,
    updatedAt: 1,
  };
}

function createTransaction(overrides: Partial<Transaction> = {}): Transaction {
  return {
    id: 'transaction-1',
    accountId: 'account-1',
    categoryId: 'food',
    kind: 'expense',
    amountCents: 2_000,
    date: '2026-07-10',
    description: 'Compra',
    notes: null,
    paymentMethod: null,
    transferAccountId: null,
    installmentGroupId: null,
    installmentNumber: null,
    installmentTotal: null,
    invoiceId: null,
    recurringId: null,
    isPaid: true,
    deletedAt: null,
    createdAt: 1,
    updatedAt: 1,
    ...overrides,
  };
}

function createRecurringRule(overrides: Partial<RecurringRule> = {}): RecurringRule {
  return {
    id: 'rule-1',
    accountId: 'account-1',
    categoryId: 'food',
    kind: 'expense',
    amountCents: 500,
    description: 'Despesa recorrente',
    paymentMethod: null,
    startDate: '2026-06-15',
    endDate: null,
    dayOfMonth: 15,
    isActive: true,
    lastGeneratedDate: '2026-06-15',
    createdAt: 1,
    updatedAt: 1,
    ...overrides,
  };
}

const defaultFilters: FinancialReportFilters = {
  period: { fromDate: '2026-07-01', toDate: '2026-08-31' },
  accountId: null,
  categoryId: null,
  uncategorizedOnly: false,
  tagId: null,
  kind: 'all',
};

function createInput(
  overrides: Partial<BuildFinancialReportInput> = {},
): BuildFinancialReportInput {
  return {
    accounts: [createAccount('account-1', 10_000), createAccount('account-2', 2_000)],
    categories: [createCategory('food'), createCategory('salary', 'income')],
    transactions: [],
    recurringRules: [],
    tags: [],
    transactionTags: [],
    filters: defaultFilters,
    uncategorizedLabel: 'Sem categoria',
    missingCategoryLabel: 'Categoria indisponível',
    missingAccountLabel: 'Conta indisponível',
    ...overrides,
  };
}

describe('financial reports', () => {
  it('combines period, account, category, type, and tag filters', () => {
    const tag: Tag = {
      id: 'essential',
      name: 'Essencial',
      color: '#147A58',
      createdAt: 1,
      updatedAt: 1,
    };
    const matching = createTransaction({ id: 'matching', amountCents: 3_000 });
    const otherCategory = createTransaction({
      id: 'other-category',
      categoryId: null,
      accountId: 'account-2',
    });
    const income = createTransaction({
      id: 'income',
      kind: 'income',
      categoryId: 'salary',
      amountCents: 5_000,
    });
    const old = createTransaction({ id: 'old', date: '2026-06-30' });
    const input = createInput({
      transactions: [matching, otherCategory, income, old],
      tags: [tag],
      transactionTags: [{ transactionId: 'matching', tagId: tag.id }],
      filters: {
        ...defaultFilters,
        period: { fromDate: '2026-07-01', toDate: '2026-07-31' },
        accountId: 'account-1',
        categoryId: 'food',
        tagId: tag.id,
        kind: 'expense',
      },
    });

    const report = buildFinancialReport(input);

    expect(report.incomeCents).toBe(0);
    expect(report.expenseCents).toBe(3_000);
    expect(report.categories).toMatchObject([
      { categoryId: 'food', kind: 'expense', amountCents: 3_000 },
    ]);
    expect(report.transactions.map(({ transaction }) => transaction.id)).toEqual(['matching']);
    expect(report.transactions[0]?.tagNames).toEqual(['Essencial']);
  });

  it('aggregates monthly flow and projects balances with transfers and future recurring rules', () => {
    const transactions = [
      createTransaction({
        id: 'prior-income',
        kind: 'income',
        categoryId: 'salary',
        amountCents: 5_000,
        date: '2026-06-20',
      }),
      createTransaction({
        id: 'prior-transfer',
        kind: 'transfer',
        amountCents: 1_000,
        date: '2026-06-25',
        transferAccountId: 'account-2',
      }),
      createTransaction({
        id: 'period-income',
        kind: 'income',
        categoryId: 'salary',
        amountCents: 7_000,
      }),
      createTransaction({ id: 'period-expense', amountCents: 2_000, isPaid: false }),
      createTransaction({
        id: 'period-transfer',
        kind: 'transfer',
        amountCents: 3_000,
        transferAccountId: 'account-2',
        isPaid: false,
      }),
    ];
    const report = buildFinancialReport(
      createInput({
        transactions,
        recurringRules: [createRecurringRule()],
        filters: {
          ...defaultFilters,
          period: { fromDate: '2026-07-01', toDate: '2026-07-31' },
        },
      }),
    );

    expect(report.incomeCents).toBe(7_000);
    expect(report.expenseCents).toBe(2_000);
    expect(report.netCents).toBe(5_000);
    expect(report.months).toEqual([
      { month: '2026-07', incomeCents: 7_000, expenseCents: 2_000, netCents: 5_000 },
    ]);
    expect(report.projectedBalanceCents).toBe(21_500);

    const accountReport = buildFinancialReport(
      createInput({
        transactions,
        recurringRules: [createRecurringRule()],
        filters: {
          ...defaultFilters,
          period: { fromDate: '2026-07-01', toDate: '2026-07-31' },
          accountId: 'account-1',
        },
      }),
    );
    expect(accountReport.projectedBalanceCents).toBe(15_500);
  });

  it('does not count generated recurring transactions twice and rejects invalid periods', () => {
    const report = buildFinancialReport(
      createInput({
        transactions: [
          createTransaction({
            id: 'generated-recurring',
            recurringId: 'rule-1',
            date: '2026-07-15',
            amountCents: 500,
            isPaid: false,
          }),
        ],
        recurringRules: [createRecurringRule({ lastGeneratedDate: null })],
        filters: {
          ...defaultFilters,
          period: { fromDate: '2026-07-01', toDate: '2026-07-31' },
        },
      }),
    );

    expect(report.expenseCents).toBe(500);
    expect(report.projectedBalanceCents).toBe(11_500);
    expect(() =>
      buildFinancialReport(
        createInput({
          filters: {
            ...defaultFilters,
            period: { fromDate: '2026-01-01', toDate: '2031-01-01' },
          },
        }),
      ),
    ).toThrow(RangeError);
  });
});
