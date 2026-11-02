import { act, render, waitFor } from '@testing-library/react-native';
import { Text } from 'react-native';
import { useBudgets } from '../src/features/budgets/useBudgets';

const mockAddDatabaseChangeListener = jest.fn();
const mockGetTransactionServices = jest.fn();

jest.mock('expo-sqlite', () => ({
  addDatabaseChangeListener: (listener: (event: { tableName: string }) => void) =>
    mockAddDatabaseChangeListener(listener),
}));
jest.mock('expo-router', () => ({
  useFocusEffect: (callback: () => void | (() => void)) =>
    jest.requireActual('react').useEffect(callback, [callback]),
}));
jest.mock('../src/features/transactions/transactionData', () => ({
  getTransactionServices: () => mockGetTransactionServices(),
}));

function BudgetDataProbe() {
  const { transactions, loading } = useBudgets('2025-06');
  return <Text>{loading ? 'loading' : `transactions:${transactions.length}`}</Text>;
}

describe('budget live updates', () => {
  beforeEach(() => {
    mockAddDatabaseChangeListener.mockReset();
    mockGetTransactionServices.mockReset();
  });

  it('reloads monthly spending after a transaction table change', async () => {
    const transactionList = jest
      .fn()
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ id: 'expense-1' }]);
    const changeListener = jest.fn();
    mockAddDatabaseChangeListener.mockImplementation((listener) => {
      changeListener.mockImplementation(listener);
      return { remove: jest.fn() };
    });
    mockGetTransactionServices.mockResolvedValue({
      budgetService: { listByMonth: jest.fn().mockResolvedValue([]) },
      categoryService: { list: jest.fn().mockResolvedValue([]) },
      transactionService: { list: transactionList },
    });

    const screen = await render(<BudgetDataProbe />);
    await waitFor(() => expect(screen.getByText('transactions:0')).toBeTruthy());

    await act(async () => {
      changeListener({ tableName: 'transactions' });
    });

    await waitFor(() => expect(screen.getByText('transactions:1')).toBeTruthy());
    expect(transactionList).toHaveBeenCalledTimes(2);
  });

  it('ignores changes to unrelated tables', async () => {
    const transactionList = jest.fn().mockResolvedValue([]);
    const changeListener = jest.fn();
    mockAddDatabaseChangeListener.mockImplementation((listener) => {
      changeListener.mockImplementation(listener);
      return { remove: jest.fn() };
    });
    mockGetTransactionServices.mockResolvedValue({
      budgetService: { listByMonth: jest.fn().mockResolvedValue([]) },
      categoryService: { list: jest.fn().mockResolvedValue([]) },
      transactionService: { list: transactionList },
    });

    await render(<BudgetDataProbe />);
    await waitFor(() => expect(transactionList).toHaveBeenCalledTimes(1));

    await act(async () => {
      changeListener({ tableName: 'accounts' });
    });

    expect(transactionList).toHaveBeenCalledTimes(1);
  });
});
