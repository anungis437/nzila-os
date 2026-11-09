import { describe, expect, it, vi } from 'vitest';

const { buildDependencyPropagationMap, calculateResilienceIndex, listVerifiedDependencies, listActiveNodeAliases } = vi.hoisted(() => ({
  buildDependencyPropagationMap: vi.fn(),
  calculateResilienceIndex: vi.fn(),
  listVerifiedDependencies: vi.fn(async () => []),
  listActiveNodeAliases: vi.fn(async () => []),
}));
vi.mock('../../propagation/dependency-propagator', () => ({ buildDependencyPropagationMap }));
vi.mock('../../propagation/verified-dependency-store', () => ({ listVerifiedDependencies }));
vi.mock('../../propagation/node-alias-store', () => ({ listActiveNodeAliases }));
vi.mock('../../propagation/evidence-document-reference', () => ({ loadEvidenceDocumentIntegrity: async () => new Map() }));
vi.mock('../../resilience-index/resilience-calculator', () => ({ calculateResilienceIndex }));

import { buildResilienceRoadmap } from '../strategy-modeler';
import { currentVerifiedRecord } from '../../propagation/__tests__/verified-record-fixture';

function node(overrides: Record<string, unknown> = {}) {
  const id = (overrides.id as string | undefined) ?? 'node';
  return { id, label: id, isSingleSource: false, category: 'operational', nodeType: 'process', ...overrides };
}

/** A propagation map with the given nodes and inferred directed edges [dependent, dependsOn]. */
function map(nodes: unknown[], edges: Array<[string, string]> = []) {
  return { nodes, edges: edges.map(([dependentId, dependsOnId]) => ({ dependentId, dependsOnId, strength: 'medium', evidenceCount: 1, rationale: '' })) };
}

function resilienceIndex(score: number, docScore = 50) {
  return {
    overallScore: score,
    dimensions: [{ name: 'Documentation Maturity', score: docScore }],
  };
}

describe('lib/knowledge-transfer/resilience-strategies/strategy-modeler', () => {
  it('builds a full roadmap selecting many strategies for a fragile org', async () => {
    const nodes = [
      ...Array.from({ length: 6 }, () => node({ isSingleSource: true })),
      node({ category: 'governance', isSingleSource: true }),
      node({ category: 'governance', isSingleSource: false }),
      node({ category: 'vendor', isSingleSource: true }),
      node({ category: 'vendor', isSingleSource: false }),
      node({ nodeType: 'vendor', isSingleSource: true }),
      node(), node(), node(),
    ];
    buildDependencyPropagationMap.mockResolvedValue(map(nodes));
    calculateResilienceIndex.mockResolvedValue(resilienceIndex(30, 40));

    const roadmap = await buildResilienceRoadmap('org-1');
    expect(roadmap.strategies.length).toBeGreaterThan(0);
    expect(roadmap.strategies.length).toBeLessThanOrEqual(5);
    // DEF-0B7-COGB-ROADMAP-DOCUMENTATION-RULE-PRECEDENCE-AND-CONSTANT-PROJECTED-GAINS: no validated model projects a score or a gain,
    // so neither is stated (they were literals from a per-strategy table), and the roadmap says why.
    expect(roadmap.projectedScore).toBeNull();
    expect(roadmap.projectionNotMeasuredReason).toMatch(/^Not measured/);
    for (const strategy of roadmap.strategies) {
      expect(strategy.projectedResilienceGain).toBeNull();
      expect(strategy.governanceStabilityGain).toBeNull();
      expect(strategy.dependencyReductionImpact).toBeNull();
    }
    expect(roadmap.maturityNarrative).toContain('early');
    expect(roadmap.phase1QuickWins.length + roadmap.phase2Foundation.length + roadmap.phase3Sustained.length).toBeGreaterThan(0);
  });

  it('produces a minimal roadmap for a mature, well-distributed org', async () => {
    buildDependencyPropagationMap.mockResolvedValue(map([node(), node()]));
    calculateResilienceIndex.mockResolvedValue(resilienceIndex(80, 90));
    const roadmap = await buildResilienceRoadmap('org-2');
    expect(roadmap.maturityNarrative).toContain('strong');
    expect(Array.isArray(roadmap.strategies)).toBe(true);
  });

  it('covers developing and adequate maturity narratives', async () => {
    buildDependencyPropagationMap.mockResolvedValue(map(Array.from({ length: 12 }, () => node({ isSingleSource: true }))));
    calculateResilienceIndex.mockResolvedValue(resilienceIndex(50, 30));
    const dev = await buildResilienceRoadmap('org-3');
    expect(dev.maturityNarrative).toContain('developing');

    calculateResilienceIndex.mockResolvedValue(resilienceIndex(68, 30));
    const adq = await buildResilienceRoadmap('org-4');
    expect(adq.maturityNarrative).toContain('adequate');
  });

  it('reports verifiedEvidenceCoverage as directed edge coverage, zero with no verified relationships', async () => {
    const n1 = node({ id: 'n1' });
    const n2 = node({ id: 'n2' });
    buildDependencyPropagationMap.mockResolvedValue(map([n1, n2], [['n1', 'n2']]));
    calculateResilienceIndex.mockResolvedValue(resilienceIndex(50, 50));
    listVerifiedDependencies.mockResolvedValueOnce([]);
    const noEvidence = await buildResilienceRoadmap('org-5');
    expect(noEvidence.verifiedEvidenceCoverage).toEqual({ exploratoryEdgeCount: 1, verifiedEdgeCount: 0, ratio: 0, fullyVerified: false });

    listVerifiedDependencies.mockResolvedValueOnce([currentVerifiedRecord(n1, n2)]);
    const withEvidence = await buildResilienceRoadmap('org-5');
    expect(withEvidence.verifiedEvidenceCoverage).toEqual({ exploratoryEdgeCount: 1, verifiedEdgeCount: 1, ratio: 1, fullyVerified: true });
  });

  it('does not count a verified record that points the opposite way of the inferred edge', async () => {
    const n1 = node({ id: 'n1' });
    const n2 = node({ id: 'n2' });
    buildDependencyPropagationMap.mockResolvedValue(map([n1, n2], [['n1', 'n2']]));
    calculateResilienceIndex.mockResolvedValue(resilienceIndex(50, 50));
    // n2 depends on n1 is verified; the inferred edge says n1 depends on n2. Both nodes participate - nothing counts.
    listVerifiedDependencies.mockResolvedValueOnce([currentVerifiedRecord(n2, n1)]);
    const roadmap = await buildResilienceRoadmap('org-6');
    expect(roadmap.verifiedEvidenceCoverage).toEqual({ exploratoryEdgeCount: 1, verifiedEdgeCount: 0, ratio: 0, fullyVerified: false });
  });

  it('does not count a verified record whose fingerprint no longer matches the current nodes', async () => {
    const n1 = node({ id: 'n1' });
    const n2 = node({ id: 'n2' });
    // n2 was re-classified after verification: the attested claim no longer describes the current node.
    buildDependencyPropagationMap.mockResolvedValue(map([n1, node({ id: 'n2', category: 'governance' })], [['n1', 'n2']]));
    calculateResilienceIndex.mockResolvedValue(resilienceIndex(50, 50));
    listVerifiedDependencies.mockResolvedValueOnce([currentVerifiedRecord(n1, n2)]);
    const roadmap = await buildResilienceRoadmap('org-7');
    expect(roadmap.verifiedEvidenceCoverage.verifiedEdgeCount).toBe(0);
  });
});
