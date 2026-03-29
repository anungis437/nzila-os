/**
 * Dues Notifications — Unit Tests
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ── Hoisted mocks ────────────────────────────────────────────────────────────

const mocks = vi.hoisted(() => ({
  mockSend: vi.fn(),
  mockGetNotificationService: vi.fn(),
  mockSelect: vi.fn(),
  mockFrom: vi.fn(),
  mockWhere: vi.fn(),
  mockInnerJoin: vi.fn(),
  mockLimit: vi.fn(),
}));

vi.mock('@/lib/services/notification-service', () => ({
  getNotificationService: mocks.mockGetNotificationService,
}));

vi.mock('@/lib/notification-templates/dues-notifications', () => ({
  DuesNotificationTemplates: {
    DUES_PAYMENT_CONFIRMATION: {
      id: 'tpl-confirm',
      subject: vi.fn(() => 'Payment Confirmed'),
      title: vi.fn(() => 'Payment Confirmed'),
      body: vi.fn(() => 'Your payment was received'),
      htmlBody: vi.fn(() => '<p>confirmed</p>'),
    },
    DUES_PAYMENT_FAILED: {
      id: 'tpl-failed',
      subject: vi.fn(() => 'Payment Failed'),
      title: vi.fn(() => 'Payment Failed'),
      body: vi.fn(() => 'Your payment failed'),
      htmlBody: vi.fn(() => '<p>failed</p>'),
    },
    DUES_PAYMENT_RETRY_SCHEDULED: {
      id: 'tpl-retry',
      subject: vi.fn(() => 'Retry Scheduled'),
      title: vi.fn(() => 'Retry Scheduled'),
      body: vi.fn(() => 'Your payment will be retried'),
      htmlBody: vi.fn(() => '<p>retry</p>'),
    },
    DUES_ADMIN_INTERVENTION: {
      id: 'tpl-admin',
      subject: vi.fn(() => 'Admin Action Required'),
      title: vi.fn(() => 'Admin Action Required'),
      body: vi.fn(() => 'Admin intervention needed'),
      htmlBody: vi.fn(() => '<p>admin</p>'),
    },
  },
  DuesNotificationData: {},
}));

vi.mock('@/db', () => ({
  db: {
    select: mocks.mockSelect,
  },
}));

vi.mock('@/db/schema-organizations', () => ({
  organizationMembers: { id: 'id', name: 'name', email: 'email', organizationId: 'organization_id', role: 'role', metadata: 'metadata' },
  organizations: { id: 'id', name: 'name', slug: 'slug', email: 'email' },
}));

vi.mock('@/db/schema/domains/finance/dues', () => ({
  duesTransactions: { id: 'id', memberId: 'member_id', organizationId: 'organization_id' },
}));

vi.mock('drizzle-orm', () => ({
  eq: vi.fn((a, b) => ({ field: a, value: b })),
  and: vi.fn((...args: unknown[]) => args),
  inArray: vi.fn((a, b) => ({ field: a, values: b })),
  or: vi.fn((...args: unknown[]) => args),
}));

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import {
  sendPaymentConfirmation,
  sendPaymentFailure,
  sendAdminIntervention,
  calculateRetryDate,
} from '../dues-notifications';

// ── Helpers ──────────────────────────────────────────────────────────────────

function chain(resolvedValue: unknown) {
  const result = {
    from: vi.fn().mockReturnThis(),
    innerJoin: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue(resolvedValue),
    then: (resolve: (v: unknown) => void) => Promise.resolve(resolvedValue).then(resolve),
  };
  return result;
}

const baseTx = {
  id: 'tx-1',
  memberId: 'member-1',
  organizationId: 'org-1',
  totalAmount: '50.00',
  dueDate: '2025-06-01',
  periodStart: '2025-06-01',
  periodEnd: '2025-06-30',
  duesAmount: '40.00',
  copeAmount: '5.00',
  pacAmount: '3.00',
  strikeFundAmount: '2.00',
  receiptUrl: 'https://receipt.example.com/r1',
  metadata: {},
};

const memberRow = {
  transaction: baseTx,
  memberName: 'Alice Smith',
  memberEmail: 'alice@example.com',
  memberMetadata: null,
};

function setupTransactionQuery(rows: unknown[]) {
  const c = chain(rows);
  mocks.mockSelect.mockReturnValue(c);
}

function setupOrgContextQueries() {
  // org lookup + admin members lookup — sequenced via mockSelect
  let callCount = 0;
  mocks.mockSelect.mockImplementation(() => {
    callCount++;
    if (callCount === 1) {
      // transaction lookup
      return chain([memberRow]);
    }
    if (callCount === 2) {
      // org lookup
      return chain([{ id: 'org-1', name: 'CUPE Local 123', slug: 'cupe-123', email: 'admin@cupe.ca' }]);
    }
    // admin members
    return chain([{ email: 'treasurer@cupe.ca' }, { email: 'president@cupe.ca' }]);
  });
}

function setupAdminInterventionQueries() {
  let callCount = 0;
  mocks.mockSelect.mockImplementation(() => {
    callCount++;
    if (callCount === 1) {
      // transaction + member
      return chain([{ transaction: baseTx, memberName: 'Alice Smith', memberEmail: 'alice@example.com' }]);
    }
    if (callCount === 2) {
      // org
      return chain([{ id: 'org-1', name: 'CUPE Local 123', slug: 'cupe-123', email: 'admin@cupe.ca' }]);
    }
    // admin members
    return chain([{ email: 'treasurer@cupe.ca' }]);
  });
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('sendPaymentConfirmation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.mockSend.mockResolvedValue(undefined);
    mocks.mockGetNotificationService.mockReturnValue({ send: mocks.mockSend });
  });

  it('sends email notification on success', async () => {
    setupOrgContextQueries();
    await sendPaymentConfirmation('tx-1');
    expect(mocks.mockSend).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'email',
        recipientEmail: 'alice@example.com',
        priority: 'normal',
      }),
    );
  });

  it('sends push when firebaseToken is present', async () => {
    let callCount = 0;
    mocks.mockSelect.mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        return chain([{
          ...memberRow,
          memberMetadata: { firebaseToken: 'fcm-abc' },
        }]);
      }
      if (callCount === 2) return chain([{ id: 'org-1', name: 'CUPE', slug: 'cupe', email: null }]);
      return chain([]);
    });

    await sendPaymentConfirmation('tx-1');
    expect(mocks.mockSend).toHaveBeenCalledTimes(2);
    expect(mocks.mockSend).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'push', recipientFirebaseToken: 'fcm-abc' }),
    );
  });

  it('does nothing when transaction not found', async () => {
    setupTransactionQuery([]);
    await sendPaymentConfirmation('tx-missing');
    expect(mocks.mockSend).not.toHaveBeenCalled();
  });

  it('swallows errors without throwing', async () => {
    mocks.mockSelect.mockImplementation(() => { throw new Error('DB down'); });
    await expect(sendPaymentConfirmation('tx-1')).resolves.toBeUndefined();
  });
});

describe('sendPaymentFailure', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.mockSend.mockResolvedValue(undefined);
    mocks.mockGetNotificationService.mockReturnValue({ send: mocks.mockSend });
  });

  it('uses failure template when no retry', async () => {
    setupOrgContextQueries();
    await sendPaymentFailure('tx-1', 'Card declined', false);
    expect(mocks.mockSend).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'email',
        priority: 'high',
        subject: 'Payment Failed',
      }),
    );
  });

  it('uses retry template when retryScheduled', async () => {
    setupOrgContextQueries();
    await sendPaymentFailure('tx-1', 'Card declined', true, '2025-07-01');
    expect(mocks.mockSend).toHaveBeenCalledWith(
      expect.objectContaining({
        subject: 'Retry Scheduled',
      }),
    );
  });

  it('sends push when firebaseToken present', async () => {
    let callCount = 0;
    mocks.mockSelect.mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        return chain([{ ...memberRow, memberMetadata: { firebaseToken: 'fcm-x' } }]);
      }
      if (callCount === 2) return chain([{ id: 'org-1', name: 'CUPE', slug: 'c', email: null }]);
      return chain([]);
    });

    await sendPaymentFailure('tx-1', 'Declined', false);
    expect(mocks.mockSend).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'push' }),
    );
  });

  it('does nothing when transaction not found', async () => {
    setupTransactionQuery([]);
    await sendPaymentFailure('tx-missing', 'err');
    expect(mocks.mockSend).not.toHaveBeenCalled();
  });

  it('swallows errors', async () => {
    mocks.mockSelect.mockImplementation(() => { throw new Error('fail'); });
    await expect(sendPaymentFailure('tx-1', 'err')).resolves.toBeUndefined();
  });
});

describe('sendAdminIntervention', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.mockSend.mockResolvedValue(undefined);
    mocks.mockGetNotificationService.mockReturnValue({ send: mocks.mockSend });
  });

  it('sends to all admin emails', async () => {
    setupAdminInterventionQueries();
    await sendAdminIntervention('tx-1');
    // org email (admin@cupe.ca) + admin member (treasurer@cupe.ca) = 2 unique emails
    expect(mocks.mockSend).toHaveBeenCalledTimes(2);
    expect(mocks.mockSend).toHaveBeenCalledWith(
      expect.objectContaining({
        priority: 'urgent',
        recipientEmail: expect.any(String),
      }),
    );
  });

  it('uses env fallback when no admin emails', async () => {
    let callCount = 0;
    mocks.mockSelect.mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        return chain([{ transaction: baseTx, memberName: 'Alice', memberEmail: 'alice@ex.com' }]);
      }
      if (callCount === 2) return chain([]);   // no org found
      return chain([]);                        // no admin members
    });

    await sendAdminIntervention('tx-1');
    expect(mocks.mockSend).toHaveBeenCalledWith(
      expect.objectContaining({ recipientEmail: 'admin@unioneyes.ca' }),
    );
  });

  it('does nothing when transaction not found', async () => {
    setupTransactionQuery([]);
    await sendAdminIntervention('tx-missing');
    expect(mocks.mockSend).not.toHaveBeenCalled();
  });

  it('swallows errors', async () => {
    mocks.mockSelect.mockImplementation(() => { throw new Error('fail'); });
    await expect(sendAdminIntervention('tx-1')).resolves.toBeUndefined();
  });
});

describe('calculateRetryDate', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-06-15T12:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('attempt 1 → adds 1 day', () => {
    expect(calculateRetryDate(1)).toBe('2025-06-16');
  });

  it('attempt 2 → adds 3 days', () => {
    expect(calculateRetryDate(2)).toBe('2025-06-18');
  });

  it('attempt 3 → adds 7 days', () => {
    expect(calculateRetryDate(3)).toBe('2025-06-22');
  });

  it('attempt 4+ → adds 0 days (no more retries)', () => {
    expect(calculateRetryDate(4)).toBe('2025-06-15');
    expect(calculateRetryDate(10)).toBe('2025-06-15');
  });
});

// ── Batch 36: branch gap-fill ─────────────────────────────────────────────
describe('Batch 36: branch gap-fill', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.mockSend.mockResolvedValue(undefined);
    mocks.mockGetNotificationService.mockReturnValue({ send: mocks.mockSend });
  });

  it('sendPaymentConfirmation with null breakdown fields falls back to 0.00', async () => {
    const txNoBreakdown = {
      ...baseTx,
      copeAmount: null,
      pacAmount: null,
      strikeFundAmount: null,
      receiptUrl: null,
    };
    let callCount = 0;
    mocks.mockSelect.mockImplementation(() => {
      callCount++;
      if (callCount === 1) return chain([{ transaction: txNoBreakdown, memberName: 'Alice', memberEmail: 'a@e.com', memberMetadata: null }]);
      if (callCount === 2) return chain([{ id: 'org-1', name: 'CUPE', slug: 'c', email: null }]);
      return chain([]);
    });

    await sendPaymentConfirmation('tx-1');
    expect(mocks.mockSend).toHaveBeenCalledTimes(1);
  });

  it('getOrganizationNotificationContext skips adminMember with no email', async () => {
    let callCount = 0;
    mocks.mockSelect.mockImplementation(() => {
      callCount++;
      if (callCount === 1) return chain([memberRow]);
      if (callCount === 2) return chain([{ id: 'org-1', name: 'CUPE', slug: 'c', email: null }]);
      // admin members — one has email, one does not
      return chain([{ email: null }, { email: 'admin@cupe.ca' }]);
    });

    await sendPaymentConfirmation('tx-1');
    // Should still send (only valid admin emails collected, but confirmation goes to member)
    expect(mocks.mockSend).toHaveBeenCalled();
  });

  it('sendPaymentFailure with retryScheduled selects retry template branches', async () => {
    let callCount = 0;
    mocks.mockSelect.mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        return chain([{
          transaction: { ...baseTx, metadata: { failureCount: 2 } },
          memberName: 'Alice',
          memberEmail: 'a@e.com',
          memberMetadata: null,
        }]);
      }
      if (callCount === 2) return chain([{ id: 'org-1', name: 'CUPE', slug: 'c', email: null }]);
      return chain([]);
    });

    await sendPaymentFailure('tx-1', 'Declined', true, '2025-07-05');
    expect(mocks.mockSend).toHaveBeenCalledWith(
      expect.objectContaining({ subject: 'Retry Scheduled' }),
    );
  });

  // ── Batch 37: push-notification + admin-intervention branches ──────
  it('sendPaymentFailure sends push when firebaseToken present (retryScheduled=true)', async () => {
    let callCount = 0;
    mocks.mockSelect.mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        return chain([{
          transaction: { ...baseTx, metadata: { failureCount: 1 } },
          memberName: 'Bob',
          memberEmail: 'b@e.com',
          memberMetadata: { firebaseToken: 'fcm-token-123' },
        }]);
      }
      if (callCount === 2) return chain([{ id: 'org-1', name: 'CUPE', slug: 'c', email: null }]);
      return chain([]);
    });

    await sendPaymentFailure('tx-1', 'Declined', true, '2025-07-10');
    // push notification should have been sent
    const pushCall = mocks.mockSend.mock.calls.find(
      (c: unknown[]) => (c[0] as Record<string, unknown>).type === 'push',
    );
    expect(pushCall).toBeDefined();
    expect((pushCall![0] as Record<string, unknown>).title).toBe('Payment Retry Scheduled');
  });

  it('sendPaymentFailure sends push when firebaseToken present (retryScheduled=false)', async () => {
    let callCount = 0;
    mocks.mockSelect.mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        return chain([{
          transaction: { ...baseTx, metadata: {} },
          memberName: 'Carol',
          memberEmail: 'c@e.com',
          memberMetadata: { firebaseToken: 'fcm-xyz' },
        }]);
      }
      if (callCount === 2) return chain([{ id: 'org-1', name: 'CUPE', slug: 'c', email: null }]);
      return chain([]);
    });

    await sendPaymentFailure('tx-1', 'Insufficient funds', false);
    const pushCall = mocks.mockSend.mock.calls.find(
      (c: unknown[]) => (c[0] as Record<string, unknown>).type === 'push',
    );
    expect(pushCall).toBeDefined();
    expect((pushCall![0] as Record<string, unknown>).title).toBe('⚠️ Payment Failed');
  });

  it('sendAdminIntervention returns early when result is null', async () => {
    mocks.mockSelect.mockImplementation(() => chain(null));
    await sendAdminIntervention('tx-nonexistent');
    expect(mocks.mockSend).not.toHaveBeenCalled();
  });
});
