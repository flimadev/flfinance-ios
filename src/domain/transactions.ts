import type { Transaction } from '@/src/db/schema';

export function parseCurrencyDigitsToCents(digits: string): number | null {
  if (!/^\d{1,15}$/.test(digits)) {
    return null;
  }

  const cents = Number(digits);
  return Number.isSafeInteger(cents) ? cents : null;
}

export function getLocalDateString(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export type TransactionRow =
  | { type: 'date'; key: string; date: string }
  | { type: 'transaction'; key: string; transaction: Transaction };

export function groupTransactionsByDate(items: Transaction[]): TransactionRow[] {
  const rows: TransactionRow[] = [];
  let currentDate: string | undefined;

  for (const transaction of items) {
    if (transaction.date !== currentDate) {
      currentDate = transaction.date;
      rows.push({
        type: 'date',
        key: `date-${currentDate}`,
        date: currentDate,
      });
    }
    rows.push({
      type: 'transaction',
      key: transaction.id,
      transaction,
    });
  }

  return rows;
}

export function normalizeSearchText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('pt-BR')
    .trim();
}
