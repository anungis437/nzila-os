import { describe, it, expect, vi, beforeEach } from 'vitest';

// === Hoisted mocks ===
const mocks = vi.hoisted(() => ({
  mockSelect: vi.fn(),
  mockFrom: vi.fn(),
  mockWhere: vi.fn(),
  mockLimit: vi.fn(),
  mockOffset: vi.fn(),
  mockInsert: vi.fn(),
  mockValues: vi.fn(),
  mockUpdate: vi.fn(),
  mockSet: vi.fn(),
  mockOrderBy: vi.fn(),
}));

vi.mock('@/db/db', () => ({
  db: {
    select: mocks.mockSelect,
    insert: mocks.mockInsert,
    update: mocks.mockUpdate,
  },
}));

vi.mock('@/db/schema/lrb-agreements-schema', () => ({
  lrbAgreements: {
    id: 'id', source: 'source', sourceId: 'sourceId', employerName: 'employerName',
    unionName: 'unionName', jurisdiction: 'jurisdiction', sector: 'sector',
    status: 'status', effectiveDate: 'effectiveDate', expiryDate: 'expiryDate',
    hourlyWageRange: 'hourlyWageRange', annualSalaryRange: 'annualSalaryRange',
    employerAddress: 'employerAddress', unionCode: 'unionCode', bargainingUnit: 'bargainingUnit',
    bargainingUnitSize: 'bargainingUnitSize', pdfUrl: 'pdfUrl',
  },
  lrbSyncLog: { syncId: 'syncId', source: 'source', completedAt: 'completedAt', startedAt: 'startedAt' },
}));

vi.mock('drizzle-orm', () => ({
  eq: vi.fn((...args: any[]) => args),
  and: vi.fn((...args: any[]) => args),
  desc: vi.fn(),
  like: vi.fn(),
  sql: vi.fn(),
  relations: vi.fn(() => ({})),
}));

vi.mock('uuid', () => ({ v4: vi.fn(() => 'test-uuid-5678') }));

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import { UnifiedLRBService } from '../lrb-unified-service';

describe('UnifiedLRBService', () => {
  let service: UnifiedLRBService;

  beforeEach(() => {
    vi.clearAllMocks();

    // Use mockImplementation for chain mocks — shares mockLimit so tests can customize
    mocks.mockFrom.mockImplementation(() => ({
      where: vi.fn().mockImplementation(() => ({
        limit: mocks.mockLimit,
        orderBy: vi.fn().mockImplementation(() => ({
          limit: vi.fn().mockImplementation((_n: number) => ({
            offset: mocks.mockOffset,
          })),
        })),
      })),
      orderBy: vi.fn().mockImplementation(() => ({
        limit: vi.fn().mockImplementation(() => ({
          offset: mocks.mockOffset,
        })),
      })),
      groupBy: vi.fn().mockResolvedValue([]),
    }));
    mocks.mockSelect.mockReturnValue({ from: mocks.mockFrom });
    mocks.mockLimit.mockResolvedValue([]);
    mocks.mockOffset.mockResolvedValue([]);
    mocks.mockInsert.mockReturnValue({ values: mocks.mockValues });
    mocks.mockValues.mockResolvedValue(undefined);
    mocks.mockUpdate.mockReturnValue({ set: mocks.mockSet });
    mocks.mockSet.mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) });

    service = new UnifiedLRBService();
  });

  describe('syncOntario', () => {
    it('creates a sync log and processes agreements', async () => {
      // Simulate: no existing agreement found → insert path
      mocks.mockLimit.mockResolvedValue([]);
      mocks.mockValues.mockResolvedValue(undefined);

      const result = await service.syncOntario();

      expect(result.source).toBe('ontario_lrb');
      expect(result.success).toBe(true);
      expect(result.agreementsFound).toBeGreaterThan(0);
      expect(result.agreementsInserted).toBeGreaterThan(0);
      expect(mocks.mockInsert).toHaveBeenCalled();
    });

    it('updates existing agreements', async () => {
      // existing agreement found → update path
      mocks.mockLimit.mockResolvedValue([{ id: 'existing-1' }]);

      const result = await service.syncOntario();
      expect(result.agreementsUpdated).toBeGreaterThan(0);
    });

    it('returns a syncId', async () => {
      mocks.mockLimit.mockResolvedValue([]);
      const result = await service.syncOntario();
      expect(result.syncId).toContain('lrb_sync_');
    });
  });

  describe('syncBC', () => {
    it('creates a sync log and processes BC agreements', async () => {
      mocks.mockLimit.mockResolvedValue([]);

      const result = await service.syncBC();
      expect(result.source).toBe('bc_lrb');
      expect(result.success).toBe(true);
      expect(result.agreementsFound).toBeGreaterThan(0);
    });
  });

  describe('syncAll', () => {
    it('syncs both Ontario and BC', async () => {
      mocks.mockLimit.mockResolvedValue([]);

      const result = await service.syncAll();
      expect(result.ontario.source).toBe('ontario_lrb');
      expect(result.bc.source).toBe('bc_lrb');
      expect(result).toHaveProperty('totalInserted');
      expect(result).toHaveProperty('totalUpdated');
    });
  });

  describe('search', () => {
    it('returns paginated results', async () => {
      const agreements = [{ id: 'a1' }];
      mocks.mockSelect
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              orderBy: vi.fn().mockReturnValue({
                limit: vi.fn().mockReturnValue({
                  offset: vi.fn().mockResolvedValue(agreements),
                }),
              }),
            }),
          }),
        })
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([{ count: 1 }]),
          }),
        });

      const result = await service.search({ page: 1, limit: 10 });
      expect(result.agreements).toEqual(agreements);
      expect(result.total).toBe(1);
      expect(result.page).toBe(1);
    });

    it('applies source and employer filters', async () => {
      mocks.mockSelect
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              orderBy: vi.fn().mockReturnValue({
                limit: vi.fn().mockReturnValue({
                  offset: vi.fn().mockResolvedValue([]),
                }),
              }),
            }),
          }),
        })
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([{ count: 0 }]),
          }),
        });

      const result = await service.search({ source: 'ontario_lrb', employerName: 'CUPE' });
      expect(result.total).toBe(0);
    });
  });

  describe('getById', () => {
    it('returns agreement when found', async () => {
      const agr = { id: 'a1', employerName: 'Test Corp' };
      mocks.mockLimit.mockResolvedValue([agr]);

      const result = await service.getById('a1');
      expect(result).toEqual(agr);
    });

    it('returns null when not found', async () => {
      mocks.mockLimit.mockResolvedValue([]);
      const result = await service.getById('nonexistent');
      expect(result).toBeNull();
    });
  });

  describe('getWageComparisons', () => {
    it('returns active agreement comparisons', async () => {
      const comps = [{ employerName: 'Corp A', unionName: 'Union B' }];
      mocks.mockSelect.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue(comps),
            }),
          }),
        }),
      });

      const result = await service.getWageComparisons('NOC-1234');
      expect(result).toEqual(comps);
    });

    it('filters by jurisdiction when provided', async () => {
      mocks.mockSelect.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([]),
            }),
          }),
        }),
      });

      const result = await service.getWageComparisons('NOC-1234', 'ON');
      expect(result).toEqual([]);
    });
  });
});
