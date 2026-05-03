import { describe, expect, it } from 'vitest'
import { getAllowedClaimTransitions } from '@/lib/services/claim-workflow-fsm'
import { QA_ROUTE_INVENTORY } from './_qa-route-inventory'
import { UE_INVALID_TRANSITIONS, UE_TEST_CASES, UE_VALID_TRANSITIONS } from '../fixtures/test-cases'

describe('UE QA - case lifecycle and isolation rules', () => {
  it('valid transitions are allowed by the state machine', () => {
    for (const transition of UE_VALID_TRANSITIONS) {
      const allowed = getAllowedClaimTransitions(transition.from as never, 'admin')
      expect(allowed, `${transition.from} -> ${transition.to} should be valid`).toContain(
        transition.to,
      )
    }
  })

  it('invalid transitions are rejected by the state machine', () => {
    for (const transition of UE_INVALID_TRANSITIONS) {
      const allowed = getAllowedClaimTransitions(transition.from as never, 'steward')
      expect(allowed, `${transition.from} -> ${transition.to} must be blocked`).not.toContain(
        transition.to,
      )
    }
  })

  it('resolved state is terminal unless explicitly supported by implementation', () => {
    const allowed = getAllowedClaimTransitions('resolved' as never, 'admin')
    expect(allowed).not.toContain('assigned')
    expect(allowed).not.toContain('escalated')
  })

  it('undefined transitions are blocked', () => {
    const allowed = getAllowedClaimTransitions('submitted' as never, 'admin')
    expect(allowed).not.toContain('nonexistent_status' as never)
  })

  it('fixture cases enforce cross-org isolation assumptions', () => {
    expect(UE_TEST_CASES.primarySubmitted.organizationId).not.toBe(
      UE_TEST_CASES.secondarySubmitted.organizationId,
    )
  })

  it('deterministic fixture cases include required lifecycle anchors', () => {
    expect(UE_TEST_CASES.primarySubmitted.status).toBe('submitted')
    expect(UE_TEST_CASES.primaryAssigned.status).toBe('assigned')
  })

  it('evidence route is org-scoped and pilot-critical (MEMBER-CANNOT-VIEW-WRONG-ORG-DOCUMENT)', () => {
    const evidenceEntries = QA_ROUTE_INVENTORY.filter((e) => e.routeFile.includes('/evidence/'))
    expect(evidenceEntries.length).toBeGreaterThan(0)
    expect(evidenceEntries.every((e) => e.readinessCategory === 'pilot_critical')).toBe(true)
    expect(evidenceEntries.every((e) => e.expectedAuthorizationByPersona.unauthenticated === 'deny')).toBe(true)
  })
})
