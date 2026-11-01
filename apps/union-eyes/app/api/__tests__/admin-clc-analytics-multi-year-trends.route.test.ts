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
  ErrorCode: {
    AUTH_REQUIRED: 'AUTH_REQUIRED',
    FORBIDDEN: 'FORBIDDEN',
    VALIDATION_ERROR: 'VALIDATION_ERROR',
    INTERNAL_ERROR: 'INTERNAL_ERROR',
  },
  standardErrorResponse: m.standardErrorResponse,
}));

async function loadRoute() {
  return import('../admin/clc/analytics/multi-year-trends/route');
}
const request = (query = '') =>
  new NextRequest('http://localhost/api/admin/clc/analytics/multi-year-trends' + query);
const authorized = { userId: 'user-1', organizationId: 'org-1' };

describe('admin/clc/analytics/multi-year-trends route: tenant and financial controls', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.withRoleAuth.mockImplementation((_role: string, handler: any) =>
      (req: NextRequest, context: any = authorized) => handler(req, context));
    m.checkRateLimit.mockResolvedValue({ allowed: true, resetIn: 0 });
    m.createRateLimitHeaders.mockReturnValue({ 'x-ratelimit-remaining': '0' });
    m.analyzeMultiYearTrends.mockResolvedValue({ years: [2024, 2025, 2026], trend: [] });
    m.standardErrorResponse.mockImplementation((code: string, message: string) => {
      const status: Record<string, number> = {
        AUTH_REQUIRED: 401, FORBIDDEN: 403, VALIDATION_ERROR: 400, INTERNAL_ERROR: 500,
      };
      return new Response(JSON.stringify({ code, message }), { status: status[code] ?? 500 });
    });
  });

  it('denies a missing authenticated actor before rate limiting or financial access', async () => {
    const { GET } = await loadRoute();
    const response = await GET(request(), { userId: undefined, organizationId: 'org-1' });
    expect(response.status).toBe(401);
    expect(m.checkRateLimit).not.toHaveBeenCalled();
    expect(m.analyzeMultiYearTrends).not.toHaveBeenCalled();
  });

  it('denies a missing organization before rate limiting or financial access', async () => {
    const { GET } = await loadRoute();
    const response = await GET(request(), { userId: 'user-1', organizationId: null });
    expect(response.status).toBe(403);
    expect(m.checkRateLimit).not.toHaveBeenCalled();
    expect(m.analyzeMultiYearTrends).not.toHaveBeenCalled();
  });

  it('rate-limits before querying financial data', async () => {
    const { GET } = await loadRoute();
    m.checkRateLimit.mockResolvedValueOnce({ allowed: false, resetIn: 60 });
    const response = await GET(request('?years=5'), authorized);
    expect(response.status).toBe(429);
    expect(m.analyzeMultiYearTrends).not.toHaveBeenCalled();
  });

  it.each(['4', '5foo', '3.5', '', 'NaN', '0', 'Infinity'])(
    'rejects unsupported or malformed years=%s without financial access',
    async years => {
      const { GET } = await loadRoute();
      const response = await GET(request('?years=' + encodeURIComponent(years)), authorized);
      expect(response.status).toBe(400);
      expect(m.analyzeMultiYearTrends).not.toHaveBeenCalled();
    },
  );

  it('uses only the authenticated tenant and no-store cache headers', async () => {
    const { GET } = await loadRoute();
    const response = await GET(request('?years=5&organizationId=org-2'), authorized);
    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('private, no-store');
    expect(m.analyzeMultiYearTrends).toHaveBeenCalledWith({ years: 5, organizationId: 'org-1' });
    expect(m.checkRateLimit).toHaveBeenCalledWith('user-1', expect.anything());
  });

  it('uses five years when the parameter is absent', async () => {
    const { GET } = await loadRoute();
    const response = await GET(request(), authorized);
    expect(response.status).toBe(200);
    expect(m.analyzeMultiYearTrends).toHaveBeenCalledWith({ years: 5, organizationId: 'org-1' });
  });

  it('returns an error rather than synthetic data when the service fails', async () => {
    const { GET } = await loadRoute();
    m.analyzeMultiYearTrends.mockRejectedValueOnce(new Error('database unavailable'));
    const response = await GET(request('?years=3'), authorized);
    expect(response.status).toBe(500);
  });
});
