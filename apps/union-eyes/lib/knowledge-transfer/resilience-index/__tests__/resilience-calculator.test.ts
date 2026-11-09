/**
 * Organizational Resilience Index — Unit Tests
 *
 * Drives calculateResilienceIndex with mocked propagation maps + interview
 * rows to exercise all dimension calculators, statusFromScore tiers, maturity
 * levels, trend heuristic, and recommendation filtering.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
// The SQL of the eligibility condition is proven against real SQL in app/api/__tests__/interview-derived-analytics.pglite.test.ts.
vi.mock('@/lib/knowledge-transfer/governance/interview-access', () => ({ derivedAnalyticsCondition: () => 'derived-analytics-condition' }))

const mocks = vi.hoisted(() => ({ buildMap: vi.fn(), interviews: [] as unknown[], listVerifiedDependencies: vi.fn(), listActiveNodeAliases: vi.fn(async () => []) }));

function makeChain() {
  const chain: Record<string, unknown> = {};
  chain.from = () => chain;
  chain.where = () => ({ limit: () => Promise.resolve(mocks.interviews) });
  return chain;
}

vi.mock('@/lib/knowledge-transfer/propagation/dependency-propagator', () => ({
  buildDependencyPropagationMap: mocks.buildMap,
}));
vi.mock('@/lib/knowledge-transfer/propagation/verified-dependency-store', () => ({
  listVerifiedDependencies: mocks.listVerifiedDependencies,
}));
vi.mock('@/lib/knowledge-transfer/propagation/node-alias-store', () => ({
  listActiveNodeAliases: mocks.listActiveNodeAliases,
}));
vi.mock('@/lib/knowledge-transfer/propagation/evidence-document-reference', () => ({
  loadEvidenceDocumentIntegrity: async () => new Map(),
}));
vi.mock('@/db/db', () => ({ db: { select: vi.fn(() => makeChain()) } }));
// The interviews are read through the organization's tenant transaction; the transaction here is the mocked handle.
vi.mock('@/lib/knowledge-transfer/org-scope', () => ({
  isUuid: () => true,
  inOrganization: async (_organizationId: string, work: (tx: unknown) => Promise<unknown>) => work((await import('@/db/db')).db),
}));
vi.mock('@/db/schema', () => ({
  exitInterviews: { organizationId: 'organizationId', status: 'status' },
}));
vi.mock('drizzle-orm', () => ({ and: (...a: unknown[]) => a, eq: (...a: unknown[]) => a, relations: () => ({}) }));

import { calculateResilienceIndex } from '../resilience-calculator';
import { currentVerifiedRecord } from '@/lib/knowledge-transfer/propagation/__tests__/verified-record-fixture';

function n(id: string, frequency: number, category: string, isSingleSource: boolean, sensitivity = 'low') {
  return {
    id, label: id, nodeType: category, category, frequency, associatedRoles: ['R'],
    isSingleSource, continuitySensitivity: sensitivity, sensitivityReason: '',
  };
}

function mapWith(nodes: unknown[], bottlenecks: unknown[] = [], edges: Array<[string, string]> = []) {
  return {
    organizationId: 'org', generatedAt: new Date().toISOString(),
    nodes,
    edges: edges.map(([dependentId, dependsOnId]) => ({ dependentId, dependsOnId, strength: 'medium', evidenceCount: 1, rationale: '' })),
    downstreamImpacts: [], upstreamDependencies: [],
    couplingAnalysis: [], bottlenecks,
    resilience: { recommendations: [], priorityOrder: [], estimatedEffort: {} },
  };
}

describe('calculateResilienceIndex', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.interviews = [];
    mocks.listVerifiedDependencies.mockResolvedValue([]);
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
    // DEF-0B7-COGB-RESILIENCE-INDEX: trend is a single-snapshot risk-concentration signal, never 'improving' -
    // there is no prior snapshot to compare against.
    expect(['stable', 'degrading']).toContain(idx.trend);
    expect(idx.trend).toBe('stable');
    expect(idx.methodologyNote).toMatch(/single-snapshot|heuristic|not a (measured|validated)/i);
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
    // DEF-0B7-COGB-RESILIENCE-INDEX-TREND-AND-DOCUMENTATION-QUALITY-ARE-HEURISTIC-LABELS: there is no separate
    // "Estimated doc quality" figure anymore - only the raw, honest interview count.
    expect(doc!.components).toEqual([{ name: 'Published interviews', value: 5 }]);
    // preparedness gets +15 for identified bottlenecks (no critical)
    const prep = idx.dimensions.find((d) => d.name === 'Continuity Preparedness');
    expect(prep!.score).toBeGreaterThan(0);
  });

  it('handles low documentation threshold (<4 interviews)', async () => {
    mocks.interviews = [{ id: 'i1' }, { id: 'i2' }];
    mocks.buildMap.mockResolvedValue(mapWith([n('a', 2, 'general', false, 'low')]));
    const idx = await calculateResilienceIndex('org');
    const doc = idx.dimensions.find((d) => d.name === 'Documentation Maturity');
    expect(doc!.components).toEqual([{ name: 'Published interviews', value: 2 }]);
  });

  // DEF-0B7-COGB-EMPTY-ORGANIZATION-RESILIENCE-INDEX-DIVIDES-BY-ZERO-AND-REPORTS-STRONG: an organization with no dependency map used to read as a
  // score (NaN, or strong from the absence of risks never looked for). It is refused, whether or not it has interviews.
  it.each([[[]], [[{ id: 'i1' }, { id: 'i2' }]]])('refuses, rather than scoring, an organization with no dependency data (interviews: %j)', async (interviews) => {
    mocks.interviews = interviews as unknown[];
    mocks.buildMap.mockResolvedValue(mapWith([]));
    await expect(calculateResilienceIndex('org')).rejects.toMatchObject({ code: 'CONFLICT' });
  });

  it('always produces finite scores once there is dependency data', async () => {
    mocks.interviews = [];
    mocks.buildMap.mockResolvedValue(mapWith([n('a', 2, 'general', false, 'low')]));
    const idx = await calculateResilienceIndex('org');
    expect(idx.dimensions.every((d) => Number.isFinite(d.score))).toBe(true);
    expect(Number.isFinite(idx.overallScore)).toBe(true);
  });

  it('reports verifiedEvidenceCoverage as directed edge coverage, zero with no verified relationships', async () => {
    const a = n('a', 2, 'general', false, 'low');
    const b = n('b', 2, 'general', false, 'low');
    const c = n('c', 2, 'general', false, 'low');
    mocks.interviews = [];
    // Inferred edges: a depends on b, and c depends on a.
    mocks.buildMap.mockResolvedValue(mapWith([a, b, c], [], [['a', 'b'], ['c', 'a']]));
    mocks.listVerifiedDependencies.mockResolvedValue([]);
    const idx = await calculateResilienceIndex('org');
    expect(idx.verifiedEvidenceCoverage).toEqual({ exploratoryEdgeCount: 2, verifiedEdgeCount: 0, ratio: 0, fullyVerified: false });

    mocks.listVerifiedDependencies.mockResolvedValue([currentVerifiedRecord(a, b)]);
    const idxVerified = await calculateResilienceIndex('org');
    expect(idxVerified.verifiedEvidenceCoverage).toEqual({ exploratoryEdgeCount: 2, verifiedEdgeCount: 1, ratio: 0.5, fullyVerified: false });
  });

  it('does not count a verified record pointing the opposite way of an inferred edge, nor one that merely involves a node', async () => {
    const a = n('a', 2, 'general', false, 'low');
    const b = n('b', 2, 'general', false, 'low');
    const c = n('c', 2, 'general', false, 'low');
    mocks.interviews = [];
    mocks.buildMap.mockResolvedValue(mapWith([a, b, c], [], [['a', 'b'], ['c', 'a']]));
    // b depends on a (reversed vs the inferred a->b) and a depends on c (reversed vs c->a): every node participates
    // in a current verified record, yet no inferred edge's direction is verified.
    mocks.listVerifiedDependencies.mockResolvedValue([currentVerifiedRecord(b, a), currentVerifiedRecord(a, c)]);
    const idx = await calculateResilienceIndex('org');
    expect(idx.verifiedEvidenceCoverage).toEqual({ exploratoryEdgeCount: 2, verifiedEdgeCount: 0, ratio: 0, fullyVerified: false });
  });

  it('does not count a verified record whose external evidence is unattested or self-attested', async () => {
    const a = n('a', 2, 'general', false, 'low');
    const b = n('b', 2, 'general', false, 'low');
    mocks.interviews = [];
    mocks.buildMap.mockResolvedValue(mapWith([a, b], [], [['a', 'b']]));
    mocks.listVerifiedDependencies.mockResolvedValue([currentVerifiedRecord(a, b, { externalAttestedBy: 'u1' })]);
    expect((await calculateResilienceIndex('org')).verifiedEvidenceCoverage.verifiedEdgeCount).toBe(0);
    mocks.listVerifiedDependencies.mockResolvedValue([currentVerifiedRecord(a, b)]);
    expect((await calculateResilienceIndex('org')).verifiedEvidenceCoverage).toEqual({ exploratoryEdgeCount: 1, verifiedEdgeCount: 1, ratio: 1, fullyVerified: true });
  });
});
