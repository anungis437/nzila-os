# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: tests\e2e\auditor-readonly.spec.ts >> UE E2E - auditor read-only boundary >> auditor can read allowed surfaces but mutation controls are blocked
- Location: tests\e2e\auditor-readonly.spec.ts:14:7

# Error details

```
"beforeAll" hook timeout of 60000ms exceeded.
```

# Test source

```ts
  1  | import { test } from '@playwright/test'
  2  | import { assertPermissionDenied, assertRoleGatedReadStatus, ensureServerReady, loginAsTestUser, seedOrVerifyTestState, UE_E2E_USERS, cleanupDatabaseConnections } from './_helpers'
  3  | 
  4  | test.describe('UE E2E - auditor read-only boundary', () => {
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
  14 |   test('auditor can read allowed surfaces but mutation controls are blocked', async ({ request }) => {
  15 |     await loginAsTestUser(request, UE_E2E_USERS.auditor)
  16 | 
  17 |     const readAudit = await request.get('/api/audits')
  18 |     assertRoleGatedReadStatus(readAudit.status())
  19 | 
  20 |     const mutate = await request.post('/api/workbench/assign', {
  21 |       data: {
  22 |         claimId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2',
  23 |         assignedTo: 'ue-qa-steward-primary',
  24 |       },
  25 |     })
  26 | 
  27 |     assertPermissionDenied(mutate.status())
  28 |   })
  29 | })
  30 | 
```