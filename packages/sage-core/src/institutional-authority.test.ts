import { describe, expect, it } from 'vitest'
import {
  evaluateSageInstitutionalMandate,
  type SageInstitutionalAuthorityRequest,
  type SageVerifiedInstitutionalMandate,
} from './institutional-authority'

const at = '2026-11-23T12:00:00.000Z'

function request(
  changes: Partial<SageInstitutionalAuthorityRequest> = {},
): SageInstitutionalAuthorityRequest {
  return {
    orgId: 'institution-alder',
    actorId: 'sponsor-1',
    actorKind: 'human',
    currentPositionId: 'director-assurance',
    resourceId: 'engagement-17',
    action: 'intervention.authorize',
    mandateId: 'mandate-7',
    evaluatedAt: at,
    authenticated: true,
    activeWorkspaceMembership: true,
    applicationPermissionGranted: true,
    conflictOrRecusal: false,
    ...changes,
  }
}

function mandate(
  changes: Partial<SageVerifiedInstitutionalMandate> = {},
): SageVerifiedInstitutionalMandate {
  return {
    id: 'mandate-7',
    orgId: 'institution-alder',
    principalActorId: 'sponsor-1',
    positionId: 'director-assurance',
    resourceId: 'engagement-17',
    permittedActions: ['intervention.authorize'],
    instrumentRef: 'institutional-register/instrument/7',
    instrumentVersion: 'v3',
    issuerActorId: 'institution-chair',
    verificationStatus: 'verified',
    attestedAt: '2026-11-22T12:00:00.000Z',
    acceptedAt: '2026-11-22T12:30:00.000Z',
    effectiveAt: '2026-11-23T00:00:00.000Z',
    expiresAt: '2026-12-23T00:00:00.000Z',
    revokedAt: null,
    status: 'active',
    ...changes,
  }
}

function reason(
  input: SageInstitutionalAuthorityRequest,
  candidates: readonly SageVerifiedInstitutionalMandate[] = [mandate()],
) {
  return evaluateSageInstitutionalMandate(input, candidates).reason
}

describe('SAGE institutional mandate admission: separate identity, app permission, institution', () => {
  it('admits only an exact verified active mandate, returning its versioned source', () => {
    expect(evaluateSageInstitutionalMandate(request(), [mandate()])).toEqual({
      allowed: true,
      reason: 'ADMITTED',
      mandateId: 'mandate-7',
      instrumentRef: 'institutional-register/instrument/7',
      instrumentVersion: 'v3',
    })
  })

  it('does not treat authenticated platform or tenant administration as institutional authority', () => {
    expect(reason(request(), [])).toBe('MANDATE_MISSING_OR_AMBIGUOUS')
    expect(reason(request({ mandateId: '' }))).toBe('MANDATE_MISSING_OR_AMBIGUOUS')
  })

  it('refuses a missing session, including a human role label without authentication', () => {
    expect(reason(request({ authenticated: false }))).toBe('UNAUTHENTICATED')
    expect(reason(request({ actorId: '' }))).toBe('UNAUTHENTICATED')
  })

  it('refuses machine and service actors even with a purported mandate', () => {
    for (const actorKind of ['system', 'service'] as const) {
      expect(reason(request({ actorKind }))).toBe('NON_HUMAN')
    }
  })

  it('requires live membership and application permission as independent floors', () => {
    expect(reason(request({ activeWorkspaceMembership: false }))).toBe('NO_ACTIVE_MEMBERSHIP')
    expect(reason(request({ applicationPermissionGranted: false }))).toBe('APPLICATION_PERMISSION_DENIED')
  })

  it('enforces conflict and recusal against all mandate sources', () => {
    expect(reason(request({ conflictOrRecusal: true }))).toBe('CONFLICT_OR_RECUSAL')
  })

  it('refuses a mandate selected by a different actor, position, tenant or resource', () => {
    expect(reason(request({ actorId: 'other-sponsor' }))).toBe('MANDATE_SCOPE_MISMATCH')
    expect(reason(request({ currentPositionId: 'former-office' }))).toBe('MANDATE_SCOPE_MISMATCH')
    expect(reason(request({ orgId: 'other-institution' }))).toBe('MANDATE_SCOPE_MISMATCH')
    expect(reason(request({ resourceId: 'another-engagement' }))).toBe('MANDATE_SCOPE_MISMATCH')
    expect(reason(request({ action: 'decision.ratify' }))).toBe('MANDATE_SCOPE_MISMATCH')
  })

  it('refuses an ambiguous duplicate mandate rather than choosing an arbitrary row', () => {
    expect(reason(request(), [mandate(), mandate({ instrumentVersion: 'v2' })])).toBe(
      'MANDATE_MISSING_OR_AMBIGUOUS',
    )
  })

  it('does not accept unverified, rejected, unattested or unidentified instruments', () => {
    expect(reason(request(), [mandate({ verificationStatus: 'unverified' })])).toBe(
      'UNVERIFIED_INSTRUMENT',
    )
    expect(reason(request(), [mandate({ verificationStatus: 'rejected' })])).toBe(
      'UNVERIFIED_INSTRUMENT',
    )
    expect(reason(request(), [mandate({ instrumentRef: '' })])).toBe('UNVERIFIED_INSTRUMENT')
    expect(reason(request(), [mandate({ instrumentVersion: '' })])).toBe('UNVERIFIED_INSTRUMENT')
    expect(reason(request(), [mandate({ issuerActorId: '' })])).toBe('UNVERIFIED_INSTRUMENT')
  })

  it('refuses revocation or suspension even when the time window and roles look valid', () => {
    expect(reason(request(), [mandate({ status: 'revoked' })])).toBe('MANDATE_INACTIVE')
    expect(reason(request(), [mandate({ status: 'suspended' })])).toBe('MANDATE_INACTIVE')
    expect(reason(request(), [mandate({ revokedAt: '2026-11-23T11:59:00.000Z' })])).toBe(
      'MANDATE_INACTIVE',
    )
  })

  it('enforces effective start inclusive and expiry exclusive', () => {
    expect(reason(request({ evaluatedAt: '2026-11-22T23:59:59.999Z' }))).toBe(
      'MANDATE_NOT_EFFECTIVE',
    )
    expect(reason(request({ evaluatedAt: '2026-11-23T00:00:00.000Z' }))).toBe('ADMITTED')
    expect(reason(request({ evaluatedAt: '2026-12-23T00:00:00.000Z' }))).toBe(
      'MANDATE_NOT_EFFECTIVE',
    )
  })

  it('allows acceptance before effectiveness but not acceptance or attestation in the future', () => {
    expect(reason(request(), [mandate()])).toBe('ADMITTED')
    expect(reason(request(), [mandate({ acceptedAt: '2026-11-24T00:00:00.000Z' })])).toBe(
      'MANDATE_NOT_EFFECTIVE',
    )
    expect(reason(request(), [mandate({ attestedAt: '2026-11-24T00:00:00.000Z' })])).toBe(
      'MANDATE_NOT_EFFECTIVE',
    )
    expect(reason(request(), [mandate({ acceptedAt: null })])).toBe('MANDATE_NOT_EFFECTIVE')
  })

  it('refuses malformed dates and inverted mandate windows without JS rollover', () => {
    expect(reason(request({ evaluatedAt: '2026-02-30T00:00:00.000Z' }))).toBe(
      'INVALID_EVALUATION_TIME',
    )
    expect(reason(request(), [mandate({ effectiveAt: '2026-02-30T00:00:00.000Z' })])).toBe(
      'MANDATE_NOT_EFFECTIVE',
    )
    expect(reason(request(), [mandate({ expiresAt: '2026-11-22T00:00:00.000Z' })])).toBe(
      'MANDATE_NOT_EFFECTIVE',
    )
  })

  it('cannot use an old valid approval as present authorization for a new resource', () => {
    expect(reason(request({ resourceId: 'new-extension-18' }))).toBe('MANDATE_SCOPE_MISMATCH')
  })

  it('cannot combine two narrow mandates to invent a broader authorization', () => {
    const authorityForOtherAction = mandate({
      id: 'mandate-8',
      permittedActions: ['decision.ratify'],
    })
    expect(reason(request({ action: 'decision.ratify' }), [mandate(), authorityForOtherAction])).toBe(
      'MANDATE_SCOPE_MISMATCH',
    )
  })
})
