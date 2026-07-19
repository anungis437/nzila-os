import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const m = vi.hoisted(() => ({
  withRoleAuth: vi.fn(),
  checkRateLimit: vi.fn(),
  createRateLimitHeaders: vi.fn(),
  analyzeMultiYearTrends: vi.fn(),
  logApiAuditEvent: vi.fn(),
  standardErrorResponse: vi.fn(),
}));

vi.mock('@/lib/api-auth-guard', () => ({ withRoleAuth: m.withRoleAuth }));
vi.mock('@/lib/rate-limiter', () => ({
  checkRateLimit: m.checkRateLimit,
  createRateLimitHeaders: m.createRateLimitHeaders,
  RATE_LIMITS: { CLC_OPERATIONS: { requests: 50, window: 3600 } },
}));
vi.mock('@/services/clc/compliance-reports', () => ({ analyzeMultiYearTrends: m.analyzeMultiYearTrends }));
vi.mock('@/lib/middleware/api-security', () => ({ logApiAuditEvent: m.logApiAuditEvent }));
vi.mock('@/lib/api/standardized-responses', () => ({
  ErrorCode: { VALIDATION_ERROR: 'VALIDATION_ERROR', INTERNAL_ERROR: 'INTERNAL_ERROR' },
  standardErrorResponse: m.standardErrorResponse,
}));

async function loadRoute() {
  return import('../admin/clc/analytics/multi-year-trends/route');
}

describe('admin/clc/analytics/multi-year-trends route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.withRoleAuth.mockImplementation((_role: string, handler: any) =>
      (request: NextRequest, context: any = { userId: 'u1' }) => handler(request, context));
    m.checkRateLimit.mockResolvedValue({ allowed: true, resetIn: 0 });
    m.createRateLimitHeaders.mockReturnValue({ 'x-ratelimit-remaining': '49' });
    m.analyzeMultiYearTrends.mockResolvedValue({ years: 5, trend: [] });
    m.standardErrorResponse.mockImplementation((code: string, message: string) =>
      new Response(JSON.stringify({ code, message }), { status: code === 'VALIDATION_ERROR' ? 400 : 500 }));
  });

  it('returns 429 when rate limit is exceeded', async () => {
    const { GET } = await loadRoute();
    m.checkRateLimit.mockResolvedValueOnce({ allowed: false, resetIn: 120 });

    const response = await GET(new NextRequest('http://localhost/api/admin/clc/analytics/multi-year-trends?years=5'));

    expect(response.status).toBe(429);
  });

  it('returns 400 for invalid years parameter', async () => {
    const { GET } = await loadRoute();

    const response = await GET(new NextRequest('http://localhost/api/admin/clc/analytics/multi-year-trends?years=4'));

    expect(response.status).toBe(400);
  });

  it('returns trends for valid years parameter', async () => {
    const { GET } = await loadRoute();

    const response = await GET(new NextRequest('http://localhost/api/admin/clc/analytics/multi-year-trends?years=10'));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toMatchObject({ years: 5, trend: [] });
    expect(m.analyzeMultiYearTrends).toHaveBeenCalledWith({ years: 10 });
  });

  it('returns 500 when trend analysis fails', async () => {
    const { GET } = await loadRoute();
    m.analyzeMultiYearTrends.mockRejectedValueOnce(new Error('service down'));

    const response = await GET(new NextRequest('http://localhost/api/admin/clc/analytics/multi-year-trends?years=5'));

    expect(response.status).toBe(500);
  });
});