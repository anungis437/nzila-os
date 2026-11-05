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
        { nodeId: 'c1', directDependents: [], allAffectedNodes: ['Area C'], propagationPaths: [], totalExposureScore: 0, governanceExposure: [], vendorDependencyExposure: [], mitigation: { priority: 'high', actions: [] } },
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
    // c1 has no propagation path -> default depth
    const c1Risk = result.cascadeRisks.find((r) => r.governanceGap === 'L-c1');
    expect(c1Risk?.cascadeDepth).toBe(1);
    expect(c1Risk?.impactedAreas).toEqual(['Area C']);
    // DEF-0B7-COGA-CASCADE-REGULATORY-RISK-IS-A-LABEL-TEMPLATE: only what depends on a compliance node is listed, as a dependency;
    // what depends on a governance node alone is not called regulatory, and no fixed recommendations are attached.
    expect(result.regulatoryRisks).toEqual(['Depends on a compliance node: Area C']);
    expect(result.regulatoryAssessment).toBe('dependency_only_no_regulation_assessed');
    expect(result.recommendations).toEqual([]);
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
