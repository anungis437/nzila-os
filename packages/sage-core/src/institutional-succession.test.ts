// R01 / S01 adversarial pure proofs: no automatic inheritance of authority
// across institutional merger or leadership succession.

import { describe, expect, it } from 'vitest'
import {
  evaluateSageInstitutionalMandate,
  type SageInstitutionalAuthorityRequest,
  type SageVerifiedInstitutionalMandate,
} from './institutional-authority'

const NOW = '2026-11-23T16:00:00.000Z'

function mandate(
  overrides: Partial<SageVerifiedInstitutionalMandate> & Pick<
    SageVerifiedInstitutionalMandate,
    'id' | 'orgId' | 'principalActorId' | 'resourceId'
  >,
): SageVerifiedInstitutionalMandate {
  return {
    positionId: 'pos-director',
    permittedActions: ['decision.ratify', 'resource.commit', 'succession.delegate', 'records.transfer'],
    instrumentRef: 'INSTR-1',
    instrumentVersion: 'v1',
    issuerActorId: 'issuer-1',
    monetaryLimitMinor: 1_000_000,
    currency: 'CAD',
    verificationStatus: 'verified',
    attestedAt: '2026-01-01T00:00:00.000Z',
    acceptedAt: '2026-01-02T00:00:00.000Z',
    effectiveAt: '2026-01-03T00:00:00.000Z',
    expiresAt: '2027-01-01T00:00:00.000Z',
    revokedAt: null,
    status: 'active',
    ...overrides,
  }
}

function request(
  overrides: Partial<SageInstitutionalAuthorityRequest> &
    Pick<SageInstitutionalAuthorityRequest, 'orgId' | 'actorId' | 'resourceId' | 'mandateId'>,
): SageInstitutionalAuthorityRequest {
  return {
    actorKind: 'human',
    currentPositionId: 'pos-director',
    action: 'decision.ratify',
    evaluatedAt: NOW,
    authenticated: true,
    activeWorkspaceMembership: true,
    applicationPermissionGranted: true,
    conflictOrRecusal: false,
    ...overrides,
  }
}

describe('R01 regulatory merger — no automatic inheritance', () => {
  const bodyA = mandate({
    id: 'm-body-a',
    orgId: 'regulator-a',
    principalActorId: 'officer-a',
    resourceId: 'records.custody.a',
    instrumentRef: 'REG-A-MANDATE',
  })
  const bodyB = mandate({
    id: 'm-body-b',
    orgId: 'regulator-b',
    principalActorId: 'officer-b',
    resourceId: 'records.custody.b',
    instrumentRef: 'REG-B-MANDATE',
  })

  it('refuses actor from body A exercising body B mandate after a fictional merger announcement', () => {
    const decision = evaluateSageInstitutionalMandate(
      request({
        orgId: 'regulator-merged',
        actorId: 'officer-a',
        resourceId: 'records.custody.b',
        mandateId: bodyB.id,
        action: 'records.transfer',
      }),
      [bodyA, bodyB],
    )
    expect(decision.allowed).toBe(false)
    if (decision.allowed) return
    expect(decision.reason).toBe('MANDATE_SCOPE_MISMATCH')
  })

  it('requires an explicit successor mandate for the merged institution', () => {
    const successor = mandate({
      id: 'm-merged-successor',
      orgId: 'regulator-merged',
      principalActorId: 'officer-successor',
      positionId: 'pos-successor',
      resourceId: 'records.custody.merged',
      instrumentRef: 'MERGER-SUCCESSOR-INSTRUMENT',
      instrumentVersion: 'v1',
      permittedActions: ['records.transfer', 'decision.ratify'],
    })
    const denied = evaluateSageInstitutionalMandate(
      request({
        orgId: 'regulator-merged',
        actorId: 'officer-successor',
        currentPositionId: 'pos-successor',
        resourceId: 'records.custody.merged',
        mandateId: bodyA.id,
        action: 'records.transfer',
      }),
      [bodyA, bodyB, successor],
    )
    expect(denied.allowed).toBe(false)

    const admitted = evaluateSageInstitutionalMandate(
      request({
        orgId: 'regulator-merged',
        actorId: 'officer-successor',
        currentPositionId: 'pos-successor',
        resourceId: 'records.custody.merged',
        mandateId: successor.id,
        action: 'records.transfer',
      }),
      [bodyA, bodyB, successor],
    )
    expect(admitted).toMatchObject({ allowed: true, instrumentRef: 'MERGER-SUCCESSOR-INSTRUMENT' })
  })
})

describe('S01 leadership succession — historic inspectable, expired access not restored', () => {
  const predecessor = mandate({
    id: 'm-pred',
    orgId: 'secretariat-1',
    principalActorId: 'leader-outgoing',
    resourceId: 'programme.continuity',
    instrumentRef: 'SEC-PRED',
    expiresAt: '2026-06-01T00:00:00.000Z',
  })
  const successor = mandate({
    id: 'm-succ',
    orgId: 'secretariat-1',
    principalActorId: 'leader-incoming',
    positionId: 'pos-secretary',
    resourceId: 'programme.continuity',
    instrumentRef: 'SEC-SUCC',
    effectiveAt: '2026-06-01T00:00:00.000Z',
    acceptedAt: '2026-06-01T00:00:00.000Z',
    attestedAt: '2026-05-15T00:00:00.000Z',
  })

  it('keeps the predecessor instrument historically readable with its original identity', () => {
    expect(predecessor.instrumentRef).toBe('SEC-PRED')
    expect(predecessor.principalActorId).toBe('leader-outgoing')
    expect(predecessor.expiresAt).toBe('2026-06-01T00:00:00.000Z')
  })

  it('refuses the predecessor acting after expiry and admits only the successor mandate', () => {
    const expired = evaluateSageInstitutionalMandate(
      request({
        orgId: 'secretariat-1',
        actorId: 'leader-outgoing',
        resourceId: 'programme.continuity',
        mandateId: predecessor.id,
        action: 'decision.ratify',
      }),
      [predecessor, successor],
    )
    expect(expired.allowed).toBe(false)
    if (!expired.allowed) expect(expired.reason).toBe('MANDATE_NOT_EFFECTIVE')

    const spoof = evaluateSageInstitutionalMandate(
      request({
        orgId: 'secretariat-1',
        actorId: 'leader-incoming',
        currentPositionId: 'pos-secretary',
        resourceId: 'programme.continuity',
        mandateId: predecessor.id,
        action: 'decision.ratify',
      }),
      [predecessor, successor],
    )
    expect(spoof.allowed).toBe(false)

    const ok = evaluateSageInstitutionalMandate(
      request({
        orgId: 'secretariat-1',
        actorId: 'leader-incoming',
        currentPositionId: 'pos-secretary',
        resourceId: 'programme.continuity',
        mandateId: successor.id,
        action: 'decision.ratify',
      }),
      [predecessor, successor],
    )
    expect(ok.allowed).toBe(true)
  })
})
