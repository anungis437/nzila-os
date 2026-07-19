import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const m = vi.hoisted(() => ({
  withRoleAuth: vi.fn(),
  checkRateLimit: vi.fn(),
  guardAiFeature: vi.fn(),
  requireEntitlement: vi.fn(),
  enforceAISafety: vi.fn(),
  generateInsightReport: vi.fn(),
  standardErrorResponse: vi.fn(),
  standardSuccessResponse: vi.fn(),
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
vi.mock('@/lib/api/standardized-responses', () => ({
  ErrorCode: {
    RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED',
    VALIDATION_ERROR: 'VALIDATION_ERROR',
    INTERNAL_ERROR: 'INTERNAL_ERROR',
  },
  standardErrorResponse: m.standardErrorResponse,
  standardSuccessResponse: m.standardSuccessResponse,
}));

async function loadRoute() {
  return import('../ai/insights/[reportType]/route');
}

describe('ai/insights/[reportType] route (strong)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.withRoleAuth.mockImplementation((_role: string, handler: any) =>
      (request: NextRequest, context: any = { userId: 'u1', organizationId: 'org_1', userRole: 'officer' }) => handler(request, context));
    m.checkRateLimit.mockResolvedValue({ allowed: true, resetIn: 0 });
    m.guardAiFeature.mockResolvedValue(null);
    m.requireEntitlement.mockResolvedValue(undefined);
    m.enforceAISafety.mockReturnValue(undefined);
    m.generateInsightReport.mockResolvedValue({ reportType: 'trend_forecast', insights: ['a'] });
    m.standardErrorResponse.mockImplementation((code: string, message: string) => new Response(JSON.stringify({ code, message }), { status: code === 'RATE_LIMIT_EXCEEDED' ? 429 : code === 'VALIDATION_ERROR' ? 400 : 500 }));
    m.standardSuccessResponse.mockImplementation((data: any) => new Response(JSON.stringify({ data }), { status: 200 }));
  });

  it('returns 429 when rate limited', async () => {
    const { GET } = await loadRoute();
    m.checkRateLimit.mockResolvedValueOnce({ allowed: false, resetIn: 60 });

    const response = await GET(new NextRequest('http://localhost/api/ai/insights/trend_forecast'));

    expect(response.status).toBe(429);
  });

  it('returns 400 for invalid reportType', async () => {
    const { GET } = await loadRoute();

    const response = await GET(new NextRequest('http://localhost/api/ai/insights/not_valid'));

    expect(response.status).toBe(400);
  });

  it('returns feature guard response when blocked', async () => {
    const { GET } = await loadRoute();
    m.guardAiFeature.mockResolvedValueOnce(new Response('blocked', { status: 403 }));

    const response = await GET(new NextRequest('http://localhost/api/ai/insights/trend_forecast'));

    expect(response.status).toBe(403);
  });

  it('returns 200 and insight report on success', async () => {
    const { GET } = await loadRoute();

    const response = await GET(new NextRequest('http://localhost/api/ai/insights/trend_forecast?timeframe=30d'));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.data).toMatchObject({ reportType: 'trend_forecast' });
    expect(m.generateInsightReport).toHaveBeenCalledWith(expect.objectContaining({ reportType: 'trend_forecast', timeframe: '30d' }));
  });

  it('returns 500 when generation fails', async () => {
    const { GET } = await loadRoute();
    m.generateInsightReport.mockRejectedValueOnce(new Error('model down'));

    const response = await GET(new NextRequest('http://localhost/api/ai/insights/trend_forecast?timeframe=90d'));

    expect(response.status).toBe(500);
  });
});