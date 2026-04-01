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
  mockQueryRewardBudgetEnvelopes: { findFirst: vi.fn(), findMany: vi.fn() },
  mockQueryBudgetReservations: { findFirst: vi.fn(), findMany: vi.fn() },
  mockLogger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
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

vi.mock('uuid', () => ({ v4: vi.fn(() => 'mock-uuid-1234') }));

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
        rewardBudgetEnvelopes: mocks.mockQueryRewardBudgetEnvelopes,
        budgetReservations: mocks.mockQueryBudgetReservations,
      },
    },
  };
});

vi.mock('@/db/schema', () => ({
  rewardBudgetEnvelopes: {
    id: 'id',
    orgId: 'orgId',
    programId: 'programId',
    scopeType: 'scopeType',
    startsAt: 'startsAt',
    endsAt: 'endsAt',
    amountUsed: 'amountUsed',
    amountLimit: 'amountLimit',
    createdAt: 'createdAt',
  },
  budgetReservations: {
    id: 'id',
    poolId: 'poolId',
    status: 'status',
    referenceType: 'referenceType',
    referenceId: 'referenceId',
    expiresAt: 'expiresAt',
  },
}));

vi.mock('@/lib/logger', () => ({ logger: mocks.mockLogger }));

import {
  createBudgetEnvelope,
  getBudgetEnvelopeById,
  listBudgetEnvelopes,
  updateBudgetEnvelope,
  checkBudgetAvailability,
  applyBudgetUsage,
  applyBudgetUsageChecked,
  getBudgetUsageSummary,
  reserveBudget,
  confirmBudgetReservation,
  releaseReservedBudget,
  releaseReservationsByReference,
  getBudgetStatus,
  cleanupExpiredReservations,
} from '../budget-service';

describe('budget-service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  /* ============================= createBudgetEnvelope ============================= */
  describe('createBudgetEnvelope', () => {
    it('inserts envelope and returns it', async () => {
      const envelope = { id: 'env-1', orgId: 'org-1', amountLimit: 1000, amountUsed: 0 };
      mocks.mockReturning.mockResolvedValueOnce([envelope]);

      const result = await createBudgetEnvelope({ orgId: 'org-1', amountLimit: 1000 } as unknown as Parameters<typeof createBudgetEnvelope>[0]);

      expect(result).toEqual(envelope);
      expect(mocks.mockInsert).toHaveBeenCalled();
    });
  });

  /* ============================= getBudgetEnvelopeById ============================= */
  describe('getBudgetEnvelopeById', () => {
    it('returns envelope when found', async () => {
      const envelope = { id: 'env-1', orgId: 'org-1' };
      mocks.mockQueryRewardBudgetEnvelopes.findFirst.mockResolvedValue(envelope);

      const result = await getBudgetEnvelopeById('env-1', 'org-1');

      expect(result).toEqual(envelope);
    });

    it('returns null when not found', async () => {
      mocks.mockQueryRewardBudgetEnvelopes.findFirst.mockResolvedValue(null);

      const result = await getBudgetEnvelopeById('nope', 'org-1');

      expect(result).toBeNull();
    });
  });

  /* ============================= listBudgetEnvelopes ============================= */
  describe('listBudgetEnvelopes', () => {
    it('returns envelopes for a program', async () => {
      const envelopes = [{ id: 'e-1' }, { id: 'e-2' }];
      mocks.mockQueryRewardBudgetEnvelopes.findMany.mockResolvedValue(envelopes);

      const result = await listBudgetEnvelopes('prog-1', 'org-1');

      expect(result).toHaveLength(2);
    });

    it('filters by active only when requested', async () => {
      mocks.mockQueryRewardBudgetEnvelopes.findMany.mockResolvedValue([]);

      await listBudgetEnvelopes('prog-1', 'org-1', true);

      expect(mocks.mockQueryRewardBudgetEnvelopes.findMany).toHaveBeenCalled();
    });
  });

  /* ============================= updateBudgetEnvelope ============================= */
  describe('updateBudgetEnvelope', () => {
    it('updates and returns envelope', async () => {
      const updated = { id: 'e-1', name: 'Updated', orgId: 'org-1' };
      mocks.mockReturning.mockResolvedValueOnce([updated]);

      const result = await updateBudgetEnvelope('e-1', 'org-1', { name: 'Updated' } as unknown as Parameters<typeof updateBudgetEnvelope>[2]);

      expect(result).toEqual(updated);
      expect(mocks.mockUpdate).toHaveBeenCalled();
    });
  });

  /* ============================= checkBudgetAvailability ============================= */
  describe('checkBudgetAvailability', () => {
    it('returns true when no envelope exists', async () => {
      mocks.mockQueryRewardBudgetEnvelopes.findFirst.mockResolvedValue(null);

      const result = await checkBudgetAvailability('prog-1', 100);

      expect(result).toBe(true);
    });

    it('returns true when budget is sufficient', async () => {
      mocks.mockQueryRewardBudgetEnvelopes.findFirst.mockResolvedValue({
        amountLimit: 1000,
        amountUsed: 200,
      });

      const result = await checkBudgetAvailability('prog-1', 500);

      expect(result).toBe(true);
    });

    it('returns false when budget is insufficient', async () => {
      mocks.mockQueryRewardBudgetEnvelopes.findFirst.mockResolvedValue({
        amountLimit: 1000,
        amountUsed: 900,
      });

      const result = await checkBudgetAvailability('prog-1', 200);

      expect(result).toBe(false);
    });
  });

  /* ============================= applyBudgetUsage ============================= */
  describe('applyBudgetUsage', () => {
    it('does nothing when no active envelope found', async () => {
      mocks.mockQueryRewardBudgetEnvelopes.findFirst.mockResolvedValue(null);

      await applyBudgetUsage('prog-1', 50);

      expect(mocks.mockUpdate).not.toHaveBeenCalled();
    });

    it('updates usage when envelope found', async () => {
      mocks.mockQueryRewardBudgetEnvelopes.findFirst.mockResolvedValue({ id: 'e-1' });

      await applyBudgetUsage('prog-1', 50);

      expect(mocks.mockUpdate).toHaveBeenCalled();
    });
  });

  /* ============================= applyBudgetUsageChecked ============================= */
  describe('applyBudgetUsageChecked', () => {
    it('returns true for negative amounts (refunds)', async () => {
      mocks.mockQueryRewardBudgetEnvelopes.findFirst.mockResolvedValue(null);

      const result = await applyBudgetUsageChecked('prog-1', -50);

      expect(result).toBe(true);
    });

    it('returns true when no envelope exists', async () => {
      mocks.mockQueryRewardBudgetEnvelopes.findFirst.mockResolvedValue(null);

      const result = await applyBudgetUsageChecked('prog-1', 100);

      expect(result).toBe(true);
    });

    it('returns true when update succeeds (within limit)', async () => {
      mocks.mockQueryRewardBudgetEnvelopes.findFirst.mockResolvedValue({ id: 'e-1' });
      mocks.mockReturning.mockResolvedValueOnce([{ id: 'e-1' }]);

      const result = await applyBudgetUsageChecked('prog-1', 100);

      expect(result).toBe(true);
    });

    it('returns false when update returns empty (exceeds limit)', async () => {
      mocks.mockQueryRewardBudgetEnvelopes.findFirst.mockResolvedValue({ id: 'e-1' });
      mocks.mockReturning.mockResolvedValueOnce([undefined]);

      const result = await applyBudgetUsageChecked('prog-1', 100);

      expect(result).toBe(false);
    });
  });

  /* ============================= getBudgetUsageSummary ============================= */
  describe('getBudgetUsageSummary', () => {
    it('returns mapped summary for envelopes', async () => {
      const envelopes = [
        {
          id: 'e-1',
          name: 'Q1',
          amountUsed: 500,
          amountLimit: 1000,
          startsAt: new Date('2025-01-01'),
          endsAt: new Date('2027-12-31'),
        },
      ];
      mocks.mockQueryRewardBudgetEnvelopes.findMany.mockResolvedValue(envelopes);

      const result = await getBudgetUsageSummary('org-1');

      expect(result).toHaveLength(1);
      expect(result[0].percentage).toBe(50);
      expect(result[0].isActive).toBe(true);
    });
  });

  /* ============================= reserveBudget ============================= */
  describe('reserveBudget', () => {
    it('returns success when no envelope exists', async () => {
      mocks.mockQueryRewardBudgetEnvelopes.findFirst.mockResolvedValue(null);

      const result = await reserveBudget('prog-1', 100, 'award', 'ref-1');

      expect(result.success).toBe(true);
    });

    it('returns error when insufficient budget', async () => {
      mocks.mockQueryRewardBudgetEnvelopes.findFirst.mockResolvedValue({
        id: 'e-1',
        amountLimit: 500,
        amountUsed: 400,
      });
      mocks.mockQueryBudgetReservations.findMany.mockResolvedValue([
        { reservedAmount: 90 },
      ]);

      const result = await reserveBudget('prog-1', 100, 'award', 'ref-1');

      expect(result.success).toBe(false);
    });

    it('creates reservation when budget available', async () => {
      mocks.mockQueryRewardBudgetEnvelopes.findFirst.mockResolvedValue({
        id: 'e-1',
        amountLimit: 1000,
        amountUsed: 200,
      });
      mocks.mockQueryBudgetReservations.findMany.mockResolvedValue([]);
      mocks.mockValues.mockReturnValue({ returning: vi.fn().mockResolvedValue([]) });

      const result = await reserveBudget('prog-1', 100, 'award', 'ref-1');

      expect(result.success).toBe(true);
      expect(mocks.mockInsert).toHaveBeenCalled();
    });
  });

  /* ============================= confirmBudgetReservation ============================= */
  describe('confirmBudgetReservation', () => {
    it('confirms a pending reservation', async () => {
      mocks.mockQueryBudgetReservations.findFirst.mockResolvedValue({ id: 'r-1', status: 'pending' });

      const result = await confirmBudgetReservation('r-1');

      expect(result.success).toBe(true);
      expect(mocks.mockUpdate).toHaveBeenCalled();
    });

    it('returns error when reservation not found', async () => {
      mocks.mockQueryBudgetReservations.findFirst.mockResolvedValue(null);

      const result = await confirmBudgetReservation('nope');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Reservation not found');
    });

    it('returns error when reservation is not pending', async () => {
      mocks.mockQueryBudgetReservations.findFirst.mockResolvedValue({ id: 'r-1', status: 'confirmed' });

      const result = await confirmBudgetReservation('r-1');

      expect(result.success).toBe(false);
    });
  });

  /* ============================= releaseReservedBudget ============================= */
  describe('releaseReservedBudget', () => {
    it('releases a reservation', async () => {
      mocks.mockQueryBudgetReservations.findFirst.mockResolvedValue({ id: 'r-1', status: 'pending' });

      const result = await releaseReservedBudget('r-1');

      expect(result.success).toBe(true);
    });

    it('returns success if already released', async () => {
      mocks.mockQueryBudgetReservations.findFirst.mockResolvedValue({ id: 'r-1', status: 'released' });

      const result = await releaseReservedBudget('r-1');

      expect(result.success).toBe(true);
    });
  });

  /* ============================= releaseReservationsByReference ============================= */
  describe('releaseReservationsByReference', () => {
    it('releases matching reservations', async () => {
      mocks.mockQueryBudgetReservations.findMany.mockResolvedValue([
        { id: 'r1' },
        { id: 'r2' },
      ]);

      const result = await releaseReservationsByReference('award', 'ref-1');

      expect(result.released).toBe(2);
    });
  });

  /* ============================= getBudgetStatus ============================= */
  describe('getBudgetStatus', () => {
    it('returns zero status when no envelope found', async () => {
      mocks.mockQueryRewardBudgetEnvelopes.findFirst.mockResolvedValue(null);

      const result = await getBudgetStatus('prog-1', 'org-1');

      expect(result.envelope).toBeNull();
      expect(result.available).toBe(0);
    });

    it('returns full status when envelope exists', async () => {
      mocks.mockQueryRewardBudgetEnvelopes.findFirst.mockResolvedValue({
        id: 'e-1',
        amountLimit: 1000,
        amountUsed: 300,
      });
      mocks.mockQueryBudgetReservations.findMany.mockResolvedValue([
        { reservedAmount: 100 },
      ]);

      const result = await getBudgetStatus('prog-1', 'org-1');

      expect(result.totalBudget).toBe(1000);
      expect(result.used).toBe(300);
      expect(result.reserved).toBe(100);
      expect(result.available).toBe(600);
    });
  });

  /* ============================= cleanupExpiredReservations ============================= */
  describe('cleanupExpiredReservations', () => {
    it('marks expired reservations and sums released amount', async () => {
      mocks.mockQueryBudgetReservations.findMany.mockResolvedValue([
        { id: 'r1', reservedAmount: 50 },
        { id: 'r2', reservedAmount: 30 },
      ]);

      const result = await cleanupExpiredReservations();

      expect(result.cleaned).toBe(2);
      expect(result.released).toBe(80);
    });
  });
});
