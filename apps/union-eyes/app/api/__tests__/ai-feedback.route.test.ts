import { beforeEach, describe, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => ({
  withRoleAuth: vi.fn(),
  checkRateLimit: vi.fn(),
  createRateLimitHeaders: vi.fn(),
  guardAiFeature: vi.fn(),
  enforceAISafety: vi.fn(),
  db: { select: vi.fn(), insert: vi.fn(), execute: vi.fn() },
  withRLSContext: vi.fn(),
  standardErrorResponse: vi.fn(),
  selectQueue: [] as unknown[][],
}));

vi.mock('@/lib/api-auth-guard', () => ({ withRoleAuth: m.withRoleAuth, BaseAuthContext: {} }));
vi.mock('@/lib/rate-limiter', () => ({
  checkRateLimit: m.checkRateLimit,
  RATE_LIMITS: { AI_COMPLETION: { limit: 10 } },
  createRateLimitHeaders: m.createRateLimitHeaders,
}));
vi.mock('@/lib/ai/ai-feature-guard', () => ({ guardAiFeature: m.guardAiFeature }));
vi.mock('@nzila/policies', () => ({ enforceAISafety: m.enforceAISafety }));
vi.mock('@/db/db', () => ({ db: m.db }));
vi.mock('@/lib/db/with-rls-context', () => ({ withRLSContext: m.withRLSContext }));
vi.mock('@/lib/services/feature-flags', () => ({ AI_FEATURES: { AI_FEEDBACK: 'AI_FEEDBACK' } }));
vi.mock('@/lib/logger', () => ({ logger: { error: vi.fn() } }));
vi.mock('@/lib/api/standardized-responses', () => {
  const statusByCode: Record<string, number> = {
    VALIDATION_ERROR: 400,
    INTERNAL_ERROR: 500,
  };
  return {
    ErrorCode: {
      VALIDATION_ERROR: 'VALIDATION_ERROR',
      INTERNAL_ERROR: 'INTERNAL_ERROR',
    },
    standardErrorResponse: m.standardErrorResponse.mockImplementation((code: string, message: string) =>
      new Response(JSON.stringify({ code, message }), { status: statusByCode[code] ?? 400 })),
  };
});

async function loadRoute() {
  return import('../ai/feedback/route');
}

describe('ai/feedback route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.selectQueue = [];
    m.withRoleAuth.mockImplementation((_role: string, handler: any) => (request: any, ctx: any = { userId: 'u1', organizationId: 'org_1' }) => handler(request, ctx));
    m.checkRateLimit.mockResolvedValue({ allowed: true });
    m.createRateLimitHeaders.mockReturnValue({});
    m.guardAiFeature.mockResolvedValue(null);
    m.enforceAISafety.mockReturnValue(undefined);

    const createSelectChain = () => {
      const chain: {
        from: () => unknown;
        where: () => unknown;
        limit: () => unknown;
        then: (resolve: (value: unknown[]) => unknown, reject: (reason: unknown) => unknown) => Promise<unknown>;
      } = {
        from: () => chain,
        where: () => chain,
        limit: () => chain,
        then: (resolve, reject) => Promise.resolve((m.selectQueue.shift() ?? []) as unknown[]).then(resolve, reject),
      };
      return chain;
    };

    m.db.select = vi.fn(() => createSelectChain());
    m.db.insert = vi.fn(() => ({ values: vi.fn(() => ({ returning: vi.fn(async () => [{ id: 'f1' }]) })) }));
    m.withRLSContext.mockImplementation(async (fn: any) => fn());
  });

  it('returns 429 when rate-limited', async () => {
    const { POST } = await loadRoute();
    m.checkRateLimit.mockResolvedValueOnce({ allowed: false });
    const response = await POST(new Request('http://localhost/api/ai/feedback', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ query_id: '11111111-1111-1111-1111-111111111111', rating: 'good' }),
    }));
    expect(response.status).toBe(429);
  });

  it('returns 400 when organization context is missing', async () => {
    const { POST } = await loadRoute();
    const response = await POST(new Request('http://localhost/api/ai/feedback', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ query_id: '11111111-1111-1111-1111-111111111111', rating: 'good' }),
    }), { userId: 'u1', organizationId: '' });

    expect(response.status).toBe(400);
  });

  it('returns blocked response when AI feature is disabled', async () => {
    const { POST } = await loadRoute();
    m.guardAiFeature.mockResolvedValueOnce(new Response(JSON.stringify({ error: 'blocked' }), { status: 403 }));

    const response = await POST(new Request('http://localhost/api/ai/feedback', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ query_id: '11111111-1111-1111-1111-111111111111', rating: 'good' }),
    }));

    expect(response.status).toBe(403);
  });

  it('returns validation error for malformed payload', async () => {
    const { POST } = await loadRoute();

    const response = await POST(new Request('http://localhost/api/ai/feedback', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ query_id: 'not-a-uuid', rating: 'good' }),
    }));

    expect(response.status).toBe(400);
  });

  it('creates feedback when no prior feedback exists', async () => {
    const { POST } = await loadRoute();
    m.selectQueue.push([]);

    const response = await POST(new Request('http://localhost/api/ai/feedback', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ query_id: '11111111-1111-1111-1111-111111111111', rating: 'good', comment: 'helpful' }),
    }));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.created).toBe(true);
    expect(payload.id).toBe('f1');
    expect(m.withRLSContext).not.toHaveBeenCalled();
  });

  it('updates existing feedback for the same user and query', async () => {
    const { POST } = await loadRoute();
    m.selectQueue.push([{ id: 'existing_feedback' }]);

    const response = await POST(new Request('http://localhost/api/ai/feedback', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ query_id: '11111111-1111-1111-1111-111111111111', rating: 'bad', comment: 'not accurate' }),
    }));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.updated).toBe(true);
    expect(payload.id).toBe('existing_feedback');
    expect(m.withRLSContext).toHaveBeenCalled();
  });

  it('validates query_id is required for GET', async () => {
    const { GET } = await loadRoute();
    const response = await GET(new Request('http://localhost/api/ai/feedback'));
    expect(response.status).toBe(400);
  });

  it('returns feedback list for a query id', async () => {
    const { GET } = await loadRoute();
    m.selectQueue.push([
      {
        id: 'fb_1',
        requestId: '11111111-1111-1111-1111-111111111111',
        userId: 'u1',
        metadata: { rating: 'good', comment: 'solid answer' },
        createdAt: '2026-06-11T00:00:00.000Z',
      },
    ]);

    const response = await GET(new Request('http://localhost/api/ai/feedback?query_id=11111111-1111-1111-1111-111111111111'));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.count).toBe(1);
    expect(payload.feedback[0]).toMatchObject({ id: 'fb_1', rating: 'good', comment: 'solid answer' });
  });
});
