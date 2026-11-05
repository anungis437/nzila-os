import { describe, expect, it, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

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

const { caller, resetCaller } = await import('./support/with-api-stub');

async function loadRoute() {
  return import('../ai/insights/[reportType]/route');
}

async function getReport(reportType: string, query = '') {
  const { GET } = await loadRoute();
  return GET(new NextRequest(`http://localhost/api/ai/insights/${reportType}${query}`), { params: Promise.resolve({ reportType }) });
}

describe('ai/insights/[reportType] route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetCaller();
    caller.role = 'officer';
    m.checkRateLimit.mockResolvedValue({ allowed: true, resetIn: 0 });
    m.guardAiFeature.mockResolvedValue(null);
    m.enforceAISafety.mockReturnValue(undefined);
    m.generateInsightReport.mockResolvedValue({ reportType: 'trend_forecast', insights: [] });
  });

  it('returns 429 when rate limited', async () => {
    m.checkRateLimit.mockResolvedValueOnce({ allowed: false, resetIn: 60 });
    const response = await getReport('trend_forecast');
    expect(response.status).toBe(429);
    expect(m.generateInsightReport).not.toHaveBeenCalled();
  });

  it('returns 400 for invalid reportType', async () => {
    const response = await getReport('bad_type');
    expect(response.status).toBe(400);
    expect(m.generateInsightReport).not.toHaveBeenCalled();
  });

  it('returns insight report', async () => {
    const response = await getReport('trend_forecast', '?timeframe=90d');
    expect(response.status).toBe(200);
    expect(m.generateInsightReport).toHaveBeenCalledWith(expect.objectContaining({ reportType: 'trend_forecast', timeframe: '90d' }));
  });
});
