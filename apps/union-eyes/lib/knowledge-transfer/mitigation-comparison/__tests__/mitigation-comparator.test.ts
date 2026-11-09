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

import { compareMitigations } from '../mitigation-comparator';
import { currentVerifiedRecord } from '../../propagation/__tests__/verified-record-fixture';

function node(id: string, overrides: Record<string, unknown> = {}) {
  return {
    id,
    label: `Node ${id}`,
    isSingleSource: true,
    continuitySensitivity: 'critical',
    nodeType: 'process',
    category: 'operational',
    ...overrides,
  };
}

/** A propagation map with the given nodes and inferred directed edges [dependent, dependsOn]. */
function map(nodes: unknown[], edges: Array<[string, string]> = []) {
  return { nodes, edges: edges.map(([dependentId, dependsOnId]) => ({ dependentId, dependsOnId, strength: 'medium', evidenceCount: 1, rationale: '' })) };
}

describe('lib/knowledge-transfer/mitigation-comparison/mitigation-comparator', () => {
  it('compares multiple scenarios and recommends the strongest', async () => {
    const nodes = [
      node('n1', { category: 'governance', nodeType: 'governance' }),
      node('n2', { continuitySensitivity: 'high' }),
      node('n3', { continuitySensitivity: 'medium', isSingleSource: false }),
      node('n4', { continuitySensitivity: 'low', isSingleSource: true }),
      node('n5', { category: 'compliance' }),
    ];
    buildDependencyPropagationMap.mockResolvedValue(map(nodes));
    calculateResilienceIndex.mockResolvedValue({ overallScore: 50 });

    const comparison = await compareMitigations('org-1', [
      { mitigationType: 'documentation_campaign', targetNodeIds: ['n1', 'n2'], investmentLevel: 'high', durationWeeks: 6 },
      { mitigationType: 'cross_training', targetNodeIds: [], investmentLevel: 'low', durationWeeks: 16 },
      { mitigationType: 'governance_decentralization', targetNodeIds: ['n1', 'n5'], investmentLevel: 'medium', durationWeeks: 24 },
    ]);

    expect(comparison.scenarios.length).toBe(3);
    expect(comparison.recommendedScenario).toBeTruthy();
    expect(comparison.baselineScore).toBe(50);
    expect(comparison.recommendationRationale).toContain('resilience gain');
    // The figures come from fixed assumptions, so the result says so and claims no confidence band.
    expect(comparison.basis).toBe('ASSUMED_EFFECTIVENESS_NOT_CALIBRATED');
    expect(comparison.assumptions.length).toBeGreaterThan(0);
    expect(comparison.noNodesEvaluated).toBe(false);
    expect(comparison.recommendationRationale).toContain('not calibrated');
    comparison.scenarios.forEach((s) => s.domainDeltas.forEach((d) => expect(d.confidence).toBe('unvalidated')));
    expect(Array.isArray(comparison.residualRisks)).toBe(true);
    comparison.scenarios.forEach((s) => {
      expect(s.projectionCurve.length).toBe(12);
      expect(s.actionPlan.length).toBeGreaterThan(0);
      expect(['weeks', 'months', 'quarters']).toContain(s.implementationEffort);
    });
  });

  it('handles unknown mitigation type with default action plan and no affected nodes', async () => {
    buildDependencyPropagationMap.mockResolvedValue(map([node('x', { isSingleSource: false, continuitySensitivity: 'low' })]));
    calculateResilienceIndex.mockResolvedValue({ overallScore: 70 });
    const comparison = await compareMitigations('org-2', [
      { mitigationType: 'unknown_type' as never, targetNodeIds: [], investmentLevel: 'medium', durationWeeks: 30 },
    ]);
    expect(comparison.scenarios[0].actionPlan.length).toBeGreaterThan(0);
    expect(comparison.scenarios[0].implementationEffort).toBe('quarters');
    // Nothing was evaluated, so no scenario is recommended and the result says so instead of ranking zeroes.
    expect(comparison.noNodesEvaluated).toBe(true);
    expect(comparison.recommendedScenario).toBe('');
    expect(comparison.recommendationRationale).toContain('nothing was evaluated');
  });

  it('reports verifiedEvidenceCoverage as directed edge coverage, zero with no verified relationships', async () => {
    const nodes = [node('n1'), node('n2')];
    buildDependencyPropagationMap.mockResolvedValue(map(nodes, [['n1', 'n2']]));
    calculateResilienceIndex.mockResolvedValue({ overallScore: 50 });
    listVerifiedDependencies.mockResolvedValueOnce([]);
    const comparison = await compareMitigations('org-3', [
      { mitigationType: 'cross_training', targetNodeIds: ['n1'], investmentLevel: 'medium', durationWeeks: 10 },
    ]);
    expect(comparison.verifiedEvidenceCoverage).toEqual({ exploratoryEdgeCount: 1, verifiedEdgeCount: 0, ratio: 0, fullyVerified: false });

    listVerifiedDependencies.mockResolvedValueOnce([currentVerifiedRecord(node('n1'), node('n2'))]);
    const comparisonWithEvidence = await compareMitigations('org-3', [
      { mitigationType: 'cross_training', targetNodeIds: ['n1'], investmentLevel: 'medium', durationWeeks: 10 },
    ]);
    expect(comparisonWithEvidence.verifiedEvidenceCoverage).toEqual({ exploratoryEdgeCount: 1, verifiedEdgeCount: 1, ratio: 1, fullyVerified: true });
  });

  it('does not count a reversed verified record, nor one whose node was reclassified since verification', async () => {
    buildDependencyPropagationMap.mockResolvedValue(map([node('n1'), node('n2'), node('n3')], [['n1', 'n2'], ['n1', 'n3']]));
    calculateResilienceIndex.mockResolvedValue({ overallScore: 50 });
    listVerifiedDependencies.mockResolvedValueOnce([
      // n2 depends on n1: the opposite of the inferred n1 -> n2.
      currentVerifiedRecord(node('n2'), node('n1')),
      // n1 -> n3 was verified while n3 was classified 'governance'; it is 'operational' now, so the attestation is stale.
      currentVerifiedRecord(node('n1'), node('n3', { category: 'governance' })),
    ]);
    const comparison = await compareMitigations('org-4', [
      { mitigationType: 'cross_training', targetNodeIds: ['n1'], investmentLevel: 'medium', durationWeeks: 10 },
    ]);
    expect(comparison.verifiedEvidenceCoverage).toEqual({ exploratoryEdgeCount: 2, verifiedEdgeCount: 0, ratio: 0, fullyVerified: false });
  });
});
