import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

/* ------------------------------------------------------------------ */
/*  Hoisted mocks                                                     */
/* ------------------------------------------------------------------ */
const mocks = vi.hoisted(() => ({
  mockOrgFindFirst: vi.fn(),
  mockOrgFindMany: vi.fn(),
  mockClauseFindMany: vi.fn(),
  mockCacheGet: vi.fn(),
  mockCacheSet: vi.fn(),
}));

vi.mock('@/db/db', () => ({
  db: {
    query: {
      organizations: {
        findFirst: mocks.mockOrgFindFirst,
        findMany: mocks.mockOrgFindMany,
      },
      sharedClauseLibrary: {
        findMany: mocks.mockClauseFindMany,
      },
    },
  },
}));

vi.mock('@/db/schema', () => ({
  organizations: {
    id: 'id', name: 'name', organizationType: 'organizationType',
    provinceTerritory: 'provinceTerritory', status: 'status',
    memberCount: 'memberCount', clcAffiliated: 'clcAffiliated',
    sectors: 'sectors', parentId: 'parentId', hierarchyPath: 'hierarchyPath',
  },
  sharedClauseLibrary: {
    sharingLevel: 'sharingLevel', sector: 'sector',
    province: 'province', sourceOrganizationId: 'sourceOrganizationId',
    createdAt: 'createdAt',
  },
}));

vi.mock('drizzle-orm', () => ({
  eq: vi.fn((...a: unknown[]) => ({ _t: 'eq', _a: a })),
  and: vi.fn((...a: unknown[]) => ({ _t: 'and', _a: a })),
  or: vi.fn((...a: unknown[]) => ({ _t: 'or', _a: a })),
  inArray: vi.fn((...a: unknown[]) => ({ _t: 'inArray', _a: a })),
  gte: vi.fn((...a: unknown[]) => ({ _t: 'gte', _a: a })),
  sql: Object.assign(vi.fn((...a: unknown[]) => ({ _t: 'sql', _a: a })), { raw: vi.fn() }),
}));

vi.mock('@/lib/logger', () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
}));

vi.mock('@/lib/services/cache-service', () => ({
  cacheGet: mocks.mockCacheGet,
  cacheSet: mocks.mockCacheSet,
}));

/* ------------------------------------------------------------------ */
/*  Import SUT                                                        */
/* ------------------------------------------------------------------ */
import {
  autoDetectParentFederation,
  suggestRelevantClauses,
  findPeerOrganizations,
  getPeerBenchmarks,
  getSmartDefaults,
  runSmartOnboarding,
} from '@/lib/utils/smart-onboarding';

/* ------------------------------------------------------------------ */
/*  Fixtures                                                          */
/* ------------------------------------------------------------------ */
const ORG = {
  id: 'org-1',
  name: 'CUPE Local 123',
  organizationType: 'union',
  provinceTerritory: 'ON',
  status: 'active',
  memberCount: 1000,
  clcAffiliated: true,
  sectors: ['public'],
  parentId: 'fed-1',
  hierarchyPath: ['fed-1', 'congress-1'],
};

const FED = {
  id: 'fed-1',
  name: 'CUPE Ontario',
  organizationType: 'federation',
  provinceTerritory: 'ON',
  status: 'active',
  memberCount: 50000,
  clcAffiliated: true,
  sectors: ['public'],
};

const SHARED_CLAUSE = {
  id: 'sc-1',
  clauseTitle: 'Wage Grid',
  clauseType: 'wages',
  sharingLevel: 'federation',
  sector: 'public',
  province: 'ON',
  sourceOrganizationId: 'fed-1',
  createdAt: new Date(),
  sourceOrganization: { name: 'CUPE Ontario', organizationType: 'federation' },
};

/* ------------------------------------------------------------------ */
/*  Tests                                                             */
/* ------------------------------------------------------------------ */
describe('smart-onboarding', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.CLC_API_KEY;
    delete process.env.CLC_API_URL;
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    vi.restoreAllMocks();
  });

  // ================================================================
  // autoDetectParentFederation
  // ================================================================
  describe('autoDetectParentFederation', () => {
    it('returns scored federations for province match', async () => {
      mocks.mockOrgFindMany.mockResolvedValue([FED]);

      const results = await autoDetectParentFederation('ON', 'public', 1000);
      expect(results).toHaveLength(1);
      expect(results[0].id).toBe('fed-1');
      expect(results[0].matchScore).toBeGreaterThan(0);
      expect(results[0].matchReasons).toContain('Same province (ON)');
    });

    it('awards CLC affiliation score', async () => {
      mocks.mockOrgFindMany.mockResolvedValue([FED]);

      const results = await autoDetectParentFederation('ON', 'public');
      const r = results[0];
      expect(r.matchReasons).toContain('CLC affiliated');
    });

    it('awards organization type bonus for federation', async () => {
      mocks.mockOrgFindMany.mockResolvedValue([FED]);

      const results = await autoDetectParentFederation('ON', null);
      expect(results[0].matchReasons).toContain('Provincial federation');
    });

    it('calculates size proximity score', async () => {
      const fedWithCount = { ...FED, memberCount: 2000 };
      mocks.mockOrgFindMany.mockResolvedValue([fedWithCount]);

      const results = await autoDetectParentFederation('ON', null, 1000);
      expect(results[0].matchReasons).toContain('Similar size category');
    });

    it('returns empty array when no federations found', async () => {
      mocks.mockOrgFindMany.mockResolvedValue([]);
      const results = await autoDetectParentFederation('ON', 'public');
      expect(results).toEqual([]);
    });

    it('returns empty array on error', async () => {
      mocks.mockOrgFindMany.mockRejectedValue(new Error('db'));
      const results = await autoDetectParentFederation('ON', 'public');
      expect(results).toEqual([]);
    });

    it('sorts by match score descending', async () => {
      const fed2 = { ...FED, id: 'fed-2', name: 'CUPE BC', provinceTerritory: 'BC', clcAffiliated: false };
      mocks.mockOrgFindMany.mockResolvedValue([fed2, FED]);

      const results = await autoDetectParentFederation('ON', null);
      // FED (ON match + CLC + federation) should rank higher than fed2 (no province match, no CLC)
      expect(results[0].id).toBe('fed-1');
    });

    it('handles null province and null sector', async () => {
      mocks.mockOrgFindMany.mockResolvedValue([FED]);
      const results = await autoDetectParentFederation(null, null);
      expect(results).toHaveLength(1);
    });
  });

  // ================================================================
  // suggestRelevantClauses
  // ================================================================
  describe('suggestRelevantClauses', () => {
    it('returns scored clause suggestions', async () => {
      mocks.mockOrgFindFirst.mockResolvedValue(ORG);
      mocks.mockClauseFindMany.mockResolvedValue([SHARED_CLAUSE]);

      const results = await suggestRelevantClauses('org-1');
      expect(results).toHaveLength(1);
      expect(results[0].clauseId).toBe('sc-1');
      expect(results[0].relevanceScore).toBeGreaterThan(0);
      expect(results[0].sourceOrgName).toBe('CUPE Ontario');
    });

    it('scores federation-shared clauses higher than public', async () => {
      const publicClause = { ...SHARED_CLAUSE, id: 'sc-2', sharingLevel: 'public', sourceOrganizationId: 'other' };
      mocks.mockOrgFindFirst.mockResolvedValue(ORG);
      mocks.mockClauseFindMany.mockResolvedValue([SHARED_CLAUSE, publicClause]);

      const results = await suggestRelevantClauses('org-1');
      const fedResult = results.find(r => r.clauseId === 'sc-1');
      const pubResult = results.find(r => r.clauseId === 'sc-2');
      expect(fedResult!.relevanceScore).toBeGreaterThan(pubResult!.relevanceScore);
    });

    it('scores congress-level clauses highest', async () => {
      const congressClause = { ...SHARED_CLAUSE, id: 'sc-3', sharingLevel: 'congress', sourceOrganizationId: 'congress-1' };
      mocks.mockOrgFindFirst.mockResolvedValue(ORG);
      mocks.mockClauseFindMany.mockResolvedValue([congressClause]);

      const results = await suggestRelevantClauses('org-1');
      expect(results[0].relevanceReasons).toContain('Congress-level template');
    });

    it('awards hierarchy proximity score', async () => {
      mocks.mockOrgFindFirst.mockResolvedValue(ORG);
      mocks.mockClauseFindMany.mockResolvedValue([SHARED_CLAUSE]);

      const results = await suggestRelevantClauses('org-1');
      // sourceOrganizationId = 'fed-1' which is in hierarchyPath
      expect(results[0].relevanceReasons).toContain('From parent organization');
    });

    it('awards sector match score', async () => {
      mocks.mockOrgFindFirst.mockResolvedValue(ORG);
      mocks.mockClauseFindMany.mockResolvedValue([SHARED_CLAUSE]);

      const results = await suggestRelevantClauses('org-1');
      expect(results[0].relevanceReasons).toContain('Same sector (public)');
    });

    it('awards province match score', async () => {
      mocks.mockOrgFindFirst.mockResolvedValue(ORG);
      mocks.mockClauseFindMany.mockResolvedValue([SHARED_CLAUSE]);

      const results = await suggestRelevantClauses('org-1');
      expect(results[0].relevanceReasons).toContain('Same province (ON)');
    });

    it('returns empty array when org not found', async () => {
      mocks.mockOrgFindFirst.mockResolvedValue(null);
      const results = await suggestRelevantClauses('missing');
      expect(results).toEqual([]);
    });

    it('returns at most 20 suggestions', async () => {
      const clauses = Array.from({ length: 30 }, (_, i) => ({
        ...SHARED_CLAUSE,
        id: `sc-${i}`,
        sourceOrganizationId: 'other',
      }));
      mocks.mockOrgFindFirst.mockResolvedValue(ORG);
      mocks.mockClauseFindMany.mockResolvedValue(clauses);

      const results = await suggestRelevantClauses('org-1');
      expect(results.length).toBeLessThanOrEqual(20);
    });

    it('handles org with no sectors or province', async () => {
      const orgNoMeta = { ...ORG, sectors: [], provinceTerritory: null, hierarchyPath: [] };
      mocks.mockOrgFindFirst.mockResolvedValue(orgNoMeta);
      mocks.mockClauseFindMany.mockResolvedValue([SHARED_CLAUSE]);

      const results = await suggestRelevantClauses('org-1');
      expect(results).toHaveLength(1);
    });

    it('handles clause with no sourceOrganization', async () => {
      const clause = { ...SHARED_CLAUSE, sourceOrganization: null };
      mocks.mockOrgFindFirst.mockResolvedValue(ORG);
      mocks.mockClauseFindMany.mockResolvedValue([clause]);

      const results = await suggestRelevantClauses('org-1');
      expect(results[0].sourceOrgName).toBe('Unknown');
    });
  });

  // ================================================================
  // findPeerOrganizations
  // ================================================================
  describe('findPeerOrganizations', () => {
    it('returns peer IDs excluding self', async () => {
      const peer = { id: 'peer-1', sectors: ['public'] };
      mocks.mockOrgFindFirst.mockResolvedValue(ORG);
      mocks.mockOrgFindMany.mockResolvedValue([peer, { id: 'org-1', sectors: ['public'] }]);

      const peers = await findPeerOrganizations('org-1');
      expect(peers).toEqual(['peer-1']);
    });

    it('filters by sector when org has sectors', async () => {
      const peer1 = { id: 'peer-1', sectors: ['public'] };
      const peer2 = { id: 'peer-2', sectors: ['private'] };
      mocks.mockOrgFindFirst.mockResolvedValue(ORG);
      mocks.mockOrgFindMany.mockResolvedValue([peer1, peer2]);

      const peers = await findPeerOrganizations('org-1');
      // ORG.sectors = ['public'], so peer2 ('private') should be filtered out
      expect(peers).toEqual(['peer-1']);
    });

    it('returns empty array when org not found', async () => {
      mocks.mockOrgFindFirst.mockResolvedValue(null);
      const peers = await findPeerOrganizations('missing');
      expect(peers).toEqual([]);
    });

    it('returns empty array on error', async () => {
      mocks.mockOrgFindFirst.mockRejectedValue(new Error('db'));
      const peers = await findPeerOrganizations('org-1');
      expect(peers).toEqual([]);
    });

    it('handles org without sectors', async () => {
      const orgNoSectors = { ...ORG, sectors: [] };
      const peer = { id: 'peer-1', sectors: ['private'] };
      mocks.mockOrgFindFirst.mockResolvedValue(orgNoSectors);
      mocks.mockOrgFindMany.mockResolvedValue([peer]);

      const peers = await findPeerOrganizations('org-1');
      // No sector filter → all peers included (except self)
      expect(peers).toEqual(['peer-1']);
    });

    it('handles org without memberCount or province', async () => {
      const orgMinimal = { ...ORG, memberCount: null, provinceTerritory: null };
      mocks.mockOrgFindFirst.mockResolvedValue(orgMinimal);
      mocks.mockOrgFindMany.mockResolvedValue([]);

      const peers = await findPeerOrganizations('org-1');
      expect(peers).toEqual([]);
    });
  });

  // ================================================================
  // getPeerBenchmarks
  // ================================================================
  describe('getPeerBenchmarks', () => {
    it('returns member count benchmark with percentile', async () => {
      // getPeerBenchmarks calls:
      // 1. findFirst (org lookup)
      // 2. findPeerOrganizations → findFirst (org), findMany (peers)
      // 3. findMany (peer memberCounts)
      mocks.mockOrgFindFirst
        .mockResolvedValueOnce(ORG)  // getPeerBenchmarks org lookup
        .mockResolvedValueOnce(ORG); // findPeerOrganizations org lookup

      mocks.mockOrgFindMany
        .mockResolvedValueOnce([{ id: 'peer-1', sectors: ['public'] }, { id: 'peer-2', sectors: ['public'] }]) // findPeerOrganizations
        .mockResolvedValueOnce([{ memberCount: 800 }, { memberCount: 1200 }]); // peer member counts

      // CLC API key not set → fallback average
      mocks.mockCacheGet.mockResolvedValue(null);

      const benchmarks = await getPeerBenchmarks('org-1');
      expect(benchmarks).toHaveLength(1);
      expect(benchmarks[0].metricName).toBe('Member Count');
      expect(benchmarks[0].yourValue).toBe(1000);
      expect(benchmarks[0].peerAverage).toBe(1000); // (800+1200)/2
      expect(benchmarks[0].nationalAverage).toBe(2500); // fallback
      expect(benchmarks[0].percentile).toBeGreaterThanOrEqual(0);
    });

    it('uses cached national average', async () => {
      mocks.mockOrgFindFirst
        .mockResolvedValueOnce(ORG)
        .mockResolvedValueOnce(ORG);
      mocks.mockOrgFindMany
        .mockResolvedValueOnce([{ id: 'peer-1', sectors: ['public'] }])
        .mockResolvedValueOnce([{ memberCount: 900 }]);
      mocks.mockCacheGet.mockResolvedValue(3000);

      const benchmarks = await getPeerBenchmarks('org-1');
      expect(benchmarks[0].nationalAverage).toBe(3000);
      expect(mocks.mockCacheSet).not.toHaveBeenCalled();
    });

    it('returns empty array when org not found', async () => {
      mocks.mockOrgFindFirst.mockResolvedValue(null);
      const benchmarks = await getPeerBenchmarks('missing');
      expect(benchmarks).toEqual([]);
    });

    it('returns empty benchmarks when no peers', async () => {
      mocks.mockOrgFindFirst
        .mockResolvedValueOnce(ORG)
        .mockResolvedValueOnce(ORG);
      mocks.mockOrgFindMany.mockResolvedValue([]);

      const benchmarks = await getPeerBenchmarks('org-1');
      expect(benchmarks).toEqual([]);
    });

    it('returns empty on error', async () => {
      mocks.mockOrgFindFirst.mockRejectedValue(new Error('db'));
      const benchmarks = await getPeerBenchmarks('org-1');
      expect(benchmarks).toEqual([]);
    });
  });

  // ================================================================
  // getSmartDefaults (pure function)
  // ================================================================
  describe('getSmartDefaults', () => {
    it('returns small defaults for < 500 members', () => {
      const defaults = getSmartDefaults('local', 100);
      expect(defaults.suggestedRateLimits).toEqual({
        apiCallsPerDay: 1000,
        documentsPerMonth: 100,
        storageGb: 5,
      });
    });

    it('returns medium defaults for 500-1999 members', () => {
      const defaults = getSmartDefaults('union', 1000);
      expect(defaults.suggestedRateLimits.apiCallsPerDay).toBe(5000);
    });

    it('returns large defaults for 2000-9999 members', () => {
      const defaults = getSmartDefaults('federation', 5000);
      expect(defaults.suggestedRateLimits.apiCallsPerDay).toBe(20000);
    });

    it('returns enterprise defaults for 10000+ members', () => {
      const defaults = getSmartDefaults('congress', 50000);
      expect(defaults.suggestedRateLimits).toEqual({
        apiCallsPerDay: 100000,
        documentsPerMonth: 10000,
        storageGb: 500,
      });
    });

    it('defaults to 100 members when not provided', () => {
      const defaults = getSmartDefaults('local');
      // 100 < 500 → small
      expect(defaults.suggestedRateLimits.apiCallsPerDay).toBe(1000);
    });

    it('returns congress features', () => {
      const defaults = getSmartDefaults('congress');
      expect(defaults.recommendedFeatures).toContain('clc-integration');
      expect(defaults.recommendedFeatures).toContain('federation-management');
    });

    it('returns federation features', () => {
      const defaults = getSmartDefaults('federation');
      expect(defaults.recommendedFeatures).toContain('shared-clause-library');
    });

    it('returns union features', () => {
      const defaults = getSmartDefaults('union');
      expect(defaults.recommendedFeatures).toContain('grievance-management');
      expect(defaults.recommendedFeatures).toContain('dues-tracking');
    });

    it('returns local features by default for unknown type', () => {
      const defaults = getSmartDefaults('unknown_type');
      expect(defaults.recommendedFeatures).toContain('basic-grievance-tracking');
    });

    it('returns congress integrations', () => {
      const defaults = getSmartDefaults('congress');
      expect(defaults.suggestedIntegrations).toContain('clc-api');
      expect(defaults.suggestedIntegrations).toContain('statistics-canada');
    });

    it('returns local integrations by default for unknown type', () => {
      const defaults = getSmartDefaults('something_else');
      expect(defaults.suggestedIntegrations).toContain('google-workspace');
    });
  });

  // ================================================================
  // runSmartOnboarding
  // ================================================================
  describe('runSmartOnboarding', () => {
    it('returns full onboarding result', async () => {
      // runSmartOnboarding calls:
      // 1. findFirst (org) — the orchestrator lookup
      // 2. autoDetectParentFederation → findMany (federations)
      // 3. suggestRelevantClauses → findFirst (org) + clauseFindMany
      // 4. getPeerBenchmarks → findFirst (org) + findPeerOrganizations → findFirst + findMany + findMany (counts)

      const orgWithParent = { ...ORG, parentId: 'fed-1' };

      mocks.mockOrgFindFirst
        .mockResolvedValueOnce(orgWithParent)   // runSmartOnboarding
        .mockResolvedValueOnce(orgWithParent)   // suggestRelevantClauses
        .mockResolvedValueOnce(orgWithParent)   // getPeerBenchmarks
        .mockResolvedValueOnce(orgWithParent);  // findPeerOrganizations

      mocks.mockOrgFindMany
        .mockResolvedValueOnce([FED])  // autoDetectParentFederation
        .mockResolvedValueOnce([{ id: 'peer-1', sectors: ['public'] }]) // findPeerOrganizations
        .mockResolvedValueOnce([{ memberCount: 900 }]); // peer counts

      mocks.mockClauseFindMany.mockResolvedValue([SHARED_CLAUSE]);
      mocks.mockCacheGet.mockResolvedValue(null);

      const result = await runSmartOnboarding('org-1');
      expect(result.organization).toEqual(orgWithParent);
      expect(result.federationSuggestions.length).toBeGreaterThan(0);
      expect(result.smartDefaults.suggestedRateLimits).toBeDefined();
      expect(result.clauseSuggestions.length).toBeGreaterThan(0);
      expect(result.onboardingComplete.federationSelected).toBe(true);
    });

    it('skips clause suggestions when no parentId', async () => {
      const orgNoParent = { ...ORG, parentId: null };

      mocks.mockOrgFindFirst
        .mockResolvedValueOnce(orgNoParent)   // runSmartOnboarding
        .mockResolvedValueOnce(orgNoParent)   // getPeerBenchmarks
        .mockResolvedValueOnce(orgNoParent);  // findPeerOrganizations

      mocks.mockOrgFindMany
        .mockResolvedValueOnce([])  // autoDetectParentFederation (no federations)
        .mockResolvedValueOnce([]); // findPeerOrganizations

      mocks.mockCacheGet.mockResolvedValue(null);

      const result = await runSmartOnboarding('org-1');
      expect(result.clauseSuggestions).toEqual([]);
      expect(result.onboardingComplete.clausesImported).toBe(false);
      expect(mocks.mockClauseFindMany).not.toHaveBeenCalled();
    });

    it('throws when org not found', async () => {
      mocks.mockOrgFindFirst.mockResolvedValue(null);
      await expect(runSmartOnboarding('missing')).rejects.toThrow('Organization not found');
    });
  });
});
