import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const m = vi.hoisted(() => ({
  withRoleAuth: vi.fn(),
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
  dbExecuteQueue: [] as unknown[][],
  logger: { error: vi.fn(), warn: vi.fn() },
}));

vi.mock('@/lib/api-auth-guard', () => ({ withRoleAuth: m.withRoleAuth, hasMinRole: m.hasMinRole }));
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
vi.mock('@/db/db', () => ({ db: { execute: vi.fn(async () => (m.dbExecuteQueue.shift() ?? []) as unknown[]) } }));
vi.mock('@nzila/ai-sdk', () => ({ buildCanonicalAiOutput: m.buildCanonicalAiOutput }));
vi.mock('@/lib/ai/ai-client', () => ({
  UE_APP_KEY: 'ue-app',
  UE_SYSTEM_ORG_ID: 'sys-org',
  UE_PROFILES: { CHATBOT: 'chatbot' },
  buildOrgAiTrace: () => ({ trace: 't1' }),
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
vi.mock('@/lib/api/standardized-responses', () => ({
  ErrorCode: { VALIDATION_ERROR: 'VALIDATION_ERROR', NOT_IMPLEMENTED: 'NOT_IMPLEMENTED' },
  standardErrorResponse: (code: string, message: string) => new Response(JSON.stringify({ message }), { status: code === 'NOT_IMPLEMENTED' ? 501 : 400 }),
}));
vi.mock('drizzle-orm', async (importOriginal) => {
  const actual = await importOriginal<typeof import('drizzle-orm')>();
  return { ...actual, sql: vi.fn(() => 'sql') };
});

async function loadRoute() {
  return import('../ai/search/route');
}

describe('ai/search route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.dbExecuteQueue = [];
    m.checkRateLimit.mockResolvedValue({ allowed: true });
    m.createRateLimitHeaders.mockReturnValue({});
    m.checkEntitlement.mockResolvedValue({ allowed: true });
    m.guardAiFeature.mockResolvedValue(null);
    m.hasMinRole.mockResolvedValue(true);
    m.vectorColumnReady.mockResolvedValue(true);
    m.generateEmbedding.mockResolvedValue([0.1, 0.2]);
    m.withRLSContext.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => fn({ tx: true }));
    m.resolveReader.mockResolvedValue({ userId: 'u1', stewardPlus: false, levels: new Set(['public_internal']) });
    m.sourceCondition.mockReturnValue({ condition: 'source' });
    m.search.mockResolvedValue([]);
    m.buildCanonicalAiOutput.mockImplementation((x: unknown) => x);
    m.getAiClient.mockReturnValue({ generate: vi.fn(async () => ({ content: 'AI answer' })) });
    m.withRoleAuth.mockImplementation(
      (_role: string, handler: (request: NextRequest, context: any) => Promise<Response>) =>
        (request: NextRequest, context: any = { userId: 'u1', organizationId: 'org_1' }) => handler(request, context),
    );
  });

  it('POST returns 429 when rate-limited', async () => {
    const { POST } = await loadRoute();
    m.checkRateLimit.mockResolvedValueOnce({ allowed: false });

    const response = await POST(new NextRequest('http://localhost/api/ai/search', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ query: 'test' }),
    }), { userId: 'u1', organizationId: 'org_1' });

    expect(response.status).toBe(429);
  });

  it('POST returns 403 when entitlement is missing', async () => {
    const { POST } = await loadRoute();
    m.checkEntitlement.mockResolvedValueOnce({ allowed: false, reason: 'upgrade', upgradeUrl: '/upgrade' });

    const response = await POST(new NextRequest('http://localhost/api/ai/search', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ query: 'test' }),
    }), { userId: 'u1', organizationId: 'org_1' });

    expect(response.status).toBe(403);
  });

  it('POST returns guard-blocked response', async () => {
    const { POST } = await loadRoute();
    m.guardAiFeature.mockResolvedValueOnce(new Response(JSON.stringify({ error: 'blocked' }), { status: 403 }));

    const response = await POST(new NextRequest('http://localhost/api/ai/search', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ query: 'test' }),
    }), { userId: 'u1', organizationId: 'org_1' });

    expect(response.status).toBe(403);
  });

  it('POST validates request body', async () => {
    const { POST } = await loadRoute();
    const response = await POST(new NextRequest('http://localhost/api/ai/search', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ query: '' }),
    }), { userId: 'u1', organizationId: 'org_1' });

    expect(response.status).toBe(400);
  });

  it('POST answers 501 before the query is embedded or searched when pgvector is not installed', async () => {
    const { POST } = await loadRoute();
    m.vectorColumnReady.mockResolvedValue(false);

    const response = await POST(new NextRequest('http://localhost/api/ai/search', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ query: 'benefits' }),
    }), { userId: 'u1', organizationId: 'org_1' });

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

    const response = await POST(new NextRequest('http://localhost/api/ai/search', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ query: 'benefits', max_results: 5, threshold: 0.6, generate_answer: false }),
    }), { userId: 'u1', organizationId: 'org_1' });

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

    await POST(new NextRequest('http://localhost/api/ai/search', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ query: 'benefits', max_results: 3, threshold: 0.75, document_type: 'faq' }),
    }), { userId: 'u1', organizationId: 'org_1' });

    // The reader is the caller, with the levels their role may read; the condition is built for the caller's organization.
    expect(m.resolveReader).toHaveBeenCalledWith('u1', false, m.hasMinRole);
    expect(m.sourceCondition).toHaveBeenCalledWith(expect.objectContaining({ levels: new Set(['public_internal']) }), 'org_1');
    expect(m.search).toHaveBeenCalledWith(
      { tx: true },
      { organizationId: 'org_1', embedding: [0.1, 0.2], minSimilarity: 0.75, limit: 3, documentTypes: ['faq'], sourceCondition: { condition: 'source' } },
    );
  });

  it('POST searches every document type when none is named, and returns nothing when nothing reaches the threshold', async () => {
    const { POST } = await loadRoute();

    const response = await POST(new NextRequest('http://localhost/api/ai/search', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ query: 'benefits' }),
    }), { userId: 'u1', organizationId: 'org_1' });

    expect(m.search).toHaveBeenCalledWith({ tx: true }, expect.objectContaining({ documentTypes: undefined, minSimilarity: 0.6, limit: 5 }));
    expect(await response.json()).toEqual({ query: 'benefits', results: [], count: 0 });
  });

  it('GET returns index health stats', async () => {
    const { GET } = await loadRoute();
    m.dbExecuteQueue.push([{ total: 10, with_embeddings: 7, organizations: 3, document_types: 4 }]);

    const response = await GET(new NextRequest('http://localhost/api/ai/search'), { userId: 'u1', organizationId: 'org_1' });

    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.knowledge_base.total).toBe(10);
    expect(json.knowledge_base.with_embeddings).toBe(7);
  });
});
