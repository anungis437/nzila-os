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
  dbExecuteQueue: [] as unknown[][],
  logger: { error: vi.fn(), warn: vi.fn() },
}));

vi.mock('@/lib/api-auth-guard', () => ({ withRoleAuth: m.withRoleAuth }));
vi.mock('@/lib/rate-limiter', () => ({
  checkRateLimit: m.checkRateLimit,
  RATE_LIMITS: { AI_COMPLETION: { limit: 10 } },
  createRateLimitHeaders: m.createRateLimitHeaders,
}));
vi.mock('@/lib/services/entitlements', () => ({ checkEntitlement: m.checkEntitlement }));
vi.mock('@/lib/ai/ai-feature-guard', () => ({ guardAiFeature: m.guardAiFeature }));
vi.mock('@nzila/policies', () => ({ enforceAISafety: m.enforceAISafety }));
vi.mock('@/lib/services/ai/vector-search-service', () => ({ generateEmbedding: m.generateEmbedding }));
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
vi.mock('@/lib/api/standardized-responses', () => ({
  ErrorCode: { VALIDATION_ERROR: 'VALIDATION_ERROR' },
  standardErrorResponse: (_code: string, message: string) => new Response(JSON.stringify({ message }), { status: 400 }),
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
    m.generateEmbedding.mockResolvedValue([0.1, 0.2]);
    m.withRLSContext.mockImplementation(async (fn: () => Promise<unknown>) => fn());
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

  it('POST returns search results without generated answer', async () => {
    const { POST } = await loadRoute();
    m.dbExecuteQueue.push([{ id: 'k1', title: 'Doc', document_type: 'faq', content: 'content', summary: 'sum', tags: [], keywords: [], language: 'en', source_type: 'kb', source_url: null, view_count: 0, citation_count: 0, effective_date: null, expiry_date: null, similarity: 0.9 }]);

    const response = await POST(new NextRequest('http://localhost/api/ai/search', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ query: 'benefits', max_results: 5, threshold: 0.6, generate_answer: false }),
    }), { userId: 'u1', organizationId: 'org_1' });

    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.count).toBe(1);
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
