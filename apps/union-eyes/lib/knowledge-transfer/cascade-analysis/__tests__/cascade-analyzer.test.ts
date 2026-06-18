import { describe, expect, it, vi } from 'vitest';

const { buildDependencyPropagationMap } = vi.hoisted(() => ({ buildDependencyPropagationMap: vi.fn() }));
vi.mock('../../propagation/dependency-propagator', () => ({ buildDependencyPropagationMap }));

import { analyzeCascadeRisks } from '../cascade-analyzer';

function node(id: string, category: string, sensitivity = 'high') {
  return {
    id, label: `L-${id}`, nodeType: 'governance', category,
    frequency: 1, associatedRoles: ['officer'], isSingleSource: true,
    continuitySensitivity: sensitivity, sensitivityReason: 'r',
  };
}

describe('lib/knowledge-transfer/cascade-analysis/cascade-analyzer', () => {
  it('maps governance/compliance nodes to cascade and regulatory risks', async () => {
    buildDependencyPropagationMap.mockResolvedValue({
      organizationId: 'org-1',
      generatedAt: '2025-01-01',
      nodes: [
        node('g1', 'governance', 'critical'),
        node('c1', 'compliance', 'high'),
        node('s1', 'system', 'high'), // excluded
      ],
      edges: [],
      downstreamImpacts: [
        { nodeId: 'g1', directDependents: [], allAffectedNodes: ['Area A', 'Area B'], propagationPaths: [{ chainDepth: 3 } as never], totalExposureScore: 0, governanceExposure: [], vendorDependencyExposure: [], mitigation: { priority: 'high', actions: [] } },
      ],
      upstreamDependencies: [],
      couplingAnalysis: [],
      bottlenecks: [],
      resilience: { recommendations: [], priorityOrder: [], estimatedEffort: {} },
    });

    const result = await analyzeCascadeRisks('org-1');
    expect(result.governanceNodes.length).toBe(2);
    expect(result.governanceNodes.find((n) => n.id === 'g1')?.criticality).toBe('critical');
    expect(result.governanceNodes.find((n) => n.id === 'c1')?.criticality).toBe('high');
    const g1Risk = result.cascadeRisks.find((r) => r.governanceGap === 'L-g1');
    expect(g1Risk?.cascadeDepth).toBe(3);
    expect(g1Risk?.impactedAreas).toEqual(['Area A', 'Area B']);
    expect(g1Risk?.severity).toBe('critical');
    // c1 has no downstream impact -> defaults
    const c1Risk = result.cascadeRisks.find((r) => r.governanceGap === 'L-c1');
    expect(c1Risk?.cascadeDepth).toBe(1);
    expect(c1Risk?.impactedAreas).toEqual([]);
    expect(result.regulatoryRisks.some((r) => r.includes('Area A'))).toBe(true);
    expect(result.recommendations.length).toBe(3);
  });

  it('handles orgs with no governance nodes', async () => {
    buildDependencyPropagationMap.mockResolvedValue({
      organizationId: 'org-2', generatedAt: '2025-01-01',
      nodes: [node('s1', 'system')], edges: [], downstreamImpacts: [],
      upstreamDependencies: [], couplingAnalysis: [], bottlenecks: [],
      resilience: { recommendations: [], priorityOrder: [], estimatedEffort: {} },
    });
    const result = await analyzeCascadeRisks('org-2');
    expect(result.governanceNodes).toEqual([]);
    expect(result.cascadeRisks).toEqual([]);
    expect(result.regulatoryRisks).toEqual([]);
  });
});
