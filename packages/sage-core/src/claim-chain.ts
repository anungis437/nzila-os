// ─── @nzila/sage-core — claim → evidence → source → date → authority ─────────
// Additive, migration-free register entries for institutional continuity Q&A
// (e.g. Leadership Transition / Institutional Memory). Maps onto existing
// evidence item + source ids. Narrative lives here or in CLEAR registers — not
// as prospect-specific DB columns.
//
// DO_NOT_REGRESS: a claim is eligible only when its evidence item AND its exact
// source id and authorization level match the authorized context. A caller
// may not re-label an allowed item with a different source or lower sensitivity.
//
// Note: matching an authorized source reference is NOT institutional attestation
// of the actor, the claim or its date. Those require a separate verified
// institutional source and mandate model.

import type { SageAuthorizationLevel } from './types'
import type { SageAuthorizedEvidenceContextPayload } from './synthesis-context'

/**
 * One continuity claim linked to an evidence item. Generic — no prospect fields.
 * Example first-case fixtures may populate these for «why B / what changed /
 * what unresolved» without forking SAGE schema.
 */
export type SageClaimChainEntry = {
  claimId: string
  /** Short claim statement (e.g. why option B was preferred). */
  claim: string
  evidenceItemId: string
  sourceId: string
  /** When the underlying event/decision occurred (ISO-8601 date or datetime). */
  occurredAt: string
  /** Claimed human authority actor id; NOT independently verified attestation. */
  authorityActorId: string
  /** Optional institutional role label (not a SageApplicationRole enum). */
  authorityRoleLabel?: string
  whatChanged?: string
  whatUnresolved?: string
  authorizationLevel: SageAuthorizationLevel
  workspaceId: string
  orgId: string
}

export type SageAuthorizedClaimChainAnswer = {
  /** A matching repository source is not verification of client-supplied narrative,
   * occurrence date or authority actor. This marker MUST accompany the claim. */
  attestationStatus: 'unverified_annotation'
  claimId: string
  claim: string
  evidenceItemId: string
  sourceId: string
  occurredAt: string
  authorityActorId: string
  authorityRoleLabel?: string
  whatChanged?: string
  whatUnresolved?: string
  authorizationLevel: SageAuthorizationLevel
  provenance: {
    evidenceItemId: string
    sourceId: string
    occurredAt: string
    authorityActorId: string
  }
}

/**
 * Filter a claim register to entries whose evidence survived the authorized
 * context payload. Cross-workspace/org entries are dropped even if somehow present.
 */
export function filterClaimRegisterToAuthorizedContext(
  payload: SageAuthorizedEvidenceContextPayload,
  register: readonly SageClaimChainEntry[],
): SageAuthorizedClaimChainAnswer[] {
  // A visible item id alone does not authorize arbitrary source or classification
  // labels. Deny ambiguous duplicate IDs even if they resolve to the same source;
  // the repository must provide a unique authoritative evidence/source binding.
  const allowed = new Map<
    string,
    { sourceId: string; authorizationLevel: SageAuthorizationLevel } | null
  >()
  for (const evidence of payload.evidence) {
    if (allowed.has(evidence.evidenceItemId)) {
      allowed.set(evidence.evidenceItemId, null)
    } else {
      allowed.set(evidence.evidenceItemId, {
        sourceId: evidence.sourceId,
        authorizationLevel: evidence.authorizationLevel,
      })
    }
  }
  const answers: SageAuthorizedClaimChainAnswer[] = []
  for (const entry of register) {
    if (entry.workspaceId !== payload.workspaceId || entry.orgId !== payload.orgId) continue
    const bound = allowed.get(entry.evidenceItemId)
    if (!bound) continue
    if (entry.sourceId !== bound.sourceId) continue
    if (entry.authorizationLevel !== bound.authorizationLevel) continue
    answers.push({
      attestationStatus: 'unverified_annotation',
      claimId: entry.claimId,
      claim: entry.claim,
      evidenceItemId: entry.evidenceItemId,
      sourceId: entry.sourceId,
      occurredAt: entry.occurredAt,
      authorityActorId: entry.authorityActorId,
      ...(entry.authorityRoleLabel !== undefined
        ? { authorityRoleLabel: entry.authorityRoleLabel }
        : {}),
      ...(entry.whatChanged !== undefined ? { whatChanged: entry.whatChanged } : {}),
      ...(entry.whatUnresolved !== undefined ? { whatUnresolved: entry.whatUnresolved } : {}),
      authorizationLevel: entry.authorizationLevel,
      provenance: {
        evidenceItemId: entry.evidenceItemId,
        sourceId: entry.sourceId,
        occurredAt: entry.occurredAt,
        authorityActorId: entry.authorityActorId,
      },
    })
  }
  return answers
}

/** Build a deterministic institutional Q&A JSON document from authorized claims only. */
export function buildInstitutionalQaDocument(input: {
  payload: SageAuthorizedEvidenceContextPayload
  claims: readonly SageAuthorizedClaimChainAnswer[]
  question?: string
}): {
  authorizedContextOnly: true
  question?: string
  principalActorId: string
  workspaceId: string
  orgId: string
  evidence: SageAuthorizedEvidenceContextPayload['evidence']
  claims: readonly SageAuthorizedClaimChainAnswer[]
  excludedCandidateCount: number
} {
  return {
    authorizedContextOnly: true,
    ...(input.question !== undefined ? { question: input.question } : {}),
    principalActorId: input.payload.principalActorId,
    workspaceId: input.payload.workspaceId,
    orgId: input.payload.orgId,
    evidence: input.payload.evidence,
    claims: input.claims,
    excludedCandidateCount: input.payload.excludedCandidateCount,
  }
}
