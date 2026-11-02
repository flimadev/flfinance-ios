import { getPaymentReminderDate } from '../src/domain/paymentReminders';

describe('payment reminder dates', () => {
  it('schedules a reminder at 9 AM local time the requested number of days before', () => {
    const now = new Date(2026, 5, 1, 8);

    expect(getPaymentReminderDate('2026-06-10', 3, now)).toEqual(new Date(2026, 5, 7, 9));
  });

  it('does not schedule reminders that have already passed', () => {
    expect(getPaymentReminderDate('2026-06-02', 1, new Date(2026, 5, 1, 9))).toBeNull();
    expect(getPaymentReminderDate('2026-06-01', 0, new Date(2026, 5, 1, 9))).toBeNull();
  });

  it('rejects invalid dates and lead times', () => {
    expect(() => getPaymentReminderDate('2026-02-30', 1)).toThrow(RangeError);
    expect(() => getPaymentReminderDate('2026-06-10', 31)).toThrow(RangeError);
  });
});
