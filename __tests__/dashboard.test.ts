import type { Account, Category, Transaction } from '../src/db/schema';
import { getMonthPeriod, summarizeDashboard } from '../src/domain/dashboard';

function createAccount(overrides: Partial<Account> = {}): Account {
  return {
    id: 'account-1',
    name: 'Conta principal',
    type: 'checking',
    initialBalanceCents: 10_000,
    closingDay: null,
    dueDay: null,
    color: '#147A58',
    icon: 'building.columns.fill',
    currency: 'BRL',
    archivedAt: null,
    deletedAt: null,
    createdAt: 1,
    updatedAt: 1,
    ...overrides,
  };
}

function createCategory(id: string, name: string, color: string): Category {
  return {
    id,
    name,
    kind: 'expense',
    icon: 'tag.fill',
    color,
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
    categoryId: 'category-1',
    kind: 'expense',
    amountCents: 1_000,
    date: '2026-10-12',
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

describe('dashboard aggregation', () => {
  it('uses the configured month boundary for current and previous periods', () => {
    expect(getMonthPeriod(new Date(2026, 2, 10), 0, 15)).toEqual({
      fromDate: '2026-02-15',
      toDate: '2026-03-14',
    });
    expect(getMonthPeriod(new Date(2026, 2, 10), -1, 15)).toEqual({
      fromDate: '2026-01-15',
      toDate: '2026-02-14',
    });
    expect(getMonthPeriod(new Date(2026, 2, 20), 0, 15)).toEqual({
      fromDate: '2026-03-15',
      toDate: '2026-04-14',
    });
  });

  it('calculates current paid balance and period totals without counting transfers', () => {
    const summary = summarizeDashboard(
      [createAccount()],
      [createCategory('category-1', 'Mercado', '#147A58')],
      [
        createTransaction({ id: 'paid-expense', amountCents: 1_000 }),
        createTransaction({
          id: 'income',
          kind: 'income',
          categoryId: null,
          amountCents: 4_000,
          isPaid: false,
        }),
        createTransaction({
          id: 'pending-expense',
          amountCents: 2_000,
          isPaid: false,
        }),
        createTransaction({
          id: 'transfer',
          kind: 'transfer',
          amountCents: 50_000,
          transferAccountId: 'account-2',
        }),
        createTransaction({
          id: 'future-income',
          kind: 'income',
          categoryId: null,
          amountCents: 8_000,
          date: '2026-11-01',
        }),
      ],
      { fromDate: '2026-10-01', toDate: '2026-10-31' },
      '2026-10-31',
    );

    expect(summary).toMatchObject({
      balanceCents: 9_000,
      incomeCents: 4_000,
      expenseCents: 3_000,
      categories: [
        {
          categoryId: 'category-1',
          name: 'Mercado',
          amountCents: 3_000,
        },
      ],
    });
    expect(summary.recentTransactions.map(({ id }) => id)).toEqual([
      'income',
      'paid-expense',
      'pending-expense',
      'transfer',
    ]);
  });

  it('groups uncategorized and lower-ranked expenses into a stable chart total', () => {
    const categories = Array.from({ length: 6 }, (_, index) =>
      createCategory(`category-${index}`, `Categoria ${index}`, '#147A58'),
    );
    const transactions = [
      ...categories.map((category, index) =>
        createTransaction({
          id: `expense-${index}`,
          categoryId: category.id,
          amountCents: 6_000 - index * 1_000,
        }),
      ),
      createTransaction({ id: 'uncategorized', categoryId: null, amountCents: 500 }),
    ];

    const summary = summarizeDashboard(
      [createAccount()],
      categories,
      transactions,
      { fromDate: '2026-10-01', toDate: '2026-10-31' },
      '2026-10-31',
    );

    expect(summary.categories).toHaveLength(6);
    expect(summary.categories[0]).toMatchObject({
      name: 'Categoria 0',
      amountCents: 6_000,
    });
    expect(summary.categories[5]).toMatchObject({
      name: 'Outras categorias',
      amountCents: 1_500,
    });
    expect(summary.expenseCents).toBe(21_500);
  });

  it('uses the correct inclusive boundaries for month presets, including leap years', () => {
    expect(getMonthPeriod(new Date(2024, 2, 15))).toEqual({
      fromDate: '2024-03-01',
      toDate: '2024-03-31',
    });
    expect(getMonthPeriod(new Date(2024, 2, 15), -1)).toEqual({
      fromDate: '2024-02-01',
      toDate: '2024-02-29',
    });
    expect(getMonthPeriod(new Date(2026, 0, 15), -1)).toEqual({
      fromDate: '2025-12-01',
      toDate: '2025-12-31',
    });
  });

  it('rejects totals that exceed safe integer cents', () => {
    const account = createAccount({ initialBalanceCents: Number.MAX_SAFE_INTEGER });

    expect(() =>
      summarizeDashboard(
        [account],
        [],
        [createTransaction({ kind: 'income', amountCents: 1 })],
        { fromDate: '2026-10-01', toDate: '2026-10-31' },
        '2026-10-31',
      ),
    ).toThrow(RangeError);
  });
});
