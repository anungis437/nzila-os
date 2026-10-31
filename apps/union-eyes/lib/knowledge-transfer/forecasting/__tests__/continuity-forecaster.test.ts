import { describe, expect, it, vi } from 'vitest';

const { buildDependencyPropagationMap, orderByMock } = vi.hoisted(() => ({
  buildDependencyPropagationMap: vi.fn(),
  orderByMock: vi.fn(),
}));
vi.mock('../../propagation/dependency-propagator', () => ({ buildDependencyPropagationMap }));
vi.mock('@/db/db', () => ({
  db: { select: () => ({ from: () => ({ where: orderByMock }) }) },
}));
vi.mock('@/db/schema', () => ({
  exitInterviews: { id: 'id' },
}));
vi.mock('@/lib/knowledge-transfer/governance/interview-access', () => ({ derivedAnalyticsCondition: () => 'derived-analytics-condition' }));

import { forecastContinuityTrends } from '../continuity-forecaster';

function node(overrides: Record<string, unknown> = {}) {
  return { isSingleSource: false, category: 'operational', frequency: 2, continuitySensitivity: 'moderate', ...overrides };
}

describe('lib/knowledge-transfer/forecasting/continuity-forecaster', () => {
  // The earlier engine projected twelve months from fixed rates and always reported an improving curve; this one reports
  // measured current metrics and says plainly that no trend can be given.
  it('reports no projection, no history and no trend, with confidence 0', async () => {
    buildDependencyPropagationMap.mockResolvedValue({ nodes: [
      ...Array.from({ length: 5 }, () => node({ isSingleSource: true, continuitySensitivity: 'critical' })),
      node({ category: 'vendor', isSingleSource: true }),
      ...Array.from({ length: 10 }, () => node()),
    ] });
    orderByMock.mockResolvedValue([{ id: 'a' }, { id: 'b' }, { id: 'c' }]);
    const forecast = await forecastContinuityTrends('org-1');
    expect(forecast.projections).toEqual([]);
    expect(forecast.historicalData).toEqual([]);
    expect(forecast.trackedRisks).toEqual([]);
    expect(forecast.trendDirection).toBe('insufficient_data');
    expect(forecast.confidence).toBe(0);
    expect(forecast.dataPoints).toBe(3);
  });

  it('derives recommendations only from measured current metrics', async () => {
    buildDependencyPropagationMap.mockResolvedValue({ nodes: [
      ...Array.from({ length: 5 }, () => node({ isSingleSource: true, continuitySensitivity: 'critical', frequency: 1 })),
      node({ category: 'vendor', isSingleSource: true, frequency: 1 }),
    ] });
    orderByMock.mockResolvedValue([]);
    const forecast = await forecastContinuityTrends('org-1');
    expect(forecast.currentMetrics).toMatchObject({ singleSourceCount: 6, totalNodes: 6 });
    expect(forecast.recommendations.length).toBeGreaterThan(0);
  });

  it('gives no metrics and no recommendations for an organization with nothing to measure', async () => {
    buildDependencyPropagationMap.mockResolvedValue({ nodes: [] });
    orderByMock.mockResolvedValue([]);
    const forecast = await forecastContinuityTrends('org-2');
    expect(forecast.currentMetrics).toBeUndefined();
    expect(forecast.recommendations).toEqual([]);
    expect(forecast.trendDirection).toBe('insufficient_data');
  });
});