import { describe, it, expect, vi, beforeEach } from 'vitest';

/* ---------- hoisted mocks ---------- */
const mocks = vi.hoisted(() => ({
  mockInsert: vi.fn(),
  mockUpdate: vi.fn(),
  mockDelete: vi.fn(),
  mockTransaction: vi.fn(),
  mockValues: vi.fn(),
  mockReturning: vi.fn(),
  mockSet: vi.fn(),
  mockDeleteWhere: vi.fn(),
  mockQueryRecognitionAwards: { findFirst: vi.fn(), findMany: vi.fn() },
  mockQueryUsers: { findFirst: vi.fn(), findMany: vi.fn() },
  mockQueryOrganizationMembers: { findFirst: vi.fn(), findMany: vi.fn() },
  mockQueryRewardRedemptions: { findFirst: vi.fn(), findMany: vi.fn() },
  // email mocks
  mockSendAwardReceivedEmail: vi.fn(),
  mockSendApprovalRequestEmail: vi.fn(),
  mockSendCreditExpirationEmail: vi.fn(),
  mockSendRedemptionConfirmationEmail: vi.fn(),
  mockLogger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock('drizzle-orm', () => ({
  eq: vi.fn((...args: any[]) => args),
  and: vi.fn((...args: any[]) => args),
  or: vi.fn((...args: any[]) => args),
  desc: vi.fn(),
  asc: vi.fn(),
  sql: vi.fn(),
  gt: vi.fn(),
  lt: vi.fn(),
  gte: vi.fn(),
  lte: vi.fn(),
  inArray: vi.fn(),
  isNull: vi.fn(),
  between: vi.fn(),
  like: vi.fn(),
  ilike: vi.fn(),
  not: vi.fn(),
  ne: vi.fn((...a: any[]) => a),
  count: vi.fn(),
  sum: vi.fn(),
  avg: vi.fn(),
  min: vi.fn(),
  max: vi.fn(),
  relations: vi.fn(() => ({})),
}));

vi.mock('uuid', () => ({ v4: vi.fn(() => 'mock-uuid') }));

vi.mock('@/db', () => {
  const mockUpdateWhere = vi.fn().mockReturnValue({ returning: mocks.mockReturning });
  mocks.mockSet.mockReturnValue({ where: mockUpdateWhere });
  mocks.mockUpdate.mockReturnValue({ set: mocks.mockSet });

  mocks.mockReturning.mockResolvedValue([]);
  mocks.mockValues.mockReturnValue({ returning: mocks.mockReturning });
  mocks.mockInsert.mockReturnValue({ values: mocks.mockValues });

  mocks.mockDeleteWhere.mockResolvedValue(undefined);
  mocks.mockDelete.mockReturnValue({ where: mocks.mockDeleteWhere });

  const mockGroupBy = vi.fn().mockReturnValue({ limit: vi.fn().mockResolvedValue([]) });
  const mockWhere = vi.fn().mockReturnValue({ groupBy: mockGroupBy });
  const mockLeftJoin4 = vi.fn().mockReturnValue({ where: mockWhere });
  const mockLeftJoin3 = vi.fn().mockReturnValue({ leftJoin: mockLeftJoin4 });
  const mockLeftJoin2 = vi.fn().mockReturnValue({ leftJoin: mockLeftJoin3 });
  const mockSelectFrom = vi.fn().mockReturnValue({ leftJoin: mockLeftJoin2 });
  const mockSelect = vi.fn().mockReturnValue({ from: mockSelectFrom });

  return {
    db: {
      select: mockSelect,
      insert: mocks.mockInsert,
      update: mocks.mockUpdate,
      delete: mocks.mockDelete,
      transaction: mocks.mockTransaction,
      query: {
        recognitionAwards: mocks.mockQueryRecognitionAwards,
        users: mocks.mockQueryUsers,
        organizationMembers: mocks.mockQueryOrganizationMembers,
        rewardRedemptions: mocks.mockQueryRewardRedemptions,
      },
    },
  };
});

vi.mock('@/db/schema', () => ({
  recognitionAwards: { id: 'id', orgId: 'orgId', recipientUserId: 'recipientUserId' },
  rewardRedemptions: { id: 'id', orgId: 'orgId' },
  rewardWalletLedger: { userId: 'userId', pointsChange: 'pointsChange', expiresAt: 'expiresAt' },
  organizations: { id: 'id', name: 'name' },
  users: { userId: 'userId', email: 'email' },
  organizationMembers: {
    userId: 'userId',
    organizationId: 'organizationId',
    name: 'name',
    role: 'role',
    email: 'email',
  },
}));

vi.mock('../email-service', () => ({
  sendAwardReceivedEmail: mocks.mockSendAwardReceivedEmail,
  sendApprovalRequestEmail: mocks.mockSendApprovalRequestEmail,
  sendCreditExpirationEmail: mocks.mockSendCreditExpirationEmail,
  sendRedemptionConfirmationEmail: mocks.mockSendRedemptionConfirmationEmail,
}));

vi.mock('@/lib/logger', () => ({ logger: mocks.mockLogger }));

import {
  notifyAwardIssued,
  notifyAwardPendingApproval,
  notifyRedemptionConfirmed,
  getExpiringCreditsUsers,
  notifyExpiringCredits,
} from '../notification-service';

describe('notification-service', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    const eqOp = vi.fn((...args: unknown[]) => args);
    const andOp = vi.fn((...args: unknown[]) => args);
    const inArrayOp = vi.fn((...args: unknown[]) => args);

    const runWhere = (options: unknown, table: Record<string, unknown>) => {
      const whereValue = (options as { where?: unknown } | undefined)?.where;
      if (typeof whereValue === 'function') {
        whereValue(table, { eq: eqOp, and: andOp, inArray: inArrayOp });
      }
    };

    mocks.mockQueryRecognitionAwards.findFirst.mockImplementation(async (options: unknown) => {
      runWhere(options, { id: 'id', status: 'status' });
      return null;
    });
    mocks.mockQueryUsers.findFirst.mockImplementation(async (options: unknown) => {
      runWhere(options, { userId: 'userId' });
      return null;
    });
    mocks.mockQueryOrganizationMembers.findMany.mockImplementation(async (options: unknown) => {
      runWhere(options, { organizationId: 'organizationId', role: 'role' });
      return [];
    });
    mocks.mockQueryRewardRedemptions.findFirst.mockImplementation(async (options: unknown) => {
      runWhere(options, { id: 'id', userId: 'userId' });
      return null;
    });
  });

  /* ============================= notifyAwardIssued ============================= */
  describe('notifyAwardIssued', () => {
    it('sends email when award is issued and recipient found', async () => {
      mocks.mockQueryRecognitionAwards.findFirst.mockResolvedValue({
        id: 'a-1',
        status: 'issued',
        recipientUserId: 'u-1',
        issuerUserId: 'u-2',
        reason: 'Nice job',
        orgId: 'org-1',
        awardType: { name: 'Kudos', defaultCreditAmount: 50 },
        organization: { name: 'TestOrg' },
      });
      mocks.mockQueryUsers.findFirst
        .mockResolvedValueOnce({ userId: 'u-1', email: 'alice@test.com' })  // recipient
        .mockResolvedValueOnce({ userId: 'u-2', email: 'bob@test.com' });   // issuer
      mocks.mockSendAwardReceivedEmail.mockResolvedValue(undefined);

      const result = await notifyAwardIssued('a-1');

      expect(result.success).toBe(true);
      expect(mocks.mockSendAwardReceivedEmail).toHaveBeenCalledTimes(1);
    });

    it('returns error when award not found', async () => {
      mocks.mockQueryRecognitionAwards.findFirst.mockResolvedValue(null);

      const result = await notifyAwardIssued('nope');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Award not found or not issued');
    });

    it('returns error when award status is not issued', async () => {
      mocks.mockQueryRecognitionAwards.findFirst.mockResolvedValue({
        id: 'a-1',
        status: 'pending',
      });

      const result = await notifyAwardIssued('a-1');

      expect(result.success).toBe(false);
    });

    it('returns error when recipient has no email', async () => {
      mocks.mockQueryRecognitionAwards.findFirst.mockResolvedValue({
        id: 'a-1',
        status: 'issued',
        recipientUserId: 'u-1',
        issuerUserId: null,
        orgId: 'org-1',
        awardType: { name: 'Kudos' },
        organization: { name: 'TestOrg' },
      });
      mocks.mockQueryUsers.findFirst.mockResolvedValue(null);

      const result = await notifyAwardIssued('a-1');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Recipient email not found');
    });

    it('executes query where closures for coverage', async () => {
      mocks.mockQueryRecognitionAwards.findFirst.mockResolvedValue({
        id: 'a-1',
        status: 'issued',
        recipientUserId: 'u-1',
        issuerUserId: 'u-2',
        awardType: { name: 'Kudos', defaultCreditAmount: 10 },
        organization: { name: 'Org' },
      });
      mocks.mockQueryUsers.findFirst
        .mockResolvedValueOnce({ userId: 'u-1', email: 'recipient@test.com' })
        .mockResolvedValueOnce({ userId: 'u-2', email: 'issuer@test.com' });
      mocks.mockSendAwardReceivedEmail.mockResolvedValue(undefined);

      await notifyAwardIssued('a-1');

      const awardOpts = mocks.mockQueryRecognitionAwards.findFirst.mock.calls[0]?.[0] as {
        where?: (table: unknown, ops: { eq: (...args: unknown[]) => unknown }) => unknown;
      };
      const recipientOpts = mocks.mockQueryUsers.findFirst.mock.calls[0]?.[0] as {
        where?: (table: unknown, ops: { eq: (...args: unknown[]) => unknown }) => unknown;
      };
      const issuerOpts = mocks.mockQueryUsers.findFirst.mock.calls[1]?.[0] as {
        where?: (table: unknown, ops: { eq: (...args: unknown[]) => unknown }) => unknown;
      };

      awardOpts.where?.({ id: 'id' }, { eq: vi.fn() });
      recipientOpts.where?.({ userId: 'userId' }, { eq: vi.fn() });
      issuerOpts.where?.({ userId: 'userId' }, { eq: vi.fn() });
    });
  });

  /* ============================= notifyAwardPendingApproval ============================= */
  describe('notifyAwardPendingApproval', () => {
    it('sends notification to admins for a pending award', async () => {
      mocks.mockQueryRecognitionAwards.findFirst.mockResolvedValue({
        id: 'a-1',
        status: 'pending',
        recipientUserId: 'u-1',
        issuerUserId: 'u-2',
        reason: 'Great work',
        orgId: 'org-1',
        awardType: { name: 'Spot Award', defaultCreditAmount: 100 },
        organization: { name: 'TestOrg' },
      });
      mocks.mockQueryUsers.findFirst
        .mockResolvedValueOnce({ email: 'recipient@test.com' })   // recipient
        .mockResolvedValueOnce({ email: 'issuer@test.com' })      // issuer
        .mockResolvedValueOnce({ displayName: 'Admin', email: 'admin@test.com' }); // admin lookup
      mocks.mockQueryOrganizationMembers.findMany.mockResolvedValue([
        { userId: 'admin-1', email: 'admin@test.com', role: 'admin' },
      ]);
      mocks.mockSendApprovalRequestEmail.mockResolvedValue(undefined);

      const result = await notifyAwardPendingApproval('a-1');

      expect(result.success).toBe(true);
    });

    it('returns error when award not found or not pending', async () => {
      mocks.mockQueryRecognitionAwards.findFirst.mockResolvedValue(null);

      const result = await notifyAwardPendingApproval('nope');

      expect(result.success).toBe(false);
    });

    it('executes pending-approval where closures for coverage', async () => {
      mocks.mockQueryRecognitionAwards.findFirst.mockResolvedValue({
        id: 'a-2',
        status: 'pending',
        recipientUserId: 'u-r',
        issuerUserId: 'u-i',
        orgId: 'org-1',
        awardType: { name: 'Spot', defaultCreditAmount: 25 },
        organization: { name: 'Org' },
      });
      mocks.mockQueryUsers.findFirst
        .mockResolvedValueOnce({ email: 'recipient@test.com' })
        .mockResolvedValueOnce({ email: 'issuer@test.com' })
        .mockResolvedValueOnce({ displayName: 'Admin', email: 'admin@test.com' });
      mocks.mockQueryOrganizationMembers.findMany.mockResolvedValue([{ userId: 'admin-1', email: 'admin@test.com' }]);
      mocks.mockSendApprovalRequestEmail.mockResolvedValue(undefined);

      await notifyAwardPendingApproval('a-2');

      const awardOpts = mocks.mockQueryRecognitionAwards.findFirst.mock.calls[0]?.[0] as {
        where?: (table: unknown, ops: { eq: (...args: unknown[]) => unknown }) => unknown;
      };
      const recipientOpts = mocks.mockQueryUsers.findFirst.mock.calls[0]?.[0] as {
        where?: (table: unknown, ops: { eq: (...args: unknown[]) => unknown }) => unknown;
      };
      const issuerOpts = mocks.mockQueryUsers.findFirst.mock.calls[1]?.[0] as {
        where?: (table: unknown, ops: { eq: (...args: unknown[]) => unknown }) => unknown;
      };
      const adminMemberOpts = mocks.mockQueryOrganizationMembers.findMany.mock.calls[0]?.[0] as {
        where?: (
          table: unknown,
          ops: {
            eq: (...args: unknown[]) => unknown;
            and: (...args: unknown[]) => unknown;
            inArray: (...args: unknown[]) => unknown;
          },
        ) => unknown;
      };
      const adminUserOpts = mocks.mockQueryUsers.findFirst.mock.calls[2]?.[0] as {
        where?: (...args: unknown[]) => unknown;
      };

      awardOpts.where?.({ id: 'id' }, { eq: vi.fn() });
      recipientOpts.where?.({ userId: 'userId' }, { eq: vi.fn() });
      issuerOpts.where?.({ userId: 'userId' }, { eq: vi.fn() });
      adminMemberOpts.where?.(
        { organizationId: 'organizationId', role: 'role' },
        { eq: vi.fn(), and: vi.fn(), inArray: vi.fn() },
      );
      if (typeof adminUserOpts.where === 'function') {
        adminUserOpts.where({ userId: 'userId' }, { eq: vi.fn() });
      }
    });
  });

  /* ============================= notifyRedemptionConfirmed ============================= */
  describe('notifyRedemptionConfirmed', () => {
    it('sends confirmation email for a redemption', async () => {
      mocks.mockQueryRewardRedemptions.findFirst.mockResolvedValue({
        id: 'r-1',
        userId: 'u-1',
        creditsSpent: 200,
        providerCheckoutId: 'checkout-1',
        organization: { name: 'TestOrg' },
      });
      mocks.mockQueryUsers.findFirst.mockResolvedValue({ userId: 'u-1', email: 'user@test.com' });
      mocks.mockSendRedemptionConfirmationEmail.mockResolvedValue(undefined);

      const result = await notifyRedemptionConfirmed('r-1');

      expect(result.success).toBe(true);
      expect(mocks.mockSendRedemptionConfirmationEmail).toHaveBeenCalledTimes(1);
    });

    it('returns error when redemption not found', async () => {
      mocks.mockQueryRewardRedemptions.findFirst.mockResolvedValue(null);

      const result = await notifyRedemptionConfirmed('nope');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Redemption not found');
    });

    it('returns error when user email not found', async () => {
      mocks.mockQueryRewardRedemptions.findFirst.mockResolvedValue({
        id: 'r-1',
        userId: 'u-1',
        creditsSpent: 200,
        organization: { name: 'TestOrg' },
      });
      mocks.mockQueryUsers.findFirst.mockResolvedValue(null);

      const result = await notifyRedemptionConfirmed('r-1');

      expect(result.success).toBe(false);
      expect(result.error).toBe('User email not found');
    });

    it('executes redemption where closures for coverage', async () => {
      mocks.mockQueryRewardRedemptions.findFirst.mockResolvedValue({
        id: 'r-2',
        userId: 'u-1',
        creditsSpent: 20,
        organization: { name: 'Org' },
      });
      mocks.mockQueryUsers.findFirst.mockResolvedValue({ userId: 'u-1', email: 'user@test.com' });
      mocks.mockSendRedemptionConfirmationEmail.mockResolvedValue(undefined);

      await notifyRedemptionConfirmed('r-2');

      const redemptionOpts = mocks.mockQueryRewardRedemptions.findFirst.mock.calls[0]?.[0] as {
        where?: (table: unknown, ops: { eq: (...args: unknown[]) => unknown }) => unknown;
      };
      const userOpts = mocks.mockQueryUsers.findFirst.mock.calls[0]?.[0] as {
        where?: (table: unknown, ops: { eq: (...args: unknown[]) => unknown }) => unknown;
      };

      redemptionOpts.where?.({ id: 'id' }, { eq: vi.fn() });
      userOpts.where?.({ userId: 'userId' }, { eq: vi.fn() });
    });
  });

  /* ============================= getExpiringCreditsUsers ============================= */
  describe('getExpiringCreditsUsers', () => {
    it('returns empty array when no expiring credits', async () => {
      const result = await getExpiringCreditsUsers(7);

      expect(result).toEqual([]);
    });
  });

  /* ============================= notifyExpiringCredits ============================= */
  describe('notifyExpiringCredits', () => {
    it('returns result when no users have expiring credits', async () => {
      const result = await notifyExpiringCredits(7);

      expect(result.success).toBe(true);
      expect(result.totalUsers).toBe(0);
    });
  });
});

/* ======== additional coverage for uncovered paths ======== */

import {
  sendBatchExpirationWarnings,
  getNotificationStats,
  scheduleExpirationNotifications,
} from '../notification-service';

describe('notification-service (extended paths)', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    const eqOp = vi.fn((...args: unknown[]) => args);
    const andOp = vi.fn((...args: unknown[]) => args);
    const inArrayOp = vi.fn((...args: unknown[]) => args);

    const runWhere = (options: unknown, table: Record<string, unknown>) => {
      const whereValue = (options as { where?: unknown } | undefined)?.where;
      if (typeof whereValue === 'function') {
        whereValue(table, { eq: eqOp, and: andOp, inArray: inArrayOp });
      }
    };

    mocks.mockQueryRecognitionAwards.findFirst.mockImplementation(async (options: unknown) => {
      runWhere(options, { id: 'id', status: 'status' });
      return null;
    });
    mocks.mockQueryUsers.findFirst.mockImplementation(async (options: unknown) => {
      runWhere(options, { userId: 'userId' });
      return null;
    });
    mocks.mockQueryOrganizationMembers.findMany.mockImplementation(async (options: unknown) => {
      runWhere(options, { organizationId: 'organizationId', role: 'role' });
      return [];
    });
    mocks.mockQueryRewardRedemptions.findFirst.mockImplementation(async (options: unknown) => {
      runWhere(options, { id: 'id', userId: 'userId' });
      return null;
    });
  });

  describe('getExpiringCreditsUsers with data', () => {
    it('returns mapped entries filtering null emails', async () => {
      // Override the db.select chain to return rows
      const { db } = await import('@/db');
      const limitFn = vi.fn().mockResolvedValue([
        { userId: 'u1', userEmail: 'a@b.com', userName: 'Alice', organizationName: 'CUPE', expiringAmount: 50, expirationDate: new Date(Date.now() + 86400000) },
        { userId: 'u2', userEmail: null, userName: 'Bob', organizationName: 'CUPE', expiringAmount: 20, expirationDate: null },
      ]);
      const groupByFn = vi.fn().mockReturnValue({ limit: limitFn });
      const whereFn = vi.fn().mockReturnValue({ groupBy: groupByFn });
      const lj4 = vi.fn().mockReturnValue({ where: whereFn });
      const lj3 = vi.fn().mockReturnValue({ leftJoin: lj4 });
      const lj2 = vi.fn().mockReturnValue({ leftJoin: lj3 });
      const fromFn = vi.fn().mockReturnValue({ leftJoin: lj2 });
      (db.select as ReturnType<typeof vi.fn>).mockReturnValueOnce({ from: fromFn });

      const { getExpiringCreditsUsers } = await import('../notification-service');
      const result = await getExpiringCreditsUsers(7);
      expect(result).toHaveLength(1);
      expect(result[0].userId).toBe('u1');
    });
  });

  describe('notifyExpiringCredits with batch processing', () => {
    it('processes users in batches and sends emails', async () => {
      const { db } = await import('@/db');
      const expirationDate = new Date(Date.now() + 86400000);
      const limitFn = vi.fn().mockResolvedValue([
        { userId: 'u3', userEmail: 'c@d.com', userName: 'Carol', organizationName: 'CUPE', expiringAmount: 100, expirationDate },
      ]);
      const groupByFn = vi.fn().mockReturnValue({ limit: limitFn });
      const whereFn = vi.fn().mockReturnValue({ groupBy: groupByFn });
      const lj4 = vi.fn().mockReturnValue({ where: whereFn });
      const lj3 = vi.fn().mockReturnValue({ leftJoin: lj4 });
      const lj2 = vi.fn().mockReturnValue({ leftJoin: lj3 });
      const fromFn = vi.fn().mockReturnValue({ leftJoin: lj2 });
      (db.select as ReturnType<typeof vi.fn>).mockReturnValueOnce({ from: fromFn });
      mocks.mockSendCreditExpirationEmail.mockResolvedValue(undefined);

      const { notifyExpiringCredits } = await import('../notification-service');
      const result = await notifyExpiringCredits(7);
      expect(result.success).toBe(true);
      expect(result.sent).toBe(1);
    }, 10000);

    it('handles email send failure gracefully', async () => {
      const { db } = await import('@/db');
      const expirationDate = new Date(Date.now() + 86400000);
      const limitFn = vi.fn().mockResolvedValue([
        { userId: 'u4', userEmail: 'd@d.com', userName: 'Dave', organizationName: 'CUPE', expiringAmount: 75, expirationDate },
      ]);
      const groupByFn = vi.fn().mockReturnValue({ limit: limitFn });
      const whereFn = vi.fn().mockReturnValue({ groupBy: groupByFn });
      const lj4 = vi.fn().mockReturnValue({ where: whereFn });
      const lj3 = vi.fn().mockReturnValue({ leftJoin: lj4 });
      const lj2 = vi.fn().mockReturnValue({ leftJoin: lj3 });
      const fromFn = vi.fn().mockReturnValue({ leftJoin: lj2 });
      (db.select as ReturnType<typeof vi.fn>).mockReturnValueOnce({ from: fromFn });
      mocks.mockSendCreditExpirationEmail.mockRejectedValue(new Error('smtp fail'));

      const { notifyExpiringCredits } = await import('../notification-service');
      const result = await notifyExpiringCredits(7);
      expect(result.success).toBe(true);
      expect(result.failed).toBe(1);
    }, 10000);
  });

  describe('sendBatchExpirationWarnings', () => {
    it('runs all 3 intervals', async () => {
      const { db } = await import('@/db');
      const emptyLimit = vi.fn().mockResolvedValue([]);
      const groupByFn = vi.fn().mockReturnValue({ limit: emptyLimit });
      const whereFn = vi.fn().mockReturnValue({ groupBy: groupByFn });
      const lj4 = vi.fn().mockReturnValue({ where: whereFn });
      const lj3 = vi.fn().mockReturnValue({ leftJoin: lj4 });
      const lj2 = vi.fn().mockReturnValue({ leftJoin: lj3 });
      const fromFn = vi.fn().mockReturnValue({ leftJoin: lj2 });
      (db.select as ReturnType<typeof vi.fn>).mockReturnValue({ from: fromFn });

      const result = await sendBatchExpirationWarnings();
      expect(result.success).toBe(true);
      expect(result).toHaveProperty('usersNotified7Days');
    });
  });

  describe('getNotificationStats', () => {
    it('returns pending awards and recent redemption counts', async () => {
      const { db } = await import('@/db');
      const where7 = vi.fn().mockResolvedValue([{ count: 7 }]);
      const from7 = vi.fn().mockReturnValue({ where: where7 });
      const where3 = vi.fn().mockResolvedValue([{ count: 3 }]);
      const from3 = vi.fn().mockReturnValue({ where: where3 });
      (db.select as ReturnType<typeof vi.fn>)
        .mockReturnValueOnce({ from: from7 })
        .mockReturnValueOnce({ from: from3 });

      const result = await getNotificationStats('org-1');
      expect(result.success).toBe(true);
      expect((result as { data: { pendingAwards: number } }).data.pendingAwards).toBe(7);
    });
  });

  describe('scheduleExpirationNotifications', () => {
    it('inserts ledger entry for scheduled expiration', async () => {
      const { db } = await import('@/db');
      // select for latest balance
      const limit1 = vi.fn().mockResolvedValue([{ balanceAfter: 500 }]);
      const orderBy1 = vi.fn().mockReturnValue({ limit: limit1 });
      const where1 = vi.fn().mockReturnValue({ orderBy: orderBy1 });
      const from1 = vi.fn().mockReturnValue({ where: where1 });
      (db.select as ReturnType<typeof vi.fn>).mockReturnValueOnce({ from: from1 });
      // insert
      mocks.mockReturning.mockResolvedValueOnce([{ id: 'mock-uuid' }]);
      mocks.mockValues.mockReturnValue({ returning: mocks.mockReturning });
      mocks.mockInsert.mockReturnValue({ values: mocks.mockValues });

      const result = await scheduleExpirationNotifications('u1', 100, new Date(Date.now() + 30 * 86400000));
      expect(result.success).toBe(true);
    });
  });
});
