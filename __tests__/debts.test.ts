import { getNextMonthlyOccurrence, summarizeDebtBalances } from '../src/domain/debts';

describe('debt scheduling', () => {
  it('keeps an upcoming recurring payment in the current month', () => {
    expect(getNextMonthlyOccurrence('2026-06-15', 15, '2026-06-02')).toBe('2026-06-15');
  });

  it('moves a past occurrence to the next month and clamps short months', () => {
    expect(getNextMonthlyOccurrence('2026-01-31', 31, '2026-01-30')).toBe('2026-01-31');
    expect(getNextMonthlyOccurrence('2026-01-31', 31, '2026-01-31')).toBe('2026-02-28');
    expect(getNextMonthlyOccurrence('2026-01-31', 31, '2026-02-28')).toBe('2026-03-31');
  });

  it('respects recurring start and end dates', () => {
    expect(getNextMonthlyOccurrence('2026-07-20', 20, '2026-06-30', '2026-08-20')).toBe(
      '2026-07-20',
    );
    expect(getNextMonthlyOccurrence('2026-07-20', 20, '2026-08-20', '2026-08-20')).toBeNull();
  });

  it('summarizes open and overdue amounts using integer cents', () => {
    expect(
      summarizeDebtBalances(
        [
          { amountCents: 2_500, dueDate: '2026-06-01' },
          { amountCents: 1_000, dueDate: '2026-06-10' },
        ],
        '2026-06-05',
      ),
    ).toEqual({ outstandingCents: 3_500, overdueCents: 2_500 });
  });

  it('rejects invalid monthly days and monetary totals', () => {
    expect(() => getNextMonthlyOccurrence('2026-06-01', 32, '2026-06-02')).toThrow(RangeError);
    expect(() =>
      summarizeDebtBalances(
        [
          { amountCents: Number.MAX_SAFE_INTEGER, dueDate: '2026-06-01' },
          {
            amountCents: 1,
            dueDate: '2026-06-02',
          },
        ],
        '2026-06-03',
      ),
    ).toThrow(RangeError);
  });
});
