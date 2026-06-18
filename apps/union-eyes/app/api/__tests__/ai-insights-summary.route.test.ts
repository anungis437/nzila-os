import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const m = vi.hoisted(() => ({
  withRoleAuth: vi.fn(),
  checkRateLimit: vi.fn(),
  guardAiFeature: vi.fn(),
  requireEntitlement: vi.fn(),
  enforceAISafety: vi.fn(),
  getInsightReports: vi.fn(),
  auditAIInvocation: vi.fn(),
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
vi.mock('@/lib/ai/executive-insights', () => ({ getInsightReports: m.getInsightReports }));
vi.mock('@/lib/audit-logger', () => ({ auditAIInvocation: m.auditAIInvocation }));
vi.mock('@/lib/api/standardized-responses', () => ({
  ErrorCode: {
    RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED',
    FORBIDDEN: 'FORBIDDEN',
    INTERNAL_ERROR: 'INTERNAL_ERROR',
  },
  standardErrorResponse: m.standardErrorResponse,
  standardSuccessResponse: m.standardSuccessResponse,
}));

async function loadRoute() {
  return import('../ai/insights/summary/route');
}

describe('ai/insights/summary route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.withRoleAuth.mockImplementation((_role: string, handler: any) =>
      (request: NextRequest, context: any = { userId: 'u1', organizationId: 'org_1', userRole: 'officer' }) => handler(request, context));
    m.checkRateLimit.mockResolvedValue({ allowed: true, resetIn: 0 });
    m.guardAiFeature.mockResolvedValue(null);
    m.requireEntitlement.mockResolvedValue(undefined);
    m.enforceAISafety.mockReturnValue(undefined);
    m.getInsightReports.mockResolvedValue([{ id: 'rep_1', score: 90 }]);
    m.auditAIInvocation.mockResolvedValue('audit_1');
    m.standardErrorResponse.mockImplementation((code: string, message: string) => new Response(JSON.stringify({ code, message }), { status: code === 'RATE_LIMIT_EXCEEDED' ? 429 : code === 'FORBIDDEN' ? 403 : 500 }));
    m.standardSuccessResponse.mockImplementation((data: any, meta?: any) => new Response(JSON.stringify({ data, meta }), { status: 200 }));
  });

  it('returns 429 when rate limited', async () => {
    const { GET } = await loadRoute();
    m.checkRateLimit.mockResolvedValueOnce({ allowed: false, resetIn: 45 });

    const response = await GET(new NextRequest('http://localhost/api/ai/insights/summary'));

    expect(response.status).toBe(429);
  });

  it('returns feature guard response when blocked', async () => {
    const { GET } = await loadRoute();
    m.guardAiFeature.mockResolvedValueOnce(new Response(JSON.stringify({ error: 'blocked' }), { status: 403 }));

    const response = await GET(new NextRequest('http://localhost/api/ai/insights/summary'));

    expect(response.status).toBe(403);
  });

  it('returns 403 when entitlement check fails', async () => {
    const { GET } = await loadRoute();
    m.requireEntitlement.mockRejectedValueOnce(new Error('entitlement missing'));

    const response = await GET(new NextRequest('http://localhost/api/ai/insights/summary'));

    expect(response.status).toBe(403);
  });

  it('returns summary payload on success', async () => {
    const { GET } = await loadRoute();

    const response = await GET(new NextRequest('http://localhost/api/ai/insights/summary'));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.data).toMatchObject({ latestTrendForecast: { id: 'rep_1' } });
    expect(payload.meta).toMatchObject({ aiGenerated: true, auditRefId: 'audit_1' });
    expect(m.getInsightReports).toHaveBeenCalledTimes(5);
  });

  it('returns 500 when report fetch fails', async () => {
    const { GET } = await loadRoute();
    m.getInsightReports.mockRejectedValueOnce(new Error('db down'));

    const response = await GET(new NextRequest('http://localhost/api/ai/insights/summary'));

    expect(response.status).toBe(500);
  });
});