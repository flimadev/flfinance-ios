import * as Notifications from 'expo-notifications';

import {
  PaymentReminderService,
  type NotificationPort,
  type PaymentReminderSource,
  type PaymentReminderTarget,
} from '../src/services/PaymentReminderService';

const grantedPermission = {
  status: 'granted',
  expires: 'never',
  granted: true,
  canAskAgain: true,
} as Awaited<ReturnType<typeof Notifications.getPermissionsAsync>>;

function getOutputSound(
  sound: Notifications.NotificationContentInput['sound'],
): Notifications.NotificationContent['sound'] {
  if (sound === false || sound === undefined || sound === null) {
    return null;
  }
  if (sound === 'default') return 'default';
  if (sound === 'defaultCritical') return 'defaultCritical';
  if (sound === 'defaultRingtone') return 'defaultRingtone';
  return 'custom';
}

function createRequest(identifier: string, key: string): Notifications.NotificationRequest {
  return {
    identifier,
    content: {
      title: 'Lembrete',
      subtitle: null,
      body: 'Aviso',
      data: { flfinancePaymentReminderKey: key },
      categoryIdentifier: null,
      sound: null,
      launchImageName: null,
      badge: null,
      attachments: [],
      threadIdentifier: null,
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: new Date(2026, 5, 7, 9),
    },
  };
}

function createNotificationPort(initial: Notifications.NotificationRequest[] = []) {
  const scheduled = [...initial];
  const cancelScheduledNotificationAsync = jest.fn(async (identifier: string) => {
    const index = scheduled.findIndex((request) => request.identifier === identifier);
    if (index >= 0) {
      scheduled.splice(index, 1);
    }
  });
  const port: NotificationPort = {
    getPermissionsAsync: jest.fn(async () => grantedPermission),
    requestPermissionsAsync: jest.fn(async () => grantedPermission),
    setNotificationChannelAsync: jest.fn(async () => null),
    getAllScheduledNotificationsAsync: jest.fn(async () => scheduled),
    scheduleNotificationAsync: jest.fn(async (request) => {
      const identifier = `scheduled-${scheduled.length + 1}`;
      scheduled.push({
        identifier,
        content: {
          title: request.content.title ?? null,
          subtitle: request.content.subtitle ?? null,
          body: request.content.body ?? null,
          data: request.content.data,
          categoryIdentifier: request.content.categoryIdentifier ?? null,
          sound: getOutputSound(request.content.sound),
          launchImageName: request.content.launchImageName ?? null,
          badge: request.content.badge ?? null,
          attachments: request.content.attachments ?? [],
          threadIdentifier: request.content.threadIdentifier ?? null,
        },
        trigger: request.trigger as Notifications.NotificationTrigger,
      });
      return identifier;
    }),
    cancelScheduledNotificationAsync,
  };
  return { port, scheduled, cancelScheduledNotificationAsync };
}

describe('PaymentReminderService', () => {
  const now = new Date(2026, 5, 1, 8);

  it('schedules pending targets and reconciles paid targets without duplicating reminders', async () => {
    let targets: PaymentReminderTarget[] = [
      { id: 'transaction:expense-1', dueDate: '2026-06-10', direction: 'payable' },
      { id: 'transaction:income-1', dueDate: '2026-06-12', direction: 'receivable' },
    ];
    const source: PaymentReminderSource = { listPendingTargets: async () => targets };
    const { port, scheduled, cancelScheduledNotificationAsync } = createNotificationPort();
    const service = new PaymentReminderService(source, port, 'ios', () => now);

    await expect(service.synchronize(3)).resolves.toBe(2);
    expect(scheduled).toHaveLength(2);
    expect(port.scheduleNotificationAsync).toHaveBeenCalledTimes(2);

    const retainedId = scheduled[1]?.identifier;
    targets = [targets[1]!];
    await expect(service.synchronize(3)).resolves.toBe(1);

    expect(scheduled).toHaveLength(1);
    expect(scheduled[0]?.identifier).toBe(retainedId);
    expect(port.scheduleNotificationAsync).toHaveBeenCalledTimes(2);
    expect(cancelScheduledNotificationAsync).toHaveBeenCalledTimes(1);
  });

  it('cancels its notifications when reminders are disabled', async () => {
    const existing = createRequest(
      'old-reminder',
      'flfinance-payment:transaction:old:2026-06-10:3',
    );
    const { port, scheduled, cancelScheduledNotificationAsync } = createNotificationPort([
      existing,
    ]);
    const source: PaymentReminderSource = { listPendingTargets: async () => [] };
    const service = new PaymentReminderService(source, port, 'ios', () => now);

    await expect(service.synchronize(0)).resolves.toBe(0);

    expect(scheduled).toHaveLength(0);
    expect(cancelScheduledNotificationAsync).toHaveBeenCalledWith('old-reminder');
  });

  it('reports denied notification permission instead of silently enabling reminders', async () => {
    const deniedPermission = {
      ...grantedPermission,
      status: 'denied',
      granted: false,
    } as Awaited<ReturnType<typeof Notifications.getPermissionsAsync>>;
    const { port } = createNotificationPort();
    port.getPermissionsAsync = jest.fn(async () => deniedPermission);
    port.requestPermissionsAsync = jest.fn(async () => deniedPermission);
    const source: PaymentReminderSource = {
      listPendingTargets: async () => [
        { id: 'transaction:expense-1', dueDate: '2026-06-10', direction: 'payable' },
      ],
    };
    const service = new PaymentReminderService(source, port, 'ios', () => now);

    await expect(service.synchronize(3, true)).rejects.toThrow(
      'payment-reminders-permission-denied',
    );
    expect(port.scheduleNotificationAsync).not.toHaveBeenCalled();
  });

  it('keeps the number of pending requests below the local notification limit', async () => {
    const targets = Array.from({ length: 51 }, (_, index) => ({
      id: `transaction:expense-${index}`,
      dueDate: '2026-06-10',
      direction: 'payable' as const,
    }));
    const source: PaymentReminderSource = { listPendingTargets: async () => targets };
    const { port, scheduled } = createNotificationPort();
    const service = new PaymentReminderService(source, port, 'ios', () => now);

    await expect(service.synchronize(3)).resolves.toBe(50);

    expect(scheduled).toHaveLength(50);
    expect(port.scheduleNotificationAsync).toHaveBeenCalledTimes(50);
  });

  it('serializes overlapping synchronization requests to avoid duplicate schedules', async () => {
    const source: PaymentReminderSource = {
      listPendingTargets: async () => [
        { id: 'transaction:expense-1', dueDate: '2026-06-10', direction: 'payable' },
      ],
    };
    const { port, scheduled } = createNotificationPort();
    const service = new PaymentReminderService(source, port, 'ios', () => now);

    await Promise.all([service.synchronize(3), service.synchronize(3)]);

    expect(scheduled).toHaveLength(1);
    expect(port.scheduleNotificationAsync).toHaveBeenCalledTimes(1);
  });
});
