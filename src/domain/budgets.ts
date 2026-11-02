import type { Budget, Category, Transaction } from '@/src/db/schema';

export type BudgetSummaryRow = {
  category: Category;
  budget: Budget | null;
  spentCents: number;
  progress: number;
  isOverBudget: boolean;
};

export function summarizeBudgets(
  categories: Category[],
  budgets: Budget[],
  transactions: Transaction[],
): BudgetSummaryRow[] {
  const spendByCategory = new Map<string, number>();

  for (const transaction of transactions) {
    if (
      transaction.deletedAt !== null ||
      transaction.kind !== 'expense' ||
      transaction.categoryId === null
    ) {
      continue;
    }

    const spent = (spendByCategory.get(transaction.categoryId) ?? 0) + transaction.amountCents;
    if (!Number.isSafeInteger(spent)) {
      throw new RangeError('O total gasto excede o limite seguro de centavos.');
    }
    spendByCategory.set(transaction.categoryId, spent);
  }

  const budgetByCategory = new Map(budgets.map((budget) => [budget.categoryId, budget]));

  return categories
    .filter(
      (category) =>
        category.kind === 'expense' && category.deletedAt === null && category.archivedAt === null,
    )
    .map((category) => {
      const budget = budgetByCategory.get(category.id) ?? null;
      const spentCents = spendByCategory.get(category.id) ?? 0;
      const isOverBudget = budget !== null && spentCents > budget.amountCents;

      return {
        category,
        budget,
        spentCents,
        progress:
          budget === null || budget.amountCents === 0
            ? 0
            : Math.min(spentCents / budget.amountCents, 1),
        isOverBudget,
      };
    })
    .sort(
      (first, second) =>
        Number(second.isOverBudget) - Number(first.isOverBudget) ||
        second.spentCents - first.spentCents ||
        first.category.sortOrder - second.category.sortOrder ||
        first.category.name.localeCompare(second.category.name, 'pt-BR'),
    );
}
