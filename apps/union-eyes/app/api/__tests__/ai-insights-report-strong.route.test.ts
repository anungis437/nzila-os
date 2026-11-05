import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';

const m = vi.hoisted(() => ({
  checkRateLimit: vi.fn(),
  guardAiFeature: vi.fn(),
  enforceAISafety: vi.fn(),
  generateInsightReport: vi.fn(),
}));

vi.mock('@/lib/api/framework', async () => (await import('./support/with-api-stub')).frameworkModule);
vi.mock('@/lib/rate-limiter', () => ({
  checkRateLimit: m.checkRateLimit,
  RATE_LIMITS: { AI_COMPLETION: { windowMs: 60000, maxRequests: 100 } },
}));
vi.mock('@/lib/ai/ai-feature-guard', () => ({ guardAiFeature: m.guardAiFeature }));
vi.mock('@/lib/services/feature-flags', () => ({ AI_FEATURES: { EXECUTIVE_INSIGHTS: 'EXECUTIVE_INSIGHTS' } }));
vi.mock('@nzila/policies', () => ({ enforceAISafety: m.enforceAISafety }));
vi.mock('@/lib/ai/executive-insights', () => ({ generateInsightReport: m.generateInsightReport }));

const { caller, declared, resetCaller } = await import('./support/with-api-stub');

async function loadRoute() {
  return import('../ai/insights/[reportType]/route');
}

async function getReport(reportType: string, query = '') {
  const { GET } = await loadRoute();
  return GET(new NextRequest(`http://localhost/api/ai/insights/${reportType}${query}`), { params: Promise.resolve({ reportType }) });
}

describe('ai/insights/[reportType] route (strong)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetCaller();
    caller.role = 'officer';
    m.checkRateLimit.mockResolvedValue({ allowed: true, resetIn: 0 });
    m.guardAiFeature.mockResolvedValue(null);
    m.enforceAISafety.mockReturnValue(undefined);
    m.generateInsightReport.mockResolvedValue({ reportType: 'trend_forecast', insights: ['a'] });
  });

  it('declares what it asks of the wrapper: an officer holding the advanced-insights entitlement', async () => {
    await loadRoute();
    const config = declared.find((entry) => entry.openapi?.summary === 'Generate an executive insight report');
    expect(config?.auth).toEqual({ minRole: 'officer' });
    expect(config?.entitlement).toBe('ai_advanced_insights');
  });

  it('refuses a steward before any limit, feature or provider is touched', async () => {
    caller.role = 'steward';

    const response = await getReport('trend_forecast');

    expect(response.status).toBe(403);
    expect(m.checkRateLimit).not.toHaveBeenCalled();
    expect(m.guardAiFeature).not.toHaveBeenCalled();
    expect(m.generateInsightReport).not.toHaveBeenCalled();
  });

  it('returns 429 when rate limited', async () => {
    m.checkRateLimit.mockResolvedValueOnce({ allowed: false, resetIn: 60 });

    const response = await getReport('trend_forecast');

    expect(response.status).toBe(429);
    expect(m.checkRateLimit).toHaveBeenCalledWith('ai-insights:u1', expect.anything());
    expect(m.generateInsightReport).not.toHaveBeenCalled();
  });

  it('returns 400 for invalid reportType', async () => {
    const response = await getReport('not_valid');

    expect(response.status).toBe(400);
    expect(m.generateInsightReport).not.toHaveBeenCalled();
  });

  it('returns feature guard response when blocked', async () => {
    m.guardAiFeature.mockResolvedValueOnce(NextResponse.json({ error: 'blocked' }, { status: 403 }));

    const response = await getReport('trend_forecast');

    expect(response.status).toBe(403);
    expect(m.generateInsightReport).not.toHaveBeenCalled();
  });

  it('returns 200 and insight report on success', async () => {
    const response = await getReport('trend_forecast', '?timeframe=30d');
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.data).toMatchObject({ reportType: 'trend_forecast' });
    expect(m.generateInsightReport).toHaveBeenCalledWith(expect.objectContaining({ reportType: 'trend_forecast', timeframe: '30d', organizationId: 'org_1', userId: 'u1' }));
  });

  it('returns 500 when generation fails', async () => {
    m.generateInsightReport.mockRejectedValueOnce(new Error('model down'));

    const response = await getReport('trend_forecast', '?timeframe=90d');

    expect(response.status).toBe(500);
  });
});