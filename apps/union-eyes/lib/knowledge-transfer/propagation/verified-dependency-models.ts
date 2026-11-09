/**
 * Verified Dependency Evidence Models
 *
 * The exploratory propagation map (lib/knowledge-transfer/propagation/propagation-models.ts) infers dependency
 * direction, sole-expert ownership and recovery time from exit-interview tag co-occurrence — a discovery signal,
 * never a verified operational fact (see PropagationMap.evidenceState and PROPAGATION_METHODOLOGY_NOTE). This
 * module is the separate, verified graph: a directional dependency between two propagation-map node ids
 * (DependencyNode.id) is "verified" only once a reviewer distinct from the submitter attributes it to a named
 * process/system and a named responsible organizational authority, with an evidence reference, via
 * ue_verified_dependency_evidence (platform migration 0085, RLS scoped 0059).
 *
 * Confirmed organizational risk, succession, simulation and compliance findings must check this graph, not the
 * exploratory one, before reporting a dependency as established — see verifiedDependencyRiskAssessment in
 * decision-engine.ts
 * (DEF-0B7-COGB-PROPAGATION-DEPENDENCIES-AND-SENSITIVITY-INFERRED-FROM-TAG-CO-OCCURRENCE).
 */

export type VerifiedDependencyStatus = 'pending_review' | 'verified' | 'rejected' | 'revoked';

/** 'document' names a stored document, resolved and content-bound at submission (existence, organization, active
 *  status, the submitter's authorization, and the exact version/content hash) and re-checked at every read (still
 *  active AND still the same content - see evidence-document-reference.ts). 'external_citation' is text naming
 *  evidence outside this system (e.g. a collective agreement clause) that the system cannot resolve. */
export type EvidenceReferenceType = 'document' | 'external_citation';

/**
 * How strongly a CURRENT verified record's evidence is established, carried on every confirmed finding so a reader
 * never mistakes an attested external source for a system-resolved record:
 *  - system_resolved_document: a stored document the system resolved, bound to its exact content at verification and
 *    unchanged since.
 *  - human_attested_external: an external citation the reviewer (a person distinct from the submitter) attested, in
 *    writing and under their own name, to having checked against the source. Accountable, but not machine-verified.
 *  - unverified_external_citation: an external citation with no such attestation. Never backs a confirmed finding.
 */
export type EvidenceTier = 'system_resolved_document' | 'human_attested_external' | 'unverified_external_citation';

export interface VerifiedDependencyRecord {
  id: string;
  organizationId: string;
  /** DependencyNode.id (propagation-models.ts) of the node that depends on the other */
  dependentNodeId: string;
  /** DependencyNode.id of the node being depended upon */
  dependsOnNodeId: string;
  processOrSystem: string;
  responsibleAuthority: string;
  evidenceReference: string;
  evidenceReferenceType: EvidenceReferenceType;
  /** Set only when evidenceReferenceType is 'document'. */
  evidenceDocumentId: string | null;
  /** The referenced document's exact content identity ("version:<n>:<contentHash>" or "sha256:<hash>"), captured at
   *  submission and refreshed at verification. Null for an external citation, or a document row from before this
   *  column existed (treated as changed: fail closed). */
  evidenceDocumentIntegrity: string | null;
  /** For an external citation: the reviewer's written statement of how they checked the cited source. Present only
   *  together with externalAttestedBy/At, and only when the reviewer is not the submitter. */
  externalAttestation: string | null;
  externalAttestedBy: string | null;
  externalAttestedAt: string | null;
  /** The identity-key version (graph-identity.ts) sourceFingerprint was computed under. 1 for rows from before
   *  version 2 existed. */
  identityKeyVersion: 1 | 2;
  /** Deterministic hash (graph-fingerprint.ts) of the dependent/dependsOn nodes' canonical label, category and
   *  nodeType, captured at submission and refreshed at every verification. Null on a row from before this column
   *  existed - treated identically to a mismatch (fail closed, never silently trusted) by graph-evidence-service.ts. */
  sourceFingerprint: string | null;
  status: VerifiedDependencyStatus;
  submittedBy: string;
  reviewedBy: string | null;
  reviewedAt: string | null;
  reviewNotes: string | null;
  createdAt: string;
  updatedAt: string;
}

/** A verification decision on an external citation must carry the reviewer's attestation (see EvidenceTier). */
export interface ExternalAttestationInput {
  attestation: string;
}

export interface SubmitVerifiedDependencyInput {
  dependentNodeId: string;
  dependsOnNodeId: string;
  processOrSystem: string;
  responsibleAuthority: string;
  evidenceReference: string;
  evidenceReferenceType: EvidenceReferenceType;
  /** Required when evidenceReferenceType is 'document'; rejected (must be absent) otherwise. */
  evidenceDocumentId?: string;
}

export type VerifiedDependencyReviewDecision = 'verified' | 'rejected';

/**
 * The result a consumer must check before reporting a dependency, risk, succession or compliance finding as
 * confirmed. 'unavailable' means no verified evidence exists for the pair right now — callers must report that
 * plainly, never silently substitute the exploratory (inferred) graph for a confirmed claim. The unavailable
 * reasons are distinguished because they carry different meaning: evidence was never submitted, versus evidence
 * was submitted and is no longer in force (rejected on review, revoked after having been verified), versus
 * evidence was once verified but is no longer CURRENT (the node drifted, or its evidence reference no longer
 * resolves) and requires re-verification - the row's full review history is preserved, it is simply not treated
 * as confirmable right now.
 */
export type VerifiedDependencyLookup =
  | { state: 'verified'; record: VerifiedDependencyRecord; evidenceTier: Exclude<EvidenceTier, 'unverified_external_citation'> }
  | {
      state: 'unavailable';
      reason: 'no_verified_evidence_recorded' | 'all_evidence_revoked_or_rejected' | 'requires_reverification' | 'node_reference_ambiguous' | 'node_not_current';
      staleReasons?: EvidenceStaleReason[];
    };

/** Why a nominally-'verified' row is excluded from the currently-confirmable set at read time. */
export type EvidenceStaleReason =
  | 'node_no_longer_current'
  | 'node_reference_ambiguous'
  | 'source_fingerprint_mismatch'
  | 'legacy_fingerprint_ambiguous'
  | 'evidence_reference_no_longer_resolves'
  | 'evidence_document_changed'
  | 'external_evidence_not_attested';

export interface StaleVerifiedDependency {
  record: VerifiedDependencyRecord;
  staleReasons: EvidenceStaleReason[];
}

/** A verified record that is CURRENT right now, with its two node references resolved to current node ids (the
 *  identity every consumer compares) and its evidence tier. Direction is preserved: dependentNodeId depends on
 *  dependsOnNodeId, never the reverse. */
export interface CurrentVerifiedDependency {
  record: VerifiedDependencyRecord;
  dependentNodeId: string;
  dependsOnNodeId: string;
  evidenceTier: Exclude<EvidenceTier, 'unverified_external_citation'>;
}

/** A durable, explicitly-authorized alias from a label to the CURRENT canonical label of the same real-world
 *  organizational concept - how a semantic rename or a label collision is migrated, as distinct from
 *  graph-identity.ts's canonicalNodeIdentityKey, which only tolerates cosmetic drift (case/spacing/punctuation)
 *  and deliberately never guesses across a semantic change. Never inferred; always an explicit action by an
 *  authorized reviewer, with a reason, and never deleted - a later re-aliasing supersedes (superseded_by/
 *  supersededAt) rather than removing the prior entry, preserving the full history of identity decisions. */
export interface NodeAlias {
  id: string;
  organizationId: string;
  aliasLabel: string;
  canonicalConceptLabel: string;
  reason: string;
  createdBy: string;
  createdAt: string;
  supersededBy: string | null;
  supersededAt: string | null;
}

export interface CreateNodeAliasInput {
  aliasLabel: string;
  canonicalConceptLabel: string;
  reason: string;
}
