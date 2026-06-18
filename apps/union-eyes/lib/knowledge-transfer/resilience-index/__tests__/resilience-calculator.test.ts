/**
 * Organizational Resilience Index — Unit Tests
 *
 * Drives calculateResilienceIndex with mocked propagation maps + interview
 * rows to exercise all dimension calculators, statusFromScore tiers, maturity
 * levels, trend heuristic, and recommendation filtering.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => ({ buildMap: vi.fn(), interviews: [] as unknown[] }));

function makeChain() {
  const chain: Record<string, unknown> = {};
  chain.from = () => chain;
  chain.where = () => Promise.resolve(mocks.interviews);
  return chain;
}

vi.mock('@/lib/knowledge-transfer/propagation/dependency-propagator', () => ({
  buildDependencyPropagationMap: mocks.buildMap,
}));
vi.mock('@/db/db', () => ({ db: { select: vi.fn(() => makeChain()) } }));
vi.mock('@/db/schema', () => ({
  exitInterviews: { organizationId: 'organizationId', status: 'status' },
}));
vi.mock('drizzle-orm', () => ({ and: (...a: unknown[]) => a, eq: (...a: unknown[]) => a }));

import { calculateResilienceIndex } from '../resilience-calculator';

function n(id: string, frequency: number, category: string, isSingleSource: boolean, sensitivity = 'low') {
  return {
    id, label: id, nodeType: category, category, frequency, associatedRoles: ['R'],
    isSingleSource, continuitySensitivity: sensitivity, sensitivityReason: '',
  };
}

function mapWith(nodes: unknown[], bottlenecks: unknown[] = []) {
  return {
    organizationId: 'org', generatedAt: new Date().toISOString(),
    nodes, edges: [], downstreamImpacts: [], upstreamDependencies: [],
    couplingAnalysis: [], bottlenecks,
    resilience: { recommendations: [], priorityOrder: [], estimatedEffort: {} },
  };
}

describe('calculateResilienceIndex', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.interviews = [];
  });

  it('computes a strong index for a well-distributed, well-documented org', async () => {
    mocks.interviews = Array.from({ length: 10 }, (_, i) => ({ id: 'i' + i }));
    mocks.buildMap.mockResolvedValue(
      mapWith([
        n('a', 6, 'governance', false, 'low'),
        n('b', 5, 'compliance', false, 'low'),
        n('c', 8, 'system', false, 'low'),
        n('d', 7, 'system', false, 'low'),
        n('e', 6, 'vendor', false, 'low'),
        n('f', 5, 'vendor', false, 'low'),
      ]),
    );
    const idx = await calculateResilienceIndex('org');
    expect(idx.organizationId).toBe('org');
    expect(idx.dimensions).toHaveLength(5);
    expect(idx.overallScore).toBeGreaterThanOrEqual(0);
    expect(idx.overallScore).toBeLessThanOrEqual(100);
    expect(['initial', 'developing', 'managed', 'optimized']).toContain(idx.maturityLevel);
    expect(['critical', 'at_risk', 'adequate', 'strong']).toContain(idx.status);
    expect(['improving', 'stable', 'degrading']).toContain(idx.trend);
    expect(idx.trend).toBe('stable');
  });

  it('flags degrading trend and low scores for a fragile single-source org', async () => {
    mocks.interviews = [{ id: 'i1' }];
    mocks.buildMap.mockResolvedValue(
      mapWith(
        [
          n('a', 1, 'governance', true, 'critical'),
          n('b', 1, 'compliance', true, 'critical'),
          n('c', 1, 'vendor', true, 'high'),
          n('d', 1, 'system', true, 'high'),
        ],
        [
          { nodeId: 'a', reason: 'single_source', riskLevel: 'critical', affectedRoles: ['R'] },
          { nodeId: 'b', reason: 'single_source', riskLevel: 'critical', affectedRoles: ['R'] },
        ],
      ),
    );
    const idx = await calculateResilienceIndex('org');
    // >40% single-source -> degrading
    expect(idx.trend).toBe('degrading');
    // low scores generate recommendations
    expect(idx.recommendations.length).toBeGreaterThan(0);
    expect(idx.recommendations.length).toBeLessThanOrEqual(5);
    // each low-scoring dimension carries recommendations
    const redundancy = idx.dimensions.find((d) => d.name === 'Knowledge Redundancy');
    expect(redundancy!.recommendations.length).toBeGreaterThan(0);
    // status tiers exercised
    expect(idx.dimensions.some((d) => d.status === 'critical' || d.status === 'at_risk')).toBe(true);
  });

  it('handles mid-range documentation thresholds (4-7 interviews)', async () => {
    mocks.interviews = Array.from({ length: 5 }, (_, i) => ({ id: 'i' + i }));
    mocks.buildMap.mockResolvedValue(
      mapWith([
        n('a', 3, 'governance', false, 'medium'),
        n('b', 2, 'system', false, 'medium'),
        n('c', 1, 'vendor', true, 'high'),
      ], [{ nodeId: 'c', reason: 'critical_vendor', riskLevel: 'high', affectedRoles: ['R'] }]),
    );
    const idx = await calculateResilienceIndex('org');
    const doc = idx.dimensions.find((d) => d.name === 'Documentation Maturity');
    // 4-7 interviews -> estimated doc quality component value 50
    expect(doc!.components.some((c) => c.value === 50)).toBe(true);
    // preparedness gets +15 for identified bottlenecks (no critical)
    const prep = idx.dimensions.find((d) => d.name === 'Continuity Preparedness');
    expect(prep!.score).toBeGreaterThan(0);
  });

  it('handles low documentation threshold (<4 interviews)', async () => {
    mocks.interviews = [{ id: 'i1' }, { id: 'i2' }];
    mocks.buildMap.mockResolvedValue(mapWith([n('a', 2, 'general', false, 'low')]));
    const idx = await calculateResilienceIndex('org');
    const doc = idx.dimensions.find((d) => d.name === 'Documentation Maturity');
    expect(doc!.components.some((c) => c.value === 25)).toBe(true);
  });
});
