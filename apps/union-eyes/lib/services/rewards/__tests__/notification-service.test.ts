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
