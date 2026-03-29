import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── hoisted mocks ───
const mocks = vi.hoisted(() => ({
  mockInsert: vi.fn(),
  mockUpdate: vi.fn(),
  mockDelete: vi.fn(),
  mockTransaction: vi.fn(),
  mockValues: vi.fn(),
  mockReturning: vi.fn(),
  mockSet: vi.fn(),
  mockDeleteWhere: vi.fn(),
  mockQueryTemplates: vi.fn(),
  mockQueryHistory: vi.fn(),
  mockUuidv4: vi.fn(),
}));

vi.mock('drizzle-orm', () => ({
  eq: vi.fn((...args: unknown[]) => args),
  and: vi.fn((...args: unknown[]) => args),
  or: vi.fn((...args: unknown[]) => args),
  desc: vi.fn(),
  sql: vi.fn(),
  asc: vi.fn(),
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
  ne: vi.fn((...args: unknown[]) => args),
  count: vi.fn(),
  sum: vi.fn(),
  avg: vi.fn(),
  min: vi.fn(),
  max: vi.fn(),
  relations: vi.fn(() => ({})),
}));

vi.mock('uuid', () => ({
  v4: mocks.mockUuidv4,
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

  return {
    db: {
      insert: mocks.mockInsert,
      update: mocks.mockUpdate,
      delete: mocks.mockDelete,
      transaction: mocks.mockTransaction,
      query: {
        awardTemplates: {
          findFirst: mocks.mockQueryTemplates,
          findMany: mocks.mockQueryTemplates,
        },
        awardHistory: {
          findFirst: mocks.mockQueryHistory,
          findMany: mocks.mockQueryHistory,
        },
      },
    },
  };
});

vi.mock('@/db/schema', () => ({
  awardTemplates: {
    id: 'id',
    organizationId: 'organization_id',
    name: 'name',
    message: 'message',
    category: 'category',
    type: 'type',
    status: 'status',
    useCount: 'use_count',
    totalAwarded: 'total_awarded',
    totalValueAwarded: 'total_value_awarded',
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    $inferInsert: {},
  },
  awardHistory: {
    templateId: 'template_id',
    awardedAt: 'awarded_at',
  },
}));

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import {
  listAwardTemplates,
  getAwardTemplate,
  createAwardTemplate,
  updateAwardTemplate,
  deleteAwardTemplate,
  incrementTemplateUseCount,
  getPopularTemplates,
  searchAwardTemplates,
  initializeDefaultTemplates,
  recordTemplateUsage,
  getTemplateHistory,
  cloneTemplate,
  getTemplateStats,
  archiveOldTemplates,
} from '../template-service';

describe('template-service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.mockQueryTemplates.mockResolvedValue(null);
    mocks.mockQueryHistory.mockResolvedValue(null);
    mocks.mockReturning.mockResolvedValue([]);
    mocks.mockValues.mockReturnValue({ returning: mocks.mockReturning });
    mocks.mockInsert.mockReturnValue({ values: mocks.mockValues });
    mocks.mockUuidv4.mockReturnValue('tmpl-uuid-1234');
  });

  // ──────────────── listAwardTemplates ────────────────
  describe('listAwardTemplates', () => {
    it('returns templates for an org', async () => {
      const templates = [{ id: 't1', name: 'Team Player' }];
      mocks.mockQueryTemplates.mockResolvedValue(templates);

      const result = await listAwardTemplates('org-1');
      expect(result.success).toBe(true);
      expect(result.data).toEqual(templates);
    });

    it('applies category filter', async () => {
      mocks.mockQueryTemplates.mockResolvedValue([]);
      const result = await listAwardTemplates('org-1', { category: 'performance' });
      expect(result.success).toBe(true);
      expect(mocks.mockQueryTemplates).toHaveBeenCalled();
    });

    it('applies type and status filters', async () => {
      mocks.mockQueryTemplates.mockResolvedValue([]);
      const result = await listAwardTemplates('org-1', {
        type: 'points',
        status: 'active',
      });
      expect(result.success).toBe(true);
      expect(mocks.mockQueryTemplates).toHaveBeenCalled();
    });

    it('returns empty array when none found', async () => {
      mocks.mockQueryTemplates.mockResolvedValue(null);
      const result = await listAwardTemplates('org-1');
      expect(result.success).toBe(true);
      expect(result.data).toEqual([]);
    });

    it('handles errors gracefully', async () => {
      mocks.mockQueryTemplates.mockRejectedValue(new Error('db error'));
      const result = await listAwardTemplates('org-1');
      expect(result.success).toBe(false);
    });
  });

  // ──────────────── getAwardTemplate ────────────────
  describe('getAwardTemplate', () => {
    it('returns template when found', async () => {
      const template = { id: 't1', name: 'Innovation' };
      mocks.mockQueryTemplates.mockResolvedValue(template);

      const result = await getAwardTemplate('t1');
      expect(result.success).toBe(true);
      expect(result.data).toEqual(template);
    });

    it('returns error when not found', async () => {
      mocks.mockQueryTemplates.mockResolvedValue(null);
      const result = await getAwardTemplate('missing');
      expect(result.success).toBe(false);
      expect(result.error).toBe('Template not found');
    });

    it('handles errors', async () => {
      mocks.mockQueryTemplates.mockRejectedValue(new Error('db'));
      const result = await getAwardTemplate('t1');
      expect(result.success).toBe(false);
    });
  });

  // ──────────────── createAwardTemplate ────────────────
  describe('createAwardTemplate', () => {
    it('creates and returns new template', async () => {
      const newTemplate = { id: 'tmpl-uuid-1234', name: 'New Award', status: 'active' };
      mocks.mockReturning.mockResolvedValue([newTemplate]);

      const result = await createAwardTemplate('org-1', {
        name: 'New Award',
        message: 'Well done!',
        category: 'performance',
        type: 'points',
      } as never, 'user-1');

      expect(result.success).toBe(true);
      expect(result.data).toEqual(newTemplate);
    });

    it('handles creation errors', async () => {
      mocks.mockReturning.mockRejectedValue(new Error('constraint'));
      mocks.mockValues.mockReturnValue({ returning: mocks.mockReturning });

      const result = await createAwardTemplate('org-1', { name: 'Fail' } as never, 'u1');
      expect(result.success).toBe(false);
    });
  });

  // ──────────────── updateAwardTemplate ────────────────
  describe('updateAwardTemplate', () => {
    it('updates and returns template', async () => {
      const updated = { id: 't1', name: 'Updated Name' };
      mocks.mockReturning.mockResolvedValue([updated]);
      const mockWhere = vi.fn().mockReturnValue({ returning: mocks.mockReturning });
      mocks.mockSet.mockReturnValue({ where: mockWhere });

      const result = await updateAwardTemplate('t1', { name: 'Updated Name' });
      expect(result.success).toBe(true);
      expect(result.data).toEqual(updated);
    });

    it('returns error when template not found', async () => {
      mocks.mockReturning.mockResolvedValue([]);
      const mockWhere = vi.fn().mockReturnValue({ returning: mocks.mockReturning });
      mocks.mockSet.mockReturnValue({ where: mockWhere });

      const result = await updateAwardTemplate('missing', { name: 'X' });
      expect(result.success).toBe(false);
    });

    it('handles update errors', async () => {
      mocks.mockUpdate.mockImplementationOnce(() => { throw new Error('update fail'); });
      const result = await updateAwardTemplate('t1', { name: 'X' });
      expect(result.success).toBe(false);
    });
  });

  // ──────────────── deleteAwardTemplate ────────────────
  describe('deleteAwardTemplate', () => {
    it('hard deletes when no usage history', async () => {
      mocks.mockQueryHistory.mockResolvedValue(null);
      const result = await deleteAwardTemplate('t1');
      expect(result.success).toBe(true);
      expect(mocks.mockDelete).toHaveBeenCalled();
    });

    it('soft deletes (archives) when has usage history', async () => {
      mocks.mockQueryHistory.mockResolvedValue({ id: 'h1' });
      const mockWhere = vi.fn().mockResolvedValue(undefined);
      mocks.mockSet.mockReturnValue({ where: mockWhere });

      const result = await deleteAwardTemplate('t1');
      expect(result.success).toBe(true);
      expect(mocks.mockUpdate).toHaveBeenCalled();
    });

    it('handles errors', async () => {
      mocks.mockQueryHistory.mockRejectedValue(new Error('db'));
      const result = await deleteAwardTemplate('t1');
      expect(result.success).toBe(false);
    });
  });

  // ──────────────── incrementTemplateUseCount ────────────────
  describe('incrementTemplateUseCount', () => {
    it('increments the use count', async () => {
      const mockWhere = vi.fn().mockResolvedValue(undefined);
      mocks.mockSet.mockReturnValue({ where: mockWhere });

      const result = await incrementTemplateUseCount('t1');
      expect(result.success).toBe(true);
      expect(mocks.mockUpdate).toHaveBeenCalled();
    });

    it('handles errors', async () => {
      mocks.mockUpdate.mockImplementationOnce(() => { throw new Error('fail'); });
      const result = await incrementTemplateUseCount('t1');
      expect(result.success).toBe(false);
    });
  });

  // ──────────────── getPopularTemplates ────────────────
  describe('getPopularTemplates', () => {
    it('returns popular templates ordered by use count', async () => {
      const templates = [{ id: 't1', useCount: 50 }, { id: 't2', useCount: 30 }];
      mocks.mockQueryTemplates.mockResolvedValue(templates);

      const result = await getPopularTemplates('org-1', 5);
      expect(result.success).toBe(true);
      expect(result.data).toEqual(templates);
    });

    it('returns empty array when none exist', async () => {
      mocks.mockQueryTemplates.mockResolvedValue(null);
      const result = await getPopularTemplates('org-1');
      expect(result.success).toBe(true);
      expect(result.data).toEqual([]);
    });

    it('handles query errors', async () => {
      mocks.mockQueryTemplates.mockRejectedValue(new Error('popular fail'));
      const result = await getPopularTemplates('org-1');
      expect(result.success).toBe(false);
    });
  });

  // ──────────────── searchAwardTemplates ────────────────
  describe('searchAwardTemplates', () => {
    it('finds templates matching search query', async () => {
      const templates = [{ id: 't1', name: 'Team Player' }];
      mocks.mockQueryTemplates.mockResolvedValue(templates);

      const result = await searchAwardTemplates('org-1', 'team');
      expect(result.success).toBe(true);
      expect(result.data).toEqual(templates);
    });

    it('returns empty data when no matches', async () => {
      mocks.mockQueryTemplates.mockResolvedValue(null);
      const result = await searchAwardTemplates('org-1', 'zzz');
      expect(result.success).toBe(true);
      expect(result.data).toEqual([]);
    });

    it('handles errors', async () => {
      mocks.mockQueryTemplates.mockRejectedValue(new Error('fail'));
      const result = await searchAwardTemplates('org-1', 'x');
      expect(result.success).toBe(false);
    });
  });

  // ──────────────── initializeDefaultTemplates ────────────────
  describe('initializeDefaultTemplates', () => {
    it('creates default templates for org', async () => {
      const created = [{ id: 't1' }, { id: 't2' }];
      mocks.mockReturning.mockResolvedValue(created);

      const result = await initializeDefaultTemplates('org-1', 'admin-1');
      expect(result.success).toBe(true);
      expect(result.data).toEqual(created);
    });

    it('handles errors', async () => {
      mocks.mockReturning.mockRejectedValue(new Error('dup'));
      mocks.mockValues.mockReturnValue({ returning: mocks.mockReturning });

      const result = await initializeDefaultTemplates('org-1', 'admin-1');
      expect(result.success).toBe(false);
    });
  });

  // ──────────────── recordTemplateUsage ────────────────
  describe('recordTemplateUsage', () => {
    it('records usage in a transaction', async () => {
      mocks.mockTransaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
        const txMock = {
          update: vi.fn().mockReturnValue({
            set: vi.fn().mockReturnValue({
              where: vi.fn().mockResolvedValue(undefined),
            }),
          }),
          insert: vi.fn().mockReturnValue({
            values: vi.fn().mockResolvedValue(undefined),
          }),
        };
        return fn(txMock);
      });

      const result = await recordTemplateUsage('t1', 'u1', 'r1', 'Alice', 'a@b.com', 100, 50, 'Great');
      expect(result.success).toBe(true);
    });

    it('handles errors', async () => {
      mocks.mockTransaction.mockRejectedValue(new Error('tx fail'));
      const result = await recordTemplateUsage('t1', 'u1', 'r1', 'A', 'e@x.com', 0, 0, 'x');
      expect(result.success).toBe(false);
    });

    it('uses monetary value fallback when value is undefined', async () => {
      mocks.mockTransaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
        const txMock = {
          update: vi.fn().mockReturnValue({
            set: vi.fn().mockReturnValue({
              where: vi.fn().mockResolvedValue(undefined),
            }),
          }),
          insert: vi.fn().mockReturnValue({
            values: vi.fn().mockResolvedValue(undefined),
          }),
        };
        return fn(txMock);
      });

      const result = await recordTemplateUsage('t1', 'u1', 'r1', 'Bob', undefined, 10, undefined as unknown as number, 'N/A');
      expect(result.success).toBe(true);
    });
  });

  // ──────────────── getTemplateHistory ────────────────
  describe('getTemplateHistory', () => {
    it('returns history entries', async () => {
      const history = [{ id: 'h1', templateId: 't1' }];
      mocks.mockQueryHistory.mockResolvedValue(history);

      const result = await getTemplateHistory('t1');
      expect(result.success).toBe(true);
      expect(result.data).toEqual(history);
    });

    it('returns empty when no history', async () => {
      mocks.mockQueryHistory.mockResolvedValue(null);
      const result = await getTemplateHistory('t1');
      expect(result.success).toBe(true);
      expect(result.data).toEqual([]);
    });

    it('handles history query errors', async () => {
      mocks.mockQueryHistory.mockRejectedValue(new Error('history fail'));
      const result = await getTemplateHistory('t1');
      expect(result.success).toBe(false);
    });
  });

  // ──────────────── cloneTemplate ────────────────
  describe('cloneTemplate', () => {
    it('clones template to new org', async () => {
      mocks.mockQueryTemplates.mockResolvedValue({
        id: 't1',
        name: 'Original',
        message: 'msg',
        category: 'performance',
        type: 'points',
        pointsValue: 100,
      });
      const cloned = { id: 'tmpl-uuid-1234', name: 'Original (Copy)' };
      mocks.mockReturning.mockResolvedValue([cloned]);

      const result = await cloneTemplate('t1', 'org-2', 'user-2');
      expect(result.success).toBe(true);
      expect(result.data?.name).toBe('Original (Copy)');
    });

    it('returns error when source not found', async () => {
      mocks.mockQueryTemplates.mockResolvedValue(null);
      const result = await cloneTemplate('missing', 'org-2', 'u2');
      expect(result.success).toBe(false);
    });

    it('handles clone errors', async () => {
      mocks.mockQueryTemplates.mockRejectedValue(new Error('clone fail'));
      const result = await cloneTemplate('t1', 'org-2', 'u2');
      expect(result.success).toBe(false);
    });
  });

  // ──────────────── getTemplateStats ────────────────
  describe('getTemplateStats', () => {
    it('returns aggregate stats', async () => {
      mocks.mockQueryTemplates.mockResolvedValue([
        { status: 'active', useCount: 10, totalValueAwarded: 500 },
        { status: 'active', useCount: 5, totalValueAwarded: 200 },
        { status: 'archived', useCount: 2, totalValueAwarded: 100 },
      ]);

      const result = await getTemplateStats('org-1');
      expect(result.success).toBe(true);
      expect(result.data?.totalTemplates).toBe(3);
      expect(result.data?.activeTemplates).toBe(2);
      expect(result.data?.totalUses).toBe(17);
      expect(result.data?.totalValueAwarded).toBe(800);
    });

    it('returns zero stats when no templates', async () => {
      mocks.mockQueryTemplates.mockResolvedValue([]);
      const result = await getTemplateStats('org-1');
      expect(result.success).toBe(true);
      expect(result.data?.totalTemplates).toBe(0);
    });

    it('handles errors', async () => {
      mocks.mockQueryTemplates.mockRejectedValue(new Error('fail'));
      const result = await getTemplateStats('org-1');
      expect(result.success).toBe(false);
    });

    it('handles templates with missing counters via fallback zeros', async () => {
      mocks.mockQueryTemplates.mockResolvedValue([
        { status: 'active', useCount: undefined, totalValueAwarded: undefined },
      ]);

      const result = await getTemplateStats('org-1');
      expect(result.success).toBe(true);
      expect(result.data?.totalUses).toBe(0);
      expect(result.data?.totalValueAwarded).toBe(0);
    });

    it('calculates top template when some useCount values are undefined', async () => {
      mocks.mockQueryTemplates.mockResolvedValue([
        { id: 'a', status: 'active', useCount: undefined, totalValueAwarded: 0 },
        { id: 'b', status: 'active', useCount: 5, totalValueAwarded: 10 },
      ]);

      const result = await getTemplateStats('org-1');
      expect(result.success).toBe(true);
      expect(result.data?.topTemplate?.id).toBe('b');
    });
  });

  // ──────────────── archiveOldTemplates ────────────────
  describe('archiveOldTemplates', () => {
    it('archives old templates using default days', async () => {
      const mockWhere = vi.fn().mockResolvedValue({ rowCount: 2 });
      mocks.mockSet.mockReturnValue({ where: mockWhere });
      mocks.mockUpdate.mockReturnValue({ set: mocks.mockSet });

      const result = await archiveOldTemplates('org-1');
      expect(result.success).toBe(true);
      expect(result.archivedCount).toBe(2);
    });

    it('archives with custom day threshold', async () => {
      const mockWhere = vi.fn().mockResolvedValue({ rowCount: 1 });
      mocks.mockSet.mockReturnValue({ where: mockWhere });
      mocks.mockUpdate.mockReturnValue({ set: mocks.mockSet });

      const result = await archiveOldTemplates('org-1', 30);
      expect(result.success).toBe(true);
      expect(result.archivedCount).toBe(1);
    });

    it('returns failure when archiving throws', async () => {
      mocks.mockUpdate.mockImplementationOnce(() => { throw new Error('archive failed'); });
      const result = await archiveOldTemplates('org-1');
      expect(result.success).toBe(false);
    });
  });
});
