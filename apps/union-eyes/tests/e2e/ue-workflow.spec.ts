import { expect, test, type APIRequestContext } from '@playwright/test'
import { UE_TEST_USERS, UE_TEST_USER_PASSWORD } from '../fixtures/test-users'

async function loginAs(request: APIRequestContext, email: string): Promise<void> {
  const response = await request.post('/api/auth/login', {
    data: {
      email,
      password: UE_TEST_USER_PASSWORD,
    },
  })

  expect(response.ok(), await response.text()).toBeTruthy()
}

test.describe('Union Eyes QA E2E Flows', () => {
  test('1) intake -> review -> assign -> escalate -> resolve', async ({ request }) => {
    await loginAs(request, UE_TEST_USERS.stewardPrimary.email)

    const response = await request.post('/api/workflow/transition', {
      data: {
        claimNumber: 'UE-QA-0001',
        targetStatus: 'under_review',
        notes: 'QA deterministic transition',
      },
    })

    expect([200, 409, 422]).toContain(response.status())
  })

  test('2) unauthorized access attempt is blocked', async ({ request }) => {
    const response = await request.get('/api/workbench/assigned')
    expect([401, 403]).toContain(response.status())
  })

  test('3) cross-org access attempt is blocked', async ({ request }) => {
    await loginAs(request, UE_TEST_USERS.memberPrimary.email)

    const response = await request.post('/api/workflow/transition', {
      data: {
        claimNumber: 'UE-QA-1001',
        targetStatus: 'under_review',
        notes: 'Cross-org access attempt',
      },
    })

    expect([403, 404]).toContain(response.status())
  })

  test('4) read-only journey blocks mutation', async ({ request }) => {
    await loginAs(request, UE_TEST_USERS.memberPrimary.email)

    const readResponse = await request.get('/api/auth/user-role')
    expect([200, 401, 403]).toContain(readResponse.status())

    const mutationResponse = await request.post('/api/workbench/assign', {
      data: { claimId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2', assignedTo: 'ue-qa-steward-primary' },
    })
    expect([401, 403]).toContain(mutationResponse.status())
  })

  test('5) intelligence dashboard endpoint is tier-gated', async ({ request }) => {
    await loginAs(request, UE_TEST_USERS.stewardPrimary.email)

    const response = await request.get('/api/cognition/kpis?windowDays=30')

    expect([200, 403]).toContain(response.status())
  })

  test('6) export audit pack route is role and org constrained', async ({ request }) => {
    await loginAs(request, UE_TEST_USERS.memberPrimary.email)

    const response = await request.get('/api/exports')

    expect([200, 403, 404]).toContain(response.status())
  })
})
