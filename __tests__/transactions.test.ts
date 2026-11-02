import type { Transaction } from '../src/db/schema';
import {
  getLocalDateString,
  groupTransactionsByDate,
  normalizeSearchText,
  parseCurrencyDigitsToCents,
} from '../src/domain/transactions';

function createTransaction(id: string, date: string): Transaction {
  return {
    id,
    accountId: 'account-1',
    categoryId: null,
    kind: 'expense',
    amountCents: 100,
    date,
    description: id,
    notes: null,
    paymentMethod: null,
    transferAccountId: null,
    installmentGroupId: null,
    installmentNumber: null,
    installmentTotal: null,
    invoiceId: null,
    recurringId: null,
    isPaid: true,
    reconciledAt: null,
    deletedAt: null,
    createdAt: 1,
    updatedAt: 1,
  };
}

describe('transaction presentation helpers', () => {
  it('converts custom-keypad digits to exact integer cents', () => {
    expect(parseCurrencyDigitsToCents('0')).toBe(0);
    expect(parseCurrencyDigitsToCents('12345')).toBe(12_345);
    expect(parseCurrencyDigitsToCents('9007199254740992')).toBeNull();
    expect(parseCurrencyDigitsToCents('1.5')).toBeNull();
    expect(parseCurrencyDigitsToCents('')).toBeNull();
  });

  it('groups already-sorted transactions into date rows', () => {
    expect(
      groupTransactionsByDate([
        createTransaction('second', '2026-10-30'),
        createTransaction('first', '2026-10-30'),
        createTransaction('older', '2026-10-29'),
      ]),
    ).toEqual([
      { type: 'date', key: 'date-2026-10-30', date: '2026-10-30' },
      {
        type: 'transaction',
        key: 'second',
        transaction: createTransaction('second', '2026-10-30'),
      },
      { type: 'transaction', key: 'first', transaction: createTransaction('first', '2026-10-30') },
      { type: 'date', key: 'date-2026-10-29', date: '2026-10-29' },
      { type: 'transaction', key: 'older', transaction: createTransaction('older', '2026-10-29') },
    ]);
  });

  it('normalizes search text and formats dates in local calendar time', () => {
    expect(normalizeSearchText('  CAFÉ São Paulo  ')).toBe('cafe sao paulo');
    expect(getLocalDateString(new Date(2026, 0, 5))).toBe('2026-01-05');
  });
});
