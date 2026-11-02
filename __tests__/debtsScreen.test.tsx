import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { createElement as mockCreateElement, type ReactNode } from 'react';
import { View as mockView } from 'react-native';

import DebtsScreen from '../app/debts';
import type { DebtItem } from '../src/features/debts/useDebts';
import { useDebts } from '../src/features/debts/useDebts';
import { ThemePreviewProvider } from '../src/theme';

jest.mock('expo-router', () => ({
  Link: ({ children }: { children: ReactNode }) => children,
}));
jest.mock('expo-symbols', () => ({ SymbolView: () => null }));
jest.mock('react-native-reanimated', () => ({
  useReducedMotion: () => false,
}));
jest.mock('@shopify/flash-list', () => ({
  FlashList: ({
    data,
    renderItem,
    ListHeaderComponent,
    ListEmptyComponent,
    ListFooterComponent,
  }: {
    data: DebtItem[];
    renderItem: (args: { item: DebtItem }) => ReactNode;
    ListHeaderComponent: ReactNode;
    ListEmptyComponent: ReactNode;
    ListFooterComponent: ReactNode;
  }) =>
    mockCreateElement(
      mockView,
      null,
      ListHeaderComponent,
      data.length
        ? data.map((item) => mockCreateElement(mockView, { key: item.id }, renderItem({ item })))
        : ListEmptyComponent,
      ListFooterComponent,
    ),
}));
jest.mock('../src/features/debts/useDebts');

const mockedUseDebts = jest.mocked(useDebts);

function createDebtItem(): DebtItem {
  return {
    kind: 'transaction',
    id: 'debt-1',
    description: 'Conta de energia',
    accountName: 'Conta corrente',
    dueDate: '2020-06-01',
    amountCents: 25_000,
    installmentNumber: 2,
    installmentTotal: 6,
  };
}

describe('debts screen', () => {
  beforeEach(() => {
    mockedUseDebts.mockReturnValue({
      debts: [createDebtItem()],
      recurringDebts: [
        {
          id: 'recurring-1',
          description: 'Aluguel',
          accountName: 'Conta corrente',
          nextDate: '2099-06-10',
          amountCents: 150_000,
        },
      ],
      paymentAccounts: [],
      loading: false,
      error: null,
      operationError: null,
      reload: jest.fn(),
      markTransactionPaid: jest.fn(),
      payInvoice: jest.fn(),
    });
  });

  it('shows outstanding, overdue, installments, and recurring commitments', async () => {
    const screen = await render(
      <ThemePreviewProvider scheme="light">
        <DebtsScreen />
      </ThemePreviewProvider>,
    );

    expect(screen.getByText('Total em aberto')).toBeTruthy();
    expect(screen.getByText('Em atraso')).toBeTruthy();
    expect(screen.getByText('Conta de energia')).toBeTruthy();
    expect(screen.getByText('Parcela 2 de 6')).toBeTruthy();
    expect(screen.getByText('Aluguel')).toBeTruthy();
    expect(screen.getByText('Previsão mensal')).toBeTruthy();
  });

  it('marks a scheduled expense as paid from its obligation card', async () => {
    const markTransactionPaid = jest.fn().mockResolvedValue(true);
    mockedUseDebts.mockReturnValue({
      ...mockedUseDebts(),
      markTransactionPaid,
    });
    const screen = await render(
      <ThemePreviewProvider scheme="light">
        <DebtsScreen />
      </ThemePreviewProvider>,
    );

    await fireEvent.press(screen.getByRole('button', { name: 'Marcar como paga' }));
    expect(markTransactionPaid).toHaveBeenCalledWith('debt-1');
    await waitFor(() => expect(screen.getByText('Pagamento registrado.')).toBeTruthy());
  });

  it('asks for a payment account before paying an invoice', async () => {
    const invoice: DebtItem = {
      kind: 'invoice',
      id: 'invoice-item-1',
      invoiceId: 'invoice-1',
      description: 'Fatura de junho de 2026',
      accountName: 'Cartão principal',
      dueDate: '2026-06-10',
      amountCents: 60_000,
    };
    const payInvoice = jest.fn().mockResolvedValue(true);
    mockedUseDebts.mockReturnValue({
      ...mockedUseDebts(),
      debts: [invoice],
      paymentAccounts: [
        {
          id: 'checking-1',
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
        },
      ],
      payInvoice,
    });
    const screen = await render(
      <ThemePreviewProvider scheme="light">
        <DebtsScreen />
      </ThemePreviewProvider>,
    );

    await fireEvent.press(screen.getByRole('button', { name: 'Pagar fatura' }));
    await fireEvent.press(screen.getByRole('radio', { name: 'Conta corrente' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Confirmar pagamento' }));

    await waitFor(() => expect(payInvoice).toHaveBeenCalledWith('invoice-1', 'checking-1'));
    expect(screen.getByText('Pagamento registrado.')).toBeTruthy();
  });
});
