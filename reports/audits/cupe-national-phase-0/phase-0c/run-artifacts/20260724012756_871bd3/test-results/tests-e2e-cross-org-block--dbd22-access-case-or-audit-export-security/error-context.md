# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: tests\e2e\cross-org-block.spec.ts >> UE E2E - cross-org containment >> wrong-org user cannot access case or audit export
- Location: tests\e2e\cross-org-block.spec.ts:14:7

# Error details

```
"beforeAll" hook timeout of 60000ms exceeded.
```

# Test source

```ts
  1  | import { test } from '@playwright/test'
  2  | import { assertNoCrossOrgLeak, ensureServerReady, loginAsTestUser, seedOrVerifyTestState, UE_E2E_USERS, cleanupDatabaseConnections } from './_helpers'
  3  | 
  4  | test.describe('UE E2E - cross-org containment', () => {
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
  14 |   test('wrong-org user cannot access case or audit export', async ({ request }) => {
  15 |     await loginAsTestUser(request, UE_E2E_USERS.wrongOrg)
  16 | 
  17 |     const transition = await request.post('/api/workflow/transition', {
  18 |       data: {
  19 |         claimNumber: 'UE-QA-0002',
  20 |         targetStatus: 'under_review',
  21 |       },
  22 |     })
  23 | 
  24 |     await assertNoCrossOrgLeak(transition)
  25 | 
  26 |     const exportAccess = await request.get('/api/exports')
  27 |     await assertNoCrossOrgLeak(exportAccess)
  28 |   })
  29 | 
  30 |   test('wrong-org member cannot access evidence/documents from another org (MEMBER-CANNOT-VIEW-WRONG-ORG-DOCUMENT)', async ({ request }) => {
  31 |     await loginAsTestUser(request, UE_E2E_USERS.wrongOrg)
  32 | 
  33 |     // Attempt to access a document belonging to the primary org's case
  34 |     const evidence = await request.get('/api/claims/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1/documents')
  35 |     await assertNoCrossOrgLeak(evidence)
  36 |   })
  37 | 
  38 |   test('wrong-org auditor cannot access audit records from another org (AUDITOR-CANNOT-ACCESS-WRONG-ORG)', async ({ request }) => {
  39 |     await loginAsTestUser(request, UE_E2E_USERS.wrongOrg)
  40 | 
  41 |     const auditLog = await request.get('/api/audit/cases/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1')
  42 |     await assertNoCrossOrgLeak(auditLog)
  43 |   })
  44 | })
  45 | 
```