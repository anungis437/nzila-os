/**
 * Payment Notifications — Unit Tests
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Hoisted mocks ────────────────────────────────────────────────────────────

const mocks = vi.hoisted(() => ({
  mockSelect: vi.fn(),
  mockSend: vi.fn().mockResolvedValue({ id: 'notif-1' }),
  mockQueue: vi.fn().mockResolvedValue({ id: 'notif-2' }),
  mockSendBulk: vi.fn().mockResolvedValue(undefined),
  mockRetryFailed: vi.fn().mockResolvedValue({ retried: 0 }),
  mockGetNotificationService: vi.fn(),
}));

function chain(resolveValue: unknown): unknown {
  const handler: ProxyHandler<object> = {
    get: (_target, prop) => {
      if (prop === 'then') return (resolve: (v: unknown) => void) => resolve(resolveValue);
      return vi.fn(() => new Proxy({}, handler));
    },
  };
  return new Proxy({}, handler);
}

vi.mock('@/db/db', () => ({
  db: { select: mocks.mockSelect },
}));

vi.mock('@/db/schema/profiles-schema', () => ({
  profiles: { id: 'id', organizationId: 'organizationId' },
}));

vi.mock('drizzle-orm', async (importOriginal) => {
  const actual = await importOriginal<typeof import('drizzle-orm')>();
  return { ...actual };
});

vi.mock('@/lib/services/notification-service', () => ({
  getNotificationService: mocks.mockGetNotificationService,
}));

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

// ── Imports ──────────────────────────────────────────────────────────────────

import {
  sendPaymentReceivedNotification,
  sendPaymentFailedNotification,
  sendDuesReminderNotification,
  sendDuesOverdueNotification,
  sendStrikeBenefitNotification,
  sendBulkNotification,
  retryFailedNotifications,
} from '../payment-notifications';
import defaultExport from '../payment-notifications';

// ── Tests ────────────────────────────────────────────────────────────────────

describe('payment-notifications', () => {
  const withRecipient = (overrides: Record<string, unknown> = {}) => {
    mocks.mockSelect.mockReturnValue(
      chain([{ id: 'user-1', email: 'user@test.com', phone: '+15551234567', firebaseToken: 'token-abc', ...overrides }]),
    );
  };
  const noRecipient = () => mocks.mockSelect.mockReturnValue(chain([]));
  const noEmail = () => mocks.mockSelect.mockReturnValue(chain([{ id: 'user-1', email: null }]));

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.mockGetNotificationService.mockReturnValue({
      send: mocks.mockSend,
      queue: mocks.mockQueue,
      sendBulk: mocks.mockSendBulk,
      retryFailed: mocks.mockRetryFailed,
    });
  });

  // ── sendPaymentReceivedNotification ────────────────────────────────────────
  describe('sendPaymentReceivedNotification', () => {
    it('sends email notification', async () => {
      withRecipient();
      await sendPaymentReceivedNotification('org-1', 'user-1', 100, 'card', 'txn-1', 'admin-1');
      expect(mocks.mockSend).toHaveBeenCalledWith(
        expect.objectContaining({ recipientEmail: 'user@test.com', type: 'email' }),
      );
    });

    it('sends push when firebaseToken present', async () => {
      withRecipient();
      await sendPaymentReceivedNotification('org-1', 'user-1', 100, 'card', 'txn-1', 'admin-1');
      expect(mocks.mockQueue).toHaveBeenCalledWith(expect.objectContaining({ type: 'push' }));
    });

    it('does not send when email not found', async () => {
      noEmail();
      await sendPaymentReceivedNotification('org-1', 'user-1', 100, 'card', 'txn-1', 'admin-1');
      expect(mocks.mockSend).not.toHaveBeenCalled();
    });

    it('does not send when recipient not found', async () => {
      noRecipient();
      await sendPaymentReceivedNotification('org-1', 'no-user', 100, 'card', 'txn-1', 'admin-1');
      expect(mocks.mockSend).not.toHaveBeenCalled();
    });

    it('handles error gracefully', async () => {
      mocks.mockSelect.mockImplementationOnce(() => { throw new Error('DB fail'); });
      await sendPaymentReceivedNotification('org-1', 'user-1', 100, 'card', 'txn-1', 'admin-1');
      // does not throw
    });
  });

  // ── sendPaymentFailedNotification ──────────────────────────────────────────
  describe('sendPaymentFailedNotification', () => {
    it('sends email with high priority', async () => {
      withRecipient();
      await sendPaymentFailedNotification('org-1', 'user-1', 50, 'Card declined', 'https://retry.com', 'admin-1');
      expect(mocks.mockSend).toHaveBeenCalledWith(
        expect.objectContaining({ priority: 'high', type: 'email' }),
      );
    });

    it('queues SMS when phone available', async () => {
      withRecipient();
      await sendPaymentFailedNotification('org-1', 'user-1', 50, 'Card declined', 'https://retry.com', 'admin-1');
      expect(mocks.mockQueue).toHaveBeenCalledWith(expect.objectContaining({ type: 'sms' }));
    });

    it('does not send when email not found', async () => {
      noEmail();
      await sendPaymentFailedNotification('org-1', 'user-1', 50, 'reason', 'url', 'admin-1');
      expect(mocks.mockSend).not.toHaveBeenCalled();
    });
  });

  // ── sendDuesReminderNotification ───────────────────────────────────────────
  describe('sendDuesReminderNotification', () => {
    const dueDate = new Date('2026-04-01');

    it('queues email reminder', async () => {
      withRecipient();
      await sendDuesReminderNotification('org-1', 'user-1', 75, dueDate, 5, 'https://pay.com', 'admin-1');
      expect(mocks.mockQueue).toHaveBeenCalledWith(expect.objectContaining({ type: 'email' }));
    });

    it('sends SMS when daysUntilDue <= 3 and phone available', async () => {
      withRecipient();
      await sendDuesReminderNotification('org-1', 'user-1', 75, dueDate, 2, 'https://pay.com', 'admin-1');
      expect(mocks.mockSend).toHaveBeenCalledWith(expect.objectContaining({ type: 'sms' }));
    });

    it('skips SMS when daysUntilDue > 3', async () => {
      withRecipient();
      await sendDuesReminderNotification('org-1', 'user-1', 75, dueDate, 10, 'https://pay.com', 'admin-1');
      expect(mocks.mockSend).not.toHaveBeenCalled();
    });

    it('does not send when email not found', async () => {
      noEmail();
      await sendDuesReminderNotification('org-1', 'user-1', 75, dueDate, 5, 'url', 'admin-1');
      expect(mocks.mockQueue).not.toHaveBeenCalled();
    });
  });

  // ── sendDuesOverdueNotification ────────────────────────────────────────────
  describe('sendDuesOverdueNotification', () => {
    const dueDate = new Date('2026-03-15');

    it('sends urgent email and SMS', async () => {
      withRecipient();
      await sendDuesOverdueNotification('org-1', 'user-1', 100, dueDate, 25, 'https://pay.com', 'admin-1');
      expect(mocks.mockSend).toHaveBeenCalledWith(expect.objectContaining({ priority: 'urgent', type: 'email' }));
      expect(mocks.mockSend).toHaveBeenCalledWith(expect.objectContaining({ type: 'sms' }));
    });

    it('does not send when email not found', async () => {
      noEmail();
      await sendDuesOverdueNotification('org-1', 'user-1', 100, dueDate, 25, 'url', 'admin-1');
      expect(mocks.mockSend).not.toHaveBeenCalled();
    });
  });

  // ── sendStrikeBenefitNotification ──────────────────────────────────────────
  describe('sendStrikeBenefitNotification', () => {
    const strikeStart = new Date('2026-03-01');

    it('sends email and push notification', async () => {
      withRecipient();
      await sendStrikeBenefitNotification('org-1', 'user-1', 500, strikeStart, 'https://claim.com', 'admin-1');
      expect(mocks.mockSend).toHaveBeenCalledWith(expect.objectContaining({ type: 'email' }));
      expect(mocks.mockQueue).toHaveBeenCalledWith(expect.objectContaining({ type: 'push' }));
    });

    it('does not send when email not found', async () => {
      noEmail();
      await sendStrikeBenefitNotification('org-1', 'user-1', 500, strikeStart, 'url', 'admin-1');
      expect(mocks.mockSend).not.toHaveBeenCalled();
    });
  });

  // ── sendBulkNotification ───────────────────────────────────────────────────
  describe('sendBulkNotification', () => {
    it('sends email to recipients with email', async () => {
      mocks.mockSelect.mockReturnValue(chain([
        { id: 'user-1', email: 'a@test.com', phone: null, firebaseToken: null },
        { id: 'user-2', email: 'b@test.com', phone: null, firebaseToken: null },
      ]));
      await sendBulkNotification('org-1', ['user-1', 'user-2'], 'Update', 'Hello', 'email', 'normal', 'admin-1');
      expect(mocks.mockSendBulk).toHaveBeenCalledWith(
        expect.arrayContaining([expect.objectContaining({ recipientEmail: 'a@test.com' })]),
      );
    });

    it('sends SMS when type is sms', async () => {
      mocks.mockSelect.mockReturnValue(chain([
        { id: 'user-1', email: null, phone: '+15551234567', firebaseToken: null },
      ]));
      await sendBulkNotification('org-1', ['user-1'], 'Alert', 'Urgent', 'sms', 'high', 'admin-1');
      expect(mocks.mockSendBulk).toHaveBeenCalledWith(
        expect.arrayContaining([expect.objectContaining({ recipientPhone: '+15551234567' })]),
      );
    });

    it('sends push when type is push', async () => {
      mocks.mockSelect.mockReturnValue(chain([
        { id: 'user-1', email: null, phone: null, firebaseToken: 'tok-1' },
      ]));
      await sendBulkNotification('org-1', ['user-1'], 'Alert', 'Push', 'push', 'normal', 'admin-1');
      expect(mocks.mockSendBulk).toHaveBeenCalledWith(
        expect.arrayContaining([expect.objectContaining({ recipientFirebaseToken: 'tok-1' })]),
      );
    });
  });

  // ── retryFailedNotifications ───────────────────────────────────────────────
  describe('retryFailedNotifications', () => {
    it('calls retryFailed on notification service', async () => {
      await retryFailedNotifications('org-1', 5);
      expect(mocks.mockRetryFailed).toHaveBeenCalledWith('org-1', 5);
    });

    it('handles error gracefully', async () => {
      mocks.mockRetryFailed.mockRejectedValueOnce(new Error('fail'));
      await retryFailedNotifications('org-1');
      // does not throw
    });
  });

  // ── default export ─────────────────────────────────────────────────────────
  describe('default export', () => {
    it('contains all functions', () => {
      expect(defaultExport.sendPaymentReceivedNotification).toBe(sendPaymentReceivedNotification);
      expect(defaultExport.sendPaymentFailedNotification).toBe(sendPaymentFailedNotification);
      expect(defaultExport.sendDuesReminderNotification).toBe(sendDuesReminderNotification);
      expect(defaultExport.sendDuesOverdueNotification).toBe(sendDuesOverdueNotification);
      expect(defaultExport.sendStrikeBenefitNotification).toBe(sendStrikeBenefitNotification);
      expect(defaultExport.sendBulkNotification).toBe(sendBulkNotification);
      expect(defaultExport.retryFailedNotifications).toBe(retryFailedNotifications);
    });
  });
});
