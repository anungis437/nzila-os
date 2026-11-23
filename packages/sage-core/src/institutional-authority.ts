// ─── @nzila/sage-core — institutional mandate authorization ────────────────
//
// Pure, server-only admission decision for future consequential SAGE actions.
// This is an additional institutional authority gate, NOT a replacement for
// authenticated session, workspace membership, SAGE role/RLS, evidence grants,
// conflict checks, or the institution's signed source instruments.
//
// A role label or platform-admin status does not authorize an institutional
// action. Every admission is bound to one selected, verified, currently effective
// and explicitly accepted mandate for the exact institution/resource/action.
//
// Inputs are VERIFIED FACTS supplied by a trusted server-side loader. In
// particular, verificationStatus MUST be established by a controlled source
// adapter from an institutionally attested record, never a browser form.
// Do not expose this evaluator as an API accepting caller-supplied mandates.
//
// DESIGN STAGE ONLY: not wired into persistence or deployed routes. Until the
// source adapter and protected runtime gates exist, no product may claim that
// institutional-mandate enforcement is operational.

export const SAGE_INSTITUTIONAL_ACTIONS = [
  'question.adopt',
  'decision.ratify',
  'intervention.authorize',
  'resource.commit',
  'records.transfer',
  'export.release',
  'succession.delegate',
] as const

export type SageInstitutionalAction = (typeof SAGE_INSTITUTIONAL_ACTIONS)[number]

export type SageMandateStatus = 'active' | 'suspended' | 'revoked'

/** The authenticated actor context and source facts verified by the server. */
export interface SageInstitutionalAuthorityRequest {
  orgId: string
  actorId: string
  actorKind: 'human' | 'service' | 'system'
  currentPositionId: string
  resourceId: string
  action: SageInstitutionalAction
  /** Exact institutional mandate explicitly selected for this act. */
  mandateId: string
  /** ISO-8601 UTC evaluation instant from the trusted server clock. */
  evaluatedAt: string
  authenticated: boolean
  activeWorkspaceMembership: boolean
  applicationPermissionGranted: boolean
  /** True when the actor is adverse, recused, or prohibited from this action. */
  conflictOrRecusal: boolean
}

/** Authoritative mandate facts. Must come from a verified repository adapter. */
export interface SageVerifiedInstitutionalMandate {
  id: string
  orgId: string
  principalActorId: string
  positionId: string
  resourceId: string
  permittedActions: readonly SageInstitutionalAction[]
  instrumentRef: string
  instrumentVersion: string
  issuerActorId: string
  /** Set by trusted institutional verification, never by the request body. */
  verificationStatus: 'verified' | 'unverified' | 'rejected'
  attestedAt: string
  /** The mandate holder's recorded acceptance of this mandate. */
  acceptedAt: string | null
  effectiveAt: string
  expiresAt: string
  revokedAt: string | null
  status: SageMandateStatus
}

export type SageMandateDecisionReason =
  | 'ADMITTED'
  | 'INVALID_EVALUATION_TIME'
  | 'UNAUTHENTICATED'
  | 'NON_HUMAN'
  | 'NO_ACTIVE_MEMBERSHIP'
  | 'APPLICATION_PERMISSION_DENIED'
  | 'CONFLICT_OR_RECUSAL'
  | 'MANDATE_MISSING_OR_AMBIGUOUS'
  | 'MANDATE_SCOPE_MISMATCH'
  | 'UNVERIFIED_INSTRUMENT'
  | 'MANDATE_INACTIVE'
  | 'MANDATE_NOT_EFFECTIVE'

export type SageInstitutionalMandateDecision =
  | { allowed: true; reason: 'ADMITTED'; mandateId: string; instrumentRef: string; instrumentVersion: string }
  | { allowed: false; reason: Exclude<SageMandateDecisionReason, 'ADMITTED'> }

function utcInstant(value: string | null): number | null {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/.test(value)) {
    return null
  }
  const ms = Date.parse(value)
  return Number.isFinite(ms) ? ms : null
}

function deny(
  reason: Exclude<SageMandateDecisionReason, 'ADMITTED'>,
): SageInstitutionalMandateDecision {
  return { allowed: false, reason }
}

/**
 * Fail-closed consequential-action admission.
 *
 * This evaluator does not confer or mint any authority. The selected mandate
 * must exist as exactly one authoritative row, and the caller's independently
 * checked authentication, membership, app permission, role/position and
 * institutional conflict state must also pass.
 *
 * A future source adapter must load mandates inside the same serialized
 * authorization/decision transaction to prevent post-check revocation races.
 */
export function evaluateSageInstitutionalMandate(
  request: SageInstitutionalAuthorityRequest,
  mandates: readonly SageVerifiedInstitutionalMandate[],
): SageInstitutionalMandateDecision {
  const now = utcInstant(request.evaluatedAt)
  if (now === null) return deny('INVALID_EVALUATION_TIME')
  if (!request.authenticated || !request.actorId.trim()) return deny('UNAUTHENTICATED')
  if (request.actorKind !== 'human') return deny('NON_HUMAN')
  if (!request.activeWorkspaceMembership) return deny('NO_ACTIVE_MEMBERSHIP')
  if (!request.applicationPermissionGranted) return deny('APPLICATION_PERMISSION_DENIED')
  if (request.conflictOrRecusal) return deny('CONFLICT_OR_RECUSAL')

  const selected = mandates.filter((mandate) => mandate.id === request.mandateId)
  if (selected.length !== 1 || !request.mandateId.trim()) {
    return deny('MANDATE_MISSING_OR_AMBIGUOUS')
  }
  const mandate = selected[0]!

  if (
    !request.orgId.trim() ||
    !request.currentPositionId.trim() ||
    !request.resourceId.trim() ||
    mandate.orgId !== request.orgId ||
    mandate.principalActorId !== request.actorId ||
    mandate.positionId !== request.currentPositionId ||
    mandate.resourceId !== request.resourceId ||
    !mandate.permittedActions.includes(request.action)
  ) {
    return deny('MANDATE_SCOPE_MISMATCH')
  }

  if (
    mandate.verificationStatus !== 'verified' ||
    !mandate.instrumentRef.trim() ||
    !mandate.instrumentVersion.trim() ||
    !mandate.issuerActorId.trim()
  ) {
    return deny('UNVERIFIED_INSTRUMENT')
  }

  if (mandate.status !== 'active' || mandate.revokedAt !== null) {
    return deny('MANDATE_INACTIVE')
  }

  const effective = utcInstant(mandate.effectiveAt)
  const expires = utcInstant(mandate.expiresAt)
  const attested = utcInstant(mandate.attestedAt)
  const accepted = utcInstant(mandate.acceptedAt)

  // All four dates must be well-formed, and both issuer attestation and holder
  // acceptance must predate the proposed action. Expiry is exclusive.
  if (
    effective === null ||
    expires === null ||
    attested === null ||
    accepted === null ||
    now < effective ||
    now >= expires ||
    attested > now ||
    accepted > now ||
    accepted < effective ||
    expires <= effective
  ) {
    return deny('MANDATE_NOT_EFFECTIVE')
  }

  return {
    allowed: true,
    reason: 'ADMITTED',
    mandateId: mandate.id,
    instrumentRef: mandate.instrumentRef,
    instrumentVersion: mandate.instrumentVersion,
  }
}
