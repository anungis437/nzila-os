/**
 * Adversarial boundary matrix — institutional evaluator proofs.
 *
 * Covers the Wave 2 refusal matrix: wrong-tenant, wrong-resource, expired,
 * revoked, conflict/recusal, unauthenticated, unavailable conflict data,
 * duplicate-intent determinism.
 *
 * LOCAL_TESTED only. Staging HTTP / UI / EN-FR remain NOT_PROVEN.
 */
import { describe, expect, it } from 'vitest'
import {
  evaluateSageInstitutionalMandate,
  type SageInstitutionalAuthorityRequest,
  type SageVerifiedInstitutionalMandate,
} from './institutional-authority'
import {
  InMemorySageInstitutionalCapacityStore,
  resolveInstitutionalCapacityForAdmission,
} from './institutional-capacity'

const AT = '2026-11-23T18:00:00.000Z'
const ORG = 'org-alder-civic'
const RESOURCE = 'procurement.alder.workflow-redesign'

function mandate(
  overrides: Partial<SageVerifiedInstitutionalMandate> = {},
): SageVerifiedInstitutionalMandate {
  return {
    id: 'm-current',
    orgId: ORG,
    principalActorId: 'officer-alder-1',
    positionId: 'pos-procurement',
    resourceId: RESOURCE,
    permittedActions: ['resource.commit', 'decision.ratify'],
    instrumentRef: 'FICT-M',
    instrumentVersion: '2',
    issuerActorId: 'issuer-1',
    monetaryLimitMinor: 3_000_000,
    currency: 'CAD',
    verificationStatus: 'verified',
    attestedAt: '2026-01-01T00:00:00.000Z',
    acceptedAt: '2026-01-02T00:00:00.000Z',
    effectiveAt: '2026-01-01T00:00:00.000Z',
    expiresAt: '2027-12-31T00:00:00.000Z',
    revokedAt: null,
    status: 'active',
    ...overrides,
  }
}

function request(
  overrides: Partial<SageInstitutionalAuthorityRequest> = {},
): SageInstitutionalAuthorityRequest {
  return {
    orgId: ORG,
    actorId: 'officer-alder-1',
    actorKind: 'human',
    currentPositionId: 'pos-procurement',
    resourceId: RESOURCE,
    action: 'resource.commit',
    mandateId: 'm-current',
    evaluatedAt: AT,
    authenticated: true,
    activeWorkspaceMembership: true,
    applicationPermissionGranted: true,
    conflictOrRecusal: false,
    commitment: {
      currency: 'CAD',
      totalCommittedMinorAfterAction: 1_000_000,
    },
    ...overrides,
  }
}

describe('Adversarial boundary matrix (LOCAL_TESTED)', () => {
  it('authorized success admits under current mandate', () => {
    const d = evaluateSageInstitutionalMandate(request(), [mandate()])
    expect(d.allowed).toBe(true)
    if (d.allowed) expect(d.reason).toBe('ADMITTED')
  })

  it('wrong-tenant refuses', () => {
    const d = evaluateSageInstitutionalMandate(
      request({ orgId: 'org-regulator-beta' }),
      [mandate()],
    )
    expect(d.allowed).toBe(false)
    if (!d.allowed) expect(d.reason).toBe('MANDATE_SCOPE_MISMATCH')
  })

  it('wrong-resource refuses', () => {
    const d = evaluateSageInstitutionalMandate(
      request({ resourceId: 'procurement.other' }),
      [mandate()],
    )
    expect(d.allowed).toBe(false)
    if (!d.allowed) expect(d.reason).toBe('MANDATE_SCOPE_MISMATCH')
  })

  it('expired mandate refuses', () => {
    const d = evaluateSageInstitutionalMandate(request(), [
      mandate({
        expiresAt: '2026-01-01T00:00:00.000Z',
        effectiveAt: '2025-01-01T00:00:00.000Z',
      }),
    ])
    expect(d.allowed).toBe(false)
  })

  it('revoked mandate refuses', () => {
    const d = evaluateSageInstitutionalMandate(request(), [
      mandate({ status: 'revoked', revokedAt: '2026-06-01T00:00:00.000Z' }),
    ])
    expect(d.allowed).toBe(false)
    if (!d.allowed) expect(d.reason).toBe('MANDATE_INACTIVE')
  })

  it('unauthenticated refuses', () => {
    const d = evaluateSageInstitutionalMandate(request({ authenticated: false }), [mandate()])
    expect(d.allowed).toBe(false)
    if (!d.allowed) expect(d.reason).toBe('UNAUTHENTICATED')
  })

  it('conflictOrRecusal true refuses', () => {
    const d = evaluateSageInstitutionalMandate(request({ conflictOrRecusal: true }), [mandate()])
    expect(d.allowed).toBe(false)
    if (!d.allowed) expect(d.reason).toBe('CONFLICT_OR_RECUSAL')
  })

  it('null conflict data fails closed', () => {
    const d = evaluateSageInstitutionalMandate(request({ conflictOrRecusal: null }), [mandate()])
    expect(d.allowed).toBe(false)
    if (!d.allowed) expect(d.reason).toBe('CONFLICT_DATA_UNAVAILABLE')
  })

  it('capacity store: active conflict surfaces as conflictOrRecusal true', async () => {
    const store = new InMemorySageInstitutionalCapacityStore()
    store.setPosition(ORG, 'ws-1', 'officer-alder-1', 'pos-procurement')
    store.setConflict(ORG, 'ws-1', 'officer-alder-1', RESOURCE, 'resource.commit', true)
    const capacity = await resolveInstitutionalCapacityForAdmission(store, {
      orgId: ORG,
      workspaceId: 'ws-1',
      actorId: 'officer-alder-1',
      resourceId: RESOURCE,
      action: 'resource.commit',
      mandateId: 'm-current',
      mandatePositionId: 'pos-procurement',
    })
    expect(capacity.resolved).toBe(true)
    if (capacity.resolved) expect(capacity.conflictOrRecusal).toBe(true)
    const d = evaluateSageInstitutionalMandate(
      request({ conflictOrRecusal: capacity.resolved ? capacity.conflictOrRecusal : null }),
      [mandate()],
    )
    expect(d.allowed).toBe(false)
  })

  it('capacity store: missing conflict attestation fails closed', async () => {
    const store = new InMemorySageInstitutionalCapacityStore()
    store.setPosition(ORG, 'ws-1', 'officer-alder-1', 'pos-procurement')
    const capacity = await resolveInstitutionalCapacityForAdmission(store, {
      orgId: ORG,
      workspaceId: 'ws-1',
      actorId: 'officer-alder-1',
      resourceId: RESOURCE,
      action: 'resource.commit',
      mandateId: 'm-current',
      mandatePositionId: 'pos-procurement',
    })
    expect(capacity).toEqual({ resolved: false, reason: 'CONFLICT_DATA_UNAVAILABLE' })
  })

  it('duplicate evaluation is deterministic for identical inputs', () => {
    const m = [mandate()]
    const r = request()
    expect(evaluateSageInstitutionalMandate(r, m)).toEqual(evaluateSageInstitutionalMandate(r, m))
  })
})
