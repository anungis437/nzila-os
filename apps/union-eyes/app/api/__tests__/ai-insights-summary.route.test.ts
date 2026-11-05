import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';

const m = vi.hoisted(() => ({
  checkRateLimit: vi.fn(),
  guardAiFeature: vi.fn(),
  requireEntitlement: vi.fn(),
  enforceAISafety: vi.fn(),
  getLatestInsightReports: vi.fn(),
  auditAIInvocation: vi.fn(),
}));

vi.mock('@/lib/api/framework', async () => (await import('./support/with-api-stub')).frameworkModule);
vi.mock('@/lib/rate-limiter', () => ({
  checkRateLimit: m.checkRateLimit,
  RATE_LIMITS: { AI_COMPLETION: { windowMs: 60000, maxRequests: 100 } },
}));
vi.mock('@/lib/ai/ai-feature-guard', () => ({ guardAiFeature: m.guardAiFeature }));
vi.mock('@/lib/services/feature-flags', () => ({ AI_FEATURES: { EXECUTIVE_INSIGHTS: 'EXECUTIVE_INSIGHTS' } }));
vi.mock('@nzila/policies', () => ({ enforceAISafety: m.enforceAISafety }));
vi.mock('@/lib/ai/executive-insights', () => ({ getLatestInsightReports: m.getLatestInsightReports }));
vi.mock('@/lib/audit-logger', () => ({ auditAIInvocation: m.auditAIInvocation }));

const { caller, declared, entitlementGuard, resetCaller } = await import('./support/with-api-stub');

async function loadRoute() {
  return import('../ai/insights/summary/route');
}

const get = () => new NextRequest('http://localhost/api/ai/insights/summary');

describe('ai/insights/summary route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetCaller();
    caller.role = 'officer';
    entitlementGuard.require = m.requireEntitlement;
    m.checkRateLimit.mockResolvedValue({ allowed: true, resetIn: 0 });
    m.guardAiFeature.mockResolvedValue(null);
    m.requireEntitlement.mockResolvedValue(undefined);
    m.enforceAISafety.mockReturnValue(undefined);
    m.getLatestInsightReports.mockResolvedValue({
      trendForecast: { id: 'rep_1', score: 90 },
      employerHotspots: null,
      stewardCapacity: null,
      arbitrationEscalation: null,
      executiveSummary: null,
    });
    m.auditAIInvocation.mockResolvedValue('audit_1');
  });

  it('declares what it asks of the wrapper: an officer holding the advanced-insights entitlement', async () => {
    await loadRoute();
    const config = declared.find((entry) => entry.openapi?.summary === 'Latest executive insight report of each type');
    expect(config?.auth).toEqual({ minRole: 'officer' });
    expect(config?.entitlement).toBe('ai_advanced_insights');
  });

  it('refuses a steward before any limit, feature or read is touched', async () => {
    caller.role = 'steward';
    const { GET } = await loadRoute();

    const response = await GET(get());

    expect(response.status).toBe(403);
    expect(m.checkRateLimit).not.toHaveBeenCalled();
    expect(m.getLatestInsightReports).not.toHaveBeenCalled();
  });

  it('returns 429 when rate limited', async () => {
    const { GET } = await loadRoute();
    m.checkRateLimit.mockResolvedValueOnce({ allowed: false, resetIn: 45 });

    const response = await GET(get());

    expect(response.status).toBe(429);
    expect(m.getLatestInsightReports).not.toHaveBeenCalled();
  });

  it('returns feature guard response when blocked', async () => {
    const { GET } = await loadRoute();
    m.guardAiFeature.mockResolvedValueOnce(NextResponse.json({ error: 'blocked' }, { status: 403 }));

    const response = await GET(get());

    expect(response.status).toBe(403);
    expect(m.getLatestInsightReports).not.toHaveBeenCalled();
  });

  it('returns 403 when entitlement check fails, before any limit or read is touched', async () => {
    const { GET } = await loadRoute();
    m.requireEntitlement.mockRejectedValueOnce(new Error('entitlement missing'));

    const response = await GET(get());

    expect(response.status).toBe(403);
    expect(m.requireEntitlement).toHaveBeenCalledWith('org_1', 'ai_advanced_insights', 'u1');
    expect(m.checkRateLimit).not.toHaveBeenCalled();
    expect(m.getLatestInsightReports).not.toHaveBeenCalled();
  });

  it('returns summary payload on success', async () => {
    const { GET } = await loadRoute();

    const response = await GET(get());
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.data).toMatchObject({ latestTrendForecast: { id: 'rep_1' } });
    expect(Object.keys(payload.data).sort()).toEqual([
      'latestArbitrationEscalation',
      'latestEmployerHotspots',
      'latestExecutiveSummary',
      'latestStewardCapacity',
      'latestTrendForecast',
    ]);
    expect(payload.meta).toMatchObject({ aiGenerated: true, auditRefId: 'audit_1' });
    expect(m.getLatestInsightReports).toHaveBeenCalledWith('org_1');
  });

  it('returns 500 when report fetch fails', async () => {
    const { GET } = await loadRoute();
    m.getLatestInsightReports.mockRejectedValueOnce(new Error('db down'));

    const response = await GET(get());

    expect(response.status).toBe(500);
  });
});