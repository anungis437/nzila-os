import { describe, expect, it } from 'vitest'
import { UE_TEST_ORGS } from '../fixtures/test-orgs'
import { UE_TEST_USERS } from '../fixtures/test-users'
import { UE_EXTERNAL_TESTER_CONTAINMENT } from '../fixtures/test-permissions'

describe('UE QA - external tester containment', () => {
  it('external tester fixture is deterministic and tied to isolated UX org only', () => {
    const tester = UE_TEST_USERS.restrictedUxTester
    expect(tester.userId).toBe('ue-qa-ux-tester-001')
    expect(tester.orgId).toBe(UE_TEST_ORGS.uxTesterIsolated.id)
  })

  it('external tester cannot map to production-like orgs', () => {
    const tester = UE_TEST_USERS.restrictedUxTester
    expect(tester.orgId).not.toBe(UE_TEST_ORGS.productionLike.id)
    expect(tester.orgId).not.toBe(UE_TEST_ORGS.primary.id)
    expect(tester.orgId).not.toBe(UE_TEST_ORGS.secondary.id)
  })

  it('containment policy defines denied admin and cross-org audit actions', () => {
    expect(UE_EXTERNAL_TESTER_CONTAINMENT.deniedRoutes).toContain('/api/admin/update-role')
    expect(UE_EXTERNAL_TESTER_CONTAINMENT.deniedRoutes).toContain('/api/exports')
    expect(UE_EXTERNAL_TESTER_CONTAINMENT.deniedRoutes).toContain('/api/audits')
  })

  it('containment policy defines audit trace expectation and revocation process', () => {
    expect(UE_EXTERNAL_TESTER_CONTAINMENT.auditTrackingExpectation.length).toBeGreaterThan(10)
    expect(UE_EXTERNAL_TESTER_CONTAINMENT.revocationChecklist.length).toBeGreaterThan(2)
  })

  it('audit tracking expectation includes complete metadata description (EXTERNAL-TESTER-ACTIONS-AUDITABLE)', () => {
    const expectation = UE_EXTERNAL_TESTER_CONTAINMENT.auditTrackingExpectation
    expect(typeof expectation).toBe('string')
    expect(expectation.length).toBeGreaterThan(20)
    const lower = expectation.toLowerCase()
    expect(lower.includes('request id')).toBe(true)
    expect(lower.includes('org id')).toBe(true)
    expect(lower.includes('actor id')).toBe(true)
    expect(lower.includes('decision')).toBe(true)
  })

  it('suspended account is a distinct containment scenario from external tester: inactive status and org membership differ (NEG-SUSPENDED-USER-BEHAVIOR)', () => {
    const suspended = UE_TEST_USERS.suspendedMember
    const externalTester = UE_TEST_USERS.restrictedUxTester

    // Suspended member has inactive status and suspended metadata flag
    expect(suspended.status).toBe('inactive')
    expect(suspended.metadata.suspended).toBe(true)

    // Suspended member belongs to the primary org (not the isolated tester org)
    expect(suspended.orgId).toBe(UE_TEST_ORGS.primary.id)
    expect(suspended.orgId).not.toBe(externalTester.orgId)

    // Containment policy denied routes cover the routes suspended users must not access
    expect(UE_EXTERNAL_TESTER_CONTAINMENT.deniedRoutes).toContain('/api/admin/update-role')
    expect(UE_EXTERNAL_TESTER_CONTAINMENT.deniedRoutes).toContain('/api/workbench/assign')
    expect(UE_EXTERNAL_TESTER_CONTAINMENT.deniedRoutes).toContain('/api/exports')

    // The revocation checklist applies to both suspension scenarios
    expect(UE_EXTERNAL_TESTER_CONTAINMENT.revocationChecklist.length).toBeGreaterThan(0)
  })
})
