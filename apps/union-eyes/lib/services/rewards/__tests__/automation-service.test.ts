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
  mockQueryRecognitionAwardTypes: { findFirst: vi.fn(), findMany: vi.fn() },
  mockQueryRecognitionAwards: { findFirst: vi.fn(), findMany: vi.fn() },
  // sibling service mocks
  mockCreateAwardRequest: vi.fn(),
  mockIssueAward: vi.fn(),
  // logger mock
  mockLogger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock('drizzle-orm', () => ({
  eq: vi.fn((...args: unknown[]) => args),
  and: vi.fn((...args: unknown[]) => args),
  or: vi.fn((...args: unknown[]) => args),
  desc: vi.fn(),
  asc: vi.fn(),
  sql: vi.fn((strings: TemplateStringsArray, ..._values: unknown[]) => strings.join('')),
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
      execute: mocks.mockExecute,
      transaction: mocks.mockTransaction,
      query: {
        recognitionAwardTypes: mocks.mockQueryRecognitionAwardTypes,
        recognitionAwards: mocks.mockQueryRecognitionAwards,
      },
    },
  };
});

vi.mock('@/db/schema', () => ({
  recognitionAwardTypes: { id: 'id', orgId: 'orgId', name: 'name', kind: 'kind' },
  recognitionAwards: { id: 'id', orgId: 'orgId', recipientUserId: 'recipientUserId', awardTypeId: 'awardTypeId' },
}));

vi.mock('@/db/schema/recognition-rewards-schema', () => ({
  automationRules: { id: 'id', orgId: 'orgId', triggerType: 'triggerType', isActive: 'isActive' },
}));

vi.mock('../award-service', () => ({
  createAwardRequest: mocks.mockCreateAwardRequest,
  issueAward: mocks.mockIssueAward,
}));

vi.mock('@/lib/logger', () => ({ logger: mocks.mockLogger }));

import {
  processAnniversaryAwards,
  processMilestoneAwards,
  processMetricAwards,
  processScheduledAwards,
  createAutomationRule,
  updateAutomationRule,
  deleteAutomationRule,
} from '../automation-service';

describe('automation-service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  /* ============================= processAnniversaryAwards ============================= */
  describe('processAnniversaryAwards', () => {
    it('returns processed:0 when no anniversaries are found', async () => {
      mocks.mockExecute.mockResolvedValue([]);
      mocks.mockQueryRecognitionAwardTypes.findFirst.mockResolvedValue(null);

      const result = await processAnniversaryAwards('org-1');

      expect(result.success).toBe(true);
      expect(result.processed).toBe(0);
    });

    it('creates and issues awards for anniversaries', async () => {
      mocks.mockExecute.mockResolvedValue([
        { user_id: 'u1', user_name: 'Alice', years_of_service: 5 },
      ]);
      const awardType = { id: 'at-1', programId: 'p-1', requiresApproval: false };
      mocks.mockQueryRecognitionAwardTypes.findFirst.mockResolvedValue(awardType);
      const award = { id: 'award-1' };
      mocks.mockCreateAwardRequest.mockResolvedValue(award);
      mocks.mockIssueAward.mockResolvedValue({ award, newBalance: 200 });

      const result = await processAnniversaryAwards('org-1');

      expect(result.success).toBe(true);
      expect(result.processed).toBe(1);
      expect(mocks.mockCreateAwardRequest).toHaveBeenCalledTimes(1);
      expect(mocks.mockIssueAward).toHaveBeenCalledTimes(1);
    });

    it('does not issue when award type requires approval', async () => {
      mocks.mockExecute.mockResolvedValue([{ user_id: 'u1', years_of_service: 3 }]);
      const awardType = { id: 'at-1', programId: 'p-1', requiresApproval: true };
      mocks.mockQueryRecognitionAwardTypes.findFirst.mockResolvedValue(awardType);
      mocks.mockCreateAwardRequest.mockResolvedValue({ id: 'a-1' });

      const result = await processAnniversaryAwards('org-1');

      expect(result.processed).toBe(1);
      expect(mocks.mockIssueAward).not.toHaveBeenCalled();
    });

    it('continues processing when one anniversary fails', async () => {
      mocks.mockExecute.mockResolvedValue([
        { user_id: 'u1', years_of_service: 1 },
        { user_id: 'u2', years_of_service: 2 },
      ]);
      const awardType = { id: 'at-1', programId: 'p-1', requiresApproval: false };
      mocks.mockQueryRecognitionAwardTypes.findFirst.mockResolvedValue(awardType);
      mocks.mockCreateAwardRequest
        .mockRejectedValueOnce(new Error('fail'))
        .mockResolvedValueOnce({ id: 'a2' });
      mocks.mockIssueAward.mockResolvedValue({ award: { id: 'a2' }, newBalance: 50 });

      const result = await processAnniversaryAwards('org-1');

      expect(result.processed).toBe(1);
    });
  });

  /* ============================= processMilestoneAwards ============================= */
  describe('processMilestoneAwards', () => {
    it('returns processed:0 when no milestone rules match', async () => {
      const mockSelectWhere = vi.fn().mockResolvedValue([]);
      const mockSelectFrom = vi.fn().mockReturnValue({ where: mockSelectWhere });
      const { db } = await import('@/db');
      (db.select as any).mockReturnValue({ from: mockSelectFrom });

      const result = await processMilestoneAwards('org-1', 'user-1', 'contracts_closed', 5);

      expect(result.success).toBe(true);
      expect(result.processed).toBe(0);
    });

    it('creates award when milestone rule matches and no prior award exists', async () => {
      const rule = {
        id: 'rule-1',
        orgId: 'org-1',
        triggerType: 'milestone',
        isActive: true,
        awardTypeId: 'at-1',
        description: 'Congrats!',
        conditions: { metric: 'contracts_closed', operator: 'gte', value: 5 },
      };

      const mockSelectWhere = vi.fn().mockResolvedValue([rule]);
      const mockSelectFrom = vi.fn().mockReturnValue({ where: mockSelectWhere });
      const { db } = await import('@/db');
      (db.select as any).mockReturnValue({ from: mockSelectFrom });

      mocks.mockQueryRecognitionAwards.findFirst.mockResolvedValue(null);
      mocks.mockQueryRecognitionAwardTypes.findFirst.mockResolvedValue({
        id: 'at-1',
        requiresApproval: false,
      });
      mocks.mockCreateAwardRequest.mockResolvedValue({ id: 'a-1' });
      mocks.mockIssueAward.mockResolvedValue({ award: { id: 'a-1' }, newBalance: 100 });

      const result = await processMilestoneAwards('org-1', 'user-1', 'contracts_closed', 10);

      expect(result.success).toBe(true);
      expect(result.processed).toBe(1);
    });

    it('skips award when already exists for this milestone', async () => {
      const rule = {
        id: 'rule-1',
        awardTypeId: 'at-1',
        conditions: { metric: 'contracts_closed', operator: 'eq', value: 5 },
      };

      const mockSelectWhere = vi.fn().mockResolvedValue([rule]);
      const mockSelectFrom = vi.fn().mockReturnValue({ where: mockSelectWhere });
      const { db } = await import('@/db');
      (db.select as any).mockReturnValue({ from: mockSelectFrom });

      mocks.mockQueryRecognitionAwards.findFirst.mockResolvedValue({ id: 'existing-award' });

      const result = await processMilestoneAwards('org-1', 'user-1', 'contracts_closed', 5);

      expect(result.processed).toBe(0);
      expect(mocks.mockCreateAwardRequest).not.toHaveBeenCalled();
    });
  });

  /* ============================= processMetricAwards ============================= */
  describe('processMetricAwards', () => {
    it('delegates to processMilestoneAwards', async () => {
      const mockSelectWhere = vi.fn().mockResolvedValue([]);
      const mockSelectFrom = vi.fn().mockReturnValue({ where: mockSelectWhere });
      const { db } = await import('@/db');
      (db.select as any).mockReturnValue({ from: mockSelectFrom });

      const result = await processMetricAwards('org-1', 'u-1', 'satisfaction_score', 95);

      expect(result.success).toBe(true);
    });
  });

  /* ============================= processScheduledAwards ============================= */
  describe('processScheduledAwards', () => {
    it('processes scheduled rules', async () => {
      const rules = [
        { id: 'r-1', orgId: 'org-1', name: 'Monthly toppers', triggerType: 'scheduled', isActive: true },
      ];
      const mockSelectWhere = vi.fn().mockResolvedValue(rules);
      const mockSelectFrom = vi.fn().mockReturnValue({ where: mockSelectWhere });
      const { db } = await import('@/db');
      (db.select as any).mockReturnValue({ from: mockSelectFrom });

      const result = await processScheduledAwards('org-1');

      expect(result.success).toBe(true);
      expect(result.processed).toBe(1);
    });
  });

  /* ============================= createAutomationRule ============================= */
  describe('createAutomationRule', () => {
    it('creates a new rule and returns success', async () => {
      const newRule = { id: 'rule-1', name: 'Anniversary Rule' };
      mocks.mockReturning.mockResolvedValueOnce([newRule]);

      const result = await createAutomationRule({
        orgId: 'org-1',
        name: 'Anniversary Rule',
        triggerType: 'anniversary',
        awardTypeId: 'at-1',
      });

      expect(result.success).toBe(true);
      expect(result.rule).toEqual(newRule);
    });

    it('returns error on insert failure', async () => {
      mocks.mockValues.mockReturnValue({ returning: vi.fn().mockRejectedValue(new Error('db error')) });

      const result = await createAutomationRule({
        orgId: 'org-1',
        name: 'Bad Rule',
        triggerType: 'milestone',
        awardTypeId: 'at-1',
      });

      expect(result.success).toBe(false);
    });
  });

  /* ============================= updateAutomationRule ============================= */
  describe('updateAutomationRule', () => {
    it('updates rule and returns success', async () => {
      const updated = { id: 'r-1', name: 'Updated' };
      mocks.mockReturning.mockResolvedValueOnce([updated]);

      const result = await updateAutomationRule('r-1', { name: 'Updated' });

      expect(result.success).toBe(true);
      expect(result.rule).toEqual(updated);
    });

    it('returns error when rule not found', async () => {
      mocks.mockReturning.mockResolvedValueOnce([undefined]);

      const result = await updateAutomationRule('nope', { name: 'X' });

      expect(result.success).toBe(false);
    });
  });

  /* ============================= deleteAutomationRule ============================= */
  describe('deleteAutomationRule', () => {
    it('deletes a rule successfully', async () => {
      mocks.mockDeleteWhere.mockResolvedValue(undefined);

      const result = await deleteAutomationRule('r-1');

      expect(result.success).toBe(true);
      expect(mocks.mockDelete).toHaveBeenCalled();
    });
  });
});
