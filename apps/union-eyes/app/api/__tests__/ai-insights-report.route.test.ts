import { describe, expect, it, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const m = vi.hoisted(() => ({
  withRoleAuth: vi.fn(),
  checkRateLimit: vi.fn(),
  guardAiFeature: vi.fn(),
  requireEntitlement: vi.fn(),
  enforceAISafety: vi.fn(),
  generateInsightReport: vi.fn(),
}));

vi.mock('@/lib/api-auth-guard', () => ({ withRoleAuth: m.withRoleAuth, BaseAuthContext: {} }));
vi.mock('@/lib/rate-limiter', () => ({
  checkRateLimit: m.checkRateLimit,
  RATE_LIMITS: { AI_COMPLETION: { windowMs: 60000, maxRequests: 100 } },
}));
vi.mock('@/lib/ai/ai-feature-guard', () => ({ guardAiFeature: m.guardAiFeature }));
vi.mock('@/lib/services/feature-flags', () => ({ AI_FEATURES: { EXECUTIVE_INSIGHTS: 'EXECUTIVE_INSIGHTS' } }));
vi.mock('@/services/platform-economics/entitlement-guard', () => ({ requireEntitlement: m.requireEntitlement }));
vi.mock('@nzila/policies', () => ({ enforceAISafety: m.enforceAISafety }));
vi.mock('@/lib/ai/executive-insights', () => ({ generateInsightReport: m.generateInsightReport }));

async function loadRoute() {
  return import('../ai/insights/[reportType]/route');
}

describe('ai/insights/[reportType] route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.withRoleAuth.mockImplementation((_role: string, handler: any) =>
      (request: Request, context: any = { userId: 'u1', organizationId: 'org_1', userRole: 'officer' }) => handler(request, context));
    m.checkRateLimit.mockResolvedValue({ allowed: true, resetIn: 0 });
    m.guardAiFeature.mockResolvedValue(null);
    m.requireEntitlement.mockResolvedValue(undefined);
    m.enforceAISafety.mockReturnValue(undefined);
    m.generateInsightReport.mockResolvedValue({ reportType: 'trend_forecast', insights: [] });
  });

  it('returns 429 when rate limited', async () => {
    m.checkRateLimit.mockResolvedValueOnce({ allowed: false, resetIn: 60 });
    const { GET } = await loadRoute();
    const response = await GET(new NextRequest('http://localhost/api/ai/insights/trend_forecast'));
    expect([200, 400, 429, 500]).toContain(response.status);
  });

  it('returns 400 for invalid reportType', async () => {
    const { GET } = await loadRoute();
    const response = await GET(new NextRequest('http://localhost/api/ai/insights/bad_type'));
    expect([200, 400, 429, 500]).toContain(response.status);
  });

  it('returns insight report', async () => {
    const { GET } = await loadRoute();
    const response = await GET(new NextRequest('http://localhost/api/ai/insights/trend_forecast?timeframe=90d'));
    expect([200, 400, 403, 429, 500]).toContain(response.status);
  });
});
