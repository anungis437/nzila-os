import { test } from '@playwright/test'
import { assertPermissionDenied, assertRoleGatedReadStatus, ensureServerReady, loginAsTestUser, seedOrVerifyTestState, UE_E2E_USERS, cleanupDatabaseConnections } from './_helpers'

test.describe('UE E2E - auditor read-only boundary', () => {
  test.beforeAll(async ({ request }) => {
    await ensureServerReady(request)
    await seedOrVerifyTestState(request)
  })

  test.afterEach(async ({ request }) => {
    await cleanupDatabaseConnections(request)
  })

  test('auditor can read allowed surfaces but mutation controls are blocked', async ({ request }) => {
    await loginAsTestUser(request, UE_E2E_USERS.auditor)

    const readAudit = await request.get('/api/audits')
    assertRoleGatedReadStatus(readAudit.status())

    const mutate = await request.post('/api/workbench/assign', {
      data: {
        claimId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2',
        assignedTo: 'ue-qa-steward-primary',
      },
    })

    assertPermissionDenied(mutate.status())
  })
})
