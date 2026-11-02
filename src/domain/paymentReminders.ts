const maxReminderDays = 30;
const reminderHour = 9;

export function getPaymentReminderDate(
  dueDate: string,
  daysBefore: number,
  now: Date = new Date(),
): Date | null {
  if (!Number.isInteger(daysBefore) || daysBefore < 0 || daysBefore > maxReminderDays) {
    throw new RangeError('A antecedência do lembrete deve estar entre 0 e 30 dias.');
  }

  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dueDate);
  if (!match) {
    throw new RangeError('A data de vencimento deve seguir o formato YYYY-MM-DD.');
  }

  const [, yearValue, monthValue, dayValue] = match;
  const due = new Date(Number(yearValue), Number(monthValue) - 1, Number(dayValue), reminderHour);
  if (
    due.getFullYear() !== Number(yearValue) ||
    due.getMonth() !== Number(monthValue) - 1 ||
    due.getDate() !== Number(dayValue)
  ) {
    throw new RangeError('A data de vencimento informada não existe.');
  }

  due.setDate(due.getDate() - daysBefore);
  return due.getTime() > now.getTime() ? due : null;
}
