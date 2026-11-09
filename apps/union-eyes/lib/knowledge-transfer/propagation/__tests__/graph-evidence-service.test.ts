/**
 * Direct unit coverage for the shared graph-evidence contract (DEF-0B7-COGB-PROPAGATION-DEPENDENCIES-AND-
 * SENSITIVITY-INFERRED-FROM-TAG-CO-OCCURRENCE, Family 1 final correction). Every consumer loads evidence through
 * loadGraphEvidence and may call something confirmed only through assessDependencyClaim (or the helpers built on it).
 * This file proves, directly: directed claims, claim-level (not node-level) confirmation, chain confirmation, the
 * evidence tier carried by a confirmation, and aggregate coverage that counts verified directed edges only.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { buildDependencyPropagationMap, listVerifiedDependencies, listActiveNodeAliases, loadEvidenceDocumentIntegrity } = vi.hoisted(() => ({
  buildDependencyPropagationMap: vi.fn(),
  listVerifiedDependencies: vi.fn(),
  listActiveNodeAliases: vi.fn(async () => [] as Array<{ aliasLabel: string; canonicalConceptLabel: string }>),
  loadEvidenceDocumentIntegrity: vi.fn(async () => new Map<string, { active: boolean; integrity: string | null }>()),
}));
vi.mock('../dependency-propagator', () => ({ buildDependencyPropagationMap }));
vi.mock('../verified-dependency-store', () => ({ listVerifiedDependencies }));
vi.mock('../node-alias-store', () => ({ listActiveNodeAliases }));
vi.mock('../evidence-document-reference', () => ({ loadEvidenceDocumentIntegrity }));

import {
  loadGraphEvidence,
  assessDependencyClaim,
  hasVerifiedDependency,
  evidenceBasisOf,
  verifiedEdgeCoverage,
  verifiedImpactChains,
  impactChainEdges,
  GRAPH_EVIDENCE_METHODOLOGY_NOTE,
} from '../graph-evidence-service';
import { computeSourceFingerprint } from '../graph-fingerprint';

const NODE = (id: string) => ({ id, label: id, category: 'operational', nodeType: 'process' });

function propagationMap(nodeIds: string[], edges: Array<[string, string]> = []) {
  return {
    organizationId: 'org-1',
    generatedAt: 'now',
    nodes: nodeIds.map(NODE),
    edges: edges.map(([dependentId, dependsOnId]) => ({ dependentId, dependsOnId, strength: 'medium', evidenceCount: 1, rationale: '' })),
    downstreamImpacts: [],
    upstreamDependencies: [],
    couplingAnalysis: [],
    bottlenecks: [],
    resilience: { recommendations: [], priorityOrder: [], estimatedEffort: {} },
    evidenceState: 'exploratory' as const,
  };
}

/** A verified record for dependent -> dependsOn that is current against propagationMap(...) unless overridden. */
function verifiedRecord(dependentNodeId: string, dependsOnNodeId: string, overrides: Record<string, unknown> = {}) {
  return {
    id: `v-${dependentNodeId}-${dependsOnNodeId}`,
    organizationId: 'org-1',
    dependentNodeId,
    dependsOnNodeId,
    processOrSystem: 'payroll run',
    responsibleAuthority: 'finance',
    evidenceReference: 'ref',
    evidenceReferenceType: 'external_citation' as const,
    evidenceDocumentId: null,
    evidenceDocumentIntegrity: null,
    externalAttestation: 'checked the clause',
    externalAttestedBy: 'user-b',
    externalAttestedAt: 'now',
    identityKeyVersion: 2 as const,
    sourceFingerprint: computeSourceFingerprint(NODE(dependentNodeId), NODE(dependsOnNodeId), 2),
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

async function evidenceFor(nodeIds: string[], records: ReturnType<typeof verifiedRecord>[], edges: Array<[string, string]> = []) {
  buildDependencyPropagationMap.mockResolvedValueOnce(propagationMap(nodeIds, edges));
  listVerifiedDependencies.mockResolvedValueOnce(records);
  return loadGraphEvidence('org-1');
}

beforeEach(() => {
  listActiveNodeAliases.mockResolvedValue([]);
  loadEvidenceDocumentIntegrity.mockResolvedValue(new Map());
});

describe('loadGraphEvidence', () => {
  it('splits current from stale with the single evaluator, preserving direction and resolving to current ids', async () => {
    const evidence = await evidenceFor(['A', 'B', 'C'], [verifiedRecord('a', 'B'), verifiedRecord('B', 'Gone')]);
    expect(evidence.methodologyNote).toBe(GRAPH_EVIDENCE_METHODOLOGY_NOTE);
    expect(evidence.currentVerified).toHaveLength(1);
    expect(evidence.currentVerified[0]).toMatchObject({ dependentNodeId: 'A', dependsOnNodeId: 'B', evidenceTier: 'human_attested_external' });
    expect(evidence.staleVerified.map((s) => s.staleReasons)).toEqual([['node_no_longer_current']]);
  });

  it('treats document evidence whose content changed, or that lost its binding, as stale', async () => {
    loadEvidenceDocumentIntegrity.mockResolvedValue(new Map([
      ['doc-1', { active: true, integrity: 'version:2:new' }],
      ['doc-2', { active: true, integrity: 'sha256:same' }],
    ]));
    const doc = (id: string, integrity: string | null) => ({ evidenceReferenceType: 'document' as const, evidenceDocumentId: id, evidenceDocumentIntegrity: integrity, externalAttestation: null, externalAttestedBy: null, externalAttestedAt: null });
    const evidence = await evidenceFor(['A', 'B', 'C', 'D'], [
      verifiedRecord('A', 'B', doc('doc-1', 'version:1:old')),
      verifiedRecord('A', 'C', doc('doc-2', 'sha256:same')),
      verifiedRecord('A', 'D', doc('doc-2', null)),
    ]);
    expect(evidence.currentVerified.map((d) => [d.dependsOnNodeId, d.evidenceTier])).toEqual([['C', 'system_resolved_document']]);
    expect(evidence.staleVerified.map((s) => s.staleReasons)).toEqual([['evidence_document_changed'], ['evidence_document_changed']]);
  });

  it('never lets an unattested external citation, or one attested by its own submitter, back a confirmation', async () => {
    const evidence = await evidenceFor(['A', 'B', 'C'], [
      verifiedRecord('A', 'B', { externalAttestation: null, externalAttestedBy: null, externalAttestedAt: null }),
      verifiedRecord('A', 'C', { externalAttestedBy: 'user-a' }),
    ]);
    expect(evidence.currentVerified).toEqual([]);
    expect(evidence.staleVerified.map((s) => s.staleReasons)).toEqual([['external_evidence_not_attested'], ['external_evidence_not_attested']]);
  });
});

describe('directed claims', () => {
  it('A depends on B is confirmed; B depends on A is a hypothesis', async () => {
    const evidence = await evidenceFor(['A', 'B'], [verifiedRecord('A', 'B')]);
    expect(hasVerifiedDependency(evidence, 'A', 'B')).toBe(true);
    expect(hasVerifiedDependency(evidence, 'B', 'A')).toBe(false);
    expect(assessDependencyClaim(evidence, { kind: 'dependency', dependentNodeId: 'B', dependsOnNodeId: 'A' })).toEqual({
      status: 'hypothesis',
      reason: 'edge_not_verified',
      unverifiedEdges: [{ dependentNodeId: 'B', dependsOnNodeId: 'A' }],
    });
  });

  it('a node\'s participation in one verified dependency confirms nothing about its other relationships', async () => {
    const evidence = await evidenceFor(['A', 'B', 'C'], [verifiedRecord('A', 'B')]);
    expect(hasVerifiedDependency(evidence, 'A', 'C')).toBe(false);
    expect(hasVerifiedDependency(evidence, 'C', 'B')).toBe(false);
  });

  it('carries the verified record and its tier on a confirmation', async () => {
    const evidence = await evidenceFor(['A', 'B'], [verifiedRecord('A', 'B')]);
    const assessment = assessDependencyClaim(evidence, { kind: 'dependency', dependentNodeId: 'a', dependsOnNodeId: 'b' });
    expect(assessment.status).toBe('confirmed');
    if (assessment.status === 'confirmed') {
      expect(assessment.evidenceTier).toBe('human_attested_external');
      expect(assessment.verifiedBy[0].record.id).toBe('v-A-B');
    }
    expect(evidenceBasisOf(assessment)).toBe('verified');
  });

  it('reports re-verification, ambiguity and absence distinctly', async () => {
    const stale = await evidenceFor(['A', 'B'], [verifiedRecord('A', 'B', { sourceFingerprint: 'drifted' })]);
    expect(assessDependencyClaim(stale, { kind: 'dependency', dependentNodeId: 'A', dependsOnNodeId: 'B' })).toMatchObject({ status: 'hypothesis', reason: 'requires_reverification' });
    const ambiguous = await evidenceFor(['A', 'B', 'b'], [verifiedRecord('A', 'C')]);
    expect(assessDependencyClaim(ambiguous, { kind: 'dependency', dependentNodeId: 'A', dependsOnNodeId: 'B' })).toMatchObject({ status: 'hypothesis', reason: 'node_reference_ambiguous' });
    const none = await evidenceFor(['A', 'B'], []);
    expect(assessDependencyClaim(none, { kind: 'dependency', dependentNodeId: 'A', dependsOnNodeId: 'B' })).toMatchObject({ status: 'hypothesis', reason: 'no_verified_evidence_recorded' });
  });

  it('resolves claims through the same aliases as the evidence', async () => {
    listActiveNodeAliases.mockResolvedValue([{ aliasLabel: 'Old_B', canonicalConceptLabel: 'B' }]);
    const evidence = await evidenceFor(['A', 'B'], [verifiedRecord('A', 'B')]);
    expect(hasVerifiedDependency(evidence, 'A', 'Old_B')).toBe(true);
  });
});

describe('chain claims', () => {
  it('confirms a chain only when every directed edge is verified, and carries the weakest tier', async () => {
    loadEvidenceDocumentIntegrity.mockResolvedValue(new Map([['doc-1', { active: true, integrity: 'sha256:x' }]]));
    const evidence = await evidenceFor(['A', 'B', 'C', 'D'], [
      verifiedRecord('B', 'A', { evidenceReferenceType: 'document', evidenceDocumentId: 'doc-1', evidenceDocumentIntegrity: 'sha256:x', externalAttestation: null, externalAttestedBy: null, externalAttestedAt: null }),
      verifiedRecord('C', 'B'),
    ]);
    const full = assessDependencyClaim(evidence, { kind: 'dependency_chain', edges: impactChainEdges(['A', 'B', 'C']) });
    expect(full).toMatchObject({ status: 'confirmed', evidenceTier: 'human_attested_external' });
    const partial = assessDependencyClaim(evidence, { kind: 'dependency_chain', edges: impactChainEdges(['A', 'B', 'C', 'D']) });
    expect(partial).toMatchObject({ status: 'hypothesis', unverifiedEdges: [{ dependentNodeId: 'D', dependsOnNodeId: 'C' }] });
    expect(assessDependencyClaim(evidence, { kind: 'dependency_chain', edges: [] })).toMatchObject({ status: 'hypothesis', reason: 'empty_claim' });
  });

  it('verifiedImpactChains follows only verified edges in the impact direction', async () => {
    const evidence = await evidenceFor(['A', 'B', 'C', 'D'], [verifiedRecord('B', 'A'), verifiedRecord('C', 'B'), verifiedRecord('A', 'D')]);
    const chains = verifiedImpactChains(evidence, 'A');
    expect([...chains.keys()].sort()).toEqual(['B', 'C']);
    expect(chains.get('C')?.chain).toEqual(['A', 'B', 'C']);
    // D is something A depends on: a failure of A does not reach D.
    expect(chains.has('D')).toBe(false);
  });
});

describe('verifiedEdgeCoverage', () => {
  it('counts verified directed exploratory edges, never participating nodes', async () => {
    const evidence = await evidenceFor(['A', 'B', 'C'], [verifiedRecord('A', 'B')], [['A', 'B'], ['B', 'A'], ['A', 'C']]);
    expect(verifiedEdgeCoverage(evidence)).toEqual({ exploratoryEdgeCount: 3, verifiedEdgeCount: 1, ratio: 1 / 3, fullyVerified: false });
  });

  it('is zero, not full, with no edges', async () => {
    const evidence = await evidenceFor(['A'], []);
    expect(verifiedEdgeCoverage(evidence)).toEqual({ exploratoryEdgeCount: 0, verifiedEdgeCount: 0, ratio: 0, fullyVerified: false });
  });
});
