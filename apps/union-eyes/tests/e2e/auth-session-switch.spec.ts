import { expect, test } from '@playwright/test'
import { ensureServerReady, loginAsTestUser, seedOrVerifyTestState } from './_helpers'
import { UE_TEST_USERS } from '../fixtures/test-users'

async function getRole(request: Parameters<typeof test>[0] extends never ? never : any): Promise<string> {
  const response = await request.get('/api/auth/user-role')
  expect(response.status()).toBe(200)

  const payload = (await response.json()) as { role?: string }
  expect(typeof payload.role).toBe('string')
  return payload.role as string
}

test.describe('UE E2E - auth session switching', () => {
  test.beforeAll(async ({ request }) => {
    await ensureServerReady(request)
    await seedOrVerifyTestState(request)
  })

  test('sequential logins replace the active session and role context', async ({ request }) => {
    await loginAsTestUser(request, UE_TEST_USERS.memberPrimary.email)
    await expect.poll(async () => getRole(request)).toBe('member')

    await loginAsTestUser(request, UE_TEST_USERS.stewardPrimary.email)
    await expect.poll(async () => getRole(request)).toBe('steward')
  })
})