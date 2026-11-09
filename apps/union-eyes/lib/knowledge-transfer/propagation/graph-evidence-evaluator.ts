/**
 * Graph Evidence Evaluator — the ONE currentness computation for verified dependency evidence. Imported by
 * graph-evidence-service.ts (every record, for every consumer) and verified-dependency-store.ts (the single-pair
 * lookup, submission and review), so there is no second definition of "current" anywhere.
 *
 * Family 1 final correction (DEF-0B7-COGB-PROPAGATION-DEPENDENCIES-AND-SENSITIVITY-INFERRED-FROM-TAG-CO-OCCURRENCE).
 */
import { buildDependencyPropagationMap } from './dependency-propagator';
import { legacyReferenceIsUnambiguous, resolveNodeReference, type AliasLookup, type NodeResolution } from './graph-identity';
import { computeSourceFingerprint } from './graph-fingerprint';
import { listActiveNodeAliases } from './node-alias-store';
import { loadEvidenceDocumentIntegrity, type EvidenceDocumentState } from './evidence-document-reference';
import type { PropagationMap, DependencyNode } from './propagation-models';
import type { CurrentVerifiedDependency, EvidenceStaleReason, EvidenceTier, VerifiedDependencyRecord } from './verified-dependency-models';

/** Everything currentness depends on, loaded once so every record and every claim is judged against the SAME
 *  snapshot of the graph, the aliases and the evidence documents. */
export interface GraphEvidenceContext {
  currentNodeIds: string[];
  nodesById: Map<string, DependencyNode>;
  aliases: AliasLookup[];
  /** Keyed by evidence document id. Absent key = not looked up (no record references it). */
  documents: Map<string, EvidenceDocumentState>;
}

export type RecordCurrentness =
  | { current: true; dependency: CurrentVerifiedDependency }
  | { current: false; staleReasons: EvidenceStaleReason[] };

function referenceReason(resolution: NodeResolution): EvidenceStaleReason | null {
  if (resolution.status === 'ambiguous') return 'node_reference_ambiguous';
  if (resolution.status === 'not_found') return 'node_no_longer_current';
  return null;
}

/** The evidence tier a record would carry if current, or the reason its evidence cannot back a confirmation. */
function evidenceTierFor(
  record: VerifiedDependencyRecord,
  documents: Map<string, EvidenceDocumentState>,
): { tier: Exclude<EvidenceTier, 'unverified_external_citation'> } | { stale: EvidenceStaleReason } {
  if (record.evidenceReferenceType === 'document') {
    const doc = record.evidenceDocumentId ? documents.get(record.evidenceDocumentId) : undefined;
    if (!doc || !doc.active) return { stale: 'evidence_reference_no_longer_resolves' };
    // Bound to exact content at verification. A new version, a changed hash, or a record from before the binding
    // existed (null) means the reviewer never attested THIS content.
    if (record.evidenceDocumentIntegrity === null || doc.integrity === null || doc.integrity !== record.evidenceDocumentIntegrity) {
      return { stale: 'evidence_document_changed' };
    }
    return { tier: 'system_resolved_document' };
  }
  const attested =
    typeof record.externalAttestation === 'string' &&
    record.externalAttestation.trim().length > 0 &&
    record.externalAttestedBy !== null &&
    record.externalAttestedAt !== null &&
    record.externalAttestedBy !== record.submittedBy;
  return attested ? { tier: 'human_attested_external' } : { stale: 'external_evidence_not_attested' };
}

/**
 * Whether one verified record is CURRENT, judged against one context. Used by loadGraphEvidence for every record and
 * by lookupVerifiedDependency for a single pair - there is no other currentness computation. A record is current only
 * when ALL of these hold:
 *  - status is 'verified' (revoked/rejected/pending never are);
 *  - both node references resolve to exactly one current node (not missing, not ambiguous);
 *  - the fingerprint recorded at verification matches the resolved nodes' current identity and classification,
 *    under the identity-key version it was recorded with. A version-1 fingerprint is trusted only when the legacy key
 *    of each resolved node names exactly one current node (otherwise the old, collision-prone key cannot show which
 *    concept was attested);
 *  - its evidence is current: a document still active with the exact content verified, or an external citation
 *    attested by a reviewer distinct from the submitter.
 */
export function evaluateRecordCurrentness(record: VerifiedDependencyRecord, context: GraphEvidenceContext): RecordCurrentness {
  if (record.status !== 'verified') return { current: false, staleReasons: [] };
  const reasons: EvidenceStaleReason[] = [];

  const dependent = resolveNodeReference(context.aliases, context.currentNodeIds, record.dependentNodeId);
  const dependsOn = resolveNodeReference(context.aliases, context.currentNodeIds, record.dependsOnNodeId);
  for (const resolution of [dependent, dependsOn]) {
    const reason = referenceReason(resolution);
    if (reason && !reasons.includes(reason)) reasons.push(reason);
  }

  if (dependent.status === 'resolved' && dependsOn.status === 'resolved') {
    if (dependent.nodeId === dependsOn.nodeId) {
      // Two references that now resolve to ONE node (a merge via alias) no longer describe a dependency at all.
      reasons.push('source_fingerprint_mismatch');
    } else {
      const dependentNode = context.nodesById.get(dependent.nodeId)!;
      const dependsOnNode = context.nodesById.get(dependsOn.nodeId)!;
      if (
        record.identityKeyVersion === 1 &&
        !(legacyReferenceIsUnambiguous(context.currentNodeIds, dependent.nodeId) && legacyReferenceIsUnambiguous(context.currentNodeIds, dependsOn.nodeId))
      ) {
        reasons.push('legacy_fingerprint_ambiguous');
      } else {
        const expected = computeSourceFingerprint(dependentNode, dependsOnNode, record.identityKeyVersion);
        if (record.sourceFingerprint === null || record.sourceFingerprint !== expected) reasons.push('source_fingerprint_mismatch');
      }
    }
  }

  const evidence = evidenceTierFor(record, context.documents);
  if ('stale' in evidence) reasons.push(evidence.stale);

  if (reasons.length > 0 || dependent.status !== 'resolved' || dependsOn.status !== 'resolved' || 'stale' in evidence) {
    return { current: false, staleReasons: reasons };
  }
  return {
    current: true,
    dependency: { record, dependentNodeId: dependent.nodeId, dependsOnNodeId: dependsOn.nodeId, evidenceTier: evidence.tier },
  };
}

/** Builds the evaluation context. The propagation map may be supplied when the caller has already built it. */
export async function loadGraphEvidenceContext(
  orgId: string,
  records: readonly VerifiedDependencyRecord[],
  exploratory?: PropagationMap,
): Promise<{ context: GraphEvidenceContext; exploratory: PropagationMap }> {
  const documentIds = [...new Set(records.flatMap((r) => (r.evidenceReferenceType === 'document' && r.evidenceDocumentId ? [r.evidenceDocumentId] : [])))];
  const [map, aliases, documents] = await Promise.all([
    exploratory ? Promise.resolve(exploratory) : buildDependencyPropagationMap(orgId),
    listActiveNodeAliases(orgId),
    loadEvidenceDocumentIntegrity(orgId, documentIds),
  ]);
  return {
    exploratory: map,
    context: {
      currentNodeIds: map.nodes.map((node) => node.id),
      nodesById: new Map(map.nodes.map((node) => [node.id, node])),
      aliases: aliases.map((alias) => ({ aliasLabel: alias.aliasLabel, canonicalConceptLabel: alias.canonicalConceptLabel })),
      documents,
    },
  };
}
