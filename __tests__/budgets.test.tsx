import { fireEvent, render } from '@testing-library/react-native';
import type { Budget, Category } from '../src/db/schema';
import type { BudgetSummaryRow } from '../src/domain/budgets';
import { BudgetEditorSheet } from '../src/features/budgets/BudgetEditorSheet';
import { BudgetProgressRow } from '../src/features/budgets/BudgetProgressRow';

jest.mock('react-native-reanimated', () => ({
  __esModule: true,
  default: {
    View: 'Animated.View',
  },
  useAnimatedStyle: (callback: () => unknown) => callback(),
  useReducedMotion: () => true,
  useSharedValue: (value: number) => ({ value }),
  withTiming: (value: number) => value,
}));

function createCategory(): Category {
  return {
    id: 'category-1',
    name: 'Moradia',
    kind: 'expense',
    icon: 'house.fill',
    color: '#147A58',
    parentId: null,
    sortOrder: 0,
    archivedAt: null,
    deletedAt: null,
    createdAt: 1,
    updatedAt: 1,
  };
}

function createBudget(): Budget {
  return {
    id: 'budget-1',
    categoryId: 'category-1',
    month: '2025-06',
    amountCents: 10_000,
    createdAt: 1,
    updatedAt: 1,
  };
}

describe('budget progress UI', () => {
  it('shows an exceeded budget and opens its editor action', async () => {
    const onEdit = jest.fn();
    const row: BudgetSummaryRow = {
      category: createCategory(),
      budget: createBudget(),
      spentCents: 12_500,
      progress: 1,
      isOverBudget: true,
    };
    const screen = await render(<BudgetProgressRow onEdit={onEdit} row={row} />);

    expect(screen.getByText('Estourado')).toBeTruthy();
    expect(screen.getByLabelText('Orçamento estourado')).toBeTruthy();
    expect(screen.getByLabelText('Editar limite Moradia')).toBeTruthy();

    await fireEvent.press(screen.getByLabelText('Editar limite Moradia'));
    expect(onEdit).toHaveBeenCalledTimes(1);
  });

  it('offers to define a limit for an unbudgeted expense category', async () => {
    const screen = await render(
      <BudgetProgressRow
        onEdit={jest.fn()}
        row={{
          category: createCategory(),
          budget: null,
          spentCents: 2_500,
          progress: 0,
          isOverBudget: false,
        }}
      />,
    );

    expect(screen.getByText('Sem limite')).toBeTruthy();
    expect(screen.getByLabelText('Definir limite Moradia')).toBeTruthy();
  });

  it('saves the custom-keypad value as exact integer cents', async () => {
    const onSave = jest.fn().mockResolvedValue(undefined);
    const screen = await render(
      <BudgetEditorSheet
        budget={null}
        category={createCategory()}
        error={null}
        monthLabel="junho de 2025"
        onClose={jest.fn()}
        onSave={onSave}
      />,
    );

    await fireEvent.press(screen.getByLabelText('Adicionar dígito 1'));
    await fireEvent.press(screen.getByLabelText('Adicionar dígito 2'));
    await fireEvent.press(screen.getByLabelText('Adicionar dígito 3'));
    await fireEvent.press(screen.getByLabelText('Salvar orçamento'));

    expect(onSave).toHaveBeenCalledWith(123);
  });
});
