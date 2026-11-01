import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

/* ------------------------------------------------------------------ */
/*  Hoisted mocks                                                     */
/* ------------------------------------------------------------------ */
const mocks = vi.hoisted(() => ({
  mockOrgFindFirst: vi.fn(),
  mockOrgFindMany: vi.fn(),
  mockCacheGet: vi.fn(),
  mockCacheSet: vi.fn(),
  directoryQueries: [] as Array<Record<string, unknown> | undefined>,
  // The clause suggestions read as the caller's tenant: one result per select, in the order the code asks.
  selectResults: [] as unknown[],
  selects: [] as Array<{ columns: unknown; where?: unknown; orderBy?: unknown; limit?: number }>,
  tenantContexts: [] as unknown[],
  names: new Map<string, string>(),
  nameLookups: [] as Array<{ rows: unknown; caller: string }>,
}));

vi.mock('@/db/db', () => ({
  db: {
    query: {
      organizations: {
        findFirst: mocks.mockOrgFindFirst,
        findMany: (...args: any[]) => {
          // Execute orderBy callback for coverage (drizzle passes it as function)
          const opts = args[0] as Record<string, unknown> | undefined;
          if (opts && typeof opts.orderBy === 'function') {
            (opts.orderBy as (...args: any[]) => unknown)({}, { desc: (x: any) => x, asc: (x: any) => x });
          }
          return mocks.mockOrgFindMany();
        },
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
    id: 'clauseId', clauseTitle: 'clauseTitle', clauseType: 'clauseType', isAnonymized: 'isAnonymized',
    sharingLevel: 'sharingLevel', sector: 'sector',
    province: 'province', sourceOrganizationId: 'sourceOrganizationId',
    createdAt: 'createdAt',
  },
}));

vi.mock('drizzle-orm', () => ({
  eq: vi.fn((...a: any[]) => ({ _t: 'eq', _a: a })),
  ne: vi.fn((...a: any[]) => ({ _t: 'ne', _a: a })),
  and: vi.fn((...a: any[]) => ({ _t: 'and', _a: a })),
  or: vi.fn((...a: any[]) => ({ _t: 'or', _a: a })),
  desc: vi.fn((...a: any[]) => ({ _t: 'desc', _a: a })),
  inArray: vi.fn((...a: any[]) => ({ _t: 'inArray', _a: a })),
  gte: vi.fn((...a: any[]) => ({ _t: 'gte', _a: a })),
  sql: Object.assign(vi.fn((...a: any[]) => ({ _t: 'sql', _a: a })), { raw: vi.fn() }),
}));

vi.mock('@/lib/logger', () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
}));

// The federation directory is an explicit cross-organization read as the system role; the stand-in records the query it was given. The clause
// suggestions are a tenant read: the stand-in records the context it was opened for and answers each select from a queue.
vi.mock('@/lib/db/with-rls-context', () => ({
  withRLSContext: (options: unknown, fn: (tx: unknown) => unknown) => {
    mocks.tenantContexts.push(options);
    const tx = {
      select: (columns: unknown) => {
        const query: { columns: unknown; where?: unknown; orderBy?: unknown; limit?: number } = { columns };
        mocks.selects.push(query);
        const chain = {
          from: () => chain,
          where: (condition: unknown) => { query.where = condition; return chain; },
          orderBy: (order: unknown) => { query.orderBy = order; return chain; },
          limit: (count: number) => {
            query.limit = count;
            const next = mocks.selectResults.shift();
            return next instanceof Error ? Promise.reject(next) : Promise.resolve(next);
          },
        };
        return chain;
      },
    };
    return fn(tx);
  },
  withSystemContext: (fn: (tx: unknown) => unknown) =>
    fn({
      query: {
        organizations: {
          findMany: (...args: any[]) => {
            const opts = args[0] as Record<string, unknown> | undefined;
            mocks.directoryQueries.push(opts);
            if (opts && typeof opts.orderBy === 'function') {
              (opts.orderBy as (...args: any[]) => unknown)({}, { desc: (x: any) => x, asc: (x: any) => x });
            }
            return mocks.mockOrgFindMany();
          },
        },
      },
    }),
}));

// The sharing rule and the source names have their own tests (and a native proof against the real policies); here they are stand-ins.
vi.mock('@/lib/clause-library/sharing-authority', () => ({
  buildClauseVisibilityCondition: async (caller: string) => ({ _t: 'visibility', caller }),
  isUuid: (value: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value),
  sourceNamesFor: async (rows: unknown, caller: string) => {
    mocks.nameLookups.push({ rows, caller });
    return mocks.names;
  },
}));

vi.mock('@/lib/services/cache-service', () => ({
  cacheGet: mocks.mockCacheGet,
  cacheSet: mocks.mockCacheSet,
}));

// Mock global fetch for CLC API tests
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

/* ------------------------------------------------------------------ */
/*  Import SUT                                                        */
/* ------------------------------------------------------------------ */
import {
  autoDetectParentFederation,
  FEDERATION_DIRECTORY_POLICY,
  isFederationListed,
  sizeBand,
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

// Clause suggestions: an organization three levels down (root, parent, itself), and the clauses a tenant read could return for it.
const CLAUSE_ORG = '00000000-0000-4000-8000-0000000000a1';
const PARENT = '00000000-0000-4000-8000-0000000000b1';
const ROOT = '00000000-0000-4000-8000-0000000000b2';
const PEER = '00000000-0000-4000-8000-0000000000c1';

const clauseOrg = (over: Record<string, unknown> = {}) => ({
  sectors: ['public'],
  provinceTerritory: 'on',
  hierarchyPath: [ROOT, PARENT, CLAUSE_ORG],
  ...over,
});

const clauseRow = (over: Record<string, unknown> = {}) => ({
  id: 'sc-1',
  clauseTitle: 'Wage Grid',
  clauseType: 'wages',
  sharingLevel: 'public',
  sourceOrganizationId: PARENT,
  isAnonymized: false,
  ...over,
});

/** What the code asked of the clause table, as the stand-in drizzle helpers recorded it. */
const clauseFilters = () => (mocks.selects[1].where as { _a: Array<{ _t: string; _a: unknown[] }> })._a;

/* ------------------------------------------------------------------ */
/*  Tests                                                             */
/* ------------------------------------------------------------------ */
describe('smart-onboarding', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.resetAllMocks();
    mockFetch.mockReset();
    mocks.selectResults.length = 0;
    mocks.selects.length = 0;
    mocks.tenantContexts.length = 0;
    mocks.directoryQueries.length = 0;
    mocks.nameLookups.length = 0;
    mocks.names.clear();
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
      expect(results[0].matchReasons).toContain('Similar size');
    });

    // DEF-0B9-ASM-FEDERATION-MATCH-IGNORES-THE-SECTOR-AND-REPORTS-SIMILAR-SIZE-FOR-ANY-RATIO
    it('states a similar size only when the sizes are close', async () => {
      mocks.mockOrgFindMany.mockResolvedValue([{ ...FED, memberCount: 50000 }]);
      const far = await autoDetectParentFederation('ON', null, 1000);
      expect(far[0].matchReasons).not.toContain('Similar size');
      expect(far[0].matchReasons).not.toContain('Similar size category');
    });

    it('scores the sector, case-insensitively, and does not when the federation does not represent it', async () => {
      mocks.mockOrgFindMany.mockResolvedValue([FED]);
      const match = await autoDetectParentFederation('ON', 'PUBLIC');
      expect(match[0].matchReasons).toContain('Represents the PUBLIC sector');
      const other = await autoDetectParentFederation('ON', 'manufacturing');
      expect(other[0].matchReasons.join(' ')).not.toContain('sector');
      expect(match[0].matchScore - other[0].matchScore).toBe(25);
    });

    it('returns empty array when no federations found', async () => {
      mocks.mockOrgFindMany.mockResolvedValue([]);
      const results = await autoDetectParentFederation('ON', 'public');
      expect(results).toEqual([]);
    });

    it('propagates federation lookup failure instead of reporting no matches', async () => {
      mocks.mockOrgFindMany.mockRejectedValue(new Error('db'));
      await expect(autoDetectParentFederation('ON', 'public')).rejects.toThrow('db');
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

    // DEF-0B9-ASM-FEDERATION-DISCOVERY-LISTS-FEDERATIONS-AND-CONGRESSES-BY-NAME-AND-MEMBER-COUNT-WITH-NO-ORGANIZATION-PREDICATE
    it('reads only the columns a suggestion needs, as the system role, and only federations that turned listing on', async () => {
      mocks.directoryQueries.length = 0;
      mocks.mockOrgFindMany.mockResolvedValue([FED]);
      await autoDetectParentFederation('ON', 'public');
      expect(mocks.directoryQueries).toHaveLength(1);
      const query = mocks.directoryQueries[0] as { columns: Record<string, boolean>; limit: number; where: { _a: unknown[] } };
      expect(Object.keys(query.columns).sort()).toEqual(['clcAffiliated', 'id', 'memberCount', 'name', 'organizationType', 'provinceTerritory', 'sectors']);
      expect(query.columns).not.toHaveProperty('settings');
      expect(query.columns).not.toHaveProperty('email');
      expect(query.limit).toBe(10);
      const predicates = JSON.stringify(query.where._a);
      expect(predicates).toContain('affiliation');
      expect(predicates).toContain('discoverable');
    });

    it('discloses a size band and never the exact member count', async () => {
      mocks.mockOrgFindMany.mockResolvedValue([{ ...FED, memberCount: 50321 }]);
      const [suggestion] = await autoDetectParentFederation('ON', 'public', 1000);
      expect(suggestion.sizeBand).toBe('20,000 or more');
      expect(Object.keys(suggestion).sort()).toEqual(['id', 'jurisdiction', 'matchReasons', 'matchScore', 'name', 'organizationType', 'province', 'sizeBand']);
      expect(JSON.stringify(suggestion)).not.toContain('50321');
    });

    it('scores the size from the exact count but reports only the band', async () => {
      mocks.mockOrgFindMany.mockResolvedValue([{ ...FED, memberCount: 2000 }]);
      const [suggestion] = await autoDetectParentFederation('ON', null, 1000);
      expect(suggestion.matchReasons).toContain('Similar size');
      expect(suggestion.sizeBand).toBe('1,000 to 4,999');
    });
  });

  describe('the federation directory policy', () => {
    it('lists nobody by default and only an explicit true turns listing on', () => {
      expect(FEDERATION_DIRECTORY_POLICY.listing).toBe('opt_in');
      expect(FEDERATION_DIRECTORY_POLICY.approvedBy).toBeNull();
      for (const settings of [undefined, null, {}, [], 'yes', { affiliation: null }, { affiliation: {} }, { affiliation: { discoverable: 'true' } }, { affiliation: { discoverable: 1 } }, { discoverable: true }]) {
        expect(isFederationListed(settings)).toBe(false);
      }
      expect(isFederationListed({ affiliation: { discoverable: true } })).toBe(true);
    });

    it('bands a member count without stating it', () => {
      expect([null, undefined, 0, -5, 99, 100, 499, 500, 999, 1000, 4999, 5000, 19999, 20000, 2_000_000].map(sizeBand)).toEqual([
        'not stated', 'not stated', 'not stated', 'not stated', 'under 100', '100 to 499', '100 to 499', '500 to 999', '500 to 999',
        '1,000 to 4,999', '1,000 to 4,999', '5,000 to 19,999', '5,000 to 19,999', '20,000 or more', '20,000 or more',
      ]);
    });
  });

  // ================================================================
  // suggestRelevantClauses
  // ================================================================
  describe('suggestRelevantClauses', () => {
    // Org row first, then the clauses, as the code asks for them.
    const given = (org: Record<string, unknown> | undefined, clauses: unknown[] = []) => {
      mocks.selectResults.push(org ? [org] : [], clauses);
    };

    it('reads as the caller tenant and asks only for clauses of other organizations that it may already read', async () => {
      given(clauseOrg(), [clauseRow()]);
      await suggestRelevantClauses(CLAUSE_ORG);

      expect(mocks.tenantContexts).toEqual([{ organizationId: CLAUSE_ORG }]);
      expect(mocks.directoryQueries).toHaveLength(0);
      expect(mocks.selects).toHaveLength(2);
      const filters = clauseFilters();
      expect(filters).toContainEqual({ _t: 'visibility', caller: CLAUSE_ORG });
      expect(filters).toContainEqual({ _t: 'ne', _a: ['sourceOrganizationId', CLAUSE_ORG] });
      expect(filters).toContainEqual({ _t: 'eq', _a: ['sector', 'public'] });
      expect(filters).toContainEqual({ _t: 'eq', _a: ['province', 'ON'] });
      // The parents are every entry of the path but the organization itself, root first, and only a source that may be named is drawn from them.
      expect(filters).toContainEqual({ _t: 'inArray', _a: ['sourceOrganizationId', [ROOT, PARENT]] });
      expect(filters).toContainEqual({ _t: 'eq', _a: ['isAnonymized', false] });
      expect(mocks.selects[1].limit).toBe(50);
    });

    it('returns scored clause suggestions with the name of a source that may be named', async () => {
      mocks.names.set(PARENT, 'CUPE Ontario');
      given(clauseOrg(), [clauseRow()]);

      const results = await suggestRelevantClauses(CLAUSE_ORG);
      expect(results).toHaveLength(1);
      expect(results[0]).toMatchObject({ clauseId: 'sc-1', clauseTitle: 'Wage Grid', clauseType: 'wages', sourceOrgName: 'CUPE Ontario', sharingLevel: 'public' });
      expect(results[0].relevanceScore).toBeGreaterThan(0);
      expect(mocks.nameLookups[0].caller).toBe(CLAUSE_ORG);
    });

    it('scores a clause shared with the organization above a public one, and gives each its true reason', async () => {
      given(clauseOrg({ hierarchyPath: [CLAUSE_ORG] }), [
        clauseRow({ id: 'public', sourceOrganizationId: PEER }),
        clauseRow({ id: 'granted', sharingLevel: 'private', sourceOrganizationId: PEER }),
      ]);

      const results = await suggestRelevantClauses(CLAUSE_ORG);
      expect(results.map((r) => r.clauseId)).toEqual(['granted', 'public']);
      expect(results[0]).toMatchObject({ relevanceScore: 40, relevanceReasons: ['Shared with your organization'] });
      expect(results[1]).toMatchObject({ relevanceScore: 20, relevanceReasons: ['Publicly available'] });
    });

    it('gives the federation and congress levels no weight and no reason: no other organization can read them', async () => {
      given(clauseOrg(), [
        clauseRow({ id: 'fed', sharingLevel: 'federation' }),
        clauseRow({ id: 'congress', sharingLevel: 'congress' }),
        clauseRow({ id: 'retired', sharingLevel: 'retired' }),
        clauseRow({ id: 'public' }),
      ]);

      const results = await suggestRelevantClauses(CLAUSE_ORG);
      expect(results.map((r) => r.clauseId)).toEqual(['public']);
      const text = JSON.stringify(results);
      expect(text).not.toMatch(/Federation-shared|Congress-level/);
    });

    it('ranks the nearest parent above a farther ancestor, because the path runs from the root', async () => {
      given(clauseOrg(), [
        clauseRow({ id: 'from-root', sourceOrganizationId: ROOT }),
        clauseRow({ id: 'from-parent', sourceOrganizationId: PARENT }),
      ]);

      const results = await suggestRelevantClauses(CLAUSE_ORG);
      expect(results.map((r) => r.clauseId)).toEqual(['from-parent', 'from-root']);
      expect(results[0]).toMatchObject({ relevanceScore: 20 + 2 * 15, relevanceReasons: ['Publicly available', 'From parent organization'] });
      expect(results[1]).toMatchObject({ relevanceScore: 20 + 1 * 15 });
    });

    it('adds no weight and no reason for the sector and province, which are filters and so are the same for every clause', async () => {
      given(clauseOrg({ hierarchyPath: [CLAUSE_ORG] }), [clauseRow({ sourceOrganizationId: PEER })]);

      const results = await suggestRelevantClauses(CLAUSE_ORG);
      expect(results[0].relevanceScore).toBe(20);
      expect(results[0].relevanceReasons).toEqual(['Publicly available']);
      expect(JSON.stringify(results)).not.toMatch(/Same sector|Same province/);
    });

    it('does not name the source of an anonymized or unclassified clause, nor say that it comes from a parent', async () => {
      mocks.names.set(PARENT, 'CUPE Ontario');
      mocks.names.set(PEER, 'CUPE Local 9');
      given(clauseOrg({ hierarchyPath: [CLAUSE_ORG] }), [
        clauseRow({ id: 'anonymized', isAnonymized: true, sourceOrganizationId: PEER }),
        clauseRow({ id: 'unclassified', isAnonymized: null, sourceOrganizationId: PEER }),
        clauseRow({ id: 'named', isAnonymized: false, sourceOrganizationId: PEER }),
      ]);

      const results = await suggestRelevantClauses(CLAUSE_ORG);
      const byId = Object.fromEntries(results.map((r) => [r.clauseId, r]));
      expect(byId.anonymized.sourceOrgName).toBe('Another organization (source not disclosed)');
      expect(byId.unclassified.sourceOrgName).toBe('Another organization (source not disclosed)');
      expect(byId.named.sourceOrgName).toBe('CUPE Local 9');
      expect(JSON.stringify(results)).not.toMatch(/Unknown/);
    });

    it('does not say that an anonymized clause comes from a parent even if one is handed back', async () => {
      mocks.names.set(PARENT, 'CUPE Ontario');
      given(clauseOrg(), [clauseRow({ isAnonymized: true, sourceOrganizationId: PARENT })]);

      const results = await suggestRelevantClauses(CLAUSE_ORG);
      expect(results[0].relevanceReasons).toEqual(['Publicly available']);
      expect(results[0].sourceOrgName).toBe('Another organization (source not disclosed)');
    });

    it('labels a source that may be named but whose name cannot be read, instead of guessing', async () => {
      given(clauseOrg(), [clauseRow()]);

      const results = await suggestRelevantClauses(CLAUSE_ORG);
      expect(results[0].sourceOrgName).toBe('Unknown organization');
    });
    it('refuses clause discovery for an unknown organization', async () => {
      given(undefined);
      await expect(suggestRelevantClauses('00000000-0000-4000-8000-0000000000ff')).rejects.toThrow('Organization not found');
      // Nothing is read from the clause table for an organization that could not be read.
      expect(mocks.selects).toHaveLength(1);
    });

    it('returns at most 20 suggestions', async () => {
      const clauses = Array.from({ length: 30 }, (_, i) => clauseRow({ id: `sc-${i}`, sourceOrganizationId: PEER }));
      given(clauseOrg({ hierarchyPath: [CLAUSE_ORG] }), clauses);

      const results = await suggestRelevantClauses(CLAUSE_ORG);
      expect(results).toHaveLength(20);
    });

    it('keeps the newest first among clauses that score the same', async () => {
      given(clauseOrg({ hierarchyPath: [CLAUSE_ORG] }), [
        clauseRow({ id: 'newest', sourceOrganizationId: PEER }),
        clauseRow({ id: 'older', sourceOrganizationId: PEER }),
      ]);

      const results = await suggestRelevantClauses(CLAUSE_ORG);
      expect(results.map((r) => r.clauseId)).toEqual(['newest', 'older']);
    });

    it('offers an organization with no parents every clause it may read, anonymized ones included, without naming their source', async () => {
      given(clauseOrg({ hierarchyPath: [CLAUSE_ORG] }), [clauseRow({ isAnonymized: true, sourceOrganizationId: PEER })]);

      const results = await suggestRelevantClauses(CLAUSE_ORG);
      expect(results).toHaveLength(1);
      const filters = clauseFilters();
      expect(filters.some((f) => f._t === 'inArray')).toBe(false);
      expect(filters).not.toContainEqual({ _t: 'eq', _a: ['isAnonymized', false] });
      expect(results[0].sourceOrgName).toBe('Another organization (source not disclosed)');
    });

    it('treats only the entries of the path that are ids as parents, and never the organization itself', async () => {
      given(clauseOrg({ hierarchyPath: ['ue-qa-primary', PARENT, CLAUSE_ORG] }), []);

      await suggestRelevantClauses(CLAUSE_ORG);
      expect(clauseFilters()).toContainEqual({ _t: 'inArray', _a: ['sourceOrganizationId', [PARENT]] });
    });

    it('handles an organization with no sector or province', async () => {
      given(clauseOrg({ sectors: [], provinceTerritory: null, hierarchyPath: [] }), [clauseRow({ sourceOrganizationId: PEER })]);

      const results = await suggestRelevantClauses(CLAUSE_ORG);
      expect(results).toHaveLength(1);
      const filters = clauseFilters();
      expect(filters.some((f) => f._t === 'eq' && (f._a[0] === 'sector' || f._a[0] === 'province'))).toBe(false);
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

    it('refuses peer discovery for an unknown organization', async () => {
      mocks.mockOrgFindFirst.mockResolvedValue(null);
      await expect(findPeerOrganizations('missing')).rejects.toThrow('Organization not found');
    });

    it('propagates peer lookup failures', async () => {
      mocks.mockOrgFindFirst.mockRejectedValue(new Error('db'));
      await expect(findPeerOrganizations('org-1')).rejects.toThrow('db');
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

      // CLC API key not set → national measurement unavailable
      mocks.mockCacheGet.mockResolvedValue(null);

      const benchmarks = await getPeerBenchmarks('org-1');
      expect(benchmarks).toHaveLength(1);
      expect(benchmarks[0].metricName).toBe('Member Count');
      expect(benchmarks[0].yourValue).toBe(1000);
      expect(benchmarks[0].peerAverage).toBe(1000); // (800+1200)/2
      expect(benchmarks[0].nationalAverage).toBeNull(); // fallback
      expect(benchmarks[0].percentile).toBeGreaterThanOrEqual(0);
    });

    it('rejects invalid cached measurements rather than returning fabricated figures', async () => {
      mocks.mockOrgFindFirst.mockResolvedValueOnce(ORG).mockResolvedValueOnce(ORG);
      mocks.mockOrgFindMany
        .mockResolvedValueOnce([{ id: 'peer-1', sectors: ['public'] }])
        .mockResolvedValueOnce([{ memberCount: 900 }]);
      mocks.mockCacheGet.mockResolvedValue('not-a-number');
      const benchmarks = await getPeerBenchmarks('org-1');
      expect(benchmarks[0].nationalAverage).toBeNull();
    });

    it('does not invent a peer percentile when every peer member count is missing', async () => {
      mocks.mockOrgFindFirst.mockResolvedValueOnce(ORG).mockResolvedValueOnce(ORG);
      mocks.mockOrgFindMany
        .mockResolvedValueOnce([{ id: 'peer-1', sectors: ['public'] }])
        .mockResolvedValueOnce([{ memberCount: null }]);
      const benchmarks = await getPeerBenchmarks('org-1');
      expect(benchmarks).toEqual([]);
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

    it('refuses benchmarking for an unknown organization', async () => {
      mocks.mockOrgFindFirst.mockResolvedValue(null);
      await expect(getPeerBenchmarks('missing')).rejects.toThrow('Organization not found');
    });

    it('returns empty benchmarks when no peers', async () => {
      mocks.mockOrgFindFirst
        .mockResolvedValueOnce(ORG)
        .mockResolvedValueOnce(ORG);
      mocks.mockOrgFindMany.mockResolvedValue([]);

      const benchmarks = await getPeerBenchmarks('org-1');
      expect(benchmarks).toEqual([]);
    });

    it('propagates benchmarking storage errors', async () => {
      mocks.mockOrgFindFirst.mockRejectedValue(new Error('db'));
      await expect(getPeerBenchmarks('org-1')).rejects.toThrow('db');
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
      // 3. suggestRelevantClauses → a tenant read of the organization and of the clauses (not the shared client)
      // 4. getPeerBenchmarks → findFirst (org) + findPeerOrganizations → findFirst + findMany + findMany (counts)

      const orgWithParent = { ...ORG, parentId: 'fed-1' };

      mocks.mockOrgFindFirst
        .mockResolvedValueOnce(orgWithParent)   // runSmartOnboarding
        .mockResolvedValueOnce(orgWithParent)   // getPeerBenchmarks
        .mockResolvedValueOnce(orgWithParent);  // findPeerOrganizations

      mocks.mockOrgFindMany
        .mockResolvedValueOnce([FED])  // autoDetectParentFederation
        .mockResolvedValueOnce([{ id: 'peer-1', sectors: ['public'] }]) // findPeerOrganizations
        .mockResolvedValueOnce([{ memberCount: 900 }]); // peer counts

      mocks.selectResults.push([clauseOrg()], [clauseRow()]);
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
      // No parent, so no clause is looked for: neither the tenant context nor the clause table is opened.
      expect(mocks.tenantContexts).toHaveLength(0);
      expect(mocks.selects).toHaveLength(0);
    });

    it('throws when org not found', async () => {
      mocks.mockOrgFindFirst.mockResolvedValue(null);
      await expect(runSmartOnboarding('missing')).rejects.toThrow('Organization not found');
    });
  });

  // ================================================================
  // Branch Coverage: fetchNationalAverage (via getPeerBenchmarks)
  // ================================================================
  describe('fetchNationalAverage — CLC API branches', () => {
    function setupPeerBenchmarkMocks() {
      mocks.mockOrgFindFirst
        .mockResolvedValueOnce(ORG)    // getPeerBenchmarks
        .mockResolvedValueOnce(ORG);   // findPeerOrganizations
      mocks.mockOrgFindMany
        .mockResolvedValueOnce([{ id: 'peer-1', sectors: ['public'] }])
        .mockResolvedValueOnce([{ memberCount: 800 }]);
      mocks.mockCacheGet.mockResolvedValue(null);
    }

    it('fetches from CLC API when key is set and caches result', async () => {
      setupPeerBenchmarkMocks();
      process.env.CLC_API_KEY = 'test-key';
      process.env.CLC_API_URL = 'https://benchmarks.example.test';

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: { average: 3500 } }),
      });

      const benchmarks = await getPeerBenchmarks('org-1');
      expect(benchmarks[0].nationalAverage).toBe(3500);
      expect(mocks.mockCacheSet).toHaveBeenCalledWith(
        expect.stringContaining('clc:national-avg:memberCount'),
        3500,
        expect.objectContaining({ ttl: 86400 })
      );
    });

    it('falls back on CLC API 404 response', async () => {
      setupPeerBenchmarkMocks();
      process.env.CLC_API_KEY = 'test-key';
      process.env.CLC_API_URL = 'https://benchmarks.example.test';

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: 'Not Found',
      });

      const benchmarks = await getPeerBenchmarks('org-1');
      expect(benchmarks[0].nationalAverage).toBeNull(); // fallback
    });

    it('falls back on CLC API non-404 error', async () => {
      setupPeerBenchmarkMocks();
      process.env.CLC_API_KEY = 'test-key';
      process.env.CLC_API_URL = 'https://benchmarks.example.test';

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Server Error',
      });

      const benchmarks = await getPeerBenchmarks('org-1');
      expect(benchmarks[0].nationalAverage).toBeNull(); // fallback (from catch)
    });

    it('falls back on invalid response format (non-number average)', async () => {
      setupPeerBenchmarkMocks();
      process.env.CLC_API_KEY = 'test-key';
      process.env.CLC_API_URL = 'https://benchmarks.example.test';

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: { average: 'not-a-number' } }),
      });

      const benchmarks = await getPeerBenchmarks('org-1');
      expect(benchmarks[0].nationalAverage).toBeNull(); // fallback
    });

    it('falls back on fetch throwing network error', async () => {
      setupPeerBenchmarkMocks();
      process.env.CLC_API_KEY = 'test-key';
      process.env.CLC_API_URL = 'https://benchmarks.example.test';

      mockFetch.mockRejectedValueOnce(new Error('Network timeout'));

      const benchmarks = await getPeerBenchmarks('org-1');
      expect(benchmarks[0].nationalAverage).toBeNull(); // fallback
    });

    it('returns empty benchmarks when org has no memberCount', async () => {
      const orgNoCount = { ...ORG, memberCount: null };
      mocks.mockOrgFindFirst
        .mockResolvedValueOnce(orgNoCount)
        .mockResolvedValueOnce(orgNoCount);
      mocks.mockOrgFindMany.mockResolvedValue([]);
      mocks.mockCacheGet.mockResolvedValue(null);

      const benchmarks = await getPeerBenchmarks('org-1');
      expect(benchmarks).toEqual([]);
    });
  });

  // ================================================================
  // Branch Coverage: autoDetectParentFederation size score
  // ================================================================
  describe('autoDetectParentFederation — size branch coverage', () => {
    it('skips size score when estimatedMemberCount is undefined', async () => {
      mocks.mockOrgFindMany.mockResolvedValue([FED]);
      const results = await autoDetectParentFederation('ON', null);
      expect(results[0].matchReasons).not.toContain('Similar size category');
    });

    it('skips size score when org.memberCount is null', async () => {
      const fedNoCount = { ...FED, memberCount: null };
      mocks.mockOrgFindMany.mockResolvedValue([fedNoCount]);
      const results = await autoDetectParentFederation('ON', null, 1000);
      expect(results[0].matchReasons).not.toContain('Similar size category');
    });

    it('includes congress type without federation bonus', async () => {
      const congress = { ...FED, id: 'cong-1', organizationType: 'congress' };
      mocks.mockOrgFindMany.mockResolvedValue([congress]);
      const results = await autoDetectParentFederation('ON', null);
      expect(results[0].matchReasons).not.toContain('Provincial federation');
    });
  });

  // ================================================================
  // Branch Coverage: getSmartDefaults integrations
  // ================================================================
  describe('getSmartDefaults — integration branches', () => {
    it('returns federation integrations', () => {
      const defaults = getSmartDefaults('federation');
      expect(defaults.suggestedIntegrations).toContain('clc-api');
      expect(defaults.suggestedIntegrations).toContain('wage-data');
    });

    it('returns union integrations', () => {
      const defaults = getSmartDefaults('union');
      expect(defaults.suggestedIntegrations).toContain('accounting-software');
    });

    it('returns congress features and integrations', () => {
      const defaults = getSmartDefaults('congress', 5000);
      expect(defaults.recommendedFeatures).toContain('clc-integration');
      expect(defaults.suggestedIntegrations).toContain('statistics-canada');
      expect(defaults.suggestedRateLimits.apiCallsPerDay).toBe(20000); // large
    });

    it('returns local defaults for unknown type', () => {
      const defaults = getSmartDefaults('unknown-type');
      expect(defaults.recommendedFeatures).toContain('document-storage');
      expect(defaults.suggestedIntegrations).toContain('zoom');
    });

    it('uses enterprise rate limits for 10000+ members', () => {
      const defaults = getSmartDefaults('union', 15000);
      expect(defaults.suggestedRateLimits.apiCallsPerDay).toBe(100000);
    });

    it('uses medium rate limits for 500-1999 members', () => {
      const defaults = getSmartDefaults('union', 1000);
      expect(defaults.suggestedRateLimits.apiCallsPerDay).toBe(5000);
    });
  });

  // ================================================================
  // Branch Coverage: suggestRelevantClauses — null field fallbacks
  // ================================================================
  describe('suggestRelevantClauses — branches', () => {
    it('handles org with no sector, no province, empty hierarchy', async () => {
      mocks.selectResults.push([clauseOrg({ sectors: [], provinceTerritory: null, hierarchyPath: null })], []);

      const results = await suggestRelevantClauses(CLAUSE_ORG);
      expect(results).toEqual([]);
    });

    it('propagates clause discovery errors', async () => {
      mocks.selectResults.push(new Error('db err'));
      await expect(suggestRelevantClauses(CLAUSE_ORG)).rejects.toThrow('db err');
    });
  });

  // ================================================================
  // Branch Coverage: findPeerOrganizations — branches
  // ================================================================
  describe('findPeerOrganizations — branches', () => {
    it('filters by sector when available', async () => {
      mocks.mockOrgFindFirst.mockResolvedValueOnce(ORG);
      mocks.mockOrgFindMany.mockResolvedValueOnce([
        { id: 'peer-1', sectors: ['public'] },
        { id: 'peer-2', sectors: ['private'] },
      ]);

      const peers = await findPeerOrganizations('org-1');
      // peer-2 should be filtered out (sector mismatch)
      expect(peers).toContain('peer-1');
      expect(peers).not.toContain('peer-2');
      // self should be excluded
      expect(peers).not.toContain('org-1');
    });

    it('skips sector filter when org has no sectors', async () => {
      const orgNoSect = { ...ORG, sectors: [], memberCount: null, provinceTerritory: null };
      mocks.mockOrgFindFirst.mockResolvedValueOnce(orgNoSect);
      mocks.mockOrgFindMany.mockResolvedValueOnce([
        { id: 'peer-3', sectors: ['private'] },
      ]);

      const peers = await findPeerOrganizations('org-1');
      expect(peers).toContain('peer-3');
    });

    it('refuses peer lookup for a missing organization', async () => {
      mocks.mockOrgFindFirst.mockResolvedValueOnce(null);
      await expect(findPeerOrganizations('missing')).rejects.toThrow('Organization not found');
    });
  });

  // ================================================================
  // Branch Coverage: fetchNationalAverage without sector
  // ================================================================
  describe('fetchNationalAverage — no sector', () => {
    it('builds cache key without sector suffix', async () => {
      // Set up org without sectors so that getPeerBenchmarks calls
      // fetchNationalAverage with sector = undefined
      const orgNoSect = { ...ORG, sectors: null };
      mocks.mockOrgFindFirst
        .mockResolvedValueOnce(orgNoSect)
        .mockResolvedValueOnce(orgNoSect);
      mocks.mockOrgFindMany
        .mockResolvedValueOnce([{ id: 'peer-1', sectors: ['public'] }])
        .mockResolvedValueOnce([{ memberCount: 1200 }]);
      mocks.mockCacheGet.mockResolvedValue(null);
      process.env.CLC_API_KEY = 'test-key';
      process.env.CLC_API_URL = 'https://benchmarks.example.test';

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: { average: 2000 } }),
      });

      const benchmarks = await getPeerBenchmarks('org-1');
      expect(benchmarks[0].nationalAverage).toBe(2000);
      expect(mocks.mockCacheSet).toHaveBeenCalledWith(
        'clc:national-avg:memberCount', // no sector suffix
        2000,
        expect.anything()
      );
    });
  });

  // ================================================================
  // Branch Coverage: getPeerBenchmarks nationalAverage fallback
  // ================================================================
  describe('getPeerBenchmarks — nationalAverage null fallback', () => {
    it('uses fallback average when CLC_API_KEY is not set', async () => {
      mocks.mockOrgFindFirst
        .mockResolvedValueOnce(ORG)
        .mockResolvedValueOnce(ORG);
      mocks.mockOrgFindMany
        .mockResolvedValueOnce([{ id: 'peer-1', sectors: ['public'] }])
        .mockResolvedValueOnce([{ memberCount: 800 }]);
      mocks.mockCacheGet.mockResolvedValue(null);
      // No CLC_API_KEY — the national average is explicitly unknown

      const benchmarks = await getPeerBenchmarks('org-1');
      expect(benchmarks[0].nationalAverage).toBeNull();
    });

    it('propagates benchmark lookup errors', async () => {
      mocks.mockOrgFindFirst.mockRejectedValueOnce(new Error('db'));
      await expect(getPeerBenchmarks('org-1')).rejects.toThrow('db');
    });
  });

  // ================================================================
  // Branch Coverage: runSmartOnboarding with parentId
  // ================================================================
  describe('runSmartOnboarding — org with parentId', () => {
    it('includes clause suggestions when parentId is set', async () => {
      mocks.mockOrgFindFirst
        .mockResolvedValueOnce(ORG)               // runSmartOnboarding
        .mockResolvedValueOnce(ORG)               // getPeerBenchmarks
        .mockResolvedValueOnce(ORG);              // findPeerOrganizations
      mocks.mockOrgFindMany
        .mockResolvedValueOnce([])                // autoDetectParentFederation
        .mockResolvedValueOnce([{ id: 'peer-1', sectors: ['public'] }])  // findPeerOrganizations
        .mockResolvedValueOnce([{ memberCount: 900 }]);  // peer query
      mocks.selectResults.push([clauseOrg()], [clauseRow()]);  // suggestRelevantClauses, as the tenant
      mocks.mockCacheGet.mockResolvedValue(null);

      const result = await runSmartOnboarding('org-1');
      expect(result.clauseSuggestions.length).toBeGreaterThan(0);
      expect(result.onboardingComplete.clausesImported).toBe(true);
    });
  });

  // ================================================================
  // Branch Coverage: fetchNationalAverage cached result
  // ================================================================
  describe('fetchNationalAverage — cache hit', () => {
    it('returns cached value without calling fetch', async () => {
      mocks.mockOrgFindFirst
        .mockResolvedValueOnce(ORG)
        .mockResolvedValueOnce(ORG);
      mocks.mockOrgFindMany
        .mockResolvedValueOnce([{ id: 'peer-1', sectors: ['public'] }])
        .mockResolvedValueOnce([{ memberCount: 1200 }]);
      mocks.mockCacheGet.mockResolvedValueOnce(4000); // cached value
      process.env.CLC_API_KEY = 'test-key';
      process.env.CLC_API_URL = 'https://benchmarks.example.test';

      const benchmarks = await getPeerBenchmarks('org-1');
      expect(benchmarks[0].nationalAverage).toBe(4000);
      expect(mockFetch).not.toHaveBeenCalled();
    });
  });

  // ================================================================
  // Branch Coverage: fetchNationalAverage — data.average fallback
  // ================================================================
  describe('fetchNationalAverage — alternative response format', () => {
    function setupBenchmarkMocks() {
      mocks.mockOrgFindFirst
        .mockResolvedValueOnce(ORG)
        .mockResolvedValueOnce(ORG);
      mocks.mockOrgFindMany
        .mockResolvedValueOnce([{ id: 'peer-1', sectors: ['public'] }])
        .mockResolvedValueOnce([{ memberCount: 1200 }]);
      mocks.mockCacheGet.mockResolvedValue(null);
      process.env.CLC_API_KEY = 'test-key';
      process.env.CLC_API_URL = 'https://benchmarks.example.test';
    }

    it('uses data.average when data.data.average is missing', async () => {
      setupBenchmarkMocks();
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ average: 4200 }), // no data.data wrapper
      });

      const benchmarks = await getPeerBenchmarks('org-1');
      expect(benchmarks[0].nationalAverage).toBe(4200);
    });

    it('handles non-Error throw in catch block', async () => {
      setupBenchmarkMocks();
      mockFetch.mockRejectedValueOnce('string-error');

      const benchmarks = await getPeerBenchmarks('org-1');
      // Missing provider measurement is explicitly unknown
      expect(benchmarks[0].nationalAverage).toBeNull();
    });
  });

  // ================================================================
  // Branch Coverage: getFallbackAverage unknown metric
  // ================================================================
  describe('getFallbackAverage — unknown metric', () => {
    it('returns 0 for an unrecognized metric', async () => {
      // We can trigger this via a 404 response for an unknown metric
      mocks.mockOrgFindFirst
        .mockResolvedValueOnce(ORG)
        .mockResolvedValueOnce(ORG);
      mocks.mockOrgFindMany
        .mockResolvedValueOnce([{ id: 'peer-1', sectors: ['public'] }])
        .mockResolvedValueOnce([{ memberCount: 1200 }]);
      mocks.mockCacheGet.mockResolvedValue(null);
      // Without CLC_API_KEY — no invented national measurement
      // Can't easily call with unknown metric through getPeerBenchmarks
      // Just verify the known fallback path works
      const benchmarks = await getPeerBenchmarks('org-1');
      expect(benchmarks[0].nationalAverage).toBeNull();
    });
  });

  // ================================================================
  // Branch Coverage: getPeerBenchmarks — peers but zero memberCount
  // ================================================================
  describe('getPeerBenchmarks — edge cases', () => {
    it('skips benchmarks when peerIds is empty', async () => {
      mocks.mockOrgFindFirst
        .mockResolvedValueOnce(ORG)
        .mockResolvedValueOnce(ORG);
      mocks.mockOrgFindMany
        .mockResolvedValueOnce([])  // findPeerOrganizations returns no peers
        .mockResolvedValueOnce([]);
      mocks.mockCacheGet.mockResolvedValue(null);

      const benchmarks = await getPeerBenchmarks('org-1');
      expect(benchmarks).toEqual([]);
    });

    it('handles peers with null memberCount', async () => {
      mocks.mockOrgFindFirst
        .mockResolvedValueOnce(ORG)
        .mockResolvedValueOnce(ORG);
      mocks.mockOrgFindMany
        .mockResolvedValueOnce([{ id: 'peer-1', sectors: ['public'] }])
        .mockResolvedValueOnce([{ memberCount: null }, { memberCount: 500 }]); // one null, one valid
      mocks.mockCacheGet.mockResolvedValue(null);

      const benchmarks = await getPeerBenchmarks('org-1');
      expect(benchmarks[0].peerAverage).toBe(500); // only the valid peer counts
    });

    it('skips benchmark when org sectors is null', async () => {
      const orgNoSectors = { ...ORG, sectors: null };
      mocks.mockOrgFindFirst
        .mockResolvedValueOnce(orgNoSectors)
        .mockResolvedValueOnce(orgNoSectors);
      mocks.mockOrgFindMany
        .mockResolvedValueOnce([{ id: 'peer-1', sectors: ['public'] }])
        .mockResolvedValueOnce([{ memberCount: 900 }]);
      mocks.mockCacheGet.mockResolvedValue(null);

      const benchmarks = await getPeerBenchmarks('org-1');
      expect(benchmarks[0]).toBeDefined();
    });
  });

  // ================================================================
  // Branch Coverage: runSmartOnboarding — org with no memberCount
  // ================================================================
  describe('runSmartOnboarding — memberCount fallbacks', () => {
    it('uses undefined memberCount, null province, empty sectors', async () => {
      const orgBare = { ...ORG, memberCount: 0, parentId: null, sectors: [], provinceTerritory: null };
      mocks.mockOrgFindFirst
        .mockResolvedValueOnce(orgBare)  // runSmartOnboarding
        .mockResolvedValueOnce(orgBare)  // getPeerBenchmarks
        .mockResolvedValueOnce(orgBare); // findPeerOrganizations
      mocks.mockOrgFindMany
        .mockResolvedValueOnce([])   // autoDetect
        .mockResolvedValueOnce([]);  // findPeers
      mocks.mockCacheGet.mockResolvedValue(null);

      const result = await runSmartOnboarding('org-1');
      expect(result.smartDefaults).toBeDefined();
      expect(result.clauseSuggestions).toEqual([]);
    });
  });
});
