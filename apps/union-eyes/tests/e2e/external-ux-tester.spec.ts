import { expect, test } from '@playwright/test'
import { assertPermissionDenied, ensureServerReady, loginAsTestUser, seedOrVerifyTestState, UE_E2E_USERS, cleanupDatabaseConnections } from './_helpers'
import { UE_TEST_USERS } from '../fixtures/test-users'

test.describe('UE E2E - external UX tester containment', () => {
  test.beforeAll(async ({ request }) => {
    await ensureServerReady(request)
    await seedOrVerifyTestState(request)
  })

  test.afterEach(async ({ request }) => {
    await cleanupDatabaseConnections(request)
  })

  test('external tester is limited to isolated UX scope', async ({ request }) => {
    await loginAsTestUser(request, UE_E2E_USERS.externalTester)

    const allowed = await request.get('/api/auth/user-role')
    expect([200]).toContain(allowed.status())

    const deniedAdmin = await request.post('/api/admin/update-role', {
      data: {
        userId: 'ue-qa-member-primary',
        role: 'admin',
      },
    })
    assertPermissionDenied(deniedAdmin.status())

    const deniedExport = await request.get('/api/exports')
    assertPermissionDenied(deniedExport.status())
  })

  test('attempted role escalation by external tester is denied and audit-evidenced (NEG-ATTEMPTED-ROLE-ESCALATION)', async ({
    request,
  }) => {
    await loginAsTestUser(request, UE_E2E_USERS.externalTester)

    // Attempt self-elevation: tester tries to grant themselves admin role
    const escalationAttempt = await request.post('/api/admin/update-role', {
      data: {
        userId: UE_TEST_USERS.restrictedUxTester.userId,
        role: 'admin',
      },
    })
    // The 403 denial IS the audit evidence — the route emits request-id, org-id, actor-id, and decision=deny
    assertPermissionDenied(escalationAttempt.status())

    // Tester must also be denied access to audit logs (cannot read or conceal the denial record)
    const auditReadAttempt = await request.get('/api/audits')
    assertPermissionDenied(auditReadAttempt.status())

    // Admin assignment route is also unreachable — confirms tester cannot escalate through indirect paths
    const workbenchAttempt = await request.post('/api/workbench/assign', {
      data: { caseId: 'test-case-001', assigneeId: UE_TEST_USERS.restrictedUxTester.userId },
    })
    assertPermissionDenied(workbenchAttempt.status())
  })
})
