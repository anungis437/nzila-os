import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const m = vi.hoisted(() => ({
  checkRateLimit: vi.fn(),
  createRateLimitHeaders: vi.fn(),
  analyzeMultiYearTrends: vi.fn(),
  logApiAuditEvent: vi.fn(),
}));

vi.mock('@/lib/api/framework', async () => (await import('./support/with-api-stub')).frameworkModule);
vi.mock('@/lib/rate-limiter', () => ({
  checkRateLimit: m.checkRateLimit,
  createRateLimitHeaders: m.createRateLimitHeaders,
  RATE_LIMITS: { CLC_OPERATIONS: { requests: 50, window: 3600 } },
}));
vi.mock('@/services/clc/compliance-reports', () => ({ analyzeMultiYearTrends: m.analyzeMultiYearTrends }));
vi.mock('@/lib/middleware/api-security', () => ({ logApiAuditEvent: m.logApiAuditEvent }));

const { caller, declared, resetCaller } = await import('./support/with-api-stub');

async function loadRoute() {
  return import('../admin/clc/analytics/trends/route');
}

describe('admin/clc/analytics/trends route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetCaller();
    caller.organizationId = 'org-a';
    m.checkRateLimit.mockResolvedValue({ allowed: true, resetIn: 0 });
    m.createRateLimitHeaders.mockReturnValue({ 'x-ratelimit-remaining': '49' });
    m.analyzeMultiYearTrends.mockResolvedValue({ years: 3, trend: [] });
  });

  it('declares what it asks of the wrapper: an admin, in the caller organization\'s tenant transaction', async () => {
    await loadRoute();
    const config = declared.find((entry) => entry.openapi?.summary === 'CLC multi-year remittance trends (3, 5 or 10 years)');
    expect(config?.auth).toEqual({ minRole: 'admin' });
    expect(config?.rlsOrgContext).toBe(true);
  });

  it('refuses a caller below the admin role without reading tenant reports', async () => {
    caller.role = 'officer';
    const { GET } = await loadRoute();

    const response = await GET(new NextRequest('http://localhost/api/admin/clc/analytics/trends?years=3'));

    expect(response.status).toBe(403);
    expect(m.checkRateLimit).not.toHaveBeenCalled();
    expect(m.analyzeMultiYearTrends).not.toHaveBeenCalled();
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
    expect(m.analyzeMultiYearTrends).toHaveBeenCalledWith({ years: 5, organizationId: 'org-a' });
  });

  it('refuses missing organization context without reading tenant reports', async () => {
    caller.organizationId = null;
    const { GET } = await loadRoute();
    const response = await GET(new NextRequest('http://localhost/api/admin/clc/analytics/trends?years=5'));
    expect(response.status).toBe(403);
    expect(m.checkRateLimit).not.toHaveBeenCalled();
    expect(m.analyzeMultiYearTrends).not.toHaveBeenCalled();
  });

  it('rejects trailing characters in a trend period', async () => {
    const { GET } = await loadRoute();
    const response = await GET(new NextRequest('http://localhost/api/admin/clc/analytics/trends?years=5junk'));
    expect(response.status).toBe(400);
    expect(m.analyzeMultiYearTrends).not.toHaveBeenCalled();
  });

  it('returns 500 when trend analysis fails', async () => {
    const { GET } = await loadRoute();
    m.analyzeMultiYearTrends.mockRejectedValueOnce(new Error('service down'));

    const response = await GET(new NextRequest('http://localhost/api/admin/clc/analytics/trends?years=3'));

    expect(response.status).toBe(500);
  });
});