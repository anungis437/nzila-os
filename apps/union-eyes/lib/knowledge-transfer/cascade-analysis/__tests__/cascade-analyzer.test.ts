import { describe, expect, it, vi, beforeEach } from 'vitest';

const { buildDependencyPropagationMap, listVerifiedDependencies, listActiveNodeAliases } = vi.hoisted(() => ({ buildDependencyPropagationMap: vi.fn(), listVerifiedDependencies: vi.fn(), listActiveNodeAliases: vi.fn(async () => []) }));
vi.mock('../../propagation/dependency-propagator', () => ({ buildDependencyPropagationMap }));
vi.mock('../../propagation/verified-dependency-store', () => ({ listVerifiedDependencies }));
vi.mock('../../propagation/node-alias-store', () => ({ listActiveNodeAliases }));
vi.mock('../../propagation/evidence-document-reference', () => ({ loadEvidenceDocumentIntegrity: async () => new Map() }));

import { analyzeCascadeRisks } from '../cascade-analyzer';
import { currentVerifiedRecord } from '../../propagation/__tests__/verified-record-fixture';

function node(id: string, category: string, sensitivity = 'high') {
  return {
    id, label: `L-${id}`, nodeType: 'governance', category,
    frequency: 1, associatedRoles: ['officer'], isSingleSource: true,
    continuitySensitivity: sensitivity, sensitivityReason: 'r',
  };
}

describe('lib/knowledge-transfer/cascade-analysis/cascade-analyzer', () => {
  beforeEach(() => {
    listVerifiedDependencies.mockResolvedValue([]);
  });

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
    // DEF-0B7-COGB: with no verified dependency evidence recorded, every item is tagged exploratory, never silently
    // presented with the same confidence as a verified finding.
    expect(result.governanceNodes.every((n) => n.evidenceBasis === 'exploratory')).toBe(true);
    expect(result.cascadeRisks.every((r) => r.evidenceBasis === 'exploratory')).toBe(true);
  });

  /** g1 (governance, critical) with inferred downstream impact on a1, a2, b1; a1 and a2 are operational areas. */
  function cascadeMap(extraNodes: ReturnType<typeof area>[] = []) {
    return {
      organizationId: 'org-1', generatedAt: '2025-01-01',
      nodes: [node('g1', 'governance', 'critical'), area('a1'), area('a2'), area('b1'), ...extraNodes],
      edges: [],
      downstreamImpacts: [
        { nodeId: 'g1', directDependents: ['a1', 'a2'], allAffectedNodes: ['a1', 'a2', 'b1'], propagationPaths: [{ chainDepth: 3 } as never], totalExposureScore: 0, governanceExposure: [], vendorDependencyExposure: [], mitigation: { priority: 'high', actions: [] } },
      ],
      upstreamDependencies: [], couplingAnalysis: [], bottlenecks: [],
      resilience: { recommendations: [], priorityOrder: [], estimatedEffort: {} },
    };
  }
  function area(id: string) {
    return { id, label: `L-${id}`, nodeType: 'process', category: 'operational', frequency: 1, associatedRoles: [], isSingleSource: false, continuitySensitivity: 'low', sensitivityReason: 'r' };
  }

  it('keeps a governance node exploratory, and confirms no cascade, when a verified record merely involves it or points the wrong way', async () => {
    buildDependencyPropagationMap.mockResolvedValue(cascadeMap());
    // g1 depends on a1: a real, current verified record naming g1 - but in the direction opposite to the impact
    // (a failure of g1 does not reach a1 through "g1 depends on a1").
    listVerifiedDependencies.mockResolvedValue([currentVerifiedRecord(node('g1', 'governance', 'critical'), area('a1'))]);
    const result = await analyzeCascadeRisks('org-1');
    expect(result.governanceNodes.find((n) => n.id === 'g1')?.evidenceBasis).toBe('exploratory');
    const g1Risk = result.cascadeRisks.find((r) => r.governanceNodeId === 'g1')!;
    expect(g1Risk.evidenceBasis).toBe('exploratory');
    expect(g1Risk.confirmedImpactedAreas).toEqual([]);
    expect(g1Risk.severityBasis).toBe('exploratory');
    expect(result.confirmedCascadeRisks).toEqual([]);
    // The inferred cascade is still reported in full, as a hypothesis.
    expect(result.exploratoryCascadeHypotheses.find((r) => r.governanceNodeId === 'g1')?.impactedAreas).toEqual(['a1', 'a2', 'b1']);
  });

  it('does not confirm a cascade from a verified record between two OTHER nodes in the cascade', async () => {
    buildDependencyPropagationMap.mockResolvedValue(cascadeMap());
    // b1 depends on a1 is verified, but nothing verified connects a1 to g1: no chain from the governance node exists.
    listVerifiedDependencies.mockResolvedValue([currentVerifiedRecord(area('b1'), area('a1'))]);
    const result = await analyzeCascadeRisks('org-1');
    expect(result.cascadeRisks.find((r) => r.governanceNodeId === 'g1')?.confirmedImpactedAreas).toEqual([]);
    expect(result.confirmedCascadeRisks).toEqual([]);
  });

  it('confirms only the areas reached through a fully verified chain in the impact direction; severity stays exploratory', async () => {
    buildDependencyPropagationMap.mockResolvedValue(cascadeMap());
    const g1 = node('g1', 'governance', 'critical');
    // a1 depends on g1, b1 depends on a1: g1 -> a1 -> b1 is a fully verified impact chain. a2 has no verified edge.
    listVerifiedDependencies.mockResolvedValue([currentVerifiedRecord(area('a1'), g1), currentVerifiedRecord(area('b1'), area('a1'))]);
    const result = await analyzeCascadeRisks('org-1');

    // Node properties are never confirmed by dependency evidence.
    expect(result.governanceNodes.find((n) => n.id === 'g1')?.evidenceBasis).toBe('exploratory');
    const g1Risk = result.cascadeRisks.find((r) => r.governanceNodeId === 'g1')!;
    expect(g1Risk.evidenceBasis).toBe('verified');
    expect(g1Risk.impactedAreas).toEqual(['a1', 'a2', 'b1']);
    expect(g1Risk.confirmedImpactedAreas.map((a) => [a.nodeId, a.chain, a.evidenceTier])).toEqual([
      ['a1', ['g1', 'a1'], 'human_attested_external'],
      ['b1', ['g1', 'a1', 'b1'], 'human_attested_external'],
    ]);
    expect(g1Risk.confirmedImpactedAreas.find((a) => a.nodeId === 'b1')?.verifiedBy.map((e) => e.record.id)).toEqual(['vd-a1-g1', 'vd-b1-a1']);

    // The confirmed view holds ONLY the confirmed areas, depth from the longest confirmed chain, severity still a hypothesis.
    expect(result.confirmedCascadeRisks).toHaveLength(1);
    const confirmed = result.confirmedCascadeRisks[0];
    expect(confirmed.impactedAreas).toEqual(['a1', 'b1']);
    expect(confirmed.impactedAreas).not.toContain('a2');
    expect(confirmed.cascadeDepth).toBe(3);
    expect(confirmed.severity).toBe('critical');
    expect(confirmed.severityBasis).toBe('exploratory');

    // The unconfirmed remainder stays available as a hypothesis.
    const hypothesis = result.exploratoryCascadeHypotheses.find((r) => r.governanceNodeId === 'g1')!;
    expect(hypothesis.impactedAreas).toEqual(['a2']);
    expect(hypothesis.evidenceBasis).toBe('exploratory');
    expect(hypothesis.confirmedImpactedAreas).toEqual([]);
  });

  it('does not confirm an area past a broken link, nor through a verified record that is no longer current', async () => {
    buildDependencyPropagationMap.mockResolvedValue(cascadeMap());
    const g1 = node('g1', 'governance', 'critical');
    listVerifiedDependencies.mockResolvedValue([
      // a1 depends on g1, but it was verified while a1 was classified 'governance': stale, so the chain starts nowhere.
      currentVerifiedRecord({ ...area('a1'), category: 'governance' }, g1),
      // b1 depends on a1 is current - but without a current g1 -> a1 link it is unreachable from g1.
      currentVerifiedRecord(area('b1'), area('a1')),
    ]);
    const result = await analyzeCascadeRisks('org-1');
    expect(result.cascadeRisks.find((r) => r.governanceNodeId === 'g1')?.confirmedImpactedAreas).toEqual([]);
    expect(result.confirmedCascadeRisks).toEqual([]);
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
