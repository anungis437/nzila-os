import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const m = vi.hoisted(() => ({
  withApi: vi.fn(),
  guardAiFeature: vi.fn(),
  enforceAISafety: vi.fn(),
  generateFinancialInsight: vi.fn(),
}));

vi.mock('@/lib/api/framework', () => ({ withApi: m.withApi, ApiError: { badRequest: (msg: string) => Object.assign(new Error(msg), { status: 400 }), unauthorized: (msg: string) => Object.assign(new Error(msg), { status: 401 }) }, RATE_LIMITS: { AI_COMPLETION: 'AI_COMPLETION' }, z: require('zod') }));
vi.mock('@/lib/services/feature-flags', () => ({ AI_FEATURES: { FINANCIAL_ANALYSIS: 'FINANCIAL_ANALYSIS' } }));
vi.mock('@/lib/ai/ai-feature-guard', () => ({ guardAiFeature: m.guardAiFeature }));
vi.mock('@nzila/policies', () => ({ enforceAISafety: m.enforceAISafety }));
vi.mock('@/lib/ai/financial-insights', () => ({ generateFinancialInsight: m.generateFinancialInsight }));

async function loadRoute() {
  return import('../ai/finance/analysis/route');
}

describe('ai/finance/analysis route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.withApi.mockImplementation((_cfg: unknown, handler: (ctx: any) => Promise<unknown>) =>
      (request: NextRequest, context: any = {}) => handler({ request, ...context }));
    m.guardAiFeature.mockResolvedValue(null);
    m.generateFinancialInsight.mockResolvedValue({ report: 'ok' });
  });

  it('returns financial analysis', async () => {
    const { GET } = await loadRoute();
    const result = await GET(new NextRequest('http://localhost/api/ai/finance/analysis?type=budget_variance&timeframe=30d'), { organizationId: 'org_1', userId: 'u1', query: { type: 'budget_variance', timeframe: '30d' } });

    expect(result).toEqual({ report: 'ok' });
    expect(m.generateFinancialInsight).toHaveBeenCalledWith(expect.objectContaining({ analysisType: 'budget_variance', timeframe: '30d', organizationId: 'org_1', userId: 'u1' }));
  });
});