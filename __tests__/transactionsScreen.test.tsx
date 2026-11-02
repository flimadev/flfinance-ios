import { fireEvent, render } from '@testing-library/react-native';
import { createElement as mockCreateElement } from 'react';
import type { ReactNode } from 'react';
import { View as mockView } from 'react-native';

import TransactionsScreen from '../app/(tabs)/transactions';
import type { Account, Category, Transaction } from '../src/db/schema';
import { useTransactions } from '../src/features/transactions/useTransactions';

jest.mock('expo-router', () => ({ useFocusEffect: jest.fn() }));
jest.mock('expo-symbols', () => ({ SymbolView: () => null }));
jest.mock('@shopify/flash-list', () => ({
  FlashList: ({
    data,
    renderItem,
    ListHeaderComponent,
    ListEmptyComponent,
  }: {
    data: { key: string }[];
    renderItem: (args: { item: { key: string } }) => ReactNode;
    ListHeaderComponent: ReactNode;
    ListEmptyComponent: ReactNode;
  }) =>
    mockCreateElement(
      mockView,
      null,
      ListHeaderComponent,
      data.length
        ? data.map((item) => mockCreateElement(mockView, { key: item.key }, renderItem({ item })))
        : ListEmptyComponent,
    ),
}));
jest.mock('react-native-gesture-handler/ReanimatedSwipeable', () => ({
  __esModule: true,
  default: ({ children }: { children: ReactNode }) => mockCreateElement(mockView, null, children),
}));
jest.mock('../src/features/transactions/useTransactions');

const account: Account = {
  id: 'checking',
  name: 'Conta corrente',
  type: 'checking',
  initialBalanceCents: 0,
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

const category: Category = {
  id: 'food',
  name: 'Mercado',
  kind: 'expense',
  icon: 'cart.fill',
  color: '#147A58',
  parentId: null,
  sortOrder: 1,
  archivedAt: null,
  deletedAt: null,
  createdAt: 1,
  updatedAt: 1,
};

const transaction: Transaction = {
  id: 'expense-1',
  accountId: account.id,
  categoryId: category.id,
  kind: 'expense',
  amountCents: 4_590,
  date: '2026-11-01',
  description: 'Compra no mercado',
  notes: null,
  paymentMethod: 'pix',
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
};

describe('TransactionsScreen', () => {
  beforeEach(() => {
    jest.mocked(useTransactions).mockReturnValue({
      accounts: [account],
      categories: [category],
      transactions: [transaction],
      loading: false,
      error: null,
      reload: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      remove: jest.fn(),
      restore: jest.fn(),
    });
  });

  it('shows a compact period summary, search, type selector, and readable transaction', async () => {
    const screen = await render(<TransactionsScreen />);

    expect(screen.getByText('Lançamentos')).toBeTruthy();
    expect(screen.getAllByText('-R$ 45,90')).toHaveLength(2);
    expect(screen.getByLabelText('Buscar lançamentos')).toBeTruthy();
    expect(screen.getByLabelText('Movimentações')).toBeTruthy();
    expect(screen.getByText('Compra no mercado')).toBeTruthy();
    expect(screen.getByText('Mercado · Conta corrente')).toBeTruthy();
  });

  it('opens category filters and applies the selected category', async () => {
    const screen = await render(<TransactionsScreen />);

    await fireEvent.press(screen.getByRole('button', { name: 'Filtros' }));
    expect(screen.getByText('Refine por conta ou categoria.')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Mercado' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Aplicar filtros' }));

    expect(screen.getByText('Compra no mercado')).toBeTruthy();
  });
});
