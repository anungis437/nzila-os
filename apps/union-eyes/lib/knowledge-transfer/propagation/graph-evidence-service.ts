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
import { canonicalNodeIdentityKey } from './graph-identity';
import type { PropagationMap } from './propagation-models';
import type { VerifiedDependencyRecord } from './verified-dependency-models';

/** Every figure in the exploratory half of this envelope is inferred, never measured - see PropagationMap.methodologyNote. */
export const GRAPH_EVIDENCE_METHODOLOGY_NOTE =
  'This envelope carries two distinct kinds of fact: an exploratory graph inferred from exit-interview tag ' +
  'co-occurrence (never a confirmed operational fact, however the figures are labelled), and a separate set of ' +
  'currently-verified relationships, each attributed by a reviewer distinct from the submitter to a named ' +
  'process/system and responsible authority. A consumer reporting a confirmed risk, dependency, succession or ' +
  'compliance conclusion must use the verified half only, and must say so explicitly when no verified evidence ' +
  'exists rather than silently substituting the exploratory graph.';

/** Loaded together so every consumer checks the SAME evidence at the SAME moment. */
export interface GraphEvidence {
  organizationId: string;
  generatedAt: string;
  methodologyNote: string;
  /** The inferred graph. Still fully functional for discovery/scenario use - never suppressed, always tagged. */
  exploratory: PropagationMap;
  /** Currently-verified relationships only (status === 'verified'). Revoked, rejected and pending rows are excluded. */
  verifiedRelationships: VerifiedDependencyRecord[];
  /** Canonical identity keys (see graph-identity.ts) of every node appearing in any currently-verified relationship. */
  verifiedNodeKeys: Set<string>;
}

export async function loadGraphEvidence(orgId: string): Promise<GraphEvidence> {
  const [exploratory, verifiedRelationships] = await Promise.all([
    buildDependencyPropagationMap(orgId),
    listVerifiedDependencies(orgId, 'verified'),
  ]);
  const verifiedNodeKeys = new Set(
    verifiedRelationships.flatMap((record) => [canonicalNodeIdentityKey(record.dependentNodeId), canonicalNodeIdentityKey(record.dependsOnNodeId)]),
  );
  return {
    organizationId: orgId,
    generatedAt: new Date().toISOString(),
    methodologyNote: GRAPH_EVIDENCE_METHODOLOGY_NOTE,
    exploratory,
    verifiedRelationships,
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
  | { status: 'unavailable'; reason: 'no_verified_evidence_recorded' | 'no_verified_evidence_for_node' };

export function confirmedForNode<T>(evidence: GraphEvidence, nodeId: string, value: T): ConfirmedOrUnavailable<T> {
  if (evidence.verifiedRelationships.length === 0) return { status: 'unavailable', reason: 'no_verified_evidence_recorded' };
  if (!hasAnyVerifiedEvidence(evidence, nodeId)) return { status: 'unavailable', reason: 'no_verified_evidence_for_node' };
  const key = canonicalNodeIdentityKey(nodeId);
  const verifiedBy = evidence.verifiedRelationships.filter(
    (record) => canonicalNodeIdentityKey(record.dependentNodeId) === key || canonicalNodeIdentityKey(record.dependsOnNodeId) === key,
  );
  return { status: 'confirmed', value, verifiedBy };
}
