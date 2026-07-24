# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: tests\e2e\auth-session-switch.spec.ts >> UE E2E - auth session switching >> sequential logins replace the active session and role context
- Location: tests\e2e\auth-session-switch.spec.ts:24:7

# Error details

```
"beforeAll" hook timeout of 60000ms exceeded.
```

# Test source

```ts
  1  | import { expect, test, type APIRequestContext } from '@playwright/test'
  2  | import { ensureServerReady, loginAsTestUser, seedOrVerifyTestState, cleanupDatabaseConnections } from './_helpers'
  3  | import { UE_TEST_USERS } from '../fixtures/test-users'
  4  | 
  5  | async function getRole(request: APIRequestContext): Promise<string> {
  6  |   const response = await request.get('/api/auth/user-role')
  7  |   expect(response.status()).toBe(200)
  8  | 
  9  |   const payload = (await response.json()) as { role?: string }
  10 |   expect(typeof payload.role).toBe('string')
  11 |   return payload.role as string
  12 | }
  13 | 
  14 | test.describe('UE E2E - auth session switching', () => {
> 15 |   test.beforeAll(async ({ request }) => {
     |        ^ "beforeAll" hook timeout of 60000ms exceeded.
  16 |     await ensureServerReady(request)
  17 |     await seedOrVerifyTestState(request)
  18 |   })
  19 | 
  20 |   test.afterEach(async ({ request }) => {
  21 |     await cleanupDatabaseConnections(request)
  22 |   })
  23 | 
  24 |   test('sequential logins replace the active session and role context', async ({ request }) => {
  25 |     await loginAsTestUser(request, UE_TEST_USERS.memberPrimary.email)
  26 |     await expect.poll(async () => getRole(request)).toBe('member')
  27 | 
  28 |     await loginAsTestUser(request, UE_TEST_USERS.stewardPrimary.email)
  29 |     await expect.poll(async () => getRole(request)).toBe('steward')
  30 |   })
  31 | })
```