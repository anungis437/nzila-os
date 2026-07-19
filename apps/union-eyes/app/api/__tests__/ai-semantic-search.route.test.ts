import { beforeEach, describe, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => ({
  withRoleAuth: vi.fn(),
  checkRateLimit: vi.fn(),
  createRateLimitHeaders: vi.fn(),
  checkEntitlement: vi.fn(),
  guardAiFeature: vi.fn(),
  enforceAISafety: vi.fn(),
  semanticClauseSearch: vi.fn(),
  semanticPrecedentSearch: vi.fn(),
  unifiedSemanticSearch: vi.fn(),
  findSimilarClauses: vi.fn(),
  db: { select: vi.fn() },
  selectQueue: [] as unknown[][],
}));

vi.mock('@/lib/api-auth-guard', () => ({ withRoleAuth: m.withRoleAuth, BaseAuthContext: {} }));
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
vi.mock('@/db/db', () => ({ db: m.db }));

async function loadRoute() {
  return import('../ai/semantic-search/route');
}

describe('ai/semantic-search route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.selectQueue = [];
    m.withRoleAuth.mockImplementation((_role: string, handler: any) => (request: any, ctx: any = { userId: 'u1', organizationId: 'org_1' }) => handler(request, ctx));
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
        then: (resolve: (value: unknown[]) => unknown, reject: (reason: unknown) => unknown) => Promise<unknown>;
      } = {
        from: () => chain,
        then: (resolve, reject) => Promise.resolve((m.selectQueue.shift() ?? []) as unknown[]).then(resolve, reject),
      };
      return chain;
    };
    m.db.select = vi.fn(() => createSelectChain());
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

  it('returns blocked response when AI feature guard denies', async () => {
    const { POST } = await loadRoute();
    m.guardAiFeature.mockResolvedValueOnce(new Response(JSON.stringify({ error: 'blocked' }), { status: 403 }));

    const response = await POST(new Request('http://localhost/api/ai/semantic-search', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ query: 'vacation clause', searchType: 'clauses' }),
    }));

    expect(response.status).toBe(403);
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

  it('reports semantic index readiness via GET', async () => {
    const { GET } = await loadRoute();
    m.selectQueue.push(
      [
        { id: 'c1', embedding: [0.1, 0.2] },
        { id: 'c2', embedding: null },
      ],
      [{ id: 'p1' }],
    );

    const response = await GET(new Request('http://localhost/api/ai/semantic-search'));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.status).toBe('ready');
    expect(payload.clauses.total).toBe(2);
    expect(payload.clauses.withEmbeddings).toBe(1);
    expect(payload.precedents.total).toBe(1);
  });
});
