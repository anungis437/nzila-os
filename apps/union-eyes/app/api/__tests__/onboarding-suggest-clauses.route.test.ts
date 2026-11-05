import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const m = vi.hoisted(() => ({
  withRoleAuth: vi.fn(),
  checkRateLimit: vi.fn(),
  suggestRelevantClauses: vi.fn(),
  logger: { warn: vi.fn(), info: vi.fn(), error: vi.fn() },
  eventBus: { emit: vi.fn() },
  record: vi.fn(),
}));

vi.mock('@/lib/role-middleware', () => ({ withRoleAuth: m.withRoleAuth }));
vi.mock('@/lib/utils/smart-onboarding', () => ({ suggestRelevantClauses: m.suggestRelevantClauses }));
vi.mock('@/lib/logger', () => ({ logger: m.logger }));
// The read audit moved from an in-process event to the canonical audit log (B87); the writer has its own coverage.
vi.mock('@/lib/utils/onboarding-read-audit', () => ({ recordOnboardingRead: m.record }));
vi.mock('@/lib/events', () => ({ eventBus: m.eventBus, AppEvents: { AUDIT_LOG: 'AUDIT_LOG' } }));
vi.mock('@/lib/rate-limiter', () => ({
  checkRateLimit: m.checkRateLimit,
  RATE_LIMITS: { ONBOARDING: 'ONBOARDING' },
  createRateLimitHeaders: vi.fn(() => ({ 'x-rate-limit': '1' })),
}));
vi.mock('@/lib/api/standardized-responses', () => ({
  ErrorCode: { VALIDATION_ERROR: 'VALIDATION_ERROR', FORBIDDEN: 'FORBIDDEN', RESOURCE_NOT_FOUND: 'RESOURCE_NOT_FOUND' },
  standardErrorResponse: (code: string, message: string, details?: unknown) =>
    new Response(JSON.stringify({ code, message, details }), { status: code === 'RESOURCE_NOT_FOUND' ? 404 : code === 'FORBIDDEN' ? 403 : 400 }),
}));

async function loadRoute() {
  return import('../onboarding/suggest-clauses/route');
}

describe('onboarding/suggest-clauses route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.withRoleAuth.mockImplementation(
      (_role: string, handler: (request: NextRequest, context: any) => Promise<Response>) =>
        (request: NextRequest, context: any = {}) => handler(request, context),
    );
    m.checkRateLimit.mockResolvedValue({ allowed: true, resetIn: 0 });
    m.suggestRelevantClauses.mockResolvedValue([{ clauseId: 'clause_1', relevanceScore: 0.9 }]);
  });

  it('returns clause suggestions', async () => {
    const { POST } = await loadRoute();
    const response = await POST(
      new NextRequest('http://localhost/api/onboarding/suggest-clauses', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ organizationId: '550e8400-e29b-41d4-a716-446655440000' }),
      }),
      { userId: 'u1', organizationId: '550e8400-e29b-41d4-a716-446655440000' },
    );

    expect(response.status).toBe(200);
    expect(m.suggestRelevantClauses).toHaveBeenCalledWith('550e8400-e29b-41d4-a716-446655440000');
    expect(m.record).toHaveBeenCalledWith(expect.anything(), 'onboarding.clause_suggestions', expect.anything());
  });

  it('returns 429 when rate limited', async () => {
    m.checkRateLimit.mockResolvedValueOnce({ allowed: false, resetIn: 60 });
    const { POST } = await loadRoute();
    const response = await POST(
      new NextRequest('http://localhost/api/onboarding/suggest-clauses', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ organizationId: '550e8400-e29b-41d4-a716-446655440000' }),
      }),
      { userId: 'u1', organizationId: '550e8400-e29b-41d4-a716-446655440000' },
    );

    expect(response.status).toBe(429);
  });

  it('answers 404 and suggests nothing for another organization named in the body, and 403 with no organization', async () => {
    const { POST } = await loadRoute();
    const request = () => new NextRequest('http://localhost/api/onboarding/suggest-clauses', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ organizationId: '660e8400-e29b-41d4-a716-446655440000' }),
    });
    expect((await POST(request(), { userId: 'u1', organizationId: '550e8400-e29b-41d4-a716-446655440000' })).status).toBe(404);
    expect((await POST(request(), { userId: 'u1', organizationId: null })).status).toBe(403);
    expect(m.suggestRelevantClauses).not.toHaveBeenCalled();
  });
});
