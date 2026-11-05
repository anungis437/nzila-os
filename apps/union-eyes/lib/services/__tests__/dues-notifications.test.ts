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

// The notices are sent by a webhook or a job with no tenant session: the reads run in one short system transaction.
vi.mock('@/lib/db/with-rls-context', () => ({
  withSystemContext: vi.fn(async (operation: (tx: unknown) => Promise<unknown>) => operation({ select: mocks.mockSelect })),
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
  and: vi.fn((...args: any[]) => args),
  inArray: vi.fn((a, b) => ({ field: a, values: b })),
  or: vi.fn((...args: any[]) => args),
  sql: vi.fn((strings: TemplateStringsArray, ...values: unknown[]) => ({ text: strings.join('?'), values })),
}));

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import {
  sendPaymentConfirmation,
  sendPaymentFailure,
  sendAdminIntervention,
  calculateRetryDate,
  duesNotificationKey,
} from '../dues-notifications';

// ── Helpers ──────────────────────────────────────────────────────────────────

function chain(resolvedValue: any) {
  const result = {
    from: vi.fn().mockReturnThis(),
    innerJoin: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue(resolvedValue),
    then: (resolve: (v: any) => void) => Promise.resolve(resolvedValue).then(resolve),
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

function setupTransactionQuery(rows: any[]) {
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
    mocks.mockSend.mockResolvedValue({ id: 'n-1', status: 'sent' });
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
      { systemSteps: true },
    );
  });

  it('reads the transaction in one system transaction that is over before any notice is sent, and sends with system steps', async () => {
    const { withSystemContext } = await import('@/lib/db/with-rls-context');
    let open = 0;
    const openAtSend: number[] = [];
    vi.mocked(withSystemContext).mockImplementationOnce(async (operation: never) => {
      open += 1;
      try {
        return await (operation as (tx: unknown) => Promise<unknown>)({ select: mocks.mockSelect });
      } finally {
        open -= 1;
      }
    });
    mocks.mockSend.mockImplementation(async () => { openAtSend.push(open); });
    setupOrgContextQueries();

    await sendPaymentConfirmation('tx-1');

    expect(withSystemContext).toHaveBeenCalledTimes(1);
    expect(openAtSend).toEqual([0]);
    expect(mocks.mockSend.mock.calls[0][1]).toEqual({ systemSteps: true });
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
      { systemSteps: true },
    );
  });

  it('does nothing when transaction not found', async () => {
    setupTransactionQuery([]);
    await sendPaymentConfirmation('tx-missing');
    expect(mocks.mockSend).not.toHaveBeenCalled();
  });

  it('swallows errors without throwing, and reports the notice as not delivered', async () => {
    mocks.mockSelect.mockImplementation(() => { throw new Error('DB down'); });
    await expect(sendPaymentConfirmation('tx-1')).resolves.toEqual({ delivered: false, failures: ['DB down'] });
  });
});

describe('sendPaymentFailure', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.mockSend.mockResolvedValue({ id: 'n-1', status: 'sent' });
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
      { systemSteps: true },
    );
  });

  it('uses retry template when retryScheduled', async () => {
    setupOrgContextQueries();
    await sendPaymentFailure('tx-1', 'Card declined', true, '2025-07-01');
    expect(mocks.mockSend).toHaveBeenCalledWith(
      expect.objectContaining({
        subject: 'Retry Scheduled',
      }),
      { systemSteps: true },
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
      { systemSteps: true },
    );
  });

  it('does nothing when transaction not found', async () => {
    setupTransactionQuery([]);
    await sendPaymentFailure('tx-missing', 'err');
    expect(mocks.mockSend).not.toHaveBeenCalled();
  });

  it('swallows errors, and reports the notice as not delivered', async () => {
    mocks.mockSelect.mockImplementation(() => { throw new Error('fail'); });
    await expect(sendPaymentFailure('tx-1', 'err')).resolves.toEqual({ delivered: false, failures: ['fail'] });
  });
});

describe('sendAdminIntervention', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.mockSend.mockResolvedValue({ id: 'n-1', status: 'sent' });
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
      { systemSteps: true },
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
      expect.objectContaining({ recipientEmail: 'admin@unioneyes.app' }),
      { systemSteps: true },
    );
  });

  it('does nothing when transaction not found', async () => {
    setupTransactionQuery([]);
    await sendAdminIntervention('tx-missing');
    expect(mocks.mockSend).not.toHaveBeenCalled();
  });

  it('swallows errors, and reports the notice as not delivered', async () => {
    mocks.mockSelect.mockImplementation(() => { throw new Error('fail'); });
    await expect(sendAdminIntervention('tx-1')).resolves.toEqual({ delivered: false, failures: ['fail'] });
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
    mocks.mockSend.mockResolvedValue({ id: 'n-1', status: 'sent' });
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
      { systemSteps: true },
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
      (c: any[]) => (c[0] as Record<string, unknown>).type === 'push',
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
      (c: any[]) => (c[0] as Record<string, unknown>).type === 'push',
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

// The member id of a dues transaction is text and the organization member id is a uuid: the join must compare them as text, which Postgres
// otherwise refuses ("operator does not exist: text = uuid"), and the member must belong to the organization of the transaction.
describe('member join and organization lookup', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.mockSend.mockResolvedValue({ id: 'n-1', status: 'sent' });
    mocks.mockGetNotificationService.mockReturnValue({ send: mocks.mockSend });
  });

  async function joinConditionOf(run: () => Promise<void>) {
    const joins: any[] = [];
    let callCount = 0;
    mocks.mockSelect.mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        const first = chain([{ transaction: baseTx, memberName: 'Alice', memberEmail: 'a@e.com', memberMetadata: null }]);
        first.innerJoin = vi.fn((_table: unknown, condition: unknown) => {
          joins.push(condition);
          return first;
        }) as never;
        return first;
      }
      if (callCount === 2) return chain([{ name: 'CUPE', email: null }]);
      return chain([{ email: 'treasurer@cupe.ca' }]);
    });
    await run();
    return joins[0] as Array<{ field?: unknown; value?: { text?: string } }>;
  }

  it.each([
    ['sendPaymentConfirmation', () => sendPaymentConfirmation('tx-1')],
    ['sendPaymentFailure', () => sendPaymentFailure('tx-1', 'declined', false)],
    ['sendAdminIntervention', () => sendAdminIntervention('tx-1')],
  ])('%s joins the member as text and inside the organization of the transaction', async (_name, run) => {
    const [memberMatch, sameOrganization] = await joinConditionOf(run);
    expect(memberMatch.value?.text).toContain('::text');
    expect(sameOrganization).toEqual({ field: 'organization_id', value: 'organization_id' });
  });

  it('looks the administrators up by the organization uuid, never by a slug the members table does not hold', async () => {
    let callCount = 0;
    mocks.mockSelect.mockImplementation(() => {
      callCount++;
      if (callCount === 1) return chain([{ transaction: baseTx, memberName: 'Alice', memberEmail: 'a@e.com' }]);
      if (callCount === 2) return chain([{ name: 'CUPE Local 123', email: 'org@cupe.ca' }]);
      return chain([{ email: 'treasurer@cupe.ca' }]);
    });

    await sendAdminIntervention('tx-1');

    const { eq, inArray } = await import('drizzle-orm');
    expect(eq).toHaveBeenCalledWith('organization_id', 'org-1');
    expect(eq).toHaveBeenCalledWith('id', 'org-1');
    expect(vi.mocked(inArray).mock.calls.map((call) => call[1])).toEqual([
      ['admin', 'super_admin', 'billing_manager', 'billing_specialist'],
    ]);
    expect(mocks.mockSend).toHaveBeenCalledTimes(2);
  });
});

// A notice the provider did not accept is not a notice sent: the helpers answer what became of it, and never say "sent" for a refusal.
describe('the delivery status of the notices', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.mockSend.mockResolvedValue({ id: 'n-1', status: 'sent' });
    mocks.mockGetNotificationService.mockReturnValue({ send: mocks.mockSend });
  });

  const withPush = () => {
    let callCount = 0;
    mocks.mockSelect.mockImplementation(() => {
      callCount++;
      if (callCount === 1) return chain([{ ...memberRow, memberMetadata: { firebaseToken: 'fcm-1' } }]);
      if (callCount === 2) return chain([{ id: 'org-1', name: 'CUPE', slug: 'c', email: null }]);
      return chain([]);
    });
  };

  it('answers delivered when the provider accepted the email', async () => {
    setupOrgContextQueries();
    await expect(sendPaymentConfirmation('tx-1')).resolves.toEqual({ delivered: true, failures: [] });
  });

  it('counts a delivered status as delivered too', async () => {
    mocks.mockSend.mockResolvedValue({ id: 'n-1', status: 'delivered' });
    setupOrgContextQueries();
    await expect(sendPaymentFailure('tx-1', 'declined', true, '2025-07-01')).resolves.toMatchObject({ delivered: true });
  });

  it.each([
    ['failed', 'Recipient is not active in organization', 'failed: Recipient is not active in organization'],
    ['bounced', undefined, 'bounced'],
    ['uncertain', 'provider accepted the message but the acceptance was not recorded', 'uncertain: provider accepted the message but the acceptance was not recorded'],
    ['pending', undefined, 'pending'],
  ])('answers not delivered, with the reason, when the status is %s', async (status, failureReason, expected) => {
    mocks.mockSend.mockResolvedValue({ id: 'n-1', status, failureReason });
    setupOrgContextQueries();
    const outcome = await sendPaymentConfirmation('tx-1');
    expect(outcome.delivered).toBe(false);
    expect(outcome.failures).toEqual([`email: ${expected}`]);
  });

  it('answers not delivered when the send throws, and when it answers nothing', async () => {
    setupOrgContextQueries();
    mocks.mockSend.mockRejectedValueOnce(new Error('No provider configured for notification type: email'));
    await expect(sendPaymentConfirmation('tx-1')).resolves.toEqual({ delivered: false, failures: ['email: No provider configured for notification type: email'] });

    setupOrgContextQueries();
    mocks.mockSend.mockResolvedValueOnce(undefined);
    await expect(sendPaymentConfirmation('tx-1')).resolves.toEqual({ delivered: false, failures: ['email: no delivery status'] });
  });

  it('answers a transaction that is not found as not delivered', async () => {
    setupTransactionQuery([]);
    await expect(sendAdminIntervention('tx-missing')).resolves.toEqual({ delivered: false, failures: ['transaction not found'] });
  });

  it('keeps the email as the notice that matters: a refused push is listed as a failure of a delivered notice, and a refused email is not saved by an accepted push', async () => {
    withPush();
    mocks.mockSend.mockResolvedValueOnce({ id: 'n-1', status: 'sent' }).mockResolvedValueOnce({ id: 'n-2', status: 'failed', failureReason: 'token expired' });
    await expect(sendPaymentFailure('tx-1', 'declined', false)).resolves.toEqual({ delivered: true, failures: ['push: failed: token expired'] });

    withPush();
    mocks.mockSend.mockResolvedValueOnce({ id: 'n-3', status: 'bounced' }).mockResolvedValueOnce({ id: 'n-4', status: 'sent' });
    const refused = await sendPaymentFailure('tx-1', 'declined', false);
    expect(refused.delivered).toBe(false);
    expect(refused.failures).toEqual(['email: bounced']);
  });

  it('answers an administrator notice delivered when any administrator was reached, and lists those who were not', async () => {
    setupAdminInterventionQueries();
    mocks.mockSend.mockImplementation(async (payload: { recipientEmail: string }) =>
      payload.recipientEmail === 'treasurer@cupe.ca' ? { id: 'n-1', status: 'failed', failureReason: 'mailbox full' } : { id: 'n-2', status: 'sent' });

    const outcome = await sendAdminIntervention('tx-1');

    expect(outcome.delivered).toBe(true);
    expect(outcome.failures).toEqual(['email: failed: mailbox full']);
  });

  it('logs a notice that was not delivered as such, never as sent', async () => {
    const { logger } = await import('@/lib/logger');
    mocks.mockSend.mockResolvedValue({ id: 'n-1', status: 'failed', failureReason: 'suppressed: email disabled by user preference' });
    setupOrgContextQueries();

    await sendPaymentFailure('tx-1', 'declined', true, '2025-07-01');

    expect(logger.warn).toHaveBeenCalledWith('Payment failure notification was not delivered', expect.objectContaining({ transactionId: 'tx-1' }));
    expect(vi.mocked(logger.info).mock.calls.map((call) => call[0])).not.toContain('Payment failure notification sent');
  });

  describe('idempotency keys', () => {
    it('sends without a key unless the caller names the notice', async () => {
      setupOrgContextQueries();
      await sendPaymentFailure('tx-1', 'declined', true, '2025-07-01');
      expect(mocks.mockSend.mock.calls[0][0]).not.toHaveProperty('idempotencyKey');
    });

    it('gives every notice of a named dedupeKey a stable uuid key of its own, per channel and per administrator', async () => {
      withPush();
      await sendPaymentFailure('tx-1', 'declined', true, '2025-07-01', { dedupeKey: 'dues-retry:tx-1:2' });
      const keys = mocks.mockSend.mock.calls.map((call) => (call[0] as { idempotencyKey?: string }).idempotencyKey);
      const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
      expect(keys).toHaveLength(2);
      expect(keys.every((key) => UUID.test(key ?? ''))).toBe(true);
      expect(new Set(keys).size).toBe(2);
      expect(keys[0]).toBe(duesNotificationKey('dues-retry:tx-1:2', 'email'));
      expect(keys[1]).toBe(duesNotificationKey('dues-retry:tx-1:2', 'push'));

      mocks.mockSend.mockClear();
      setupAdminInterventionQueries();
      await sendAdminIntervention('tx-1', { dedupeKey: 'dues-admin:tx-1' });
      const adminKeys = mocks.mockSend.mock.calls.map((call) => (call[0] as { idempotencyKey?: string }).idempotencyKey);
      expect(adminKeys).toEqual([
        duesNotificationKey('dues-admin:tx-1', 'admin', 'treasurer@cupe.ca'),
        duesNotificationKey('dues-admin:tx-1', 'admin', 'admin@cupe.ca'),
      ]);
    });

    it('derives the same key from the same parts and different keys from different parts', () => {
      expect(duesNotificationKey('a', 'b')).toBe(duesNotificationKey('a', 'b'));
      expect(duesNotificationKey('a', 'b')).not.toBe(duesNotificationKey('a', 'c'));
      expect(duesNotificationKey('a', 'b')).not.toBe(duesNotificationKey('ab'));
    });
  });
});
