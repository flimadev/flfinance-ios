import {
  createInstallmentSchedule,
  getBillingMonth,
  getInvoiceDueDate,
  getMonthlyOccurrenceDates,
} from '../src/domain/cardBilling';

describe('card billing calendar', () => {
  it('keeps purchases on the closing day in the current invoice', () => {
    expect(getBillingMonth('2025-05-25', 25)).toBe('2025-05');
    expect(getBillingMonth('2025-05-26', 25)).toBe('2025-06');
  });

  it('moves installment invoices across years and distributes cents exactly', () => {
    const schedule = createInstallmentSchedule('2025-12-31', 10_000, 3, {
      closingDay: 31,
      dueDay: 10,
    });

    expect(schedule).toEqual([
      {
        installmentNumber: 1,
        amountCents: 3_334,
        billingMonth: '2025-12',
        dueDate: '2026-01-10',
        transactionDate: '2026-01-10',
      },
      {
        installmentNumber: 2,
        amountCents: 3_333,
        billingMonth: '2026-01',
        dueDate: '2026-02-10',
        transactionDate: '2026-02-10',
      },
      {
        installmentNumber: 3,
        amountCents: 3_333,
        billingMonth: '2026-02',
        dueDate: '2026-03-10',
        transactionDate: '2026-03-10',
      },
    ]);
  });

  it('clamps due dates to February and other short months, including leap years', () => {
    expect(getInvoiceDueDate('2024-01', 31, 31)).toBe('2024-02-29');
    expect(getInvoiceDueDate('2025-01', 31, 31)).toBe('2025-02-28');
    expect(getInvoiceDueDate('2025-03', 31, 31)).toBe('2025-04-30');
  });

  it('generates monthly occurrences on the last available day for high day numbers', () => {
    expect(getMonthlyOccurrenceDates('2024-01-31', 31, '2024-04-30')).toEqual([
      '2024-01-31',
      '2024-02-29',
      '2024-03-31',
      '2024-04-30',
    ]);
  });
});
