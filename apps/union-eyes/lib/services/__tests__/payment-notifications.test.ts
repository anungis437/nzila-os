/**
 * Payment Notifications — Unit Tests
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Hoisted mocks ────────────────────────────────────────────────────────────

const { mockSelect, mockSend, mockGetNotificationService } = vi.hoisted(() => ({
  mockSelect: vi.fn(),
  mockSend: vi.fn().mockResolvedValue({ id: 'notif-1' }),
  mockGetNotificationService: vi.fn(),
}));

vi.mock('@/db/db', () => ({
  db: {
    select: mockSelect,
  },
}));

vi.mock('@/db/schema/profiles-schema', () => ({
  profiles: {},
}));

vi.mock('drizzle-orm', async (importOriginal) => {
  const actual = await importOriginal<typeof import('drizzle-orm')>();
  return { ...actual };
});

vi.mock('@/lib/services/notification-service', () => ({
  getNotificationService: mockGetNotificationService,
}));

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

// ── Imports ──────────────────────────────────────────────────────────────────

import { sendPaymentReceivedNotification } from '../payment-notifications';

// ── Tests ────────────────────────────────────────────────────────────────────

describe('PaymentNotifications', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetNotificationService.mockReturnValue({ send: mockSend });
    mockSelect.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([]),
      }),
    });
  });

  it('sendPaymentReceivedNotification looks up profile and sends notification', async () => {
    mockSelect.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([{ id: 'user-1', email: 'user@test.com' }]),
      }),
    });

    await sendPaymentReceivedNotification('org-1', 'user-1', 100, 'card', 'txn-1', 'admin-1');

    expect(mockSend).toHaveBeenCalledWith(
      expect.objectContaining({
        recipientEmail: 'user@test.com',
        type: 'email',
      })
    );
  });

  it('does not send when recipient email not found', async () => {
    mockSelect.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([{ id: 'user-1', email: null }]),
      }),
    });

    await sendPaymentReceivedNotification('org-1', 'user-1', 100, 'card', 'txn-1', 'admin-1');
    expect(mockSend).not.toHaveBeenCalled();
  });

  it('does not send when recipient not found at all', async () => {
    mockSelect.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([]),
      }),
    });

    await sendPaymentReceivedNotification('org-1', 'no-user', 100, 'card', 'txn-1', 'admin-1');
    expect(mockSend).not.toHaveBeenCalled();
  });
});
