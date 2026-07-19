import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const m = vi.hoisted(() => ({
  withRoleAuth: vi.fn(),
  checkRateLimit: vi.fn(),
  createRateLimitHeaders: vi.fn(),
  generateAnnualComplianceReport: vi.fn(),
  logApiAuditEvent: vi.fn(),
  standardErrorResponse: vi.fn(),
}));

vi.mock('@/lib/api-auth-guard', () => ({ withRoleAuth: m.withRoleAuth }));
vi.mock('@/lib/rate-limiter', () => ({
  checkRateLimit: m.checkRateLimit,
  createRateLimitHeaders: m.createRateLimitHeaders,
  RATE_LIMITS: { CLC_OPERATIONS: { requests: 50, window: 3600 } },
}));
vi.mock('@/services/clc/compliance-reports', () => ({ generateAnnualComplianceReport: m.generateAnnualComplianceReport }));
vi.mock('@/lib/middleware/api-security', () => ({ logApiAuditEvent: m.logApiAuditEvent }));
vi.mock('@/lib/api/standardized-responses', () => ({
  ErrorCode: { VALIDATION_ERROR: 'VALIDATION_ERROR', INTERNAL_ERROR: 'INTERNAL_ERROR' },
  standardErrorResponse: m.standardErrorResponse,
}));

async function loadRoute() {
  return import('../admin/clc/analytics/annual-report/route');
}

describe('admin/clc/analytics/annual-report route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.withRoleAuth.mockImplementation((_role: string, handler: any) =>
      (request: NextRequest, context: any = { userId: 'u1' }) => handler(request, context));
    m.checkRateLimit.mockResolvedValue({ allowed: true, resetIn: 0 });
    m.createRateLimitHeaders.mockReturnValue({ 'x-ratelimit-remaining': '49' });
    m.generateAnnualComplianceReport.mockResolvedValue({ year: 2026, findings: [] });
    m.standardErrorResponse.mockImplementation((code: string, message: string) =>
      new Response(JSON.stringify({ code, message }), { status: code === 'VALIDATION_ERROR' ? 400 : 500 }));
  });

  it('returns 429 when rate limit is exceeded', async () => {
    const { GET } = await loadRoute();
    m.checkRateLimit.mockResolvedValueOnce({ allowed: false, resetIn: 120 });

    const response = await GET(new NextRequest('http://localhost/api/admin/clc/analytics/annual-report?year=2026'));

    expect(response.status).toBe(429);
  });

  it('returns 400 for invalid year parameter', async () => {
    const { GET } = await loadRoute();

    const response = await GET(new NextRequest('http://localhost/api/admin/clc/analytics/annual-report?year=1900'));

    expect(response.status).toBe(400);
  });

  it('returns annual report on success', async () => {
    const { GET } = await loadRoute();

    const response = await GET(new NextRequest('http://localhost/api/admin/clc/analytics/annual-report?year=2026'));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toMatchObject({ year: 2026, findings: [] });
  });

  it('returns 500 when report generation fails', async () => {
    const { GET } = await loadRoute();
    m.generateAnnualComplianceReport.mockRejectedValueOnce(new Error('db down'));

    const response = await GET(new NextRequest('http://localhost/api/admin/clc/analytics/annual-report?year=2026'));

    expect(response.status).toBe(500);
  });
});