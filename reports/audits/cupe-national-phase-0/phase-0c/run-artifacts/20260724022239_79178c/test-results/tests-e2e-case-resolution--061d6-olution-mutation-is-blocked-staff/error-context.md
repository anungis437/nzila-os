# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: tests\e2e\case-resolution.spec.ts >> UE E2E - case resolution >> authorized resolution is visible and invalid post-resolution mutation is blocked
- Location: tests\e2e\case-resolution.spec.ts:14:7

# Error details

```
"beforeAll" hook timeout of 60000ms exceeded.
```

# Test source

```ts
  1  | import { expect, test } from '@playwright/test'
  2  | import { ensureServerReady, loginAsTestUser, seedOrVerifyTestState, UE_E2E_USERS, cleanupDatabaseConnections } from './_helpers'
  3  | 
  4  | test.describe('UE E2E - case resolution', () => {
> 5  |   test.beforeAll(async ({ request }) => {
     |        ^ "beforeAll" hook timeout of 60000ms exceeded.
  6  |     await ensureServerReady(request)
  7  |     await seedOrVerifyTestState(request)
  8  |   })
  9  | 
  10 |   test.afterEach(async ({ request }) => {
  11 |     await cleanupDatabaseConnections(request)
  12 |   })
  13 | 
  14 |   test('authorized resolution is visible and invalid post-resolution mutation is blocked', async ({ request }) => {
  15 |     await loginAsTestUser(request, UE_E2E_USERS.admin)
  16 | 
  17 |     const resolve = await request.post('/api/workflow/transition', {
  18 |       data: {
  19 |         claimNumber: 'UE-QA-0002',
  20 |         targetStatus: 'resolved',
  21 |         notes: 'Resolved in E2E flow',
  22 |       },
  23 |     })
  24 | 
  25 |     expect([200, 409, 422]).toContain(resolve.status())
  26 | 
  27 |     const invalidTransition = await request.post('/api/workflow/transition', {
  28 |       data: {
  29 |         claimNumber: 'UE-QA-0002',
  30 |         targetStatus: 'submitted',
  31 |       },
  32 |     })
  33 | 
  34 |     expect([409, 422]).toContain(invalidTransition.status())
  35 |   })
  36 | })
  37 | 
```