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

/** 'document' resolves evidenceDocumentId against the real documents table at submission (existence + the
 *  submitter's authorization) and at every read (existence only - see graph-evidence-service.ts). 'external_citation'
 *  is free text the system cannot resolve (e.g. a collective agreement clause number) - honestly typed as
 *  unverifiable-by-the-system rather than carrying the same evidentiary weight as a resolved document. */
export type EvidenceReferenceType = 'document' | 'external_citation';

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
  | { state: 'verified'; record: VerifiedDependencyRecord }
  | { state: 'unavailable'; reason: 'no_verified_evidence_recorded' | 'all_evidence_revoked_or_rejected' | 'requires_reverification' };

/** Why a nominally-'verified' row is excluded from the currently-confirmable set at read time. */
export type EvidenceStaleReason = 'node_no_longer_current' | 'source_fingerprint_mismatch' | 'evidence_reference_no_longer_resolves';

export interface StaleVerifiedDependency {
  record: VerifiedDependencyRecord;
  staleReasons: EvidenceStaleReason[];
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
