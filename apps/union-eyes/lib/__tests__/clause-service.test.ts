import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

/* ------------------------------------------------------------------ */
/*  Hoisted mocks                                                     */
/* ------------------------------------------------------------------ */
const mocks = vi.hoisted(() => ({
  mockFindFirst: vi.fn(),
  mockSelect: vi.fn(),
  mockInsert: vi.fn(),
  mockUpdate: vi.fn(),
  mockDelete: vi.fn(),
}));

vi.mock('@/db/db', () => ({
  db: {
    query: {
      cbaClause: { findFirst: mocks.mockFindFirst },
    },
    select: mocks.mockSelect,
    insert: mocks.mockInsert,
    update: mocks.mockUpdate,
    delete: mocks.mockDelete,
  },
}));

vi.mock('@/db/schema', () => ({
  cbaClause: {
    id: 'id', cbaId: 'cbaId', clauseType: 'clauseType', clauseNumber: 'clauseNumber',
    articleNumber: 'articleNumber', title: 'title', content: 'content',
    contentPlainText: 'contentPlainText', confidenceScore: 'confidenceScore',
    orderIndex: 'orderIndex', viewCount: 'viewCount', parentClauseId: 'parentClauseId',
    createdAt: 'createdAt', updatedAt: 'updatedAt',
  },
  wageProgressions: {
    cbaId: 'cbaId', classification: 'classification', step: 'step',
  },
  benefitComparisons: {},
  clauseComparisons: {},
}));

vi.mock('drizzle-orm', () => ({
  eq: vi.fn((...a: unknown[]) => ({ _t: 'eq', _a: a })),
  and: vi.fn((...a: unknown[]) => ({ _t: 'and', _a: a })),
  or: vi.fn((...a: unknown[]) => ({ _t: 'or', _a: a })),
  desc: vi.fn((c: unknown) => ({ _t: 'desc', _c: c })),
  asc: vi.fn((c: unknown) => ({ _t: 'asc', _c: c })),
  sql: Object.assign(vi.fn((...a: unknown[]) => ({ _t: 'sql', _a: a })), { raw: vi.fn() }),
  inArray: vi.fn((...a: unknown[]) => ({ _t: 'inArray', _a: a })),
  like: vi.fn((...a: unknown[]) => ({ _t: 'like', _a: a })),
  gte: vi.fn((...a: unknown[]) => ({ _t: 'gte', _a: a })),
}));

vi.mock('@/lib/logger', () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
}));

/* ------------------------------------------------------------------ */
/*  Helpers                                                           */
/* ------------------------------------------------------------------ */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function chain(result: unknown = undefined) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const c: unknown = {};
  for (const m of ['from', 'where', 'orderBy', 'limit', 'offset', 'groupBy', 'set', 'values', 'returning']) {
    c[m] = vi.fn(() => c);
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  c.then = (resolve: unknown) => resolve(result);
  return c;
}

/* ------------------------------------------------------------------ */
/*  Import SUT                                                        */
/* ------------------------------------------------------------------ */
import {
  getClauseById,
  getClausesByCBAId,
  listClauses,
  createClause,
  bulkCreateClauses,
  updateClause,
  deleteClause,
  searchClauses,
  getClausesByType,
  getClauseHierarchy,
  compareClauses,
  saveClauseComparison,
  getWageProgressions,
  createWageProgression,
  getClauseTypeDistribution,
  getMostViewedClauses,
} from '@/lib/services/clause-service';

/* ------------------------------------------------------------------ */
/*  Fixtures                                                          */
/* ------------------------------------------------------------------ */
const CLAUSE = {
  id: 'cl1',
  cbaId: 'cba1',
  clauseType: 'wages',
  clauseNumber: '12.1',
  articleNumber: '12',
  title: 'Wage Rates',
  content: '<p>All bargaining unit members...</p>',
  contentPlainText: 'All bargaining unit members...',
  confidenceScore: '0.95',
  orderIndex: 10,
  viewCount: 5,
  parentClauseId: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const WAGE = {
  id: 'w1',
  cbaId: 'cba1',
  classification: 'Clerk',
  step: 1,
  hourlyRate: '25.50',
};

/* ------------------------------------------------------------------ */
/*  Tests                                                             */
/* ------------------------------------------------------------------ */
describe('clause-service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ================================================================
  // getClauseById
  // ================================================================
  describe('getClauseById', () => {
    it('returns clause and increments view count', async () => {
      mocks.mockFindFirst.mockResolvedValue(CLAUSE);
      mocks.mockUpdate.mockReturnValue(chain());

      const result = await getClauseById('cl1');
      expect(result).toEqual(CLAUSE);
      expect(mocks.mockUpdate).toHaveBeenCalled();
    });

    it('returns null when not found', async () => {
      mocks.mockFindFirst.mockResolvedValue(undefined);
      expect(await getClauseById('missing')).toBeNull();
    });

    it('throws on error', async () => {
      mocks.mockFindFirst.mockRejectedValue(new Error('db'));
      await expect(getClauseById('cl1')).rejects.toThrow('Failed to fetch clause');
    });
  });

  // ================================================================
  // getClausesByCBAId
  // ================================================================
  describe('getClausesByCBAId', () => {
    it('returns clauses ordered by index and number', async () => {
      mocks.mockSelect.mockReturnValue(chain([CLAUSE]));
      const result = await getClausesByCBAId('cba1');
      expect(result).toEqual([CLAUSE]);
    });

    it('throws on error', async () => {
      mocks.mockSelect.mockImplementation(() => { throw new Error('fail'); });
      await expect(getClausesByCBAId('cba1')).rejects.toThrow('Failed to fetch clauses');
    });
  });

  // ================================================================
  // listClauses
  // ================================================================
  describe('listClauses', () => {
    it('returns paginated results with defaults', async () => {
      mocks.mockSelect
        .mockReturnValueOnce(chain([{ count: 1 }]))
        .mockReturnValueOnce(chain([CLAUSE]));

      const result = await listClauses();
      expect(result).toEqual({ clauses: [CLAUSE], total: 1, page: 1, limit: 50 });
    });

    it('applies all filters', async () => {
      mocks.mockSelect
        .mockReturnValueOnce(chain([{ count: 0 }]))
        .mockReturnValueOnce(chain([]));

      const result = await listClauses({
        cbaId: 'cba1',
        clauseType: ['wages'],
        articleNumber: '12',
        confidenceMin: 0.8,
        searchQuery: 'wage',
      }, { page: 2, limit: 10 });
      expect(result.page).toBe(2);
      expect(result.limit).toBe(10);
    });
  });

  // ================================================================
  // CRUD
  // ================================================================
  describe('createClause', () => {
    it('inserts and returns clause', async () => {
      mocks.mockInsert.mockReturnValue(chain([CLAUSE]));
      const result = await createClause(CLAUSE as never);
      expect(result).toEqual(CLAUSE);
    });
  });

  describe('bulkCreateClauses', () => {
    it('inserts multiple clauses', async () => {
      mocks.mockInsert.mockReturnValue(chain([CLAUSE, { ...CLAUSE, id: 'cl2' }]));
      const result = await bulkCreateClauses([CLAUSE as never, CLAUSE as never]);
      expect(result).toHaveLength(2);
    });

    it('throws on error', async () => {
      mocks.mockInsert.mockImplementation(() => { throw new Error('fail'); });
      await expect(bulkCreateClauses([CLAUSE as never])).rejects.toThrow('Failed to bulk create clauses');
    });
  });

  describe('updateClause', () => {
    it('updates and returns clause', async () => {
      const updated = { ...CLAUSE, title: 'Updated Wage Rates' };
      mocks.mockUpdate.mockReturnValue(chain([updated]));
      const result = await updateClause('cl1', { title: 'Updated Wage Rates' } as never);
      expect(result).toEqual(updated);
    });

    it('returns null when not found', async () => {
      mocks.mockUpdate.mockReturnValue(chain([undefined]));
      expect(await updateClause('missing', {} as never)).toBeNull();
    });
  });

  describe('deleteClause', () => {
    it('deletes and returns true', async () => {
      mocks.mockDelete.mockReturnValue(chain());
      expect(await deleteClause('cl1')).toBe(true);
    });

    it('throws on error', async () => {
      mocks.mockDelete.mockImplementation(() => { throw new Error('fk'); });
      await expect(deleteClause('cl1')).rejects.toThrow('Failed to delete clause');
    });
  });

  // ================================================================
  // Search
  // ================================================================
  describe('searchClauses', () => {
    it('returns matching clauses', async () => {
      mocks.mockSelect.mockReturnValue(chain([CLAUSE]));
      const result = await searchClauses('wage');
      expect(result).toEqual([CLAUSE]);
    });

    it('applies clauseType and cbaId filters', async () => {
      mocks.mockSelect.mockReturnValue(chain([]));
      const result = await searchClauses('term', { clauseType: ['wages'], cbaId: 'cba1' }, 10);
      expect(result).toEqual([]);
    });
  });

  describe('getClausesByType', () => {
    it('returns clauses of given type', async () => {
      mocks.mockSelect.mockReturnValue(chain([CLAUSE]));
      const result = await getClausesByType('wages');
      expect(result).toEqual([CLAUSE]);
    });

    it('respects limit option', async () => {
      mocks.mockSelect.mockReturnValue(chain([]));
      const result = await getClausesByType('benefits', { limit: 5 });
      expect(result).toEqual([]);
    });
  });

  // ================================================================
  // Hierarchy
  // ================================================================
  describe('getClauseHierarchy', () => {
    it('returns clause with parent and children', async () => {
      const child = { ...CLAUSE, id: 'cl-child', parentClauseId: 'cl1' };
      const parent = { ...CLAUSE, id: 'cl-parent' };

      mocks.mockFindFirst
        .mockResolvedValueOnce({ ...CLAUSE, parentClauseId: 'cl-parent' }) // clause
        .mockResolvedValueOnce(parent); // parent
      mocks.mockSelect.mockReturnValue(chain([child]));

      const result = await getClauseHierarchy('cl1');
      expect(result.clause!.id).toBe('cl1');
      expect(result.parent!.id).toBe('cl-parent');
      expect(result.children).toHaveLength(1);
    });

    it('returns nulls when clause not found', async () => {
      mocks.mockFindFirst.mockResolvedValue(undefined);
      const result = await getClauseHierarchy('missing');
      expect(result).toEqual({ parent: null, clause: null, children: [] });
    });

    it('returns null parent when no parentClauseId', async () => {
      mocks.mockFindFirst.mockResolvedValue({ ...CLAUSE, parentClauseId: null });
      mocks.mockSelect.mockReturnValue(chain([]));

      const result = await getClauseHierarchy('cl1');
      expect(result.parent).toBeNull();
      expect(result.clause).toBeDefined();
    });
  });

  // ================================================================
  // Comparison
  // ================================================================
  describe('compareClauses', () => {
    it('compares clauses and finds type similarities', async () => {
      const clause2 = { ...CLAUSE, id: 'cl2', clauseType: 'wages' };
      mocks.mockSelect.mockReturnValue(chain([CLAUSE, clause2]));

      const result = await compareClauses({ clauseIds: ['cl1', 'cl2'], analysisType: 'all' });
      expect(result.clauses).toHaveLength(2);
      expect(result.similarities.length).toBeGreaterThan(0);
      expect(result.recommendations.length).toBeGreaterThan(0);
    });

    it('throws when no clauses found', async () => {
      mocks.mockSelect.mockReturnValue(chain([]));
      await expect(compareClauses({ clauseIds: ['x'], analysisType: 'all' })).rejects.toThrow('Failed to compare clauses');
    });
  });

  describe('saveClauseComparison', () => {
    it('saves and returns comparison', async () => {
      const saved = { id: 'cmp1', comparisonName: 'Test', clauseIds: ['cl1', 'cl2'] };
      mocks.mockInsert.mockReturnValue(chain([saved]));

      const result = await saveClauseComparison('Test', 'wages', ['cl1', 'cl2'], 'org-1', 'u1');
      expect(result).toEqual(saved);
    });
  });

  // ================================================================
  // Wage progressions
  // ================================================================
  describe('getWageProgressions', () => {
    it('returns progressions for CBA', async () => {
      mocks.mockSelect.mockReturnValue(chain([WAGE]));
      const result = await getWageProgressions('cba1');
      expect(result).toEqual([WAGE]);
    });

    it('filters by classification', async () => {
      mocks.mockSelect.mockReturnValue(chain([WAGE]));
      const result = await getWageProgressions('cba1', 'Clerk');
      expect(result).toEqual([WAGE]);
    });

    it('throws on error', async () => {
      mocks.mockSelect.mockImplementation(() => { throw new Error('fail'); });
      await expect(getWageProgressions('cba1')).rejects.toThrow('Failed to fetch wage progressions');
    });
  });

  describe('createWageProgression', () => {
    it('inserts and returns progression', async () => {
      mocks.mockInsert.mockReturnValue(chain([WAGE]));
      const result = await createWageProgression(WAGE as never);
      expect(result).toEqual(WAGE);
    });
  });

  // ================================================================
  // Analytics
  // ================================================================
  describe('getClauseTypeDistribution', () => {
    it('returns type distribution', async () => {
      const dist = [{ clauseType: 'wages', count: 5 }, { clauseType: 'benefits', count: 3 }];
      mocks.mockSelect.mockReturnValue(chain(dist));
      const result = await getClauseTypeDistribution('cba1');
      expect(result).toEqual(dist);
    });
  });

  describe('getMostViewedClauses', () => {
    it('returns clauses ordered by view count', async () => {
      mocks.mockSelect.mockReturnValue(chain([CLAUSE]));
      const result = await getMostViewedClauses();
      expect(result).toEqual([CLAUSE]);
    });

    it('filters by cbaId when provided', async () => {
      mocks.mockSelect.mockReturnValue(chain([CLAUSE]));
      const result = await getMostViewedClauses(5, 'cba1');
      expect(result).toEqual([CLAUSE]);
    });

    it('throws on error', async () => {
      mocks.mockSelect.mockImplementation(() => { throw new Error('fail'); });
      await expect(getMostViewedClauses()).rejects.toThrow('Failed to fetch most viewed clauses');
    });
  });

  // ================================================================
  // Batch 36: catch-block and branch coverage
  // ================================================================
  describe('Batch 36: catch-block and branch coverage', () => {
    it('createClause throws on error', async () => {
      mocks.mockInsert.mockImplementation(() => { throw new Error('fail'); });
      await expect(createClause(CLAUSE as never)).rejects.toThrow('Failed to create clause');
    });

    it('updateClause throws on error', async () => {
      mocks.mockUpdate.mockImplementation(() => { throw new Error('fail'); });
      await expect(updateClause('cl1', {} as never)).rejects.toThrow('Failed to update clause');
    });

    it('searchClauses throws on error', async () => {
      mocks.mockSelect.mockImplementation(() => { throw new Error('fail'); });
      await expect(searchClauses('test')).rejects.toThrow('Failed to search clauses');
    });

    it('getClausesByType throws on error', async () => {
      mocks.mockSelect.mockImplementation(() => { throw new Error('fail'); });
      await expect(getClausesByType('wages')).rejects.toThrow('Failed to fetch clauses by type');
    });

    it('getClauseHierarchy throws on error', async () => {
      mocks.mockFindFirst.mockRejectedValue(new Error('fail'));
      await expect(getClauseHierarchy('cl1')).rejects.toThrow('Failed to fetch clause hierarchy');
    });

    it('saveClauseComparison throws on error', async () => {
      mocks.mockInsert.mockImplementation(() => { throw new Error('fail'); });
      await expect(saveClauseComparison('Test', 'wages', ['cl1'], 'org-1', 'u1')).rejects.toThrow('Failed to save clause comparison');
    });

    it('getWageProgressions throws on error', async () => {
      mocks.mockSelect.mockImplementation(() => { throw new Error('fail'); });
      await expect(getWageProgressions('cba1')).rejects.toThrow('Failed to fetch wage progressions');
    });

    it('createWageProgression throws on error', async () => {
      mocks.mockInsert.mockImplementation(() => { throw new Error('fail'); });
      await expect(createWageProgression(WAGE as never)).rejects.toThrow('Failed to create wage progression');
    });

    it('getClauseTypeDistribution throws on error', async () => {
      mocks.mockSelect.mockImplementation(() => { throw new Error('fail'); });
      await expect(getClauseTypeDistribution('cba1')).rejects.toThrow('Failed to fetch clause type distribution');
    });

    it('listClauses throws on error', async () => {
      mocks.mockSelect.mockImplementation(() => { throw new Error('fail'); });
      await expect(listClauses()).rejects.toThrow('Failed to list clauses');
    });
  });
});
