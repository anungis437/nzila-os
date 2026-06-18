import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const m = vi.hoisted(() => ({
  withRoleAuth: vi.fn(),
  checkRateLimit: vi.fn(),
  suggestRelevantClauses: vi.fn(),
  logger: { warn: vi.fn(), info: vi.fn(), error: vi.fn() },
  eventBus: { emit: vi.fn() },
}));

vi.mock('@/lib/role-middleware', () => ({ withRoleAuth: m.withRoleAuth }));
vi.mock('@/lib/utils/smart-onboarding', () => ({ suggestRelevantClauses: m.suggestRelevantClauses }));
vi.mock('@/lib/logger', () => ({ logger: m.logger }));
vi.mock('@/lib/events', () => ({ eventBus: m.eventBus, AppEvents: { AUDIT_LOG: 'AUDIT_LOG' } }));
vi.mock('@/lib/rate-limiter', () => ({
  checkRateLimit: m.checkRateLimit,
  RATE_LIMITS: { ONBOARDING: 'ONBOARDING' },
  createRateLimitHeaders: vi.fn(() => ({ 'x-rate-limit': '1' })),
}));
vi.mock('@/lib/api/standardized-responses', () => ({
  ErrorCode: { VALIDATION_ERROR: 'VALIDATION_ERROR' },
  standardErrorResponse: (code: string, message: string, details?: unknown) =>
    new Response(JSON.stringify({ code, message, details }), { status: 400 }),
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
      { userId: 'u1', organizationId: 'org_1' },
    );

    expect(response.status).toBe(200);
    expect(m.suggestRelevantClauses).toHaveBeenCalledWith('550e8400-e29b-41d4-a716-446655440000');
    expect(m.eventBus.emit).toHaveBeenCalled();
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
      { userId: 'u1', organizationId: 'org_1' },
    );

    expect(response.status).toBe(429);
  });
});