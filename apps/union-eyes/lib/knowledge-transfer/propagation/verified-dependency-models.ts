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
}

export type VerifiedDependencyReviewDecision = 'verified' | 'rejected';

/**
 * The result a consumer must check before reporting a dependency, risk, succession or compliance finding as
 * confirmed. 'unavailable' means no verified evidence exists for the pair right now — callers must report that
 * plainly, never silently substitute the exploratory (inferred) graph for a confirmed claim. The two unavailable
 * reasons are distinguished because they carry different meaning: evidence was never submitted, versus evidence
 * was submitted and is no longer in force (rejected on review, or revoked after having been verified).
 */
export type VerifiedDependencyLookup =
  | { state: 'verified'; record: VerifiedDependencyRecord }
  | { state: 'unavailable'; reason: 'no_verified_evidence_recorded' | 'all_evidence_revoked_or_rejected' };
