/**
 * Direct unit coverage for the shared graph-evidence contract (DEF-0B7-COGB-PROPAGATION-DEPENDENCIES-AND-
 * SENSITIVITY-INFERRED-FROM-TAG-CO-OCCURRENCE). Every consumer (cascade analysis, graph querying, forecasting,
 * resilience index, mitigation comparison, strategy modeling, copilot context, institutional intelligence
 * kernels) loads evidence through loadGraphEvidence and checks it through these helpers; this file proves the
 * contract's own logic directly, rather than relying solely on indirect coverage through each consumer.
 */
import { describe, expect, it, vi } from 'vitest';

const { buildDependencyPropagationMap, listVerifiedDependencies } = vi.hoisted(() => ({
  buildDependencyPropagationMap: vi.fn(),
  listVerifiedDependencies: vi.fn(),
}));
vi.mock('../dependency-propagator', () => ({ buildDependencyPropagationMap }));
vi.mock('../verified-dependency-store', () => ({ listVerifiedDependencies }));

import {
  loadGraphEvidence,
  hasVerifiedRelationship,
  hasAnyVerifiedEvidence,
  evidenceBasisForNode,
  evidenceBasisForPair,
  confirmedForNode,
  GRAPH_EVIDENCE_METHODOLOGY_NOTE,
  type GraphEvidence,
} from '../graph-evidence-service';

function propagationMap(nodeIds: string[]) {
  return {
    organizationId: 'org-1',
    generatedAt: 'now',
    nodes: nodeIds.map((id) => ({ id, label: id })),
    edges: [],
    downstreamImpacts: [],
    upstreamDependencies: [],
    couplingAnalysis: [],
    bottlenecks: [],
    resilience: { recommendations: [], priorityOrder: [], estimatedEffort: {} },
    evidenceState: 'exploratory' as const,
  };
}

function verifiedRecord(dependentNodeId: string, dependsOnNodeId: string, overrides: Record<string, unknown> = {}) {
  return {
    id: `v-${dependentNodeId}-${dependsOnNodeId}`,
    organizationId: 'org-1',
    dependentNodeId,
    dependsOnNodeId,
    processOrSystem: 'payroll run',
    responsibleAuthority: 'finance',
    evidenceReference: 'ref',
    status: 'verified' as const,
    submittedBy: 'user-a',
    reviewedBy: 'user-b',
    reviewedAt: 'now',
    reviewNotes: null,
    createdAt: 'now',
    updatedAt: 'now',
    ...overrides,
  };
}

describe('loadGraphEvidence', () => {
  it('loads the exploratory map and verified relationships together, and builds canonical node keys from both directions', async () => {
    buildDependencyPropagationMap.mockResolvedValue(propagationMap(['Payroll_System', 'Bylaw_Amendment', 'Vendor_X']));
    listVerifiedDependencies.mockResolvedValue([verifiedRecord('Payroll_System', 'Bylaw_Amendment')]);

    const evidence = await loadGraphEvidence('org-1');

    expect(listVerifiedDependencies).toHaveBeenCalledWith('org-1', 'verified');
    expect(evidence.exploratory.nodes.map((n) => n.id)).toEqual(['Payroll_System', 'Bylaw_Amendment', 'Vendor_X']);
    expect(evidence.verifiedRelationships.length).toBe(1);
    expect(evidence.verifiedNodeKeys.has('payroll system')).toBe(true);
    expect(evidence.verifiedNodeKeys.has('bylaw amendment')).toBe(true);
    expect(evidence.verifiedNodeKeys.has('vendor x')).toBe(false);
    expect(evidence.methodologyNote).toBe(GRAPH_EVIDENCE_METHODOLOGY_NOTE);
    expect(evidence.organizationId).toBe('org-1');
  });

  it('produces an empty verifiedNodeKeys set when there are no verified relationships', async () => {
    buildDependencyPropagationMap.mockResolvedValue(propagationMap(['Payroll_System']));
    listVerifiedDependencies.mockResolvedValue([]);

    const evidence = await loadGraphEvidence('org-1');
    expect(evidence.verifiedNodeKeys.size).toBe(0);
    expect(evidence.verifiedRelationships).toEqual([]);
  });
});

describe('hasVerifiedRelationship', () => {
  const evidence: GraphEvidence = {
    organizationId: 'org-1',
    generatedAt: 'now',
    methodologyNote: GRAPH_EVIDENCE_METHODOLOGY_NOTE,
    exploratory: propagationMap(['Payroll_System', 'Bylaw_Amendment', 'Vendor_X']),
    verifiedRelationships: [verifiedRecord('Payroll_System', 'Bylaw_Amendment')],
    verifiedNodeKeys: new Set(['payroll system', 'bylaw amendment']),
  };

  it('is true in either direction for a verified pair', () => {
    expect(hasVerifiedRelationship(evidence, 'Payroll_System', 'Bylaw_Amendment')).toBe(true);
    expect(hasVerifiedRelationship(evidence, 'Bylaw_Amendment', 'Payroll_System')).toBe(true);
  });

  it('is identity-tolerant: matches on canonical key, not raw string equality', () => {
    expect(hasVerifiedRelationship(evidence, 'payroll_system', 'BYLAW AMENDMENT')).toBe(true);
  });

  it('is false for a pair with no verified relationship between them', () => {
    expect(hasVerifiedRelationship(evidence, 'Payroll_System', 'Vendor_X')).toBe(false);
  });

  it('is false when a node simply has other verified evidence but not with this specific partner', () => {
    expect(hasVerifiedRelationship(evidence, 'Bylaw_Amendment', 'Vendor_X')).toBe(false);
  });
});

describe('hasAnyVerifiedEvidence / evidenceBasisForNode / evidenceBasisForPair', () => {
  const evidence: GraphEvidence = {
    organizationId: 'org-1',
    generatedAt: 'now',
    methodologyNote: GRAPH_EVIDENCE_METHODOLOGY_NOTE,
    exploratory: propagationMap(['Payroll_System', 'Bylaw_Amendment', 'Vendor_X']),
    verifiedRelationships: [verifiedRecord('Payroll_System', 'Bylaw_Amendment')],
    verifiedNodeKeys: new Set(['payroll system', 'bylaw amendment']),
  };

  it('reports verified for a node participating in any verified relationship', () => {
    expect(hasAnyVerifiedEvidence(evidence, 'Payroll_System')).toBe(true);
    expect(evidenceBasisForNode(evidence, 'Payroll_System')).toBe('verified');
  });

  it('reports exploratory for a node with no verified relationship at all', () => {
    expect(hasAnyVerifiedEvidence(evidence, 'Vendor_X')).toBe(false);
    expect(evidenceBasisForNode(evidence, 'Vendor_X')).toBe('exploratory');
  });

  it('reports exploratory for a node id absent from the graph entirely, never throwing', () => {
    expect(evidenceBasisForNode(evidence, 'Nonexistent_Node')).toBe('exploratory');
  });

  it('evidenceBasisForPair mirrors hasVerifiedRelationship', () => {
    expect(evidenceBasisForPair(evidence, 'Payroll_System', 'Bylaw_Amendment')).toBe('verified');
    expect(evidenceBasisForPair(evidence, 'Payroll_System', 'Vendor_X')).toBe('exploratory');
  });
});

describe('confirmedForNode', () => {
  it('is unavailable with no_verified_evidence_recorded when the organization has no verified relationships at all', () => {
    const evidence: GraphEvidence = {
      organizationId: 'org-1',
      generatedAt: 'now',
      methodologyNote: GRAPH_EVIDENCE_METHODOLOGY_NOTE,
      exploratory: propagationMap(['Payroll_System']),
      verifiedRelationships: [],
      verifiedNodeKeys: new Set(),
    };
    const result = confirmedForNode(evidence, 'Payroll_System', { some: 'value' });
    expect(result).toEqual({ status: 'unavailable', reason: 'no_verified_evidence_recorded' });
  });

  it('is unavailable with no_verified_evidence_for_node when other nodes are verified but not this one', () => {
    const evidence: GraphEvidence = {
      organizationId: 'org-1',
      generatedAt: 'now',
      methodologyNote: GRAPH_EVIDENCE_METHODOLOGY_NOTE,
      exploratory: propagationMap(['Payroll_System', 'Vendor_X']),
      verifiedRelationships: [verifiedRecord('Payroll_System', 'Bylaw_Amendment')],
      verifiedNodeKeys: new Set(['payroll system', 'bylaw amendment']),
    };
    const result = confirmedForNode(evidence, 'Vendor_X', { some: 'value' });
    expect(result).toEqual({ status: 'unavailable', reason: 'no_verified_evidence_for_node' });
  });

  it('is confirmed with the supplied value and the backing verified records when evidence exists for the node', () => {
    const record = verifiedRecord('Payroll_System', 'Bylaw_Amendment');
    const evidence: GraphEvidence = {
      organizationId: 'org-1',
      generatedAt: 'now',
      methodologyNote: GRAPH_EVIDENCE_METHODOLOGY_NOTE,
      exploratory: propagationMap(['Payroll_System', 'Bylaw_Amendment']),
      verifiedRelationships: [record],
      verifiedNodeKeys: new Set(['payroll system', 'bylaw amendment']),
    };
    const result = confirmedForNode(evidence, 'Payroll_System', { risk: 'high' });
    expect(result.status).toBe('confirmed');
    if (result.status === 'confirmed') {
      expect(result.value).toEqual({ risk: 'high' });
      expect(result.verifiedBy).toEqual([record]);
    }
  });

  it('never silently substitutes the exploratory graph as confirmed — the gate is binary on verified evidence alone', () => {
    const evidence: GraphEvidence = {
      organizationId: 'org-1',
      generatedAt: 'now',
      methodologyNote: GRAPH_EVIDENCE_METHODOLOGY_NOTE,
      exploratory: propagationMap(Array.from({ length: 20 }, (_, i) => `Node_${i}`)),
      verifiedRelationships: [],
      verifiedNodeKeys: new Set(),
    };
    for (const node of evidence.exploratory.nodes) {
      expect(confirmedForNode(evidence, node.id, 'anything').status).toBe('unavailable');
    }
  });
});
