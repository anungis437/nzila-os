# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: tests\e2e\case-escalation.spec.ts >> UE E2E - case escalation >> authorized escalation succeeds and unauthorized escalation is blocked
- Location: tests\e2e\case-escalation.spec.ts:14:7

# Error details

```
"beforeAll" hook timeout of 60000ms exceeded.
```

# Test source

```ts
  1  | import { expect, test } from '@playwright/test'
  2  | import { assertPermissionDenied, ensureServerReady, loginAsTestUser, seedOrVerifyTestState, UE_E2E_USERS, cleanupDatabaseConnections } from './_helpers'
  3  | 
  4  | test.describe('UE E2E - case escalation', () => {
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
  14 |   test('authorized escalation succeeds and unauthorized escalation is blocked', async ({ request }) => {
  15 |     await loginAsTestUser(request, UE_E2E_USERS.steward)
  16 | 
  17 |     const escalate = await request.post('/api/workflow/transition', {
  18 |       data: {
  19 |         claimNumber: 'UE-QA-0002',
  20 |         targetStatus: 'escalated',
  21 |         notes: 'Escalate for policy review',
  22 |       },
  23 |     })
  24 | 
  25 |     expect([200, 400, 409, 422], `escalate body: ${await escalate.text()}`).toContain(escalate.status())
  26 | 
  27 |     await loginAsTestUser(request, UE_E2E_USERS.member)
  28 | 
  29 |     const memberEscalate = await request.post('/api/workflow/transition', {
  30 |       data: {
  31 |         claimNumber: 'UE-QA-0002',
  32 |         targetStatus: 'escalated',
  33 |       },
  34 |     })
  35 | 
  36 |     if ([409, 422].includes(memberEscalate.status())) {
  37 |       return
  38 |     }
  39 |     assertPermissionDenied(memberEscalate.status())
  40 |   })
  41 | })
  42 | 
```