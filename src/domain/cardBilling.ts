import type { Account } from '@/src/db/schema';

export type InstallmentScheduleItem = {
  installmentNumber: number;
  amountCents: number;
  billingMonth: string;
  dueDate: string;
  transactionDate: string;
};

function parseDate(date: string): { year: number; month: number; day: number } {
  const [year, month, day] = date.split('-').map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  if (
    !Number.isInteger(year) ||
    !Number.isInteger(month) ||
    !Number.isInteger(day) ||
    parsed.toISOString().slice(0, 10) !== date
  ) {
    throw new RangeError(`Data local inválida: ${date}`);
  }
  return { year, month, day };
}

function formatMonth(year: number, month: number): string {
  const normalizedYear = year + Math.floor((month - 1) / 12);
  const normalizedMonth = ((((month - 1) % 12) + 12) % 12) + 1;
  return `${String(normalizedYear).padStart(4, '0')}-${String(normalizedMonth).padStart(2, '0')}`;
}

export function addMonthsToDate(date: string, offset: number): string {
  const parsed = parseDate(date);
  const monthIndex = parsed.month - 1 + offset;
  const year = parsed.year + Math.floor(monthIndex / 12);
  const month = ((monthIndex % 12) + 12) % 12;
  const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const day = Math.min(parsed.day, lastDay);
  return `${String(year).padStart(4, '0')}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

export function getBillingMonth(date: string, closingDay: number): string {
  const { year, month, day } = parseDate(date);
  return formatMonth(year, month + Number(day > closingDay));
}

export function getInvoiceDueDate(
  billingMonth: string,
  closingDay: number,
  dueDay: number,
): string {
  const { year, month } = parseDate(`${billingMonth}-01`);
  const dueMonth = formatMonth(year, month + Number(dueDay <= closingDay));
  const [dueYear, dueMonthNumber] = dueMonth.split('-').map(Number);
  const lastDay = new Date(Date.UTC(dueYear, dueMonthNumber, 0)).getUTCDate();
  const day = Math.min(dueDay, lastDay);
  return `${dueMonth}-${String(day).padStart(2, '0')}`;
}

export function createInstallmentSchedule(
  date: string,
  amountCents: number,
  installmentCount: number,
  account: Pick<Account, 'closingDay' | 'dueDay'>,
): InstallmentScheduleItem[] {
  if (!Number.isSafeInteger(amountCents) || amountCents <= 0) {
    throw new RangeError('O valor parcelado deve ser um inteiro positivo em centavos.');
  }
  if (!Number.isInteger(installmentCount) || installmentCount < 1 || installmentCount > 120) {
    throw new RangeError('O parcelamento deve ter entre 1 e 120 parcelas.');
  }
  if (!account.closingDay || !account.dueDay) {
    throw new RangeError('O cartão precisa ter dias de fechamento e vencimento configurados.');
  }

  const baseCents = Math.floor(amountCents / installmentCount);
  const remainderCents = amountCents % installmentCount;
  const firstBillingMonth = getBillingMonth(date, account.closingDay);

  return Array.from({ length: installmentCount }, (_, index) => {
    const [year, month] = firstBillingMonth.split('-').map(Number);
    const billingMonth = formatMonth(year, month + index);
    const dueDate = getInvoiceDueDate(billingMonth, account.closingDay!, account.dueDay!);

    return {
      installmentNumber: index + 1,
      amountCents: baseCents + Number(index < remainderCents),
      billingMonth,
      dueDate,
      transactionDate: dueDate,
    };
  });
}

export function getMonthlyOccurrenceDates(
  startDate: string,
  dayOfMonth: number,
  throughDate: string,
  afterDate?: string | null,
  endDate?: string | null,
): string[] {
  parseDate(startDate);
  parseDate(throughDate);
  if (endDate) {
    parseDate(endDate);
  }
  if (afterDate) {
    parseDate(afterDate);
  }

  const initialMonth = afterDate
    ? addMonthsToDate(`${afterDate.slice(0, 7)}-01`, 1)
    : `${startDate.slice(0, 7)}-01`;
  const finalDate = endDate && endDate < throughDate ? endDate : throughDate;
  const dates: string[] = [];

  for (
    let monthStart = initialMonth;
    monthStart <= finalDate;
    monthStart = addMonthsToDate(monthStart, 1)
  ) {
    const [year, month] = monthStart.split('-').map(Number);
    const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
    const day = Math.min(dayOfMonth, lastDay);
    const occurrence = `${monthStart.slice(0, 7)}-${String(day).padStart(2, '0')}`;
    if (
      occurrence >= startDate &&
      (!afterDate || occurrence > afterDate) &&
      occurrence <= finalDate
    ) {
      dates.push(occurrence);
    }
  }

  return dates;
}

export function getAccountCardSettings(account: Pick<Account, 'type' | 'closingDay' | 'dueDay'>): {
  closingDay: number;
  dueDay: number;
} {
  if (account.type !== 'credit_card' || account.closingDay === null || account.dueDay === null) {
    throw new RangeError('A conta não possui configuração de cartão de crédito.');
  }
  return { closingDay: account.closingDay, dueDay: account.dueDay };
}
