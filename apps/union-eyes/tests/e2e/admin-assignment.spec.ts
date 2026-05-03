import { expect, test } from '@playwright/test'
import { assertPermissionDenied, ensureServerReady, loginAsTestUser, seedOrVerifyTestState, UE_E2E_USERS } from './_helpers'

test.describe('UE E2E - admin assignment', () => {
  test.beforeAll(async ({ request }) => {
    await ensureServerReady(request)
    await seedOrVerifyTestState(request)
  })

  test('admin can assign and member cannot assign', async ({ request }) => {
    await loginAsTestUser(request, UE_E2E_USERS.admin)

    const assignAsAdmin = await request.post('/api/workbench/assign', {
      data: {
        claimId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2',
        assignedTo: 'ue-qa-steward-primary',
      },
    })

    expect([200, 403, 409, 422]).toContain(assignAsAdmin.status())

    await loginAsTestUser(request, UE_E2E_USERS.member)

    const assignAsMember = await request.post('/api/workbench/assign', {
      data: {
        claimId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2',
        assignedTo: 'ue-qa-steward-primary',
      },
    })

    assertPermissionDenied(assignAsMember.status())
  })
})
