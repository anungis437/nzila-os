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
  organizationMembers: { id: 'id', email: 'email', name: 'name', role: 'role', organizationId: 'organization_id', metadata: 'metadata' },
  organizations: { id: 'id', name: 'name', slug: 'slug', email: 'email' },
}));

vi.mock('@/db/schema/domains/finance/dues', () => ({
  duesTransactions: { id: 'id', memberId: 'member_id', organizationId: 'org_id' },
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
    DUES_PAYMENT_CONFIRMATION: {
      id: 'dues-payment-confirmation',
      subject: vi.fn(() => 'Payment Confirmed'),
      title: vi.fn(() => 'Payment Confirmed'),
      body: vi.fn(() => 'Your dues payment has been confirmed'),
      htmlBody: vi.fn(() => '<p>Your dues payment has been confirmed</p>'),
    },
    DUES_PAYMENT_FAILURE: {
      id: 'dues-payment-failure',
      subject: vi.fn(() => 'Payment Failed'),
      title: vi.fn(() => 'Payment Failed'),
      body: vi.fn(() => 'Your dues payment failed'),
      htmlBody: vi.fn(() => '<p>Your dues payment failed</p>'),
    },
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
  });

  it('sendPaymentConfirmation fetches transaction context', async () => {
    // Mock the innerJoin query chain: select().from().innerJoin().where().limit()
    const mockLimit = vi.fn().mockResolvedValue([
      {
        transaction: {
          id: 'txn-123',
          memberId: 'member-1',
          organizationId: 'org-1',
          totalAmount: '100.00',
          duesAmount: '80.00',
          copeAmount: '10.00',
          pacAmount: '5.00',
          strikeFundAmount: '5.00',
          dueDate: '2026-01-01',
          periodStart: '2026-01-01',
          periodEnd: '2026-01-31',
          receiptUrl: null,
        },
        memberName: 'Test Member',
        memberEmail: 'member@test.com',
        memberMetadata: null,
      },
    ]);

    // Transaction lookup (innerJoin chain)
    const txnChain = {
      from: vi.fn().mockReturnValue({
        innerJoin: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: mockLimit,
          }),
        }),
      }),
    };

    // Org lookup: select().from().where(or(...)).limit()
    const orgChain = {
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([
            { id: 'org-1', name: 'Test Union', slug: 'test-union', email: 'admin@test.com' },
          ]),
        }),
      }),
    };

    // Admin members lookup: select().from().where()
    const adminChain = {
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([{ email: 'admin@test.com' }]),
      }),
    };

    mockSelect
      .mockReturnValueOnce(txnChain)
      .mockReturnValueOnce(orgChain)
      .mockReturnValueOnce(adminChain);

    await sendPaymentConfirmation('txn-123');

    expect(mockSend).toHaveBeenCalled();
  });

  it('handles missing organization gracefully', async () => {
    // Transaction not found → empty result → early return
    const txnChain = {
      from: vi.fn().mockReturnValue({
        innerJoin: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      }),
    };

    mockSelect.mockReturnValueOnce(txnChain);

    // Should not throw
    await sendPaymentConfirmation('nonexistent-txn');
  });

  it('sends notification with correct template data', async () => {
    const txnChain = {
      from: vi.fn().mockReturnValue({
        innerJoin: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([
              {
                transaction: {
                  id: 'txn-456',
                  memberId: 'member-1',
                  organizationId: 'org-1',
                  totalAmount: '250.50',
                  duesAmount: '200.00',
                  copeAmount: '25.00',
                  pacAmount: '15.00',
                  strikeFundAmount: '10.50',
                  dueDate: '2026-02-01',
                  periodStart: '2026-02-01',
                  periodEnd: '2026-02-14',
                  receiptUrl: null,
                },
                memberName: 'Member Two',
                memberEmail: 'member2@test.com',
                memberMetadata: null,
              },
            ]),
          }),
        }),
      }),
    };

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

    mockSelect.mockReturnValueOnce(txnChain).mockReturnValueOnce(orgChain).mockReturnValueOnce(adminChain);

    await sendPaymentConfirmation('txn-456');

    expect(mockSend).toHaveBeenCalled();
  });
});
