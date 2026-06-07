import { test } from '@playwright/test'
import { assertNoCrossOrgLeak, ensureServerReady, loginAsTestUser, seedOrVerifyTestState, UE_E2E_USERS, cleanupDatabaseConnections } from './_helpers'

test.describe('UE E2E - cross-org containment', () => {
  test.beforeAll(async ({ request }) => {
    await ensureServerReady(request)
    await seedOrVerifyTestState(request)
  })

  test.afterEach(async ({ request }) => {
    await cleanupDatabaseConnections(request)
  })

  test('wrong-org user cannot access case or audit export', async ({ request }) => {
    await loginAsTestUser(request, UE_E2E_USERS.wrongOrg)

    const transition = await request.post('/api/workflow/transition', {
      data: {
        claimNumber: 'UE-QA-0002',
        targetStatus: 'under_review',
      },
    })

    await assertNoCrossOrgLeak(transition)

    const exportAccess = await request.get('/api/exports')
    await assertNoCrossOrgLeak(exportAccess)
  })

  test('wrong-org member cannot access evidence/documents from another org (MEMBER-CANNOT-VIEW-WRONG-ORG-DOCUMENT)', async ({ request }) => {
    await loginAsTestUser(request, UE_E2E_USERS.wrongOrg)

    // Attempt to access a document belonging to the primary org's case
    const evidence = await request.get('/api/claims/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1/documents')
    await assertNoCrossOrgLeak(evidence)
  })

  test('wrong-org auditor cannot access audit records from another org (AUDITOR-CANNOT-ACCESS-WRONG-ORG)', async ({ request }) => {
    await loginAsTestUser(request, UE_E2E_USERS.wrongOrg)

    const auditLog = await request.get('/api/audit/cases/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1')
    await assertNoCrossOrgLeak(auditLog)
  })
})
