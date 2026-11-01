import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const m = vi.hoisted(() => ({
  withRoleAuth: vi.fn(),
  checkRateLimit: vi.fn(),
  createRateLimitHeaders: vi.fn(),
  forecastRemittances: vi.fn(),
  logApiAuditEvent: vi.fn(),
  standardErrorResponse: vi.fn(),
}));

vi.mock('@/lib/api-auth-guard', () => ({ withRoleAuth: m.withRoleAuth }));
vi.mock('@/lib/rate-limiter', () => ({
  checkRateLimit: m.checkRateLimit,
  createRateLimitHeaders: m.createRateLimitHeaders,
  RATE_LIMITS: { CLC_OPERATIONS: { requests: 50, window: 3600 } },
}));
vi.mock('@/services/clc/compliance-reports', () => ({ forecastRemittances: m.forecastRemittances }));
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
  return import('../admin/clc/analytics/forecast/route');
}

const request = (query = '') =>
  new NextRequest('http://localhost/api/admin/clc/analytics/forecast' + query);
const authorized = { userId: 'user-1', organizationId: 'org-1' };

describe('admin/clc/analytics/forecast route: tenant and financial controls', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.withRoleAuth.mockImplementation((_role: string, handler: any) =>
      (req: NextRequest, context: any = authorized) => handler(req, context));
    m.checkRateLimit.mockResolvedValue({ allowed: true, resetIn: 0 });
    m.createRateLimitHeaders.mockReturnValue({ 'x-ratelimit-remaining': '0' });
    m.forecastRemittances.mockResolvedValue({ monthsAhead: 12, points: [] });
    m.standardErrorResponse.mockImplementation((code: string, message: string) => {
      const status: Record<string, number> = {
        AUTH_REQUIRED: 401, FORBIDDEN: 403, VALIDATION_ERROR: 400, INTERNAL_ERROR: 500,
      };
      return new Response(JSON.stringify({ code, message }), { status: status[code] ?? 500 });
    });
  });

  it('denies a missing actor before touching the limiter or financial service', async () => {
    const { GET } = await loadRoute();
    const response = await GET(request(), { userId: '', organizationId: 'org-1' });
    expect(response.status).toBe(401);
    expect(m.checkRateLimit).not.toHaveBeenCalled();
    expect(m.forecastRemittances).not.toHaveBeenCalled();
  });

  it('denies an absent tenant before touching the limiter or financial service', async () => {
    const { GET } = await loadRoute();
    const response = await GET(request(), { userId: 'user-1', organizationId: null });
    expect(response.status).toBe(403);
    expect(m.checkRateLimit).not.toHaveBeenCalled();
    expect(m.forecastRemittances).not.toHaveBeenCalled();
  });

  it('enforces the shared CLC request limiter before querying remittances', async () => {
    const { GET } = await loadRoute();
    m.checkRateLimit.mockResolvedValueOnce({ allowed: false, resetIn: 90 });
    const response = await GET(request('?months=6'), authorized);
    expect(response.status).toBe(429);
    expect(response.headers.get('x-ratelimit-remaining')).toBe('0');
    expect(m.forecastRemittances).not.toHaveBeenCalled();
  });

  it.each(['0', '25', 'NaN', '6extra', '1.5', '-1', '', 'Infinity'])(
    'rejects malformed or out-of-range months=%s without a service call',
    async months => {
      const { GET } = await loadRoute();
      const response = await GET(request('?months=' + encodeURIComponent(months)), authorized);
      expect(response.status).toBe(400);
      expect(m.forecastRemittances).not.toHaveBeenCalled();
    },
  );

  it('uses the authenticated tenant, defaults to 12 months, and forbids shared caching', async () => {
    const { GET } = await loadRoute();
    const response = await GET(request(), authorized);
    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('private, no-store');
    expect(m.forecastRemittances).toHaveBeenCalledWith(12, 'org-1');
    expect(m.checkRateLimit).toHaveBeenCalledWith('user-1', expect.anything());
  });

  it('does not accept a query-string organization override', async () => {
    const { GET } = await loadRoute();
    const response = await GET(request('?months=6&organizationId=org-2'), authorized);
    expect(response.status).toBe(200);
    expect(m.forecastRemittances).toHaveBeenCalledWith(6, 'org-1');
  });

  it('fails closed when forecast generation throws', async () => {
    const { GET } = await loadRoute();
    m.forecastRemittances.mockRejectedValueOnce(new Error('service failure'));
    const response = await GET(request('?months=6'), authorized);
    expect(response.status).toBe(500);
  });
});
