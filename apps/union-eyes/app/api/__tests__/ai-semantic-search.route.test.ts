import { beforeEach, describe, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => ({
  checkRateLimit: vi.fn(),
  createRateLimitHeaders: vi.fn(),
  checkEntitlement: vi.fn(),
  guardAiFeature: vi.fn(),
  enforceAISafety: vi.fn(),
  semanticClauseSearch: vi.fn(),
  semanticPrecedentSearch: vi.fn(),
  unifiedSemanticSearch: vi.fn(),
  findSimilarClauses: vi.fn(),
  withRLSContext: vi.fn(),
  tx: { select: vi.fn() },
  selectQueue: [] as unknown[][],
}));

vi.mock('@/lib/api/framework', async () => (await import('./support/with-api-stub')).frameworkModule);
vi.mock('@/lib/rate-limiter', () => ({
  checkRateLimit: m.checkRateLimit,
  RATE_LIMITS: { AI_COMPLETION: { limit: 10 } },
  createRateLimitHeaders: m.createRateLimitHeaders,
}));
vi.mock('@/lib/services/entitlements', () => ({ checkEntitlement: m.checkEntitlement }));
vi.mock('@/lib/ai/ai-feature-guard', () => ({ guardAiFeature: m.guardAiFeature }));
vi.mock('@nzila/policies', () => ({ enforceAISafety: m.enforceAISafety }));
vi.mock('@/lib/services/ai/vector-search-service', () => ({
  semanticClauseSearch: m.semanticClauseSearch,
  semanticPrecedentSearch: m.semanticPrecedentSearch,
  unifiedSemanticSearch: m.unifiedSemanticSearch,
  findSimilarClauses: m.findSimilarClauses,
}));
vi.mock('@/lib/services/feature-flags', () => ({ AI_FEATURES: { AI_SEMANTIC_SEARCH: 'SEARCH' } }));
vi.mock('@/lib/db/with-rls-context', () => ({ withRLSContext: m.withRLSContext }));

const { caller, declared, resetCaller } = await import('./support/with-api-stub');

async function loadRoute() {
  return import('../ai/semantic-search/route');
}

describe('ai/semantic-search route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetCaller();
    caller.role = 'member';
    m.selectQueue = [];
    m.checkRateLimit.mockResolvedValue({ allowed: true });
    m.createRateLimitHeaders.mockReturnValue({});
    m.checkEntitlement.mockResolvedValue({ allowed: true });
    m.guardAiFeature.mockResolvedValue(null);
    m.enforceAISafety.mockReturnValue(undefined);
    m.semanticClauseSearch.mockResolvedValue([{ id: 'c1', similarity: 0.95 }]);
    m.semanticPrecedentSearch.mockResolvedValue([{ id: 'p1', similarity: 0.87 }]);
    m.unifiedSemanticSearch.mockResolvedValue({ clauses: [{ id: 'c1' }], precedents: [{ id: 'p1' }], combined: [{ id: 'c1' }, { id: 'p1' }] });
    m.findSimilarClauses.mockResolvedValue([{ id: 'c2', similarity: 0.92 }]);

    const createSelectChain = () => {
      const chain: {
        from: () => unknown;
        where: () => unknown;
        then: (resolve: (value: unknown[]) => unknown, reject: (reason: unknown) => unknown) => Promise<unknown>;
      } = {
        from: () => chain,
        where: () => chain,
        then: (resolve, reject) => Promise.resolve((m.selectQueue.shift() ?? []) as unknown[]).then(resolve, reject),
      };
      return chain;
    };
    m.tx.select = vi.fn(() => createSelectChain());
    m.withRLSContext.mockImplementation(async (_scope: unknown, run: (tx: typeof m.tx) => Promise<unknown>) => run(m.tx));
  });

  it('declares what it asks of the wrapper: a member in an organization, and a validated body on the search', async () => {
    await loadRoute();
    const search = declared.find((entry) => entry.openapi?.summary === 'Semantic search over clauses and precedents');
    const status = declared.find((entry) => entry.openapi?.summary === 'Semantic search index status of the organization');

    expect(search?.auth).toEqual({ minRole: 'member' });
    expect(search?.body).toBeDefined();
    expect(search?.requireOrg).toBeUndefined();
    expect(search?.entitlement).toBeUndefined();
    expect(status?.auth).toEqual({ minRole: 'member' });
    expect(status?.requireOrg).toBeUndefined();
  });

  it('is refused for a caller with no active organization before any limit, entitlement or search is touched', async () => {
    caller.organizationId = null;
    const { POST, GET } = await loadRoute();

    const search = await POST(new Request('http://localhost/api/ai/semantic-search', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ query: 'vacation clause', searchType: 'clauses' }),
    }));
    const status = await GET(new Request('http://localhost/api/ai/semantic-search'));

    expect(search.status).toBe(403);
    expect(status.status).toBe(403);
    expect(m.checkRateLimit).not.toHaveBeenCalled();
    expect(m.checkEntitlement).not.toHaveBeenCalled();
    expect(m.semanticClauseSearch).not.toHaveBeenCalled();
    expect(m.withRLSContext).not.toHaveBeenCalled();
  });

  it('returns 429 when rate-limited', async () => {
    const { POST } = await loadRoute();
    m.checkRateLimit.mockResolvedValueOnce({ allowed: false });
    const response = await POST(new Request('http://localhost/api/ai/semantic-search', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ query: 'vacation clause', searchType: 'clauses' }),
    }));
    expect(response.status).toBe(429);
  });

  it('returns 403 when entitlement is missing', async () => {
    const { POST } = await loadRoute();
    m.checkEntitlement.mockResolvedValueOnce({ allowed: false, reason: 'Entitlement missing', upgradeUrl: '/upgrade' });

    const response = await POST(new Request('http://localhost/api/ai/semantic-search', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ query: 'vacation clause', searchType: 'clauses' }),
    }));
    const payload = await response.json();

    expect(response.status).toBe(403);
    expect(payload.feature).toBe('ai_semantic_search');
  });

  it('answers 501, not 500, when the database cannot search by similarity', async () => {
    const { POST } = await loadRoute();
    const { VectorSearchUnavailableError, CLAUSE_EMBEDDING } = await import('@/lib/ai/vector-readiness');
    m.semanticClauseSearch.mockRejectedValueOnce(new VectorSearchUnavailableError(CLAUSE_EMBEDDING));

    const response = await POST(new Request('http://localhost/api/ai/semantic-search', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ query: 'vacation clause', searchType: 'clauses' }),
    }));

    expect(response.status).toBe(501);
    expect(JSON.stringify(await response.json())).toContain('cba_clauses.embedding');
  });

  it('returns blocked response when AI feature guard denies', async () => {
    const { POST } = await loadRoute();
    m.guardAiFeature.mockResolvedValueOnce(new Response(JSON.stringify({ error: 'blocked' }), { status: 403 }));

    const response = await POST(new Request('http://localhost/api/ai/semantic-search', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ query: 'vacation clause', searchType: 'clauses' }),
    }));

    expect(response.status).toBe(403);
  });

  it('never honours an organization supplied in the body filters', async () => {
    const { POST } = await loadRoute();
    await POST(new Request('http://localhost/api/ai/semantic-search', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ query: 'vacation clause', searchType: 'clauses', filters: { organizationId: 'org_other' } }),
    }));
    expect(m.semanticClauseSearch).toHaveBeenCalledWith('vacation clause', expect.objectContaining({ filters: expect.objectContaining({ organizationId: 'org_1' }) }));
  });

  it('searches clauses semantically', async () => {
    const { POST } = await loadRoute();
    const response = await POST(new Request('http://localhost/api/ai/semantic-search', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ query: 'vacation clause', searchType: 'clauses', limit: 10 }),
    }));
    const payload = await response.json();
    expect(response.status).toBe(200);
    expect(payload.searchType).toBe('clauses');
    expect(payload.count).toBe(1);
  });

  it('searches precedents semantically', async () => {
    const { POST } = await loadRoute();
    const response = await POST(new Request('http://localhost/api/ai/semantic-search', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ query: 'seniority dispute', searchType: 'precedents' }),
    }));
    const payload = await response.json();
    expect(response.status).toBe(200);
    expect(payload.searchType).toBe('precedents');
    expect(payload.count).toBe(1);
  });

  it('performs unified search', async () => {
    const { POST } = await loadRoute();
    const response = await POST(new Request('http://localhost/api/ai/semantic-search', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ query: 'overtime rules', searchType: 'unified' }),
    }));
    const payload = await response.json();
    expect(response.status).toBe(200);
    expect(payload.searchType).toBe('unified');
    expect(payload.counts.total).toBe(2);
  });

  it('finds similar clauses by clause id', async () => {
    const { POST } = await loadRoute();
    const response = await POST(new Request('http://localhost/api/ai/semantic-search', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        searchType: 'similar',
        clauseId: '11111111-1111-1111-1111-111111111111',
        threshold: 0.8,
        limit: 5,
      }),
    }));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.searchType).toBe('similar');
    expect(payload.count).toBe(1);
  });

  it('returns validation error for missing query on non-similar searches', async () => {
    const { POST } = await loadRoute();
    const response = await POST(new Request('http://localhost/api/ai/semantic-search', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ searchType: 'clauses' }),
    }));

    expect(response.status).toBe(400);
  });

  it('reports semantic index readiness via GET, counted in the caller\'s own organization context', async () => {
    const { GET } = await loadRoute();
    m.selectQueue.push(
      [{ total: 2, withEmbeddings: 1 }],
      [{ total: 1 }],
    );

    const response = await GET(new Request('http://localhost/api/ai/semantic-search'));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.status).toBe('ready');
    expect(payload.clauses).toEqual({ total: 2, withEmbeddings: 1, percentage: 50 });
    expect(payload.precedents.total).toBe(1);
    expect(m.withRLSContext).toHaveBeenCalledWith({ organizationId: 'org_1' }, expect.any(Function));
    expect(m.tx.select).toHaveBeenCalledTimes(2);
  });

  it('reports the index as pending when no clause has an embedding yet', async () => {
    const { GET } = await loadRoute();
    m.selectQueue.push([{ total: 3, withEmbeddings: 0 }], [{ total: 0 }]);

    const payload = await (await GET(new Request('http://localhost/api/ai/semantic-search'))).json();

    expect(payload.status).toBe('pending');
    expect(payload.clauses).toEqual({ total: 3, withEmbeddings: 0, percentage: 0 });
  });
});
