import { describe, it, expect, vi, beforeEach } from 'vitest';

// === Hoisted mocks ===
const mocks = vi.hoisted(() => ({
  mockSelect: vi.fn(),
  mockFrom: vi.fn(),
  mockWhere: vi.fn(),
  mockLimit: vi.fn(),
  mockInsert: vi.fn(),
  mockValues: vi.fn(),
  mockUpdate: vi.fn(),
  mockSet: vi.fn(),
  mockOrderBy: vi.fn(),
  mockGroupBy: vi.fn(),
  mockFetch: vi.fn(),
}));

vi.mock('@/db/db', () => ({
  db: {
    select: mocks.mockSelect,
    insert: mocks.mockInsert,
    update: mocks.mockUpdate,
  },
}));

vi.mock('@/db/schema/clc-partnership-schema', () => ({
  clcPerCapitaBenchmarks: { id: 'id', organizationId: 'organizationId', fiscalYear: 'fiscalYear', perCapitaRate: 'perCapitaRate', organizationType: 'organizationType' },
  clcUnionDensity: { id: 'id', sector: 'sector', jurisdiction: 'jurisdiction', year: 'year' },
  clcBargainingTrends: { id: 'id', sector: 'sector', year: 'year', quarter: 'quarter' },
  clcSyncLog: { syncId: 'syncId', startedAt: 'startedAt' },
  clcOAuthTokens: { id: 'id', isActive: 'isActive', lastUsedAt: 'lastUsedAt', accessToken: 'accessToken', expiresAt: 'expiresAt', refreshToken: 'refreshToken' },
}));

vi.mock('drizzle-orm', () => ({
  eq: vi.fn((...args: unknown[]) => args),
  and: vi.fn((...args: unknown[]) => args),
  desc: vi.fn(),
  sql: vi.fn(),
  relations: vi.fn(() => ({})),
}));

vi.mock('uuid', () => ({ v4: vi.fn(() => 'test-uuid-1234') }));

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import { CLCPartnershipService } from '../clc-partnership-service';

describe('CLCPartnershipService', () => {
  let service: CLCPartnershipService;

  beforeEach(() => {
    vi.clearAllMocks();

    // Use plain arrow functions for chain intermediaries — only mockLimit/mockGroupBy need vi.fn()
    mocks.mockSelect.mockReturnValue({
      from: () => ({
        where: () => ({
          limit: mocks.mockLimit,
          orderBy: () => ({ limit: mocks.mockLimit }),
          groupBy: mocks.mockGroupBy,
        }),
        orderBy: () => ({ limit: mocks.mockLimit }),
        groupBy: mocks.mockGroupBy,
      }),
    });
    mocks.mockLimit.mockResolvedValue([]);
    mocks.mockGroupBy.mockResolvedValue([]);
    mocks.mockInsert.mockReturnValue({ values: mocks.mockValues });
    mocks.mockValues.mockResolvedValue(undefined);
    mocks.mockUpdate.mockReturnValue({ set: mocks.mockSet });
    mocks.mockSet.mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) });

    // Stub global fetch for OAuth token request — return no valid token
    global.fetch = mocks.mockFetch;
    mocks.mockFetch.mockResolvedValue({
      ok: false,
      status: 401,
      text: () => Promise.resolve('Unauthorized'),
    });

    service = new CLCPartnershipService();
  });

  describe('syncPerCapitaBenchmarks', () => {
    it('throws when OAuth token is unavailable', async () => {
      // getAccessToken relies on db returning empty + no env vars
      mocks.mockLimit.mockResolvedValue([]);

      await expect(service.syncPerCapitaBenchmarks({ fiscalYear: 2025 }))
        .rejects.toThrow();
    });

    it('creates a sync log entry', async () => {
      mocks.mockLimit.mockResolvedValue([]);

      try { await service.syncPerCapitaBenchmarks({}); } catch { /* expected */ }
      // Insert for sync log
      expect(mocks.mockInsert).toHaveBeenCalled();
    });

    it('accepts fiscalYear and jurisdiction params', async () => {
      mocks.mockLimit.mockResolvedValue([]);

      try { await service.syncPerCapitaBenchmarks({ fiscalYear: 2024, jurisdiction: 'ON' }); } catch { /* expected */ }
      expect(mocks.mockInsert).toHaveBeenCalled();
    });
  });

  describe('syncUnionDensity', () => {
    it('throws when OAuth token is unavailable', async () => {
      mocks.mockLimit.mockResolvedValue([]);

      await expect(service.syncUnionDensity({ year: 2025 }))
        .rejects.toThrow();
    });

    it('creates a sync log with correct type', async () => {
      mocks.mockLimit.mockResolvedValue([]);

      try { await service.syncUnionDensity({}); } catch { /* expected */ }
      expect(mocks.mockValues).toHaveBeenCalledWith(
        expect.objectContaining({ syncType: 'union_density', status: 'running' }),
      );
    });
  });

  describe('syncBargainingTrends', () => {
    it('throws when OAuth token is unavailable', async () => {
      mocks.mockLimit.mockResolvedValue([]);

      await expect(service.syncBargainingTrends({ year: 2025 }))
        .rejects.toThrow();
    });
  });

  describe('getBenchmarkComparison', () => {
    it('returns null when no organization data found', async () => {
      // Default chain from beforeEach returns [] for limit — getBenchmarkComparison returns null
      const result = await service.getBenchmarkComparison('org-1', 2025);
      expect(result).toBeNull();
    });

    it('returns comparison when data exists', async () => {
      const orgData = { id: '1', organizationId: 'org-1', perCapitaRate: '15.00' };
      // First select (org), second select (averages), third select (size comparison)
      mocks.mockSelect
        .mockReturnValueOnce({ from: vi.fn().mockReturnValue({ where: vi.fn().mockReturnValue({ limit: vi.fn().mockResolvedValue([orgData]) }) }) })
        .mockReturnValueOnce({ from: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue([{ nationalAvg: 14, provincialAvg: 13 }]) }) })
        .mockReturnValueOnce({ from: vi.fn().mockReturnValue({ where: vi.fn().mockReturnValue({ groupBy: vi.fn().mockResolvedValue([]) }) }) });

      const result = await service.getBenchmarkComparison('org-1', 2025);
      expect(result).not.toBeNull();
      expect(result!.organization).toEqual(orgData);
    });
  });

  describe('getSyncHistory', () => {
    it('returns sync log entries', async () => {
      const logs = [{ syncId: 's1' }];
      mocks.mockLimit.mockResolvedValueOnce(logs);

      const result = await service.getSyncHistory(5);
      expect(result).toEqual(logs);
    });
  });
});
