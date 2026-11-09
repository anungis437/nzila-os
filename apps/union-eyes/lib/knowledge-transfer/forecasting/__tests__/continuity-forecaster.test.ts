import { describe, expect, it, vi } from 'vitest';

const { buildDependencyPropagationMap, orderByMock, listVerifiedDependencies, listActiveNodeAliases } = vi.hoisted(() => ({
  buildDependencyPropagationMap: vi.fn(),
  orderByMock: vi.fn(),
  listVerifiedDependencies: vi.fn(async () => []),
  listActiveNodeAliases: vi.fn(async () => []),
}));
vi.mock('../../propagation/dependency-propagator', () => ({ buildDependencyPropagationMap }));
vi.mock('../../propagation/verified-dependency-store', () => ({ listVerifiedDependencies }));
vi.mock('../../propagation/node-alias-store', () => ({ listActiveNodeAliases }));
vi.mock('../../propagation/evidence-document-reference', () => ({ loadEvidenceDocumentIntegrity: async () => new Map() }));
vi.mock('@/db/db', () => ({
  db: { select: () => ({ from: () => ({ where: orderByMock }) }) },
}));
// The eligible-interview count is read through the organization's tenant transaction; the transaction here is the mocked handle.
vi.mock('@/lib/knowledge-transfer/org-scope', () => ({
  isUuid: () => true,
  inOrganization: async (_organizationId: string, work: (tx: unknown) => Promise<unknown>) => work((await import('@/db/db')).db),
}));
vi.mock('@/db/schema', () => ({
  exitInterviews: { id: 'id' },
}));
vi.mock('@/lib/knowledge-transfer/governance/interview-access', () => ({ derivedAnalyticsCondition: () => 'derived-analytics-condition' }));

import { forecastContinuityTrends } from '../continuity-forecaster';
import { currentVerifiedRecord } from '../../propagation/__tests__/verified-record-fixture';

function node(overrides: Record<string, unknown> = {}) {
  const id = (overrides.id as string | undefined) ?? 'node';
  return { id, label: id, nodeType: 'process', isSingleSource: false, category: 'operational', frequency: 2, continuitySensitivity: 'moderate', ...overrides };
}

/** A propagation map with the given nodes and inferred directed edges [dependent, dependsOn]. */
function map(nodes: unknown[], edges: Array<[string, string]> = []) {
  return { nodes, edges: edges.map(([dependentId, dependsOnId]) => ({ dependentId, dependsOnId, strength: 'medium', evidenceCount: 1, rationale: '' })) };
}

describe('lib/knowledge-transfer/forecasting/continuity-forecaster', () => {
  // The earlier engine projected twelve months from fixed rates and always reported an improving curve; this one reports
  // measured current metrics and says plainly that no trend can be given.
  it('reports no projection, no history and no trend, with confidence 0', async () => {
    buildDependencyPropagationMap.mockResolvedValue(map([
      ...Array.from({ length: 5 }, () => node({ isSingleSource: true, continuitySensitivity: 'critical' })),
      node({ category: 'vendor', isSingleSource: true }),
      ...Array.from({ length: 10 }, () => node()),
    ]));
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
    buildDependencyPropagationMap.mockResolvedValue(map([
      ...Array.from({ length: 5 }, () => node({ isSingleSource: true, continuitySensitivity: 'critical', frequency: 1 })),
      node({ category: 'vendor', isSingleSource: true, frequency: 1 }),
    ]));
    orderByMock.mockResolvedValue([]);
    const forecast = await forecastContinuityTrends('org-1');
    expect(forecast.currentMetrics).toMatchObject({ singleSourceCount: 6, totalNodes: 6 });
    expect(forecast.recommendations.length).toBeGreaterThan(0);
  });

  it('gives no metrics and no recommendations for an organization with nothing to measure', async () => {
    buildDependencyPropagationMap.mockResolvedValue(map([]));
    orderByMock.mockResolvedValue([]);
    const forecast = await forecastContinuityTrends('org-2');
    expect(forecast.currentMetrics).toBeUndefined();
    expect(forecast.recommendations).toEqual([]);
    expect(forecast.trendDirection).toBe('insufficient_data');
  });

  it('reports verifiedEvidenceCoverage as directed edge coverage of the inferred graph', async () => {
    const a = node({ id: 'a' });
    const b = node({ id: 'b' });
    const c = node({ id: 'c' });
    buildDependencyPropagationMap.mockResolvedValue(map([a, b, c], [['a', 'b'], ['b', 'c']]));
    orderByMock.mockResolvedValue([]);
    listVerifiedDependencies.mockResolvedValueOnce([]);
    expect((await forecastContinuityTrends('org-3')).verifiedEvidenceCoverage).toEqual({ exploratoryEdgeCount: 2, verifiedEdgeCount: 0, ratio: 0, fullyVerified: false });

    listVerifiedDependencies.mockResolvedValueOnce([currentVerifiedRecord(a, b)]);
    expect((await forecastContinuityTrends('org-3')).verifiedEvidenceCoverage).toEqual({ exploratoryEdgeCount: 2, verifiedEdgeCount: 1, ratio: 0.5, fullyVerified: false });
  });

  it('does not count a verified record pointing against the inferred edge, even though both nodes participate', async () => {
    const a = node({ id: 'a' });
    const b = node({ id: 'b' });
    buildDependencyPropagationMap.mockResolvedValue(map([a, b], [['a', 'b']]));
    orderByMock.mockResolvedValue([]);
    listVerifiedDependencies.mockResolvedValueOnce([currentVerifiedRecord(b, a)]);
    expect((await forecastContinuityTrends('org-4')).verifiedEvidenceCoverage).toEqual({ exploratoryEdgeCount: 1, verifiedEdgeCount: 0, ratio: 0, fullyVerified: false });
  });
});