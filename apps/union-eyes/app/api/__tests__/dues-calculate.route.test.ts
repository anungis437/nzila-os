import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const m = vi.hoisted(() => ({
  withRoleAuth: vi.fn(),
  requireEntitlement: vi.fn(),
  checkRateLimit: vi.fn(),
  createRateLimitHeaders: vi.fn(),
  DuesCalculationEngine: { calculateMemberDues: vi.fn() },
  logApiAuditEvent: vi.fn(),
  standardErrorResponse: vi.fn(),
}));

vi.mock('@/lib/api-auth-guard', () => ({ withRoleAuth: m.withRoleAuth }));
vi.mock('@/services/platform-economics/entitlement-guard', () => ({ requireEntitlement: m.requireEntitlement }));
vi.mock('@/lib/rate-limiter', () => ({
  checkRateLimit: m.checkRateLimit,
  RATE_LIMITS: { FINANCIAL_READ: { limit: 100 } },
  createRateLimitHeaders: m.createRateLimitHeaders,
}));
vi.mock('@/lib/dues-calculation-engine', () => ({ DuesCalculationEngine: m.DuesCalculationEngine }));
vi.mock('@/lib/middleware/api-security', () => ({ logApiAuditEvent: m.logApiAuditEvent }));
vi.mock('@/lib/api/standardized-responses', () => ({
  ErrorCode: { VALIDATION_ERROR: 'VALIDATION_ERROR', AUTH_REQUIRED: 'AUTH_REQUIRED', FORBIDDEN: 'FORBIDDEN', INTERNAL_ERROR: 'INTERNAL_ERROR' },
  standardErrorResponse: m.standardErrorResponse,
}));

async function loadRoute() {
  return import('../dues/calculate/route');
}

describe('dues/calculate route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.withRoleAuth.mockImplementation((_role: string, handler: any) => (request: NextRequest, context: any = { userId: 'u1', organizationId: 'org_1' }) => handler(request, context));
    m.requireEntitlement.mockResolvedValue(undefined);
    m.checkRateLimit.mockResolvedValue({ allowed: true });
    m.createRateLimitHeaders.mockReturnValue({});
    m.DuesCalculationEngine.calculateMemberDues.mockResolvedValue({ amount: 500, period: '2026-01' });
    m.standardErrorResponse.mockImplementation((code: string, message: string) =>
      new Response(JSON.stringify({ message }), { status: code === 'AUTH_REQUIRED' ? 401 : code === 'FORBIDDEN' ? 403 : 400 }));
  });

  it('returns 400 for invalid json', async () => {
    const { POST } = await loadRoute();
    const response = await POST(new NextRequest('http://localhost/api/dues/calculate', {
      method: 'POST', body: '{bad-json',
    }));

    expect(response.status).toBe(400);
  });

  it('returns 400 for missing required fields', async () => {
    const { POST } = await loadRoute();
    const response = await POST(new NextRequest('http://localhost/api/dues/calculate', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ memberId: 'x' }),
    }));

    expect(response.status).toBe(400);
  });

  it('returns 401 when context is missing', async () => {
    const { POST } = await loadRoute();
    const response = await POST(new NextRequest('http://localhost/api/dues/calculate', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ memberId: '11111111-1111-1111-1111-111111111111', periodStart: '2026-01-01', periodEnd: '2026-01-31' }),
    }), { userId: null, organizationId: null });

    expect(response.status).toBe(401);
  });

  it('returns 429 when rate-limited', async () => {
    const { POST } = await loadRoute();
    m.checkRateLimit.mockResolvedValueOnce({ allowed: false, resetIn: 60 });

    const response = await POST(new NextRequest('http://localhost/api/dues/calculate', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ memberId: '11111111-1111-1111-1111-111111111111', periodStart: '2026-01-01', periodEnd: '2026-01-31' }),
    }));

    expect(response.status).toBe(429);
  });

  it('calculates dues successfully', async () => {
    const { POST } = await loadRoute();
    const response = await POST(new NextRequest('http://localhost/api/dues/calculate', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ memberId: '11111111-1111-1111-1111-111111111111', periodStart: '2026-01-01', periodEnd: '2026-01-31' }),
    }));

    expect(response.status).toBe(200);
    expect(m.logApiAuditEvent).toHaveBeenCalled();
  });
});
