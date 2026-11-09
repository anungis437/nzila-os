/**
 * Graph Evidence Service — the ONE authoritative contract between the exploratory propagation map and the
 * verified-dependency graph.
 *
 * Every consumer of organizational dependency data (cascade analysis, graph querying, forecasting, resilience
 * index, mitigation comparison, strategy modeling, copilot context, continuity simulation, institutional
 * intelligence kernels, the propagation API, and every frontend workspace) must load evidence through
 * loadGraphEvidence and check it through the helpers below - never build a separate, bespoke confidence/risk/
 * currentness computation against buildDependencyPropagationMap or listVerifiedDependencies directly.
 *
 * Two kinds of fact are distinguished everywhere, by runtime behavior, not just accompanying text:
 *   - EXPLORATORY: propagationMap.nodes/edges/bottlenecks/downstreamImpacts, inferred from exit-interview tag
 *     co-occurrence. A valuable discovery signal; never a confirmed operational fact. Exploratory output remains
 *     fully functional everywhere - it is never suppressed - but every consumer must tag it as exploratory,
 *     never present it as established.
 *   - VERIFIED: ue_verified_dependency_evidence rows with status 'verified' - a reviewer distinct from the
 *     submitter attributed a named process/system and responsible authority to a directional relationship. Only
 *     this evidence may back a confirmed organizational risk, succession, simulation or compliance conclusion.
 *
 * (DEF-0B7-COGB-PROPAGATION-DEPENDENCIES-AND-SENSITIVITY-INFERRED-FROM-TAG-CO-OCCURRENCE)
 */

import { buildDependencyPropagationMap } from './dependency-propagator';
import { listVerifiedDependencies } from './verified-dependency-store';
import { canonicalNodeIdentityKey, resolveConceptLabel, type AliasLookup } from './graph-identity';
import { computeSourceFingerprint } from './graph-fingerprint';
import { listActiveNodeAliases } from './node-alias-store';
import { documentCurrentlyResolves } from './evidence-document-reference';
import type { PropagationMap, DependencyNode } from './propagation-models';
import type { VerifiedDependencyRecord, EvidenceStaleReason, StaleVerifiedDependency } from './verified-dependency-models';

/** Every figure in the exploratory half of this envelope is inferred, never measured - see PropagationMap.methodologyNote. */
export const GRAPH_EVIDENCE_METHODOLOGY_NOTE =
  'This envelope carries two distinct kinds of fact: an exploratory graph inferred from exit-interview tag ' +
  'co-occurrence (never a confirmed operational fact, however the figures are labelled), and a separate set of ' +
  'currently-verified relationships, each attributed by a reviewer distinct from the submitter to a named ' +
  'process/system and responsible authority, whose underlying nodes and evidence reference are confirmed CURRENT ' +
  'at read time (not merely verified at some point in the past) before being treated as confirmable. A consumer ' +
  'reporting a confirmed risk, dependency, succession or compliance conclusion must use the current-verified half ' +
  'only, and must say so explicitly when no verified evidence exists rather than silently substituting the ' +
  'exploratory graph.';

/** Loaded together so every consumer checks the SAME evidence at the SAME moment. */
export interface GraphEvidence {
  organizationId: string;
  generatedAt: string;
  methodologyNote: string;
  /** The inferred graph. Still fully functional for discovery/scenario use - never suppressed, always tagged. */
  exploratory: PropagationMap;
  /** Verified AND currently valid: status 'verified', fingerprint matches the nodes' current attributes (resolved
   *  through aliases), and a 'document' evidence reference still resolves. This - and only this - set backs a
   *  confirmed conclusion. */
  verifiedRelationships: VerifiedDependencyRecord[];
  /** Nominally 'verified' in the database but excluded above: the node drifted, the fingerprint no longer matches,
   *  or the evidence reference no longer resolves. Full review history is untouched (status stays 'verified', not
   *  deleted or mutated) - these are surfaced separately for audit/UI visibility and re-verification workflows,
   *  never silently dropped or silently treated as confirmable. */
  staleVerifiedRelationships: StaleVerifiedDependency[];
  /** Canonical identity keys (see graph-identity.ts) of every node appearing in a CURRENT verified relationship. */
  verifiedNodeKeys: Set<string>;
}

function nodeAttributesOf(node: DependencyNode) {
  return { label: node.label, category: node.category, nodeType: node.nodeType };
}

/** Resolves a verified record's two node ids to their CURRENT node (alias-aware), and the reasons (if any) it is
 *  no longer current: the node no longer resolves at all, its fingerprint no longer matches, or (for a 'document'
 *  evidence reference) the referenced document no longer resolves. */
async function staleReasonsFor(
  record: VerifiedDependencyRecord,
  currentIds: readonly string[],
  aliases: readonly AliasLookup[],
  byId: Map<string, DependencyNode>,
): Promise<EvidenceStaleReason[]> {
  const reasons: EvidenceStaleReason[] = [];
  const dependentId = resolveConceptLabel(aliases, currentIds, record.dependentNodeId);
  const dependsOnId = resolveConceptLabel(aliases, currentIds, record.dependsOnNodeId);
  const dependent = dependentId ? byId.get(dependentId) : undefined;
  const dependsOn = dependsOnId ? byId.get(dependsOnId) : undefined;
  if (!dependent || !dependsOn) {
    reasons.push('node_no_longer_current');
  } else {
    const current = computeSourceFingerprint(nodeAttributesOf(dependent), nodeAttributesOf(dependsOn));
    if (record.sourceFingerprint === null || record.sourceFingerprint !== current) reasons.push('source_fingerprint_mismatch');
  }
  if (record.evidenceReferenceType === 'document' && record.evidenceDocumentId) {
    const resolves = await documentCurrentlyResolves(record.organizationId, record.evidenceDocumentId);
    if (!resolves) reasons.push('evidence_reference_no_longer_resolves');
  }
  return reasons;
}

export async function loadGraphEvidence(orgId: string): Promise<GraphEvidence> {
  const [exploratory, nominallyVerified, aliases] = await Promise.all([
    buildDependencyPropagationMap(orgId),
    listVerifiedDependencies(orgId, 'verified'),
    listActiveNodeAliases(orgId),
  ]);
  const currentIds = exploratory.nodes.map((node) => node.id);
  const byId = new Map(exploratory.nodes.map((node) => [node.id, node]));

  const verifiedRelationships: VerifiedDependencyRecord[] = [];
  const staleVerifiedRelationships: StaleVerifiedDependency[] = [];
  await Promise.all(
    nominallyVerified.map(async (record) => {
      const staleReasons = await staleReasonsFor(record, currentIds, aliases, byId);
      if (staleReasons.length === 0) verifiedRelationships.push(record);
      else staleVerifiedRelationships.push({ record, staleReasons });
    }),
  );

  const verifiedNodeKeys = new Set(
    verifiedRelationships.flatMap((record) => [canonicalNodeIdentityKey(record.dependentNodeId), canonicalNodeIdentityKey(record.dependsOnNodeId)]),
  );
  return {
    organizationId: orgId,
    generatedAt: new Date().toISOString(),
    methodologyNote: GRAPH_EVIDENCE_METHODOLOGY_NOTE,
    exploratory,
    verifiedRelationships,
    staleVerifiedRelationships,
    verifiedNodeKeys,
  };
}

/** Is there a currently-verified relationship between these two node ids, in either direction? Identity-tolerant
 *  (matches on canonicalNodeIdentityKey, not raw string equality), so minor label drift does not silently drop a
 *  verified relationship's applicability. */
export function hasVerifiedRelationship(evidence: GraphEvidence, nodeIdA: string, nodeIdB: string): boolean {
  const keyA = canonicalNodeIdentityKey(nodeIdA);
  const keyB = canonicalNodeIdentityKey(nodeIdB);
  return evidence.verifiedRelationships.some((record) => {
    const dependentKey = canonicalNodeIdentityKey(record.dependentNodeId);
    const dependsOnKey = canonicalNodeIdentityKey(record.dependsOnNodeId);
    return (dependentKey === keyA && dependsOnKey === keyB) || (dependentKey === keyB && dependsOnKey === keyA);
  });
}

/** Does this node participate in ANY currently-verified relationship, as dependent or depended-upon? */
export function hasAnyVerifiedEvidence(evidence: GraphEvidence, nodeId: string): boolean {
  return evidence.verifiedNodeKeys.has(canonicalNodeIdentityKey(nodeId));
}

/** The standard evidence-basis tag every per-item output in a consumer's result must carry - attach this
 *  alongside the item, never compute a separate bespoke confidence/risk label from the same inputs. */
export type EvidenceBasis = 'verified' | 'exploratory';

export function evidenceBasisForNode(evidence: GraphEvidence, nodeId: string): EvidenceBasis {
  return hasAnyVerifiedEvidence(evidence, nodeId) ? 'verified' : 'exploratory';
}

export function evidenceBasisForPair(evidence: GraphEvidence, nodeIdA: string, nodeIdB: string): EvidenceBasis {
  return hasVerifiedRelationship(evidence, nodeIdA, nodeIdB) ? 'verified' : 'exploratory';
}

/**
 * The confirmed-reading claim gate every consumer must use before reporting a finding tied to specific node(s) as
 * an established organizational fact. Returns the supplied value only when verified evidence backs it; otherwise
 * an explicit, reasoned 'unavailable' - never a silent fall-back to the exploratory graph presented as confirmed.
 */
export type ConfirmedOrUnavailable<T> =
  | { status: 'confirmed'; value: T; verifiedBy: VerifiedDependencyRecord[] }
  | { status: 'unavailable'; reason: 'no_verified_evidence_recorded' | 'no_verified_evidence_for_node' | 'requires_reverification' };

function staleKeysOf(evidence: GraphEvidence): Set<string> {
  return new Set(
    evidence.staleVerifiedRelationships.flatMap(({ record }) => [canonicalNodeIdentityKey(record.dependentNodeId), canonicalNodeIdentityKey(record.dependsOnNodeId)]),
  );
}

export function confirmedForNode<T>(evidence: GraphEvidence, nodeId: string, value: T): ConfirmedOrUnavailable<T> {
  if (evidence.verifiedRelationships.length === 0 && evidence.staleVerifiedRelationships.length === 0) {
    return { status: 'unavailable', reason: 'no_verified_evidence_recorded' };
  }
  const key = canonicalNodeIdentityKey(nodeId);
  if (!hasAnyVerifiedEvidence(evidence, nodeId)) {
    if (staleKeysOf(evidence).has(key)) return { status: 'unavailable', reason: 'requires_reverification' };
    return { status: 'unavailable', reason: 'no_verified_evidence_for_node' };
  }
  const verifiedBy = evidence.verifiedRelationships.filter(
    (record) => canonicalNodeIdentityKey(record.dependentNodeId) === key || canonicalNodeIdentityKey(record.dependsOnNodeId) === key,
  );
  return { status: 'confirmed', value, verifiedBy };
}
