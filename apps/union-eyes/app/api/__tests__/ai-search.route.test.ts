import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const m = vi.hoisted(() => ({
  checkRateLimit: vi.fn(),
  createRateLimitHeaders: vi.fn(),
  checkEntitlement: vi.fn(),
  guardAiFeature: vi.fn(),
  enforceAISafety: vi.fn(),
  generateEmbedding: vi.fn(),
  withRLSContext: vi.fn(),
  buildCanonicalAiOutput: vi.fn(),
  getAiClient: vi.fn(),
  hasMinRole: vi.fn(),
  vectorColumnReady: vi.fn(),
  search: vi.fn(),
  resolveReader: vi.fn(),
  sourceCondition: vi.fn(),
  tx: { execute: vi.fn() },
  executeQueue: [] as unknown[][],
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

vi.mock('@/lib/api/framework', async () => (await import('./support/with-api-stub')).frameworkModule);
vi.mock('@/lib/api-auth-guard', () => ({ hasMinRole: m.hasMinRole }));
vi.mock('@/lib/rate-limiter', () => ({
  checkRateLimit: m.checkRateLimit,
  RATE_LIMITS: { AI_COMPLETION: { limit: 10 } },
  createRateLimitHeaders: m.createRateLimitHeaders,
}));
vi.mock('@/lib/services/entitlements', () => ({ checkEntitlement: m.checkEntitlement }));
vi.mock('@/lib/ai/ai-feature-guard', () => ({ guardAiFeature: m.guardAiFeature }));
vi.mock('@nzila/policies', () => ({ enforceAISafety: m.enforceAISafety }));
vi.mock('@/lib/services/ai/vector-search-service', () => ({ generateEmbedding: m.generateEmbedding }));
vi.mock('@/lib/ai/knowledge-base-embeddings', () => ({ searchKnowledgeBaseByEmbedding: m.search }));
vi.mock('@/lib/knowledge-transfer/governance/interview-access', () => ({
  resolveInterviewReader: m.resolveReader,
  knowledgeBaseSourceCondition: m.sourceCondition,
}));
vi.mock('@/lib/db/with-rls-context', () => ({ withRLSContext: m.withRLSContext }));
vi.mock('@/lib/services/feature-flags', () => ({ AI_FEATURES: { AI_SEARCH: 'AI_SEARCH' } }));
vi.mock('@/lib/audit/operation-audit', () => ({
  performAuditedOperation: (_op: unknown, run: () => Promise<unknown>) => run(),
  operationAuditResponse: () => null,
}));
vi.mock('@nzila/ai-sdk', () => ({ buildCanonicalAiOutput: m.buildCanonicalAiOutput }));
vi.mock('@/lib/ai/ai-client', () => ({
  UE_APP_KEY: 'ue-app',
  UE_SYSTEM_ORG_ID: 'sys-org',
  UE_PROFILES: { CHATBOT: 'chatbot' },
  buildOrgAiTrace: () => ({ trace: 't1' }),
  toGatewayDataClass: (c: string) => c,
  getAiClient: m.getAiClient,
}));
vi.mock('@/lib/logger', () => ({ logger: m.logger }));
vi.mock('@/lib/ai/vector-readiness', () => ({
  KNOWLEDGE_BASE_EMBEDDING: { table: 'knowledge_base', column: 'embedding' },
  vectorColumnReady: m.vectorColumnReady,
  VectorSearchUnavailableError: class extends Error {
    constructor() {
      super('Semantic search is not available');
    }
  },
}));

const { caller, declared, resetCaller } = await import('./support/with-api-stub');

async function loadRoute() {
  return import('../ai/search/route');
}

const post = (body: unknown) => new NextRequest('http://localhost/api/ai/search', {
  method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
});
const get = () => new NextRequest('http://localhost/api/ai/search');

describe('ai/search route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetCaller();
    caller.role = 'member';
    m.executeQueue = [];
    m.tx.execute.mockImplementation(async () => m.executeQueue.shift() ?? []);
    m.checkRateLimit.mockResolvedValue({ allowed: true });
    m.createRateLimitHeaders.mockReturnValue({});
    m.checkEntitlement.mockResolvedValue({ allowed: true });
    m.guardAiFeature.mockResolvedValue(null);
    m.hasMinRole.mockResolvedValue(true);
    m.vectorColumnReady.mockResolvedValue(true);
    m.generateEmbedding.mockResolvedValue([0.1, 0.2]);
    m.withRLSContext.mockImplementation(async (_scope: unknown, run: (tx: typeof m.tx) => Promise<unknown>) => run(m.tx));
    m.resolveReader.mockResolvedValue({ userId: 'u1', stewardPlus: false, levels: new Set(['public_internal']) });
    m.sourceCondition.mockReturnValue({ condition: 'source' });
    m.search.mockResolvedValue([]);
    m.buildCanonicalAiOutput.mockImplementation((x: unknown) => x);
    m.getAiClient.mockReturnValue({ generate: vi.fn(async () => ({ content: 'AI answer' })) });
  });

  it('declares what it asks of the wrapper: a member in an organization with a validated body on the search, and a member who may have no organization on the health read (the handler answers that itself)', async () => {
    await loadRoute();
    const search = declared.find((entry) => entry.openapi?.summary === 'Semantic search over the organization\'s knowledge base');
    const health = declared.find((entry) => entry.openapi?.summary === 'Knowledge base index health and counts');

    expect(search?.auth).toEqual({ minRole: 'member' });
    expect(search?.body).toBeDefined();
    expect(search?.requireOrg).toBeUndefined();
    expect(search?.entitlement).toBeUndefined();
    expect(health?.auth).toEqual({ minRole: 'member' });
    expect(health?.requireOrg).toBe(false);
  });

  it('POST is refused for a caller with no active organization before any limit, entitlement, embedding or search is touched', async () => {
    caller.organizationId = null;
    const { POST } = await loadRoute();

    const response = await POST(post({ query: 'test' }));

    expect(response.status).toBe(403);
    expect(m.checkRateLimit).not.toHaveBeenCalled();
    expect(m.checkEntitlement).not.toHaveBeenCalled();
    expect(m.generateEmbedding).not.toHaveBeenCalled();
    expect(m.withRLSContext).not.toHaveBeenCalled();
  });

  it('POST returns 429 when rate-limited', async () => {
    const { POST } = await loadRoute();
    m.checkRateLimit.mockResolvedValueOnce({ allowed: false });

    const response = await POST(post({ query: 'test' }));

    expect(response.status).toBe(429);
    expect(m.checkRateLimit).toHaveBeenCalledWith('ai-completion:u1', expect.anything());
    expect(m.checkEntitlement).not.toHaveBeenCalled();
  });

  it('POST returns 403 when entitlement is missing', async () => {
    const { POST } = await loadRoute();
    m.checkEntitlement.mockResolvedValueOnce({ allowed: false, reason: 'upgrade', upgradeUrl: '/upgrade' });

    const response = await POST(post({ query: 'test' }));

    expect(response.status).toBe(403);
    expect(await response.json()).toMatchObject({ feature: 'ai_search', upgradeUrl: '/upgrade' });
    expect(m.checkEntitlement).toHaveBeenCalledWith('org_1', 'ai_search');
    expect(m.generateEmbedding).not.toHaveBeenCalled();
  });

  it('POST returns guard-blocked response', async () => {
    const { POST } = await loadRoute();
    m.guardAiFeature.mockResolvedValueOnce(new Response(JSON.stringify({ error: 'blocked' }), { status: 403 }));

    const response = await POST(post({ query: 'test' }));

    expect(response.status).toBe(403);
  });

  it('POST validates request body', async () => {
    const { POST } = await loadRoute();
    const response = await POST(post({ query: '' }));

    expect(response.status).toBe(400);
    expect(m.checkRateLimit).not.toHaveBeenCalled();
  });

  it('POST answers 501 before the query is embedded or searched when pgvector is not installed', async () => {
    const { POST } = await loadRoute();
    m.vectorColumnReady.mockResolvedValue(false);

    const response = await POST(post({ query: 'benefits' }));

    expect(response.status).toBe(501);
    expect(m.generateEmbedding).not.toHaveBeenCalled();
    expect(m.withRLSContext).not.toHaveBeenCalled();
  });

  it('POST returns search results without generated answer', async () => {
    const { POST } = await loadRoute();
    m.search.mockResolvedValueOnce([{
      id: 'k1', title: 'Doc', documentType: 'faq', content: 'c'.repeat(400), summary: 'sum', tags: ['a'], keywords: [], language: 'en', sourceType: 'kb', sourceUrl: null,
      viewCount: 2, citationCount: 1, effectiveDate: null, expiryDate: null, similarity: 0.912345,
    }]);

    const response = await POST(post({ query: 'benefits', max_results: 5, threshold: 0.6, generate_answer: false }));

    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.count).toBe(1);
    expect(json.results[0]).toMatchObject({
      id: 'k1', title: 'Doc', document_type: 'faq', summary: 'sum', tags: ['a'], language: 'en', source_type: 'kb', similarity: 0.9123, view_count: 2, citation_count: 1,
    });
    expect(json.results[0].content_preview).toHaveLength(300);
  });

  it('POST has the database apply the organization, threshold, limit, type and the interview visibility rule', async () => {
    const { POST } = await loadRoute();

    await POST(post({ query: 'benefits', max_results: 3, threshold: 0.75, document_type: 'faq' }));

    // The reader is the caller, with the levels their role may read; the condition is built for the caller's organization.
    expect(m.resolveReader).toHaveBeenCalledWith('u1', false, m.hasMinRole);
    expect(m.sourceCondition).toHaveBeenCalledWith(expect.objectContaining({ levels: new Set(['public_internal']) }), 'org_1');
    expect(m.withRLSContext).toHaveBeenCalledWith({ organizationId: 'org_1' }, expect.any(Function));
    expect(m.search).toHaveBeenCalledWith(
      m.tx,
      { organizationId: 'org_1', embedding: [0.1, 0.2], minSimilarity: 0.75, limit: 3, documentTypes: ['faq'], sourceCondition: { condition: 'source' } },
    );
  });

  it('POST searches every document type when none is named, and returns nothing when nothing reaches the threshold', async () => {
    const { POST } = await loadRoute();

    const response = await POST(post({ query: 'benefits' }));

    expect(m.search).toHaveBeenCalledWith(m.tx, expect.objectContaining({ documentTypes: undefined, minSimilarity: 0.6, limit: 5 }));
    expect(await response.json()).toEqual({ query: 'benefits', results: [], count: 0 });
  });

  it('GET returns index health stats, read in the caller\'s own organization context', async () => {
    const { GET } = await loadRoute();
    m.executeQueue.push([{ total: 10, with_embeddings: 7, organizations: 3, document_types: 4 }]);

    const response = await GET(get());

    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.knowledge_base.total).toBe(10);
    expect(json.knowledge_base.with_embeddings).toBe(7);
    expect(m.withRLSContext).toHaveBeenCalledWith({ organizationId: 'org_1' }, expect.any(Function));
    expect(m.tx.execute).toHaveBeenCalledTimes(1);
  });

  it('GET answers 400 without reading anything when the caller has no active organization', async () => {
    caller.organizationId = null;
    const { GET } = await loadRoute();

    const response = await GET(get());

    expect(response.status).toBe(400);
    expect(m.guardAiFeature).not.toHaveBeenCalled();
    expect(m.withRLSContext).not.toHaveBeenCalled();
  });
});
