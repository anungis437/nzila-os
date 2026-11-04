import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { declaredOptions } from './with-api-double';

const m = vi.hoisted(() => ({
  checkRateLimit: vi.fn(),
  createRateLimitHeaders: vi.fn(),
  generateAnnualComplianceReport: vi.fn(),
  logApiAuditEvent: vi.fn(),
  standardErrorResponse: vi.fn(),
}));

vi.mock('@/lib/api/framework', async () => (await import('./with-api-double')).frameworkDouble);
vi.mock('@/lib/rate-limiter', () => ({
  checkRateLimit: m.checkRateLimit,
  createRateLimitHeaders: m.createRateLimitHeaders,
  RATE_LIMITS: { CLC_OPERATIONS: { requests: 50, window: 3600 } },
}));
vi.mock('@/services/clc/compliance-reports', () => ({ generateAnnualComplianceReport: m.generateAnnualComplianceReport }));
vi.mock('@/lib/middleware/api-security', () => ({ logApiAuditEvent: m.logApiAuditEvent }));
vi.mock('@/lib/api/standardized-responses', () => ({
  ErrorCode: { VALIDATION_ERROR: 'VALIDATION_ERROR', INTERNAL_ERROR: 'INTERNAL_ERROR', AUTH_REQUIRED: 'AUTH_REQUIRED', FORBIDDEN: 'FORBIDDEN' },
  standardErrorResponse: m.standardErrorResponse,
}));

async function loadRoute() {
  return import('../admin/clc/analytics/annual-report/route');
}

describe('admin/clc/analytics/annual-report route', () => {
  const authorized = { userId: 'u1', organizationId: 'org-a' };
  beforeEach(() => {
    vi.clearAllMocks();
    m.checkRateLimit.mockResolvedValue({ allowed: true, resetIn: 0 });
    m.createRateLimitHeaders.mockReturnValue({ 'x-ratelimit-remaining': '49' });
    m.generateAnnualComplianceReport.mockResolvedValue({ year: 2026, findings: [] });
    m.standardErrorResponse.mockImplementation((code: string, message: string) =>
      new Response(JSON.stringify({ code, message }), { status: code === 'VALIDATION_ERROR' ? 400 : code === 'FORBIDDEN' ? 403 : code === 'AUTH_REQUIRED' ? 401 : 500 }));
  });

  it('asks the wrapper for an administrator, an audit record, and the organization\'s own tenant transaction', async () => {
    const { GET } = await loadRoute();
    expect(declaredOptions(GET)).toMatchObject({
      auth: { minRole: 'admin' },
      rlsOrgContext: true,
      registry: { audience: 'admin', evidenceRequired: true },
    });
  });

  it('returns 429 when rate limit is exceeded', async () => {
    const { GET } = await loadRoute();
    m.checkRateLimit.mockResolvedValueOnce({ allowed: false, resetIn: 120 });

    const response = await GET(new NextRequest('http://localhost/api/admin/clc/analytics/annual-report?year=2026'), authorized);

    expect(response.status).toBe(429);
  });

  it('returns 400 for invalid year parameter', async () => {
    const { GET } = await loadRoute();

    const response = await GET(new NextRequest('http://localhost/api/admin/clc/analytics/annual-report?year=1900'), authorized);

    expect(response.status).toBe(400);
  });

  it('returns annual report on success', async () => {
    const { GET } = await loadRoute();

    const response = await GET(new NextRequest('http://localhost/api/admin/clc/analytics/annual-report?year=2026'), authorized);
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toMatchObject({ year: 2026, findings: [] });
    expect(m.generateAnnualComplianceReport).toHaveBeenCalledWith(2026, 'org-a');
  });

  it('rejects missing organization and never queries the report service', async () => {
    const { GET } = await loadRoute();
    const response = await GET(new NextRequest('http://localhost/api/admin/clc/analytics/annual-report?year=2026'), { userId: 'u1', organizationId: null });
    expect(response.status).toBe(403);
    expect(m.generateAnnualComplianceReport).not.toHaveBeenCalled();
  });

  it('rejects a year with trailing characters instead of parsing its numeric prefix', async () => {
    const { GET } = await loadRoute();
    const response = await GET(new NextRequest('http://localhost/api/admin/clc/analytics/annual-report?year=2026garbage'), authorized);
    expect(response.status).toBe(400);
    expect(m.generateAnnualComplianceReport).not.toHaveBeenCalled();
  });

  it('returns 500 when report generation fails', async () => {
    const { GET } = await loadRoute();
    m.generateAnnualComplianceReport.mockRejectedValueOnce(new Error('db down'));

    const response = await GET(new NextRequest('http://localhost/api/admin/clc/analytics/annual-report?year=2026'), authorized);

    expect(response.status).toBe(500);
  });
});