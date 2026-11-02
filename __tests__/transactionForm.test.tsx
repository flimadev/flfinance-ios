import { fireEvent, render, waitFor } from '@testing-library/react-native';

import type { Account, Category } from '../src/db/schema';
import type { CreateTransactionInput } from '../src/domain/financeSchemas';
import { TransactionFormSheet } from '../src/features/transactions/TransactionFormSheet';

jest.mock('react-native-reanimated', () => ({
  useReducedMotion: () => false,
}));

const accounts: Account[] = [
  {
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
  },
  {
    id: 'cash',
    name: 'Carteira',
    type: 'cash',
    initialBalanceCents: 0,
    closingDay: null,
    dueDay: null,
    color: '#147A58',
    icon: 'wallet.bifold.fill',
    currency: 'BRL',
    archivedAt: null,
    deletedAt: null,
    createdAt: 1,
    updatedAt: 1,
  },
];
const creditCard: Account = {
  id: 'credit-card',
  name: 'Cartão principal',
  type: 'credit_card',
  initialBalanceCents: 0,
  closingDay: 25,
  dueDay: 10,
  color: '#147A58',
  icon: 'creditcard.fill',
  currency: 'BRL',
  archivedAt: null,
  deletedAt: null,
  createdAt: 1,
  updatedAt: 1,
};

const categories: Category[] = [
  {
    id: 'food',
    name: 'Alimentação',
    kind: 'expense',
    icon: 'fork.knife',
    color: '#B36C4B',
    parentId: null,
    sortOrder: 1,
    archivedAt: null,
    deletedAt: null,
    createdAt: 1,
    updatedAt: 1,
  },
];

describe('TransactionFormSheet', () => {
  it('creates an expense using the custom keypad and selected account/category', async () => {
    const onSave = jest.fn(async (_input: CreateTransactionInput) => undefined);
    const onClose = jest.fn();
    const screen = await render(
      <TransactionFormSheet
        accounts={accounts}
        categories={categories}
        tags={[]}
        transactionTagIds={[]}
        attachments={[]}
        onClose={onClose}
        onSave={onSave}
        onSaveExtras={jest.fn()}
      />,
    );
    await fireEvent.press(screen.getByLabelText('Adicionar dígito 1'));
    await fireEvent.press(screen.getByLabelText('Adicionar dígito 2'));
    await fireEvent.press(screen.getByLabelText('Adicionar dígito 3'));
    await fireEvent.changeText(screen.getByLabelText('Descrição'), 'Compra no mercado');
    await fireEvent.press(screen.getByRole('button', { name: 'Alimentação' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Salvar lançamento' }));

    await waitFor(() => {
      expect(onSave).toHaveBeenCalledWith(
        expect.objectContaining({
          accountId: 'checking',
          categoryId: 'food',
          kind: 'expense',
          amountCents: 123,
          description: 'Compra no mercado',
          paymentMethod: 'pix',
          transferAccountId: null,
        }),
      );
      expect(onClose).toHaveBeenCalled();
    });
  });

  it('requires a distinct destination and saves transfers without a category', async () => {
    const onSave = jest.fn(async (_input: CreateTransactionInput) => undefined);
    const screen = await render(
      <TransactionFormSheet
        accounts={accounts}
        categories={categories}
        tags={[]}
        transactionTagIds={[]}
        attachments={[]}
        onClose={jest.fn()}
        onSave={onSave}
        onSaveExtras={jest.fn()}
      />,
    );

    await fireEvent.press(screen.getByText('Transferência'));
    await fireEvent.press(screen.getByLabelText('Adicionar dígito 5'));
    await fireEvent.changeText(screen.getByLabelText('Descrição'), 'Reserva');
    await fireEvent.press(screen.getAllByText('Carteira')[1]);
    await fireEvent.press(screen.getByRole('button', { name: 'Salvar lançamento' }));

    await waitFor(() => {
      expect(onSave).toHaveBeenCalledWith(
        expect.objectContaining({
          accountId: 'checking',
          categoryId: null,
          kind: 'transfer',
          transferAccountId: 'cash',
          amountCents: 5,
          paymentMethod: 'transfer',
        }),
      );
    });
  });

  it('creates card purchases with the selected installment count', async () => {
    const onSave = jest.fn(async (_input: CreateTransactionInput) => undefined);
    const screen = await render(
      <TransactionFormSheet
        accounts={[...accounts, creditCard]}
        categories={categories}
        tags={[]}
        transactionTagIds={[]}
        attachments={[]}
        onClose={jest.fn()}
        onSave={onSave}
        onSaveExtras={jest.fn()}
      />,
    );

    await fireEvent.press(screen.getByRole('button', { name: 'Cartão principal' }));
    await fireEvent.press(screen.getByLabelText('Adicionar dígito 8'));
    await fireEvent.changeText(screen.getByLabelText('Descrição'), 'Compra parcelada');
    await fireEvent.changeText(screen.getByLabelText('Parcelas'), '3');
    await fireEvent.press(screen.getByRole('button', { name: 'Salvar lançamento' }));

    await waitFor(() => {
      expect(onSave).toHaveBeenCalledWith(
        expect.objectContaining({
          accountId: 'credit-card',
          kind: 'expense',
          amountCents: 8,
          description: 'Compra parcelada',
          paymentMethod: 'credit',
          installmentCount: 3,
          isPaid: false,
        }),
      );
    });
  });
});
