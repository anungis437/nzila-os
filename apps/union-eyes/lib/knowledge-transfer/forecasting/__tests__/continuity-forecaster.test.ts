import { describe, expect, it, vi } from 'vitest';

const { buildDependencyPropagationMap, orderByMock } = vi.hoisted(() => ({
  buildDependencyPropagationMap: vi.fn(),
  orderByMock: vi.fn(),
}));
vi.mock('../../propagation/dependency-propagator', () => ({ buildDependencyPropagationMap }));
vi.mock('@/db/db', () => ({
  db: { select: () => ({ from: () => ({ where: () => ({ orderBy: orderByMock }) }) }) },
}));
vi.mock('@/db/schema', () => ({
  exitInterviews: { organizationId: 'organizationId', status: 'status', publishedAt: 'publishedAt' },
}));
vi.mock('drizzle-orm', () => ({ and: (...a: unknown[]) => a, eq: (...a: unknown[]) => a }));

import { forecastContinuityTrends } from '../continuity-forecaster';

function node(overrides: Record<string, unknown> = {}) {
  return { isSingleSource: false, category: 'operational', frequency: 2, continuitySensitivity: 'moderate', ...overrides };
}

function daysAgo(d: number) {
  return new Date(Date.now() - d * 86_400_000).toISOString();
}

describe('lib/knowledge-transfer/forecasting/continuity-forecaster', () => {
  it('forecasts trends with rich node graph and interview history', async () => {
    const nodes = [
      ...Array.from({ length: 5 }, () => node({ isSingleSource: true, continuitySensitivity: 'critical' })),
      node({ category: 'governance' }),
      node({ category: 'governance' }),
      node({ category: 'vendor', isSingleSource: true }),
      ...Array.from({ length: 15 }, () => node()),
    ];
    buildDependencyPropagationMap.mockResolvedValue({ nodes });
    orderByMock.mockResolvedValue([
      { publishedAt: daysAgo(300), status: 'published' },
      { publishedAt: daysAgo(120), status: 'published' },
      { publishedAt: daysAgo(30), status: 'published' },
    ]);

    const forecast = await forecastContinuityTrends('org-1');
    expect(forecast.projections.length).toBe(12);
    expect(forecast.historicalData.length).toBeGreaterThan(0);
    expect(forecast.trackedRisks.length).toBe(5);
    expect(['degrading', 'improving', 'stable']).toContain(forecast.trendDirection);
    expect(forecast.confidence).toBeGreaterThanOrEqual(50);
    expect(Array.isArray(forecast.recommendations)).toBe(true);
  });

  it('uses fallback historical point when no interviews', async () => {
    buildDependencyPropagationMap.mockResolvedValue({ nodes: [node({ isSingleSource: true }), node()] });
    orderByMock.mockResolvedValue([]);
    const forecast = await forecastContinuityTrends('org-2');
    expect(forecast.historicalData.length).toBe(1);
    expect(forecast.projections.length).toBe(12);
    expect(forecast.confidence).toBeLessThanOrEqual(85);
  });
});
