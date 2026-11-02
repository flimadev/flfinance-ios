import type { Budget, Category, Transaction } from '../src/db/schema';
import { summarizeBudgets } from '../src/domain/budgets';

function createCategory(id: string, overrides: Partial<Category> = {}): Category {
  return {
    id,
    name: id,
    kind: 'expense',
    icon: 'tag.fill',
    color: '#147A58',
    parentId: null,
    sortOrder: 0,
    archivedAt: null,
    deletedAt: null,
    createdAt: 1,
    updatedAt: 1,
    ...overrides,
  };
}

function createBudget(categoryId: string, amountCents: number): Budget {
  return {
    id: `budget-${categoryId}`,
    categoryId,
    month: '2025-06',
    amountCents,
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
    amountCents: 2_500,
    date: '2025-06-15',
    description: 'Compra',
    notes: null,
    paymentMethod: null,
    transferAccountId: null,
    installmentGroupId: null,
    installmentNumber: null,
    installmentTotal: null,
    invoiceId: null,
    recurringId: null,
    isPaid: false,
    deletedAt: null,
    createdAt: 1,
    updatedAt: 1,
    ...overrides,
  };
}

describe('monthly budget aggregation', () => {
  it('counts pending expenses and excludes deleted, income, transfer, and uncategorized rows', () => {
    const category = createCategory('category-1');
    const summary = summarizeBudgets(
      [category],
      [createBudget(category.id, 5_000)],
      [
        createTransaction({ id: 'pending', amountCents: 2_500, isPaid: false }),
        createTransaction({ id: 'paid', amountCents: 1_000, isPaid: true }),
        createTransaction({ id: 'deleted', amountCents: 10_000, deletedAt: 1 }),
        createTransaction({ id: 'income', amountCents: 10_000, kind: 'income' }),
        createTransaction({ id: 'transfer', amountCents: 10_000, kind: 'transfer' }),
        createTransaction({ id: 'uncategorized', amountCents: 10_000, categoryId: null }),
      ],
    );

    expect(summary).toHaveLength(1);
    expect(summary[0]).toMatchObject({
      category,
      budget: createBudget(category.id, 5_000),
      spentCents: 3_500,
      progress: 0.7,
      isOverBudget: false,
    });
  });

  it('marks overspending and clamps the progress bar while preserving exact cents', () => {
    const category = createCategory('category-1');
    const rows = summarizeBudgets(
      [category],
      [createBudget(category.id, 2_000)],
      [createTransaction({ amountCents: 2_501 })],
    );

    expect(rows[0]).toMatchObject({
      spentCents: 2_501,
      progress: 1,
      isOverBudget: true,
    });
  });

  it('keeps categories without a limit available and ignores income or archived categories', () => {
    const expense = createCategory('expense');
    const income = createCategory('income', { kind: 'income' });
    const archived = createCategory('archived', { archivedAt: 2 });
    const rows = summarizeBudgets([expense, income, archived], [], []);

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      category: expense,
      budget: null,
      spentCents: 0,
      progress: 0,
      isOverBudget: false,
    });
  });

  it('rejects spending totals outside the safe integer range', () => {
    expect(() =>
      summarizeBudgets(
        [createCategory('category-1')],
        [],
        [
          createTransaction({ id: 'first', amountCents: Number.MAX_SAFE_INTEGER }),
          createTransaction({ id: 'second', amountCents: 1 }),
        ],
      ),
    ).toThrow(RangeError);
  });
});
