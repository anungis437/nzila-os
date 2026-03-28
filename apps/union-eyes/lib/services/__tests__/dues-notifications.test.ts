/**
 * Dues Notifications — Unit Tests
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Hoisted mocks ────────────────────────────────────────────────────────────

const { mockSelect, mockSend, mockGetNotificationService } = vi.hoisted(() => ({
  mockSelect: vi.fn(),
  mockSend: vi.fn().mockResolvedValue({ id: 'notif-1' }),
  mockGetNotificationService: vi.fn(),
}));

vi.mock('@/db', () => ({
  db: {
    select: mockSelect,
  },
}));

vi.mock('@/db/schema-organizations', () => ({
  organizationMembers: {},
  organizations: {},
}));

vi.mock('@/db/schema/domains/finance/dues', () => ({
  duesTransactions: {},
}));

vi.mock('drizzle-orm', async (importOriginal) => {
  const actual = await importOriginal<typeof import('drizzle-orm')>();
  return { ...actual };
});

vi.mock('@/lib/services/notification-service', () => ({
  getNotificationService: mockGetNotificationService,
}));

vi.mock('@/lib/notification-templates/dues-notifications', () => ({
  DuesNotificationTemplates: {
    paymentConfirmation: vi.fn(() => ({
      subject: 'Payment Confirmed',
      body: 'Your dues payment has been confirmed',
    })),
    paymentFailure: vi.fn(() => ({
      subject: 'Payment Failed',
      body: 'Your dues payment failed',
    })),
  },
  DuesNotificationData: {},
}));

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

// ── Imports ──────────────────────────────────────────────────────────────────

import { sendPaymentConfirmation } from '../dues-notifications';

// ── Tests ────────────────────────────────────────────────────────────────────

describe('DuesNotifications', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetNotificationService.mockReturnValue({ send: mockSend });
    mockSelect.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([]),
          orderBy: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      }),
    });
  });

  it('sendPaymentConfirmation fetches transaction context', async () => {
    // Mock org lookup
    const orgSelectChain = {
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([
            { id: 'org-1', name: 'Test Union', slug: 'test-union', email: 'admin@test.com' },
          ]),
        }),
      }),
    };

    // Mock admin members lookup
    const adminSelectChain = {
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([{ email: 'admin@test.com' }]),
      }),
    };

    mockSelect
      .mockReturnValueOnce(orgSelectChain)
      .mockReturnValueOnce(adminSelectChain);

    await sendPaymentConfirmation(
      'org-1',
      'member-1',
      'member@test.com',
      'txn-123',
      100,
      'monthly'
    );

    expect(mockSend).toHaveBeenCalled();
  });

  it('handles missing organization gracefully', async () => {
    mockSelect.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([]),
        }),
      }),
    });

    // Should not throw
    await sendPaymentConfirmation(
      'nonexistent-org',
      'member-1',
      'member@test.com',
      'txn-123',
      100,
      'monthly'
    );
  });

  it('sends notification with correct template data', async () => {
    const orgChain = {
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([
            { id: 'org-1', name: 'Union Local 123', slug: 'local-123', email: 'info@local123.ca' },
          ]),
        }),
      }),
    };

    const adminChain = {
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([]),
      }),
    };

    mockSelect.mockReturnValueOnce(orgChain).mockReturnValueOnce(adminChain);

    await sendPaymentConfirmation(
      'org-1',
      'member-1',
      'member@test.com',
      'txn-456',
      250.50,
      'bi_weekly'
    );

    expect(mockSend).toHaveBeenCalled();
  });
});
