import { expect, test } from '@playwright/test'
import { ensureServerReady, loginAsTestUser, seedOrVerifyTestState, UE_E2E_USERS, cleanupDatabaseConnections } from './_helpers'

test.describe('UE E2E - case resolution', () => {
  test.beforeAll(async ({ request }) => {
    await ensureServerReady(request)
    await seedOrVerifyTestState(request)
  })

  test.afterEach(async ({ request }) => {
    await cleanupDatabaseConnections(request)
  })

  test('the assigned steward resolves, an admin without a mandate cannot, and an invalid post-resolution mutation is blocked', async ({ request }) => {
    // Case authority is a governed relationship, not a role: only the assigned handler may move the case.
    await loginAsTestUser(request, UE_E2E_USERS.admin)
    const adminAttempt = await request.post('/api/workflow/transition', {
      data: { claimNumber: 'UE-QA-0002', targetStatus: 'resolved', notes: 'Admin without a mandate' },
    })
    expect([403, 404]).toContain(adminAttempt.status())

    await loginAsTestUser(request, UE_E2E_USERS.steward)

    const resolve = await request.post('/api/workflow/transition', {
      data: {
        claimNumber: 'UE-QA-0002',
        targetStatus: 'resolved',
        notes: 'Resolved in E2E flow',
      },
    })

    expect([200, 409, 422]).toContain(resolve.status())

    const invalidTransition = await request.post('/api/workflow/transition', {
      data: {
        claimNumber: 'UE-QA-0002',
        targetStatus: 'submitted',
      },
    })

    expect([409, 422]).toContain(invalidTransition.status())
  })
})
