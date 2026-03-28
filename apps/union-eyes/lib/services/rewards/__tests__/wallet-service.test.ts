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
  mockExecute: vi.fn(),
}));

vi.mock('drizzle-orm', () => ({
  eq: vi.fn((...args: unknown[]) => args),
  and: vi.fn((...args: unknown[]) => args),
  or: vi.fn((...args: unknown[]) => args),
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
  ne: vi.fn((...a: unknown[]) => a),
  count: vi.fn(),
  sum: vi.fn(),
  avg: vi.fn(),
  min: vi.fn(),
  max: vi.fn(),
  relations: vi.fn(() => ({})),
}));

vi.mock('drizzle-orm/pg-core', () => ({}));
vi.mock('drizzle-orm/postgres-js', () => ({}));

vi.mock('@/db', () => {
  const mockUpdateWhere = vi.fn().mockReturnValue({ returning: mocks.mockReturning });
  mocks.mockSet.mockReturnValue({ where: mockUpdateWhere });
  mocks.mockUpdate.mockReturnValue({ set: mocks.mockSet });

  mocks.mockReturning.mockResolvedValue([]);
  mocks.mockValues.mockReturnValue({ returning: mocks.mockReturning });
  mocks.mockInsert.mockReturnValue({ values: mocks.mockValues });

  mocks.mockDeleteWhere.mockResolvedValue(undefined);
  mocks.mockDelete.mockReturnValue({ where: mocks.mockDeleteWhere });

  const mockOffset = vi.fn().mockResolvedValue([]);
  const mockLimit = vi.fn().mockReturnValue({ offset: mockOffset });
  const mockOrderBy = vi.fn().mockReturnValue({ limit: mockLimit });
  const mockSelectWhere = vi.fn().mockReturnValue({
    orderBy: mockOrderBy,
    limit: mockLimit,
  });
  const mockSelectFrom = vi.fn().mockReturnValue({ where: mockSelectWhere });
  const mockSelect = vi.fn().mockReturnValue({ from: mockSelectFrom });

  return {
    db: {
      select: mockSelect,
      insert: mocks.mockInsert,
      update: mocks.mockUpdate,
      delete: mocks.mockDelete,
      execute: mocks.mockExecute,
      transaction: mocks.mockTransaction,
    },
  };
});

vi.mock('@/db/schema/domains/infrastructure/rewards', () => ({
  rewardWalletLedger: {
    id: 'id',
    orgId: 'orgId',
    userId: 'userId',
    eventType: 'eventType',
    amountCredits: 'amountCredits',
    balanceAfter: 'balanceAfter',
    createdAt: 'createdAt',
  },
}));

import {
  getBalance,
  listLedger,
  applyLedgerEntry,
  adminAdjustBalance,
  getLedgerSummary,
  getBulkBalances,
} from '../wallet-service';

describe('wallet-service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  /* ============================= getBalance ============================= */
  describe('getBalance', () => {
    it('returns 0 when no ledger entries exist', async () => {
      const { db } = await import('@/db');
      const mockLimit = vi.fn().mockResolvedValue([]);
      const mockOrderBy = vi.fn().mockReturnValue({ limit: mockLimit });
      const mockWhere = vi.fn().mockReturnValue({ orderBy: mockOrderBy });
      const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
      (db.select as any).mockReturnValue({ from: mockFrom });

      const result = await getBalance('org-1', 'user-1');

      expect(result).toBe(0);
    });

    it('returns latest balance when entry exists', async () => {
      const { db } = await import('@/db');
      const mockLimit = vi.fn().mockResolvedValue([{ balanceAfter: 500 }]);
      const mockOrderBy = vi.fn().mockReturnValue({ limit: mockLimit });
      const mockWhere = vi.fn().mockReturnValue({ orderBy: mockOrderBy });
      const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
      (db.select as any).mockReturnValue({ from: mockFrom });

      const result = await getBalance('org-1', 'user-1');

      expect(result).toBe(500);
    });
  });

  /* ============================= listLedger ============================= */
  describe('listLedger', () => {
    it('returns entries and total count', async () => {
      const entries = [{ id: 'e-1' }, { id: 'e-2' }];
      const { db } = await import('@/db');

      // First call: entries
      const mockOffset = vi.fn().mockResolvedValue(entries);
      const mockLimit = vi.fn().mockReturnValue({ offset: mockOffset });
      const mockOrderBy = vi.fn().mockReturnValue({ limit: mockLimit });
      const mockWhere = vi.fn().mockReturnValue({ orderBy: mockOrderBy });
      const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });

      // Second call: count
      const mockCountWhere = vi.fn().mockResolvedValue([{ count: 42 }]);
      const mockCountFrom = vi.fn().mockReturnValue({ where: mockCountWhere });

      (db.select as any)
        .mockReturnValueOnce({ from: mockFrom })
        .mockReturnValueOnce({ from: mockCountFrom });

      const result = await listLedger('org-1', 'user-1');

      expect(result.entries).toEqual(entries);
      expect(result.total).toBe(42);
    });
  });

  /* ============================= applyLedgerEntry ============================= */
  describe('applyLedgerEntry', () => {
    it('inserts ledger entry with correct balance', async () => {
      const { db } = await import('@/db');

      // Mock select for latest entry
      const mockLimit = vi.fn().mockResolvedValue([{ balanceAfter: 100 }]);
      const mockOrderBy = vi.fn().mockReturnValue({ limit: mockLimit });
      const mockWhere = vi.fn().mockReturnValue({ orderBy: mockOrderBy });
      const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
      (db.select as any).mockReturnValue({ from: mockFrom });

      // Mock insert
      const newEntry = { id: 'le-1', balanceAfter: 150, amountCredits: 50 };
      mocks.mockReturning.mockResolvedValueOnce([newEntry]);

      const result = await applyLedgerEntry(db, {
        orgId: 'org-1',
        userId: 'user-1',
        eventType: 'earn',
        amountCredits: 50,
        sourceType: 'award',
      });

      expect(result).toEqual(newEntry);
      expect(mocks.mockInsert).toHaveBeenCalled();
    });

    it('throws when balance would go negative', async () => {
      const { db } = await import('@/db');

      const mockLimit = vi.fn().mockResolvedValue([{ balanceAfter: 30 }]);
      const mockOrderBy = vi.fn().mockReturnValue({ limit: mockLimit });
      const mockWhere = vi.fn().mockReturnValue({ orderBy: mockOrderBy });
      const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
      (db.select as any).mockReturnValue({ from: mockFrom });

      await expect(
        applyLedgerEntry(db, {
          orgId: 'org-1',
          userId: 'user-1',
          eventType: 'spend',
          amountCredits: -50,
          sourceType: 'redemption',
        })
      ).rejects.toThrow('Insufficient balance');
    });

    it('allows negative balance when override is set', async () => {
      const { db } = await import('@/db');

      const mockLimit = vi.fn().mockResolvedValue([{ balanceAfter: 10 }]);
      const mockOrderBy = vi.fn().mockReturnValue({ limit: mockLimit });
      const mockWhere = vi.fn().mockReturnValue({ orderBy: mockOrderBy });
      const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
      (db.select as any).mockReturnValue({ from: mockFrom });

      const newEntry = { id: 'le-1', balanceAfter: -40 };
      mocks.mockReturning.mockResolvedValueOnce([newEntry]);

      const result = await applyLedgerEntry(
        db,
        {
          orgId: 'org-1',
          userId: 'u-1',
          eventType: 'adjust',
          amountCredits: -50,
          sourceType: 'admin_adjustment',
        },
        true
      );

      expect(result.balanceAfter).toBe(-40);
    });

    it('handles first-time user with no entries', async () => {
      const { db } = await import('@/db');

      const mockLimit = vi.fn().mockResolvedValue([]);
      const mockOrderBy = vi.fn().mockReturnValue({ limit: mockLimit });
      const mockWhere = vi.fn().mockReturnValue({ orderBy: mockOrderBy });
      const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
      (db.select as any).mockReturnValue({ from: mockFrom });

      const newEntry = { id: 'le-1', balanceAfter: 100 };
      mocks.mockReturning.mockResolvedValueOnce([newEntry]);

      const result = await applyLedgerEntry(db, {
        orgId: 'org-1',
        userId: 'new-user',
        eventType: 'earn',
        amountCredits: 100,
        sourceType: 'award',
      });

      expect(result.balanceAfter).toBe(100);
    });
  });

  /* ============================= adminAdjustBalance ============================= */
  describe('adminAdjustBalance', () => {
    it('creates adjustment through transaction', async () => {
      const entry = { id: 'le-1', balanceAfter: 200 };

      mocks.mockTransaction.mockImplementation(async (cb: any) => {
        // Mock the TX with select and insert chains
        const mockLimit = vi.fn().mockResolvedValue([{ balanceAfter: 100 }]);
        const mockOrderBy = vi.fn().mockReturnValue({ limit: mockLimit });
        const mockWhere = vi.fn().mockReturnValue({ orderBy: mockOrderBy });
        const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });

        const tx = {
          select: vi.fn().mockReturnValue({ from: mockFrom }),
          insert: vi.fn().mockReturnValue({
            values: vi.fn().mockReturnValue({
              returning: vi.fn().mockResolvedValue([entry]),
            }),
          }),
        };
        return cb(tx);
      });

      const result = await adminAdjustBalance('org-1', 'u-1', 100, 'admin-1', 'Correction');

      expect(result).toEqual(entry);
    });
  });

  /* ============================= getLedgerSummary ============================= */
  describe('getLedgerSummary', () => {
    it('returns summary with totals', async () => {
      const { db } = await import('@/db');

      const mockWhere = vi.fn().mockResolvedValue([
        { totalIssued: 5000, totalSpent: 2000, activeMembers: 15 },
      ]);
      const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
      (db.select as any).mockReturnValue({ from: mockFrom });
      mocks.mockExecute.mockResolvedValue([{ total: 3000 }]);

      const result = await getLedgerSummary('org-1');

      expect(result.totalCreditsIssued).toBe(5000);
      expect(result.totalCreditsSpent).toBe(2000);
      expect(result.activeMembers).toBe(15);
    });
  });

  /* ============================= getBulkBalances ============================= */
  describe('getBulkBalances', () => {
    it('returns empty map for empty user list', async () => {
      const result = await getBulkBalances('org-1', []);

      expect(result.size).toBe(0);
    });

    it('returns balance map and fills zeroes for missing', async () => {
      mocks.mockExecute.mockResolvedValue([
        { user_id: 'u-1', balance_after: 300 },
      ]);

      const result = await getBulkBalances('org-1', ['u-1', 'u-2']);

      expect(result.get('u-1')).toBe(300);
      expect(result.get('u-2')).toBe(0);
    });
  });
});
