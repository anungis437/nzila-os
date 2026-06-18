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
  return import('../admin/clc/analytics/trends/route');
}

describe('admin/clc/analytics/trends route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.withRoleAuth.mockImplementation((_role: string, handler: any) =>
      (request: NextRequest, context: any = { userId: 'u1' }) => handler(request, context));
    m.checkRateLimit.mockResolvedValue({ allowed: true, resetIn: 0 });
    m.createRateLimitHeaders.mockReturnValue({ 'x-ratelimit-remaining': '49' });
    m.analyzeMultiYearTrends.mockResolvedValue({ years: 3, trend: [] });
    m.standardErrorResponse.mockImplementation((code: string, message: string) =>
      new Response(JSON.stringify({ code, message }), { status: code === 'VALIDATION_ERROR' ? 400 : 500 }));
  });

  it('returns 429 when rate limited', async () => {
    const { GET } = await loadRoute();
    m.checkRateLimit.mockResolvedValueOnce({ allowed: false, resetIn: 100 });

    const response = await GET(new NextRequest('http://localhost/api/admin/clc/analytics/trends?years=3'));

    expect(response.status).toBe(429);
  });

  it('returns 400 for unsupported years parameter', async () => {
    const { GET } = await loadRoute();

    const response = await GET(new NextRequest('http://localhost/api/admin/clc/analytics/trends?years=4'));

    expect(response.status).toBe(400);
  });

  it('returns trend data for valid years', async () => {
    const { GET } = await loadRoute();

    const response = await GET(new NextRequest('http://localhost/api/admin/clc/analytics/trends?years=5'));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toMatchObject({ years: 3, trend: [] });
    expect(m.analyzeMultiYearTrends).toHaveBeenCalledWith({ years: 5 });
  });

  it('returns 500 when trend analysis fails', async () => {
    const { GET } = await loadRoute();
    m.analyzeMultiYearTrends.mockRejectedValueOnce(new Error('service down'));

    const response = await GET(new NextRequest('http://localhost/api/admin/clc/analytics/trends?years=3'));

    expect(response.status).toBe(500);
  });
});