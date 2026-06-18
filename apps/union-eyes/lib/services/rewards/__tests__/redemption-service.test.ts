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
  mockQueryRewardRedemptions: { findFirst: vi.fn(), findMany: vi.fn() },
  // sibling service mocks
  mockApplyLedgerEntry: vi.fn(),
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

vi.mock('@/db', () => {
  const mockUpdateWhere = vi.fn().mockReturnValue({ returning: mocks.mockReturning });
  mocks.mockSet.mockReturnValue({ where: mockUpdateWhere });
  mocks.mockUpdate.mockReturnValue({ set: mocks.mockSet });

  mocks.mockReturning.mockResolvedValue([]);
  mocks.mockValues.mockReturnValue({ returning: mocks.mockReturning });
  mocks.mockInsert.mockReturnValue({ values: mocks.mockValues });

  mocks.mockDeleteWhere.mockResolvedValue(undefined);
  mocks.mockDelete.mockReturnValue({ where: mocks.mockDeleteWhere });

  const mockSelectWhere = vi.fn().mockReturnValue({
    orderBy: vi.fn().mockReturnValue({ limit: vi.fn().mockReturnValue({ offset: vi.fn().mockResolvedValue([]) }) }),
    limit: vi.fn().mockResolvedValue([]),
  });
  const mockSelectFrom = vi.fn().mockReturnValue({ where: mockSelectWhere });
  const mockSelect = vi.fn().mockReturnValue({ from: mockSelectFrom });

  return {
    db: {
      select: mockSelect,
      insert: mocks.mockInsert,
      update: mocks.mockUpdate,
      delete: mocks.mockDelete,
      transaction: mocks.mockTransaction,
      query: {
        rewardRedemptions: mocks.mockQueryRewardRedemptions,
      },
    },
  };
});

vi.mock('@/db/schema', () => ({
  rewardRedemptions: {
    id: 'id',
    orgId: 'orgId',
    userId: 'userId',
    providerOrderId: 'providerOrderId',
    createdAt: 'createdAt',
  },
}));

vi.mock('../wallet-service', () => ({
  applyLedgerEntry: mocks.mockApplyLedgerEntry,
}));

import {
  initiateRedemption,
  updateRedemptionCheckout,
  markRedemptionOrdered,
  markRedemptionFulfilled,
  cancelRedemption,
  processRedemptionRefund,
  getRedemptionById,
  getRedemptionByIdInternal,
  getRedemptionByOrderId,
  listUserRedemptions,
  listOrgRedemptions,
} from '../redemption-service';

describe('redemption-service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  /* ============================= initiateRedemption ============================= */
  describe('initiateRedemption', () => {
    it('creates a redemption within a transaction', async () => {
      const redemption = { id: 'r-1', status: 'initiated', creditsSpent: 100 };

      mocks.mockTransaction.mockImplementation(async (cb: (tx: any) => unknown) => {
        const tx = {
          insert: vi.fn().mockReturnValue({
            values: vi.fn().mockReturnValue({
              returning: vi.fn().mockResolvedValue([redemption]),
            }),
          }),
        };
        return cb(tx);
      });
      mocks.mockApplyLedgerEntry.mockResolvedValue({ balanceAfter: 400 });

      const result = await initiateRedemption({
        orgId: 'org-1',
        userId: 'u-1',
        programId: 'p-1',
        creditsToSpend: 100,
        provider: 'shopify',
      });

      expect(result).toEqual(redemption);
      expect(mocks.mockApplyLedgerEntry).toHaveBeenCalled();
    });
  });

  /* ============================= updateRedemptionCheckout ============================= */
  describe('updateRedemptionCheckout', () => {
    it('updates redemption with checkout details', async () => {
      const updated = { id: 'r-1', status: 'pending_payment', providerCheckoutId: 'ck-1' };
      mocks.mockReturning.mockResolvedValueOnce([updated]);

      const result = await updateRedemptionCheckout('r-1', 'org-1', 'ck-1', 'https://shop.com/checkout');

      expect(result.status).toBe('pending_payment');
      expect(mocks.mockUpdate).toHaveBeenCalled();
    });
  });

  /* ============================= markRedemptionOrdered ============================= */
  describe('markRedemptionOrdered', () => {
    it('marks redemption as ordered', async () => {
      const updated = { id: 'r-1', status: 'ordered', providerOrderId: 'order-1' };
      mocks.mockReturning.mockResolvedValueOnce([updated]);

      const result = await markRedemptionOrdered('r-1', 'org-1', 'order-1', { orderId: 'order-1' });

      expect(result.status).toBe('ordered');
    });
  });

  /* ============================= markRedemptionFulfilled ============================= */
  describe('markRedemptionFulfilled', () => {
    it('marks redemption as fulfilled', async () => {
      const updated = { id: 'r-1', status: 'fulfilled' };
      mocks.mockReturning.mockResolvedValueOnce([updated]);

      const result = await markRedemptionFulfilled('r-1', 'org-1', { tracking: '123' });

      expect(result.status).toBe('fulfilled');
    });
  });

  /* ============================= cancelRedemption ============================= */
  describe('cancelRedemption', () => {
    it('cancels redemption and refunds credits', async () => {
      const redemption = {
        id: 'r-1',
        orgId: 'org-1',
        userId: 'u-1',
        creditsSpent: 100,
        status: 'initiated',
        providerPayloadJson: {},
      };

      mocks.mockTransaction.mockImplementation(async (cb: (tx: any) => unknown) => {
        const tx = {
          query: {
            rewardRedemptions: {
              findFirst: vi.fn().mockResolvedValue(redemption),
            },
          },
          update: vi.fn().mockReturnValue({
            set: vi.fn().mockReturnValue({
              where: vi.fn().mockReturnValue({
                returning: vi.fn().mockResolvedValue([{ ...redemption, status: 'cancelled' }]),
              }),
            }),
          }),
        };
        return cb(tx);
      });
      mocks.mockApplyLedgerEntry.mockResolvedValue({ balanceAfter: 500 });

      const result = await cancelRedemption('r-1', 'org-1', 'Changed my mind');

      expect(result.redemption.status).toBe('cancelled');
      expect(result.newBalance).toBe(500);
    });

    it('throws when redemption not found', async () => {
      mocks.mockTransaction.mockImplementation(async (cb: (tx: any) => unknown) => {
        const tx = {
          query: { rewardRedemptions: { findFirst: vi.fn().mockResolvedValue(null) } },
        };
        return cb(tx);
      });

      await expect(cancelRedemption('nope', 'org-1', 'test')).rejects.toThrow('Redemption not found');
    });

    it('throws when trying to cancel ordered redemption', async () => {
      mocks.mockTransaction.mockImplementation(async (cb: (tx: any) => unknown) => {
        const tx = {
          query: {
            rewardRedemptions: {
              findFirst: vi.fn().mockResolvedValue({ id: 'r-1', status: 'ordered' }),
            },
          },
        };
        return cb(tx);
      });

      await expect(cancelRedemption('r-1', 'org-1', 'test')).rejects.toThrow(
        'Cannot cancel redemption with status: ordered'
      );
    });
  });

  /* ============================= processRedemptionRefund ============================= */
  describe('processRedemptionRefund', () => {
    it('refunds credits and marks as refunded', async () => {
      const redemption = {
        id: 'r-1',
        orgId: 'org-1',
        userId: 'u-1',
        creditsSpent: 200,
        status: 'ordered',
        providerPayloadJson: {},
      };

      mocks.mockTransaction.mockImplementation(async (cb: (tx: any) => unknown) => {
        const tx = {
          query: {
            rewardRedemptions: { findFirst: vi.fn().mockResolvedValue(redemption) },
          },
          update: vi.fn().mockReturnValue({
            set: vi.fn().mockReturnValue({
              where: vi.fn().mockReturnValue({
                returning: vi.fn().mockResolvedValue([{ ...redemption, status: 'refunded' }]),
              }),
            }),
          }),
        };
        return cb(tx);
      });
      mocks.mockApplyLedgerEntry.mockResolvedValue({ balanceAfter: 700 });

      const result = await processRedemptionRefund('r-1', 'org-1', { reason: 'defective' });

      expect(result.redemption.status).toBe('refunded');
      expect(result.newBalance).toBe(700);
    });

    it('returns existing if already refunded (idempotent)', async () => {
      const redemption = { id: 'r-1', status: 'refunded', orgId: 'org-1', userId: 'u-1', creditsSpent: 100, providerPayloadJson: {} };

      mocks.mockTransaction.mockImplementation(async (cb: (tx: any) => unknown) => {
        const tx = {
          query: { rewardRedemptions: { findFirst: vi.fn().mockResolvedValue(redemption) } },
        };
        return cb(tx);
      });

      const result = await processRedemptionRefund('r-1', 'org-1', {});

      expect(result.redemption.status).toBe('refunded');
      expect(mocks.mockApplyLedgerEntry).not.toHaveBeenCalled();
    });
  });

  /* ============================= getRedemptionById ============================= */
  describe('getRedemptionById', () => {
    it('returns redemption when found', async () => {
      const redemption = { id: 'r-1', orgId: 'org-1' };
      mocks.mockQueryRewardRedemptions.findFirst.mockResolvedValue(redemption);

      const result = await getRedemptionById('r-1', 'org-1');

      expect(result).toEqual(redemption);
    });

    it('returns null when not found', async () => {
      mocks.mockQueryRewardRedemptions.findFirst.mockResolvedValue(null);

      const result = await getRedemptionById('nope', 'org-1');

      expect(result).toBeNull();
    });
  });

  /* ============================= getRedemptionByIdInternal ============================= */
  describe('getRedemptionByIdInternal', () => {
    it('returns redemption without org scope', async () => {
      mocks.mockQueryRewardRedemptions.findFirst.mockResolvedValue({ id: 'r-1' });

      const result = await getRedemptionByIdInternal('r-1');

      expect(result).toEqual({ id: 'r-1' });
    });

    it('returns null when not found', async () => {
      mocks.mockQueryRewardRedemptions.findFirst.mockResolvedValue(null);

      const result = await getRedemptionByIdInternal('missing');

      expect(result).toBeNull();
    });
  });

  /* ============================= getRedemptionByOrderId ============================= */
  describe('getRedemptionByOrderId', () => {
    it('finds by provider order id', async () => {
      mocks.mockQueryRewardRedemptions.findFirst.mockResolvedValue({ id: 'r-1', providerOrderId: 'order-1' });

      const result = await getRedemptionByOrderId('order-1');

      expect(result?.id).toBe('r-1');
    });

    it('finds by provider order id with org scope', async () => {
      mocks.mockQueryRewardRedemptions.findFirst.mockResolvedValue({ id: 'r-1' });

      const result = await getRedemptionByOrderId('order-1', 'org-1');

      expect(result).toBeDefined();
    });
  });

  /* ============================= listUserRedemptions ============================= */
  describe('listUserRedemptions', () => {
    it('returns paginated user redemptions', async () => {
      mocks.mockQueryRewardRedemptions.findMany.mockResolvedValue([{ id: 'r-1' }]);
      const { db } = await import('@/db');
      const mockSelectWhere = vi.fn().mockResolvedValue([{ total: 5 }]);
      const mockSelectFrom = vi.fn().mockReturnValue({ where: mockSelectWhere });
      vi.mocked(db.select).mockReturnValue({ from: mockSelectFrom });

      const result = await listUserRedemptions('org-1', 'u-1');

      expect(result.redemptions).toHaveLength(1);
      expect(result.total).toBe(5);
    });
  });

  /* ============================= cancelRedemption — gap coverage ============================= */
  describe('cancelRedemption — gap coverage', () => {
    it('handles null providerPayloadJson in cancel', async () => {
      const redemption = {
        id: 'r-pj', orgId: 'org-1', userId: 'u-1', creditsSpent: 50,
        status: 'initiated', providerPayloadJson: null,
      };

      mocks.mockTransaction.mockImplementation(async (cb: (tx: any) => unknown) => {
        const tx = {
          query: { rewardRedemptions: { findFirst: vi.fn().mockResolvedValue(redemption) } },
          update: vi.fn().mockReturnValue({
            set: vi.fn().mockReturnValue({
              where: vi.fn().mockReturnValue({
                returning: vi.fn().mockResolvedValue([{ ...redemption, status: 'cancelled' }]),
              }),
            }),
          }),
        };
        return cb(tx);
      });
      mocks.mockApplyLedgerEntry.mockResolvedValue({ balanceAfter: 100 });

      const result = await cancelRedemption('r-pj', 'org-1', 'test');
      expect(result.redemption.status).toBe('cancelled');
    });

    it('throws when status is cancelled (not an allowed status)', async () => {
      const redemption = {
        id: 'r-can', orgId: 'org-1', userId: 'u-1', creditsSpent: 50,
        status: 'cancelled', providerPayloadJson: {},
      };

      mocks.mockTransaction.mockImplementation(async (cb: (tx: any) => unknown) => {
        const tx = {
          query: { rewardRedemptions: { findFirst: vi.fn().mockResolvedValue(redemption) } },
        };
        return cb(tx);
      });

      await expect(cancelRedemption('r-can', 'org-1', 'dup')).rejects.toThrow('Cannot cancel redemption with status: cancelled');
    });
  });

  /* ============================= processRedemptionRefund — gap coverage ============================= */
  describe('processRedemptionRefund — gap coverage', () => {
    it('handles null providerPayloadJson in refund', async () => {
      const redemption = {
        id: 'r-rpj', orgId: 'org-1', userId: 'u-1', creditsSpent: 100,
        status: 'ordered', providerPayloadJson: null,
      };

      mocks.mockTransaction.mockImplementation(async (cb: (tx: any) => unknown) => {
        const tx = {
          query: { rewardRedemptions: { findFirst: vi.fn().mockResolvedValue(redemption) } },
          update: vi.fn().mockReturnValue({
            set: vi.fn().mockReturnValue({
              where: vi.fn().mockReturnValue({
                returning: vi.fn().mockResolvedValue([{ ...redemption, status: 'refunded' }]),
              }),
            }),
          }),
        };
        return cb(tx);
      });
      mocks.mockApplyLedgerEntry.mockResolvedValue({ balanceAfter: 300 });

      const result = await processRedemptionRefund('r-rpj', 'org-1', { reason: 'test' });
      expect(result.redemption.status).toBe('refunded');
    });

    it('throws when redemption not found', async () => {
      mocks.mockTransaction.mockImplementation(async (cb: (tx: any) => unknown) => {
        const tx = {
          query: { rewardRedemptions: { findFirst: vi.fn().mockResolvedValue(null) } },
        };
        return cb(tx);
      });

      await expect(processRedemptionRefund('nope', 'org-1', {})).rejects.toThrow('Redemption not found');
    });
  });

  /* ============================= getRedemptionByOrderId — gap coverage ============================= */
  describe('getRedemptionByOrderId — gap coverage', () => {
    it('queries WITHOUT orgId (else branch)', async () => {
      mocks.mockQueryRewardRedemptions.findFirst.mockResolvedValue({ id: 'r-no-org', providerOrderId: 'ord-7' });

      const result = await getRedemptionByOrderId('ord-7');
      expect(result?.id).toBe('r-no-org');
    });

    it('queries WITH orgId', async () => {
      mocks.mockQueryRewardRedemptions.findFirst.mockResolvedValue({ id: 'r-org', providerOrderId: 'ord-8' });

      const result = await getRedemptionByOrderId('ord-8', 'org-1');
      expect(result?.id).toBe('r-org');
    });

    it('returns null when order not found', async () => {
      mocks.mockQueryRewardRedemptions.findFirst.mockResolvedValue(null);

      const result = await getRedemptionByOrderId('missing-order');
      expect(result).toBeNull();
    });

    it('returns null when order not found with orgId', async () => {
      mocks.mockQueryRewardRedemptions.findFirst.mockResolvedValue(undefined);

      const result = await getRedemptionByOrderId('missing-order', 'org-1');
      expect(result).toBeNull();
    });
  });

  /* ============================= listOrgRedemptions ============================= */
  describe('listOrgRedemptions', () => {
    it('returns paginated org redemptions', async () => {
      mocks.mockQueryRewardRedemptions.findMany.mockResolvedValue([{ id: 'r-1' }, { id: 'r-2' }]);
      const { db } = await import('@/db');
      const mockSelectWhere = vi.fn().mockResolvedValue([{ total: 10 }]);
      const mockSelectFrom = vi.fn().mockReturnValue({ where: mockSelectWhere });
      vi.mocked(db.select).mockReturnValue({ from: mockSelectFrom });

      const result = await listOrgRedemptions('org-1');

      expect(result.redemptions).toHaveLength(2);
      expect(result.total).toBe(10);
    });
  });
});
