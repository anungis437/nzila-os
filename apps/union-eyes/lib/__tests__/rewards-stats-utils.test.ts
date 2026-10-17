/**
 * Rewards Stats Utilities — Unit Tests
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Hoisted mocks ────────────────────────────────────────────────────────────

const mocks = vi.hoisted(() => ({
  mockSelect: vi.fn(),
  mockFrom: vi.fn(),
  mockWhere: vi.fn(),
  mockGroupBy: vi.fn(),
}));

vi.mock('@/db/db', () => ({
  db: {
    select: mocks.mockSelect,
  },
}));

vi.mock('@/db/schema/domains/infrastructure/rewards', () => ({
  rewardWalletLedger: {
    eventType: 'event_type',
    amountCredits: 'amount_credits',
    userId: 'user_id',
    orgId: 'org_id',
  },
}));

vi.mock('drizzle-orm', async (importOriginal) => {
  const actual = await importOriginal<typeof import('drizzle-orm')>();
  return { ...actual };
});

// ── Imports ──────────────────────────────────────────────────────────────────

import {
  calculateRewardTotals,
  getTotalEarned,
  getTotalRedeemed,
} from '../utils/rewards-stats-utils';

// ── Helpers ──────────────────────────────────────────────────────────────────

function setupSelectGroupByChain(rows: any[]) {
  mocks.mockGroupBy.mockResolvedValue(rows);
  mocks.mockWhere.mockReturnValue({ groupBy: mocks.mockGroupBy });
  mocks.mockFrom.mockReturnValue({ where: mocks.mockWhere });
  mocks.mockSelect.mockReturnValue({ from: mocks.mockFrom });
}

function setupSelectChain(rows: any[]) {
  mocks.mockWhere.mockResolvedValue(rows);
  mocks.mockFrom.mockReturnValue({ where: mocks.mockWhere });
  mocks.mockSelect.mockReturnValue({ from: mocks.mockFrom });
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('rewards-stats-utils', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── calculateRewardTotals ────────────────────────────────────────────────

  describe('calculateRewardTotals', () => {
    it('calculates totals for earn events', async () => {
      setupSelectGroupByChain([
        { eventType: 'earn', total: 500 },
      ]);
      const result = await calculateRewardTotals('user-1', 'org-1');
      expect(result).toEqual({
        totalEarned: 500,
        totalRedeemed: 0,
        totalExpired: 0,
        currentBalance: 500,
      });
    });

    it('handles spend events', async () => {
      setupSelectGroupByChain([
        { eventType: 'earn', total: 1000 },
        { eventType: 'spend', total: -300 },
      ]);
      const result = await calculateRewardTotals('user-1', 'org-1');
      expect(result).toEqual({
        totalEarned: 1000,
        totalRedeemed: 300,
        totalExpired: 0,
        currentBalance: 700,
      });
    });

    it('handles expire and revoke events', async () => {
      setupSelectGroupByChain([
        { eventType: 'earn', total: 1000 },
        { eventType: 'expire', total: -100 },
        { eventType: 'revoke', total: -50 },
      ]);
      const result = await calculateRewardTotals('user-1', 'org-1');
      expect(result).toEqual({
        totalEarned: 1000,
        totalRedeemed: 0,
        totalExpired: 150,
        currentBalance: 850,
      });
    });

    it('handles adjust and refund as earned', async () => {
      setupSelectGroupByChain([
        { eventType: 'adjust', total: 200 },
        { eventType: 'refund', total: 100 },
      ]);
      const result = await calculateRewardTotals('user-1', 'org-1');
      expect(result).toEqual({
        totalEarned: 300,
        totalRedeemed: 0,
        totalExpired: 0,
        currentBalance: 300,
      });
    });

    it('returns zeros when no ledger entries', async () => {
      setupSelectGroupByChain([]);
      const result = await calculateRewardTotals('user-1', 'org-1');
      expect(result).toEqual({
        totalEarned: 0,
        totalRedeemed: 0,
        totalExpired: 0,
        currentBalance: 0,
      });
    });

    it('propagates DB errors instead of fabricating an empty wallet', async () => {
      mocks.mockSelect.mockImplementation(() => {
        throw new Error('DB down');
      });
      await expect(calculateRewardTotals('user-1', 'org-1')).rejects.toThrow('DB down');
    });

    it('preserves signed debit adjustments and string aggregate values', async () => {
      setupSelectGroupByChain([
        { eventType: 'earn', total: '100' },
        { eventType: 'adjust', total: '-25' },
        { eventType: 'refund', total: '10' },
      ]);
      expect(await calculateRewardTotals('user-1', 'org-1')).toEqual({
        totalEarned: 85, totalRedeemed: 0, totalExpired: 0, currentBalance: 85,
      });
    });

    it('treats null totals as zero', async () => {
      setupSelectGroupByChain([
        { eventType: 'earn', total: null },
      ]);
      const result = await calculateRewardTotals('user-1', 'org-1');
      expect(result).toEqual({
        totalEarned: 0,
        totalRedeemed: 0,
        totalExpired: 0,
        currentBalance: 0,
      });
    });
  });

  // ── getTotalEarned ───────────────────────────────────────────────────────

  describe('getTotalEarned', () => {
    it('returns earned total', async () => {
      setupSelectChain([{ total: 750 }]);
      const result = await getTotalEarned('user-1', 'org-1');
      expect(result).toBe(750);
    });

    it('returns 0 when no result', async () => {
      setupSelectChain([{ total: null }]);
      const result = await getTotalEarned('user-1', 'org-1');
      expect(result).toBe(0);
    });

    it('propagates errors', async () => {
      mocks.mockSelect.mockImplementation(() => {
        throw new Error('DB error');
      });
      await expect(getTotalEarned('user-1', 'org-1')).rejects.toThrow('DB error');
    });
  });

  // ── getTotalRedeemed ─────────────────────────────────────────────────────

  describe('getTotalRedeemed', () => {
    it('returns absolute value of redeemed total', async () => {
      setupSelectChain([{ total: -500 }]);
      const result = await getTotalRedeemed('user-1', 'org-1');
      expect(result).toBe(500);
    });

    it('returns 0 when no result', async () => {
      setupSelectChain([{ total: null }]);
      const result = await getTotalRedeemed('user-1', 'org-1');
      expect(result).toBe(0);
    });

    it('propagates errors', async () => {
      mocks.mockSelect.mockImplementation(() => {
        throw new Error('DB error');
      });
      await expect(getTotalRedeemed('user-1', 'org-1')).rejects.toThrow('DB error');
    });
  });
});
