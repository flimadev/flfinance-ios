import { addMonthsToDate } from './cardBilling';

export type DebtBalanceItem = {
  amountCents: number;
  dueDate: string;
};

export function getNextMonthlyOccurrence(
  startDate: string,
  dayOfMonth: number,
  afterDate: string,
  endDate?: string | null,
): string | null {
  const firstSearchDate = addMonthsToDate(startDate, 0);
  const referenceDate = addMonthsToDate(afterDate, 0);
  if (endDate) {
    addMonthsToDate(endDate, 0);
    if (endDate < firstSearchDate) {
      throw new RangeError('O fim da recorrência deve ser posterior ao início.');
    }
  }
  if (!Number.isInteger(dayOfMonth) || dayOfMonth < 1 || dayOfMonth > 31) {
    throw new RangeError('O dia da recorrência deve estar entre 1 e 31.');
  }

  let month =
    firstSearchDate.slice(0, 7) > referenceDate.slice(0, 7)
      ? `${firstSearchDate.slice(0, 7)}-01`
      : `${referenceDate.slice(0, 7)}-01`;

  for (let offset = 0; offset < 2; offset += 1) {
    const [year, monthNumber] = month.split('-').map(Number);
    const lastDay = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();
    const occurrence = `${month.slice(0, 7)}-${String(Math.min(dayOfMonth, lastDay)).padStart(2, '0')}`;

    if (occurrence >= firstSearchDate && occurrence > referenceDate) {
      return endDate && occurrence > endDate ? null : occurrence;
    }

    month = addMonthsToDate(month, 1);
  }

  return null;
}

export function summarizeDebtBalances(items: DebtBalanceItem[], today: string) {
  addMonthsToDate(today, 0);
  const summary = items.reduce(
    (totals, item) => {
      addMonthsToDate(item.dueDate, 0);
      if (!Number.isSafeInteger(item.amountCents) || item.amountCents < 0) {
        throw new RangeError('O valor da dívida deve ser um inteiro não negativo em centavos.');
      }
      totals.outstandingCents += item.amountCents;
      if (!Number.isSafeInteger(totals.outstandingCents)) {
        throw new RangeError('O total das dívidas excede o limite seguro de centavos.');
      }
      if (item.dueDate < today) {
        totals.overdueCents += item.amountCents;
        if (!Number.isSafeInteger(totals.overdueCents)) {
          throw new RangeError('O total das dívidas vencidas excede o limite seguro de centavos.');
        }
      }
      return totals;
    },
    { outstandingCents: 0, overdueCents: 0 },
  );

  return summary;
}
