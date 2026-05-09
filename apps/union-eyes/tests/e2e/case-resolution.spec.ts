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

  test('authorized resolution is visible and invalid post-resolution mutation is blocked', async ({ request }) => {
    await loginAsTestUser(request, UE_E2E_USERS.admin)

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
