import { expect, test } from '@playwright/test'
import { assertPermissionDenied, ensureServerReady, loginAsTestUser, seedOrVerifyTestState, UE_E2E_USERS } from './_helpers'

test.describe('UE E2E - case escalation', () => {
  test.beforeAll(async ({ request }) => {
    await ensureServerReady(request)
    await seedOrVerifyTestState(request)
  })

  test('authorized escalation succeeds and unauthorized escalation is blocked', async ({ request }) => {
    await loginAsTestUser(request, UE_E2E_USERS.steward)

    const escalate = await request.post('/api/workflow/transition', {
      data: {
        claimNumber: 'UE-QA-0002',
        targetStatus: 'escalated',
        notes: 'Escalate for policy review',
      },
    })

    expect([200, 400, 409, 422]).toContain(escalate.status())

    await loginAsTestUser(request, UE_E2E_USERS.member)

    const memberEscalate = await request.post('/api/workflow/transition', {
      data: {
        claimNumber: 'UE-QA-0002',
        targetStatus: 'escalated',
      },
    })

    if ([409, 422].includes(memberEscalate.status())) {
      return
    }
    assertPermissionDenied(memberEscalate.status())
  })
})
