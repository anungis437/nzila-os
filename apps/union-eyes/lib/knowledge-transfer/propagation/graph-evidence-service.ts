/**
 * Graph Evidence Service — the ONE authoritative contract between the exploratory propagation map and the
 * verified-dependency graph.
 *
 * Every consumer of organizational dependency data (cascade analysis, graph querying, forecasting, resilience
 * index, mitigation comparison, strategy modeling, copilot context, continuity simulation, decision intelligence,
 * the propagation API, the verified-dependency lookup, and every frontend workspace) loads evidence through
 * loadGraphEvidence and asks it questions through the claim API below - never a separate, bespoke confidence/risk/
 * currentness computation against buildDependencyPropagationMap or listVerifiedDependencies.
 *
 * Two kinds of fact are distinguished everywhere, by runtime behavior, not just accompanying text:
 *   - EXPLORATORY: propagationMap.nodes/edges/bottlenecks/downstreamImpacts, inferred from exit-interview tag
 *     co-occurrence. A discovery signal and never a confirmed operational fact. It is never suppressed, but every
 *     consumer tags it as a hypothesis.
 *   - CONFIRMED: a specific, DIRECTED claim ("A depends on B", or a chain of such edges) every edge of which is backed
 *     by a CURRENT verified record (evaluateRecordCurrentness). A node's participation in some verified record
 *     confirms nothing about any other claim involving that node - there is deliberately no node-level confirmation.
 *
 * Family 1 final correction (DEF-0B7-COGB-PROPAGATION-DEPENDENCIES-AND-SENSITIVITY-INFERRED-FROM-TAG-CO-OCCURRENCE).
 */

import { listVerifiedDependencies } from './verified-dependency-store';
import { resolveNodeReference, type NodeResolution } from './graph-identity';
import { evaluateRecordCurrentness, loadGraphEvidenceContext, type GraphEvidenceContext } from './graph-evidence-evaluator';
import type { PropagationMap } from './propagation-models';
import type { CurrentVerifiedDependency, EvidenceTier, StaleVerifiedDependency, VerifiedDependencyRecord } from './verified-dependency-models';

export { evaluateRecordCurrentness, loadGraphEvidenceContext, type GraphEvidenceContext, type RecordCurrentness } from './graph-evidence-evaluator';

export const GRAPH_EVIDENCE_METHODOLOGY_NOTE =
  'This envelope carries two distinct kinds of fact: an exploratory graph inferred from exit-interview tag ' +
  'co-occurrence (a hypothesis, never a confirmed operational fact, however the figures are labelled), and a set ' +
  'of currently-verified DIRECTED dependencies, each attributed by a reviewer distinct from the submitter to a named ' +
  'process/system and responsible authority, whose nodes, classification and evidence are confirmed CURRENT at read ' +
  'time. A finding is confirmed only when every directed dependency it rests on is currently verified; a node ' +
  'appearing in some verified dependency confirms nothing else about that node. Each confirmed finding carries the ' +
  'evidence tier of its weakest edge: a system-resolved document, or an external source attested by a named reviewer.';

export interface GraphEvidence {
  organizationId: string;
  generatedAt: string;
  methodologyNote: string;
  /** The inferred graph. Fully functional for discovery/scenario use - never suppressed, always a hypothesis. */
  exploratory: PropagationMap;
  /** CURRENT verified dependencies, references resolved to current node ids, direction preserved. The only input to
   *  a confirmed claim. */
  currentVerified: CurrentVerifiedDependency[];
  /** Nominally 'verified' in the database but not current, with every reason. Review history is untouched - these
   *  are surfaced for re-verification, never silently dropped and never treated as confirmable. */
  staleVerified: StaleVerifiedDependency[];
  /** The snapshot the above was evaluated against; consumers resolve their own node references through it. */
  context: GraphEvidenceContext;
}

export async function loadGraphEvidence(orgId: string): Promise<GraphEvidence> {
  const nominallyVerified = await listVerifiedDependencies(orgId, 'verified');
  const { context, exploratory } = await loadGraphEvidenceContext(orgId, nominallyVerified);
  const currentVerified: CurrentVerifiedDependency[] = [];
  const staleVerified: StaleVerifiedDependency[] = [];
  for (const record of nominallyVerified) {
    const result = evaluateRecordCurrentness(record, context);
    if (result.current) currentVerified.push(result.dependency);
    else staleVerified.push({ record, staleReasons: result.staleReasons });
  }
  return {
    organizationId: orgId,
    generatedAt: new Date().toISOString(),
    methodologyNote: GRAPH_EVIDENCE_METHODOLOGY_NOTE,
    exploratory,
    currentVerified,
    staleVerified,
    context,
  };
}

// ---------------------------------------------------------------------------------------------------------------
// Claim API - the only way a consumer may call something confirmed
// ---------------------------------------------------------------------------------------------------------------

/** Resolves a consumer's node reference through the same snapshot the evidence was evaluated against. */
export function resolveEvidenceNode(evidence: GraphEvidence, reference: string): NodeResolution {
  return resolveNodeReference(evidence.context.aliases, evidence.context.currentNodeIds, reference);
}

export interface DependencyEdgeClaim {
  /** The node that depends on the other. */
  dependentNodeId: string;
  /** The node depended upon. */
  dependsOnNodeId: string;
}

export type DependencyClaim =
  | ({ kind: 'dependency' } & DependencyEdgeClaim)
  /** A path of directed edges, every one of which must be verified (e.g. a cascade from a failing node to an
   *  impacted area). An empty chain is never confirmed. */
  | { kind: 'dependency_chain'; edges: DependencyEdgeClaim[] };

export interface ConfirmedEdge {
  edge: DependencyEdgeClaim;
  record: VerifiedDependencyRecord;
  evidenceTier: Exclude<EvidenceTier, 'unverified_external_citation'>;
}

export type HypothesisReason =
  | 'no_verified_evidence_recorded'
  | 'edge_not_verified'
  | 'requires_reverification'
  | 'node_reference_ambiguous'
  | 'node_not_current'
  | 'empty_claim';

export type ClaimAssessment =
  | {
      status: 'confirmed';
      verifiedBy: ConfirmedEdge[];
      /** The weakest tier among the edges: one attested external edge makes the whole claim attested-external. */
      evidenceTier: Exclude<EvidenceTier, 'unverified_external_citation'>;
    }
  | {
      status: 'hypothesis';
      reason: HypothesisReason;
      /** The edges of the claim that are NOT currently verified. */
      unverifiedEdges: DependencyEdgeClaim[];
    };

/** The current verified record for one directed edge, by RESOLVED node id. A→B never matches B→A. */
function currentEdge(evidence: GraphEvidence, dependentId: string, dependsOnId: string): CurrentVerifiedDependency | undefined {
  return evidence.currentVerified.find((d) => d.dependentNodeId === dependentId && d.dependsOnNodeId === dependsOnId);
}

/** Whether a stale verified record exists for this directed edge (so the reason is "re-verify", not "never verified"). */
function staleEdgeExists(evidence: GraphEvidence, dependentId: string, dependsOnId: string): boolean {
  return evidence.staleVerified.some(({ record }) => {
    const a = resolveEvidenceNode(evidence, record.dependentNodeId);
    const b = resolveEvidenceNode(evidence, record.dependsOnNodeId);
    // A stale record whose references no longer resolve can still be the one this edge names by its raw reference.
    const aId = a.status === 'resolved' ? a.nodeId : record.dependentNodeId;
    const bId = b.status === 'resolved' ? b.nodeId : record.dependsOnNodeId;
    return aId === dependentId && bId === dependsOnId;
  });
}

const TIER_STRENGTH: Record<Exclude<EvidenceTier, 'unverified_external_citation'>, number> = {
  system_resolved_document: 2,
  human_attested_external: 1,
};

export function assessDependencyClaim(evidence: GraphEvidence, claim: DependencyClaim): ClaimAssessment {
  const edges = claim.kind === 'dependency' ? [{ dependentNodeId: claim.dependentNodeId, dependsOnNodeId: claim.dependsOnNodeId }] : claim.edges;
  if (edges.length === 0) return { status: 'hypothesis', reason: 'empty_claim', unverifiedEdges: [] };

  const verifiedBy: ConfirmedEdge[] = [];
  const unverifiedEdges: DependencyEdgeClaim[] = [];
  let reason: HypothesisReason | null = null;
  const note = (r: HypothesisReason) => {
    // The most actionable reason wins: identity problems, then re-verification, then plain absence.
    const rank: HypothesisReason[] = ['node_reference_ambiguous', 'node_not_current', 'requires_reverification', 'edge_not_verified'];
    if (reason === null || rank.indexOf(r) < rank.indexOf(reason)) reason = r;
  };

  for (const edge of edges) {
    const a = resolveEvidenceNode(evidence, edge.dependentNodeId);
    const b = resolveEvidenceNode(evidence, edge.dependsOnNodeId);
    if (a.status !== 'resolved' || b.status !== 'resolved') {
      unverifiedEdges.push(edge);
      note(a.status === 'ambiguous' || b.status === 'ambiguous' ? 'node_reference_ambiguous' : 'node_not_current');
      continue;
    }
    const found = currentEdge(evidence, a.nodeId, b.nodeId);
    if (found) {
      verifiedBy.push({ edge, record: found.record, evidenceTier: found.evidenceTier });
    } else {
      unverifiedEdges.push(edge);
      note(staleEdgeExists(evidence, a.nodeId, b.nodeId) ? 'requires_reverification' : 'edge_not_verified');
    }
  }

  if (unverifiedEdges.length > 0) {
    const noneRecorded = evidence.currentVerified.length === 0 && evidence.staleVerified.length === 0;
    return { status: 'hypothesis', reason: noneRecorded ? 'no_verified_evidence_recorded' : (reason ?? 'edge_not_verified'), unverifiedEdges };
  }
  const evidenceTier = verifiedBy.reduce<ConfirmedEdge['evidenceTier']>(
    (weakest, e) => (TIER_STRENGTH[e.evidenceTier] < TIER_STRENGTH[weakest] ? e.evidenceTier : weakest),
    'system_resolved_document',
  );
  return { status: 'confirmed', verifiedBy, evidenceTier };
}

/** Directed: is "dependent depends on dependsOn" currently verified? Never true for the reverse direction. */
export function hasVerifiedDependency(evidence: GraphEvidence, dependentNodeId: string, dependsOnNodeId: string): boolean {
  return assessDependencyClaim(evidence, { kind: 'dependency', dependentNodeId, dependsOnNodeId }).status === 'confirmed';
}

/** The tag every per-item consumer output carries. 'verified' ONLY when assessDependencyClaim confirmed the item's
 *  specific directed claim; everything else is 'exploratory' (a hypothesis from the inferred graph). */
export type EvidenceBasis = 'verified' | 'exploratory';

export function evidenceBasisOf(assessment: ClaimAssessment): EvidenceBasis {
  return assessment.status === 'confirmed' ? 'verified' : 'exploratory';
}

/**
 * Aggregate coverage of the exploratory graph by current verified edges, for consumers that report a single
 * organization-level figure (resilience index, forecasts, strategy and mitigation comparisons, copilot context). It
 * counts DIRECTED exploratory edges whose exact direction is verified - never nodes that merely participate in some
 * verified record - so an aggregate can say "k of n inferred dependencies are confirmed" and nothing stronger.
 */
export interface VerifiedEdgeCoverage {
  exploratoryEdgeCount: number;
  verifiedEdgeCount: number;
  /** verifiedEdgeCount / exploratoryEdgeCount, or 0 when there are no edges. */
  ratio: number;
  /** True only when every exploratory edge is verified (and there is at least one). */
  fullyVerified: boolean;
}

export function verifiedEdgeCoverage(evidence: GraphEvidence, edges: PropagationMap['edges'] = evidence.exploratory.edges): VerifiedEdgeCoverage {
  const verifiedEdgeCount = edges.filter((edge) => hasVerifiedDependency(evidence, edge.dependentId, edge.dependsOnId)).length;
  return {
    exploratoryEdgeCount: edges.length,
    verifiedEdgeCount,
    ratio: edges.length === 0 ? 0 : verifiedEdgeCount / edges.length,
    fullyVerified: edges.length > 0 && verifiedEdgeCount === edges.length,
  };
}

/**
 * Every node a failure of `originRef` reaches through CURRENT verified dependencies only, with the directed chain that
 * reaches it (origin first; each next node verifiably depends on the previous one) and that chain's assessment. This
 * is how a consumer confirms an impact claim "if X fails, Y is affected": Y is confirmed only when such a chain exists.
 * Shortest chain wins; cycles are not followed.
 */
export function verifiedImpactChains(
  evidence: GraphEvidence,
  originRef: string,
): Map<string, { chain: string[]; assessment: Extract<ClaimAssessment, { status: 'confirmed' }> }> {
  const result = new Map<string, { chain: string[]; assessment: Extract<ClaimAssessment, { status: 'confirmed' }> }>();
  const origin = resolveEvidenceNode(evidence, originRef);
  if (origin.status !== 'resolved') return result;
  const dependentsOf = new Map<string, string[]>();
  for (const dep of evidence.currentVerified) {
    dependentsOf.set(dep.dependsOnNodeId, [...(dependentsOf.get(dep.dependsOnNodeId) ?? []), dep.dependentNodeId]);
  }
  const queue: string[][] = [[origin.nodeId]];
  const seen = new Set([origin.nodeId]);
  while (queue.length > 0) {
    const chain = queue.shift()!;
    const last = chain[chain.length - 1];
    for (const next of dependentsOf.get(last) ?? []) {
      if (seen.has(next)) continue;
      seen.add(next);
      const nextChain = [...chain, next];
      const assessment = assessDependencyClaim(evidence, { kind: 'dependency_chain', edges: impactChainEdges(nextChain) });
      if (assessment.status === 'confirmed') {
        result.set(next, { chain: nextChain, assessment });
        queue.push(nextChain);
      }
    }
  }
  return result;
}

/** The directed edges an impact chain [origin, a, b, ...] asserts: a depends on origin, b depends on a, ... */
export function impactChainEdges(chain: readonly string[]): DependencyEdgeClaim[] {
  return chain.slice(1).map((dependent, i) => ({ dependentNodeId: dependent, dependsOnNodeId: chain[i] }));
}
