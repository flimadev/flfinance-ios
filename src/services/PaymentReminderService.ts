import * as Notifications from 'expo-notifications';
import { AndroidImportance } from 'expo-notifications';
import { Platform } from 'react-native';

import type { Transaction } from '@/src/db/schema';
import { getPaymentReminderDate } from '@/src/domain/paymentReminders';
import { ptBR } from '@/src/i18n/pt-BR';
import { getTransactionServices } from '@/src/features/transactions/transactionData';

const reminderDataKey = 'flfinancePaymentReminderKey';
const reminderPrefix = 'flfinance-payment:';
const maxScheduledReminders = 50;
const androidChannelId = 'payment-reminders';

export type PaymentReminderTarget = {
  id: string;
  dueDate: string;
  direction: 'payable' | 'receivable';
};

export type PaymentReminderSource = {
  listPendingTargets: () => Promise<PaymentReminderTarget[]>;
};

export type NotificationPort = Pick<
  typeof Notifications,
  | 'getPermissionsAsync'
  | 'requestPermissionsAsync'
  | 'setNotificationChannelAsync'
  | 'getAllScheduledNotificationsAsync'
  | 'scheduleNotificationAsync'
  | 'cancelScheduledNotificationAsync'
>;

function toTransactionTarget(transaction: Transaction): PaymentReminderTarget {
  return {
    id: `transaction:${transaction.id}`,
    dueDate: transaction.date,
    direction: transaction.kind === 'income' ? 'receivable' : 'payable',
  };
}

const localReminderSource: PaymentReminderSource = {
  async listPendingTargets() {
    const { accountService, invoiceService, transactionService } = await getTransactionServices();
    const [accounts, transactions] = await Promise.all([
      accountService.list(),
      transactionService.list(),
    ]);
    const accountsById = new Map(accounts.map((account) => [account.id, account]));
    const cardAccounts = accounts.filter((account) => account.type === 'credit_card');
    const invoices = await Promise.all(
      cardAccounts.map(async (account) => ({
        account,
        invoices: await invoiceService.listByAccount(account.id),
      })),
    );
    const pendingTransactions = transactions
      .filter(
        (transaction) =>
          (transaction.kind === 'expense' || transaction.kind === 'income') &&
          !transaction.isPaid &&
          transaction.invoiceId === null &&
          accountsById.get(transaction.accountId)?.type !== 'credit_card',
      )
      .flatMap((transaction) => {
        const account = accountsById.get(transaction.accountId);
        return account ? [toTransactionTarget(transaction)] : [];
      });
    const openInvoices = invoices.flatMap(({ invoices: accountInvoices }) =>
      accountInvoices
        .filter((invoice) => invoice.status === 'open' && invoice.totalCents > 0)
        .map((invoice) => ({
          id: `invoice:${invoice.id}`,
          dueDate: invoice.dueDate,
          direction: 'payable' as const,
        })),
    );

    return [...pendingTransactions, ...openInvoices];
  },
};

function getReminderKey(request: Notifications.NotificationRequest): string | null {
  const key = request.content.data?.[reminderDataKey];
  return typeof key === 'string' && key.startsWith(reminderPrefix) ? key : null;
}

export class PaymentReminderService {
  private static synchronizationQueue: Promise<void> = Promise.resolve();

  constructor(
    private readonly source: PaymentReminderSource = localReminderSource,
    private readonly notifications: NotificationPort = Notifications,
    private readonly platform: string = Platform.OS,
    private readonly now: () => Date = () => new Date(),
  ) {}

  synchronize(daysBefore: number, requestPermission = false): Promise<number> {
    const operation = PaymentReminderService.synchronizationQueue.then(() =>
      this.synchronizeNow(daysBefore, requestPermission),
    );
    PaymentReminderService.synchronizationQueue = operation.then(
      () => undefined,
      () => undefined,
    );
    return operation;
  }

  private async synchronizeNow(daysBefore: number, requestPermission: boolean): Promise<number> {
    if (this.platform !== 'ios' && this.platform !== 'android') {
      throw new Error('payment-reminders-unavailable');
    }
    if (!Number.isInteger(daysBefore) || daysBefore < 0 || daysBefore > 30) {
      throw new RangeError('A antecedência do lembrete deve estar entre 0 e 30 dias.');
    }

    const scheduled = await this.notifications.getAllScheduledNotificationsAsync();
    const existing = scheduled.filter((request) => getReminderKey(request) !== null);
    if (daysBefore === 0) {
      for (const request of existing) {
        await this.notifications.cancelScheduledNotificationAsync(request.identifier);
      }
      return 0;
    }
    if (this.platform === 'android') {
      await this.notifications.setNotificationChannelAsync(androidChannelId, {
        name: ptBR.debts.notificationChannel,
        importance: AndroidImportance.DEFAULT,
        description: ptBR.debts.notificationChannelDescription,
        sound: null,
      });
    }

    let permission = await this.notifications.getPermissionsAsync();
    if (!permission.granted && requestPermission) {
      permission = await this.notifications.requestPermissionsAsync({
        ios: { allowAlert: true, allowSound: false, allowBadge: false },
      });
    }
    if (!permission.granted) {
      throw new Error('payment-reminders-permission-denied');
    }

    const now = this.now();
    const targets = await this.source.listPendingTargets();
    const desired = targets
      .map((target) => {
        const triggerDate = getPaymentReminderDate(target.dueDate, daysBefore, now);
        if (!triggerDate) {
          return null;
        }
        return {
          target,
          triggerDate,
          key: `${reminderPrefix}${target.id}:${target.dueDate}:${daysBefore}:${triggerDate.getTime()}`,
        };
      })
      .filter((item): item is NonNullable<typeof item> => item !== null)
      .sort((a, b) => a.triggerDate.getTime() - b.triggerDate.getTime())
      .slice(0, maxScheduledReminders);

    const existingByKey = new Map<string, Notifications.NotificationRequest[]>();
    for (const request of existing) {
      const key = getReminderKey(request);
      if (!key) {
        continue;
      }
      existingByKey.set(key, [...(existingByKey.get(key) ?? []), request]);
    }

    const desiredKeys = new Set(desired.map((item) => item.key));
    const toCancel = existing.filter((request) => {
      const key = getReminderKey(request);
      const matches = key ? (existingByKey.get(key) ?? []) : [];
      return !key || !desiredKeys.has(key) || matches[0]?.identifier !== request.identifier;
    });
    const scheduledIds: string[] = [];

    for (const request of toCancel) {
      await this.notifications.cancelScheduledNotificationAsync(request.identifier);
    }

    try {
      for (const item of desired) {
        if (existingByKey.has(item.key)) {
          continue;
        }
        const identifier = await this.notifications.scheduleNotificationAsync({
          content: {
            title:
              item.target.direction === 'payable'
                ? ptBR.debts.paymentReminderTitle
                : ptBR.debts.receivableReminderTitle,
            body: ptBR.debts.paymentReminderBody,
            sound: false,
            data: {
              [reminderDataKey]: item.key,
              screen: 'debts',
            },
          },
          trigger: {
            type: Notifications.SchedulableTriggerInputTypes.DATE,
            date: item.triggerDate,
            ...(this.platform === 'android' ? { channelId: androidChannelId } : {}),
          },
        });
        scheduledIds.push(identifier);
      }
    } catch (error) {
      const cleanup = await Promise.allSettled(
        scheduledIds.map((identifier) =>
          this.notifications.cancelScheduledNotificationAsync(identifier),
        ),
      );
      for (const result of cleanup) {
        if (result.status === 'rejected') {
          console.error(
            'Não foi possível desfazer um lembrete parcialmente agendado.',
            result.reason,
          );
        }
      }
      throw error;
    }

    return desired.length;
  }
}
