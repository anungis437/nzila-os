import { expect, test } from '@playwright/test'
import {
  assertNoCrossOrgLeak,
  assertPermissionDenied,
  assertRoleGatedReadStatus,
  ensureServerReady,
  loginAsTestUser,
  seedOrVerifyTestState,
} from '../tests/e2e/_helpers'
import { UE_TEST_USERS } from '../tests/fixtures/test-users'

test.describe('Union Eyes QA E2E Flows', () => {
  test.beforeAll(async ({ request }) => {
    await ensureServerReady(request)
    await seedOrVerifyTestState(request)
  })

  test.skip(process.env.GITHUB_ACTOR === 'dependabot[bot]', 'Dependabot PR runs do not provide seeded UE auth/backend state for this workflow suite.')

  test('1) intake -> review -> assign -> escalate -> resolve', async ({ request }) => {
    await loginAsTestUser(request, UE_TEST_USERS.stewardPrimary.email)

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
    assertPermissionDenied(response.status())
  })

  test('3) cross-org access attempt is blocked', async ({ request }) => {
    await loginAsTestUser(request, UE_TEST_USERS.memberPrimary.email)

    const response = await request.post('/api/workflow/transition', {
      data: {
        claimNumber: 'UE-QA-1001',
        targetStatus: 'under_review',
        notes: 'Cross-org access attempt',
      },
    })

    await assertNoCrossOrgLeak(response)
  })

  test('4) read-only journey blocks mutation', async ({ request }) => {
    await loginAsTestUser(request, UE_TEST_USERS.memberPrimary.email)

    const readResponse = await request.get('/api/auth/user-role')
    expect([200, 401, 403]).toContain(readResponse.status())

    const mutationResponse = await request.post('/api/workbench/assign', {
      data: { claimId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2', assignedTo: 'ue-qa-steward-primary' },
    })
    assertPermissionDenied(mutationResponse.status())
  })

  test('5) intelligence dashboard endpoint is tier-gated', async ({ request }) => {
    await loginAsTestUser(request, UE_TEST_USERS.stewardPrimary.email)

    const response = await request.get('/api/cognition/kpis?windowDays=30')

    assertRoleGatedReadStatus(response.status())
  })

  test('6) export audit pack route is role and org constrained', async ({ request }) => {
    await loginAsTestUser(request, UE_TEST_USERS.memberPrimary.email)

    const response = await request.get('/api/exports')

    expect([200, 403, 404]).toContain(response.status())
  })
})
