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
  mockQueryRecognitionAwardTypes: { findFirst: vi.fn(), findMany: vi.fn() },
  // sibling service mocks
  mockApplyLedgerEntry: vi.fn(),
  mockApplyBudgetUsage: vi.fn(),
  mockApplyBudgetUsageChecked: vi.fn(),
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
        recognitionAwards: mocks.mockQueryRecognitionAwards,
        recognitionAwardTypes: mocks.mockQueryRecognitionAwardTypes,
      },
    },
  };
});

vi.mock('@/db/schema', () => ({
  recognitionAwards: { id: 'id', orgId: 'orgId', status: 'status' },
  recognitionAwardTypes: { id: 'id', orgId: 'orgId', programId: 'programId' },
}));

vi.mock('../wallet-service', () => ({
  applyLedgerEntry: mocks.mockApplyLedgerEntry,
}));

vi.mock('../budget-service', () => ({
  applyBudgetUsage: mocks.mockApplyBudgetUsage,
  applyBudgetUsageChecked: mocks.mockApplyBudgetUsageChecked,
}));

import {
  createAwardRequest,
  approveAward,
  issueAward,
  revokeAward,
  rejectAward,
} from '../award-service';

describe('award-service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  /* ============================= createAwardRequest ============================= */
  describe('createAwardRequest', () => {
    it('creates an auto-approved award when approval not required', async () => {
      const awardType = { id: 'at-1', orgId: 'org-1', programId: 'prog-1', requiresApproval: false };
      mocks.mockQueryRecognitionAwardTypes.findFirst.mockResolvedValue(awardType);
      const created = { id: 'award-1', status: 'approved', orgId: 'org-1' };
      mocks.mockReturning.mockResolvedValueOnce([created]);

      const result = await createAwardRequest({
        orgId: 'org-1',
        programId: 'prog-1',
        awardTypeId: 'at-1',
        recipientUserId: 'user-1',
        reason: 'Great work',
      });

      expect(result).toEqual(created);
      expect(mocks.mockInsert).toHaveBeenCalled();
    });

    it('creates a pending award when approval is required', async () => {
      const awardType = { id: 'at-1', orgId: 'org-1', programId: 'prog-1', requiresApproval: true };
      mocks.mockQueryRecognitionAwardTypes.findFirst.mockResolvedValue(awardType);
      const created = { id: 'award-2', status: 'pending', orgId: 'org-1' };
      mocks.mockReturning.mockResolvedValueOnce([created]);

      const result = await createAwardRequest({
        orgId: 'org-1',
        programId: 'prog-1',
        awardTypeId: 'at-1',
        recipientUserId: 'user-1',
        reason: 'Milestone reached',
      });

      expect(result.status).toBe('pending');
    });

    it('throws when award type not found', async () => {
      mocks.mockQueryRecognitionAwardTypes.findFirst.mockResolvedValue(null);

      await expect(
        createAwardRequest({
          orgId: 'org-1',
          programId: 'prog-1',
          awardTypeId: 'nonexistent',
          recipientUserId: 'user-1',
          reason: 'Test',
        })
      ).rejects.toThrow('Award type not found');
    });
  });

  /* ============================= approveAward ============================= */
  describe('approveAward', () => {
    it('approves a pending award', async () => {
      const award = { id: 'award-1', orgId: 'org-1', status: 'pending' };
      mocks.mockQueryRecognitionAwards.findFirst.mockResolvedValue(award);
      const updated = { ...award, status: 'approved', approvedByUserId: 'admin-1' };
      mocks.mockReturning.mockResolvedValueOnce([updated]);

      const result = await approveAward({ awardId: 'award-1', orgId: 'org-1', approvedByUserId: 'admin-1' });

      expect(result.status).toBe('approved');
      expect(mocks.mockUpdate).toHaveBeenCalled();
    });

    it('throws when award not found', async () => {
      mocks.mockQueryRecognitionAwards.findFirst.mockResolvedValue(null);

      await expect(
        approveAward({ awardId: 'nope', orgId: 'org-1', approvedByUserId: 'admin-1' })
      ).rejects.toThrow('Award not found');
    });

    it('throws when award is not pending', async () => {
      mocks.mockQueryRecognitionAwards.findFirst.mockResolvedValue({ id: 'a', orgId: 'org-1', status: 'issued' });

      await expect(
        approveAward({ awardId: 'a', orgId: 'org-1', approvedByUserId: 'admin-1' })
      ).rejects.toThrow('Cannot approve award with status: issued');
    });
  });

  /* ============================= issueAward ============================= */
  describe('issueAward', () => {
    it('issues an approved award within a transaction', async () => {
      const award = {
        id: 'award-1',
        orgId: 'org-1',
        programId: 'prog-1',
        recipientUserId: 'user-1',
        status: 'approved',
        awardType: { name: 'Kudos', defaultCreditAmount: 100 },
      };
      const ledgerEntry = { balanceAfter: 200 };

      let capturedTx: unknown;
      mocks.mockTransaction.mockImplementation(async (cb: (tx: any) => unknown) => {
        const txUpdateWhere = vi.fn().mockReturnValue({ returning: vi.fn().mockResolvedValue([{ ...award, status: 'issued' }]) });
        const txSet = vi.fn().mockReturnValue({ where: txUpdateWhere });
        const tx = {
          query: {
            recognitionAwards: { findFirst: vi.fn().mockResolvedValue(award) },
          },
          update: vi.fn().mockReturnValue({ set: txSet }),
        };
        capturedTx = tx;
        return cb(tx);
      });
      mocks.mockApplyLedgerEntry.mockResolvedValue(ledgerEntry);
      mocks.mockApplyBudgetUsageChecked.mockResolvedValue(true);

      const result = await issueAward({ awardId: 'award-1', orgId: 'org-1' });

      expect(result.award.status).toBe('issued');
      expect(result.newBalance).toBe(200);
      // Round 36: budget mutation must run in the SAME transaction as the
      // ledger entry/award update, and must be scoped to the award's own org.
      expect(mocks.mockApplyBudgetUsageChecked).toHaveBeenCalledWith(
        capturedTx,
        award.programId,
        award.orgId,
        100
      );
      expect(mocks.mockApplyLedgerEntry.mock.calls[0][0]).toBe(capturedTx);
    });

    it('throws when award not found in transaction', async () => {
      mocks.mockTransaction.mockImplementation(async (cb: (tx: any) => unknown) => {
        const tx = {
          query: { recognitionAwards: { findFirst: vi.fn().mockResolvedValue(null) } },
        };
        return cb(tx);
      });

      await expect(issueAward({ awardId: 'x', orgId: 'org-1' })).rejects.toThrow(
        'Award or award type not found'
      );
    });

    it('throws when award is not approved', async () => {
      mocks.mockTransaction.mockImplementation(async (cb: (tx: any) => unknown) => {
        const tx = {
          query: {
            recognitionAwards: {
              findFirst: vi.fn().mockResolvedValue({
                id: 'a',
                status: 'pending',
                awardType: { defaultCreditAmount: 50 },
              }),
            },
          },
        };
        return cb(tx);
      });

      await expect(issueAward({ awardId: 'a', orgId: 'org-1' })).rejects.toThrow(
        'Cannot issue award with status: pending'
      );
    });

    it('throws when budget is insufficient', async () => {
      const award = {
        id: 'a',
        orgId: 'org-1',
        programId: 'p',
        recipientUserId: 'u',
        status: 'approved',
        awardType: { name: 'X', defaultCreditAmount: 999 },
      };

      mocks.mockTransaction.mockImplementation(async (cb: (tx: any) => unknown) => {
        const tx = {
          query: { recognitionAwards: { findFirst: vi.fn().mockResolvedValue(award) } },
        };
        return cb(tx);
      });
      mocks.mockApplyLedgerEntry.mockResolvedValue({ balanceAfter: 999 });
      mocks.mockApplyBudgetUsageChecked.mockResolvedValue(false);

      await expect(issueAward({ awardId: 'a', orgId: 'org-1' })).rejects.toThrow(
        'Insufficient budget to issue award'
      );
    });
  });

  /* ============================= revokeAward ============================= */
  describe('revokeAward', () => {
    it('revokes an issued award and refunds budget', async () => {
      const award = {
        id: 'a',
        orgId: 'org-1',
        programId: 'p',
        recipientUserId: 'u',
        status: 'issued',
        metadataJson: {},
        awardType: { name: 'X', defaultCreditAmount: 100 },
      };

      let capturedTx: unknown;
      mocks.mockTransaction.mockImplementation(async (cb: (tx: any) => unknown) => {
        const txUpdateWhere = vi.fn().mockReturnValue({ returning: vi.fn().mockResolvedValue([{ ...award, status: 'revoked' }]) });
        const txSet = vi.fn().mockReturnValue({ where: txUpdateWhere });
        const tx = {
          query: { recognitionAwards: { findFirst: vi.fn().mockResolvedValue(award) } },
          update: vi.fn().mockReturnValue({ set: txSet }),
        };
        capturedTx = tx;
        return cb(tx);
      });
      mocks.mockApplyLedgerEntry.mockResolvedValue({ balanceAfter: 0 });
      mocks.mockApplyBudgetUsage.mockResolvedValue(undefined);

      const result = await revokeAward({ awardId: 'a', orgId: 'org-1', revokedByUserId: 'admin', reason: 'Mistake' });

      expect(result.award.status).toBe('revoked');
      expect(mocks.mockApplyBudgetUsage).toHaveBeenCalledWith(
        capturedTx,
        award.programId,
        award.orgId,
        -100
      );
      expect(mocks.mockApplyLedgerEntry.mock.calls[0][0]).toBe(capturedTx);
    });

    it('throws when award not found for revocation', async () => {
      mocks.mockTransaction.mockImplementation(async (cb: (tx: any) => unknown) => {
        const tx = {
          query: { recognitionAwards: { findFirst: vi.fn().mockResolvedValue(null) } },
        };
        return cb(tx);
      });

      await expect(
        revokeAward({ awardId: 'x', orgId: 'org-1', revokedByUserId: 'a', reason: 'test' })
      ).rejects.toThrow('Award not found');
    });

    it('throws when revoking a non-issued award', async () => {
      mocks.mockTransaction.mockImplementation(async (cb: (tx: any) => unknown) => {
        const tx = {
          query: {
            recognitionAwards: { findFirst: vi.fn().mockResolvedValue({ id: 'a', status: 'pending', awardType: {} }) },
          },
        };
        return cb(tx);
      });

      await expect(
        revokeAward({ awardId: 'a', orgId: 'org-1', revokedByUserId: 'admin', reason: 'R' })
      ).rejects.toThrow('Cannot revoke award with status: pending');
    });
  });

  /* ============================= rejectAward ============================= */
  describe('rejectAward', () => {
    it('rejects a pending award', async () => {
      const updated = { id: 'a', status: 'rejected', orgId: 'org-1' };
      mocks.mockReturning.mockResolvedValueOnce([updated]);

      const result = await rejectAward('a', 'org-1', 'admin', 'Not eligible');

      expect(result.status).toBe('rejected');
      expect(mocks.mockUpdate).toHaveBeenCalled();
    });
  });
});
