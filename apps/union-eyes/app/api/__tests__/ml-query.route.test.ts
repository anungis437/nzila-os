import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const m = vi.hoisted(() => ({
  withRoleAuth: vi.fn(),
  checkRateLimit: vi.fn(),
  createRateLimitHeaders: vi.fn(),
  logApiAuditEvent: vi.fn(),
  guardAiFeature: vi.fn(),
  enforceAISafety: vi.fn(),
}));

vi.mock('@/lib/api-auth-guard', () => ({ withRoleAuth: m.withRoleAuth }));
vi.mock('@/lib/rate-limiter', () => ({
  checkRateLimit: m.checkRateLimit,
  RATE_LIMITS: { ML_PREDICTIONS: { limit: 20 } },
  createRateLimitHeaders: m.createRateLimitHeaders,
}));
vi.mock('@/lib/middleware/api-security', () => ({ logApiAuditEvent: m.logApiAuditEvent }));
vi.mock('@/lib/ai/ai-feature-guard', () => ({ guardAiFeature: m.guardAiFeature }));
vi.mock('@/lib/services/feature-flags', () => ({ AI_FEATURES: { ML_QUERY: 'ML_QUERY' } }));
vi.mock('@nzila/policies', () => ({ enforceAISafety: m.enforceAISafety }));
vi.mock('@/lib/api/standardized-responses', () => ({
  ErrorCode: { INTERNAL_ERROR: 'INTERNAL_ERROR' },
  standardErrorResponse: () => new Response(JSON.stringify({ error: 'internal' }), { status: 500 }),
}));

async function loadRoute() {
  return import('../ml/query/route');
}

describe('ml/query route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.AI_SERVICE_URL = 'http://ai.local';
    process.env.AI_SERVICE_TOKEN = 'token';
    m.createRateLimitHeaders.mockReturnValue({ 'x-ratelimit-limit': '20' });
    m.checkRateLimit.mockResolvedValue({ allowed: true });
    m.guardAiFeature.mockResolvedValue(null);
    m.withRoleAuth.mockImplementation(
      (_role: string, handler: (request: NextRequest, context: any) => Promise<Response>) =>
        (request: NextRequest, context: any = { userId: 'u1', organizationId: 'org_1' }) => handler(request, context),
    );
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true,
      json: async () => ({ answer: 'ok', confidence: 0.8, sources: [] }),
    })) as any);
  });

  it('returns 429 when rate limit is exceeded', async () => {
    const { POST } = await loadRoute();
    m.checkRateLimit.mockResolvedValueOnce({ allowed: false, remaining: 0, resetAt: Date.now() + 1000 });

    const response = await POST(new NextRequest('http://localhost/api/ml/query', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ question: 'How many claims?' }),
    }), { userId: 'u1', organizationId: 'org_1' });

    expect(response.status).toBe(429);
  });

  it('returns 400 when organization is missing', async () => {
    const { POST } = await loadRoute();
    const response = await POST(new NextRequest('http://localhost/api/ml/query', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ question: 'How many claims?' }),
    }), { userId: 'u1', organizationId: '' });

    expect(response.status).toBe(400);
  });

  it('returns blocked response when feature guard blocks', async () => {
    const { POST } = await loadRoute();
    m.guardAiFeature.mockResolvedValueOnce(new Response(JSON.stringify({ error: 'blocked' }), { status: 403 }));

    const response = await POST(new NextRequest('http://localhost/api/ml/query', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ question: 'How many claims?' }),
    }), { userId: 'u1', organizationId: 'org_1' });

    expect(response.status).toBe(403);
  });

  it('returns 400 for invalid body', async () => {
    const { POST } = await loadRoute();
    const response = await POST(new NextRequest('http://localhost/api/ml/query', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ question: '' }),
    }), { userId: 'u1', organizationId: 'org_1' });

    expect(response.status).toBe(400);
  });

  it('returns AI query result with suggestions', async () => {
    const { POST } = await loadRoute();

    const response = await POST(new NextRequest('http://localhost/api/ml/query', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ question: 'How many claims are overdue?' }),
    }), { userId: 'u1', organizationId: 'org_1' });

    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.answer).toBe('ok');
    expect(Array.isArray(json.suggestions)).toBe(true);
    expect(m.logApiAuditEvent).toHaveBeenCalled();
  });

  it('returns 500 when AI service URL is missing', async () => {
    const { POST } = await loadRoute();
    delete process.env.AI_SERVICE_URL;

    const response = await POST(new NextRequest('http://localhost/api/ml/query', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ question: 'How many claims?' }),
    }), { userId: 'u1', organizationId: 'org_1' });

    expect(response.status).toBe(500);
  });
});
