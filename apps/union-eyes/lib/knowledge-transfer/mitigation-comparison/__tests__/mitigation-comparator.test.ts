import { describe, expect, it, vi } from 'vitest';

const { buildDependencyPropagationMap, calculateResilienceIndex } = vi.hoisted(() => ({
  buildDependencyPropagationMap: vi.fn(),
  calculateResilienceIndex: vi.fn(),
}));
vi.mock('../../propagation/dependency-propagator', () => ({ buildDependencyPropagationMap }));
vi.mock('../../resilience-index/resilience-calculator', () => ({ calculateResilienceIndex }));

import { compareMitigations } from '../mitigation-comparator';

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

describe('lib/knowledge-transfer/mitigation-comparison/mitigation-comparator', () => {
  it('compares multiple scenarios and recommends the strongest', async () => {
    const nodes = [
      node('n1', { category: 'governance', nodeType: 'governance' }),
      node('n2', { continuitySensitivity: 'high' }),
      node('n3', { continuitySensitivity: 'medium', isSingleSource: false }),
      node('n4', { continuitySensitivity: 'low', isSingleSource: true }),
      node('n5', { category: 'compliance' }),
    ];
    buildDependencyPropagationMap.mockResolvedValue({ nodes });
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
    expect(Array.isArray(comparison.residualRisks)).toBe(true);
    comparison.scenarios.forEach((s) => {
      expect(s.projectionCurve.length).toBe(12);
      expect(s.actionPlan.length).toBeGreaterThan(0);
      expect(['weeks', 'months', 'quarters']).toContain(s.implementationEffort);
    });
  });

  it('handles unknown mitigation type with default action plan and no affected nodes', async () => {
    buildDependencyPropagationMap.mockResolvedValue({ nodes: [node('x', { isSingleSource: false, continuitySensitivity: 'low' })] });
    calculateResilienceIndex.mockResolvedValue({ overallScore: 70 });
    const comparison = await compareMitigations('org-2', [
      { mitigationType: 'unknown_type' as never, targetNodeIds: [], investmentLevel: 'medium', durationWeeks: 30 },
    ]);
    expect(comparison.scenarios[0].actionPlan.length).toBeGreaterThan(0);
    expect(comparison.scenarios[0].implementationEffort).toBe('quarters');
  });
});
