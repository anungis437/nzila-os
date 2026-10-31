import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
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
  eq: vi.fn((...args: any[]) => args),
  and: vi.fn((...args: any[]) => args),
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

    it('does not insert a clc_sync_log row when OAuth is unavailable', async () => {
      mocks.mockLimit.mockResolvedValue([]);

      try { await service.syncPerCapitaBenchmarks({}); } catch { /* expected */ }
      expect(mocks.mockInsert).not.toHaveBeenCalled();
      expect(mocks.mockUpdate).not.toHaveBeenCalled();
    });

    it('accepts fiscalYear and jurisdiction params without writing clc_sync_log', async () => {
      mocks.mockLimit.mockResolvedValue([]);

      try { await service.syncPerCapitaBenchmarks({ fiscalYear: 2024, jurisdiction: 'ON' }); } catch { /* expected */ }
      expect(mocks.mockInsert).not.toHaveBeenCalled();
      expect(mocks.mockUpdate).not.toHaveBeenCalled();
    });
  });

  describe('syncUnionDensity', () => {
    it('throws when OAuth token is unavailable', async () => {
      mocks.mockLimit.mockResolvedValue([]);

      await expect(service.syncUnionDensity({ year: 2025 }))
        .rejects.toThrow();
    });

    it('does not update clc_sync_log when OAuth is unavailable', async () => {
      mocks.mockLimit.mockResolvedValue([]);

      try { await service.syncUnionDensity({}); } catch { /* expected */ }
      expect(mocks.mockInsert).not.toHaveBeenCalled();
      expect(mocks.mockUpdate).not.toHaveBeenCalled();
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
    it('refuses to read every tenant sync log', async () => {
      await expect(service.getSyncHistory(5)).rejects.toThrow(/organization-scoped CLC routes/);
      expect(mocks.mockSelect).not.toHaveBeenCalled();
    });
  });
});

describe('clc partnership dependency', () => {
  const appRoot = path.resolve(__dirname, '../../../..');
  const servicePath = path.join(appRoot, 'lib/services/external-data/clc-partnership-service.ts');

  it('does not insert or update clc_sync_log', () => {
    const source = readFileSync(servicePath, 'utf8');
    expect(source).not.toMatch(/\.update\(\s*clcSyncLog\s*\)/);
    expect(source).not.toMatch(/\.insert\(\s*clcSyncLog\s*\)/);
  });

  it('has no production, dynamic, or worker importer', () => {
    const importer = /(?:from\s+['"][^'"]*clc-partnership-service|import\s*\(\s*['"][^'"]*clc-partnership-service|require\(\s*['"][^'"]*clc-partnership-service|\bclcPartnershipService\b|new\s+CLCPartnershipService)/;
    const allowed = new Set([
      'lib/services/external-data/clc-partnership-service.ts',
      'lib/services/external-data/__tests__/clc-partnership-service.test.ts',
    ]);
    const hits: string[] = [];
    const skip = new Set(['node_modules', '.next', 'dist', 'coverage', '.git']);
    const walk = (dir: string) => {
      for (const name of readdirSync(dir)) {
        if (skip.has(name)) continue;
        const full = path.join(dir, name);
        if (statSync(full).isDirectory()) {
          walk(full);
          continue;
        }
        if (!/\.(ts|tsx|js|mjs|py)$/.test(name)) continue;
        const rel = path.relative(appRoot, full).split(path.sep).join('/');
        if (allowed.has(rel)) continue;
        if (importer.test(readFileSync(full, 'utf8'))) hits.push(rel);
      }
    };
    walk(appRoot);
    expect(hits).toEqual([]);
    for (const rel of ['backend/billing/views.py', 'backend/billing/tests_round51_dead_service_containment.py']) {
      const text = readFileSync(path.join(appRoot, rel), 'utf8');
      expect(text).toMatch(/clc-partnership-service/);
      expect(text).not.toMatch(importer);
    }
  });
});
