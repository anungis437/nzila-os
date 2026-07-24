# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: e2e\ue-workflow.spec.ts >> UnionEyes QA E2E Flows >> 1) intake -> review -> assign -> escalate -> resolve
- Location: e2e\ue-workflow.spec.ts:20:7

# Error details

```
"beforeAll" hook timeout of 60000ms exceeded.
```

# Test source

```ts
  1  | import { expect, test } from '@playwright/test'
  2  | import {
  3  |   assertNoCrossOrgLeak,
  4  |   assertPermissionDenied,
  5  |   assertRoleGatedReadStatus,
  6  |   ensureServerReady,
  7  |   loginAsTestUser,
  8  |   seedOrVerifyTestState,
  9  | } from '../tests/e2e/_helpers'
  10 | import { UE_TEST_USERS } from '../tests/fixtures/test-users'
  11 | 
  12 | test.describe('UnionEyes QA E2E Flows', () => {
> 13 |   test.beforeAll(async ({ request }) => {
     |        ^ "beforeAll" hook timeout of 60000ms exceeded.
  14 |     await ensureServerReady(request)
  15 |     await seedOrVerifyTestState(request)
  16 |   })
  17 | 
  18 |   test.skip(process.env.GITHUB_ACTOR === 'dependabot[bot]', 'Dependabot PR runs do not provide seeded UE auth/backend state for this workflow suite.')
  19 | 
  20 |   test('1) intake -> review -> assign -> escalate -> resolve', async ({ request }) => {
  21 |     await loginAsTestUser(request, UE_TEST_USERS.stewardPrimary.email)
  22 | 
  23 |     const response = await request.post('/api/workflow/transition', {
  24 |       data: {
  25 |         claimNumber: 'UE-QA-0001',
  26 |         targetStatus: 'under_review',
  27 |         notes: 'QA deterministic transition',
  28 |       },
  29 |     })
  30 | 
  31 |     expect([200, 409, 422]).toContain(response.status())
  32 |   })
  33 | 
  34 |   test('2) unauthorized access attempt is blocked', async ({ request }) => {
  35 |     const response = await request.get('/api/workbench/assigned')
  36 |     assertPermissionDenied(response.status())
  37 |   })
  38 | 
  39 |   test('3) cross-org access attempt is blocked', async ({ request }) => {
  40 |     await loginAsTestUser(request, UE_TEST_USERS.memberPrimary.email)
  41 | 
  42 |     const response = await request.post('/api/workflow/transition', {
  43 |       data: {
  44 |         claimNumber: 'UE-QA-1001',
  45 |         targetStatus: 'under_review',
  46 |         notes: 'Cross-org access attempt',
  47 |       },
  48 |     })
  49 | 
  50 |     await assertNoCrossOrgLeak(response)
  51 |   })
  52 | 
  53 |   test('4) read-only journey blocks mutation', async ({ request }) => {
  54 |     await loginAsTestUser(request, UE_TEST_USERS.memberPrimary.email)
  55 | 
  56 |     const readResponse = await request.get('/api/auth/user-role')
  57 |     expect([200, 401, 403]).toContain(readResponse.status())
  58 | 
  59 |     const mutationResponse = await request.post('/api/workbench/assign', {
  60 |       data: { claimId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2', assignedTo: 'ue-qa-steward-primary' },
  61 |     })
  62 |     assertPermissionDenied(mutationResponse.status())
  63 |   })
  64 | 
  65 |   test('5) intelligence dashboard endpoint is tier-gated', async ({ request }) => {
  66 |     await loginAsTestUser(request, UE_TEST_USERS.stewardPrimary.email)
  67 | 
  68 |     const response = await request.get('/api/cognition/kpis?windowDays=30')
  69 | 
  70 |     assertRoleGatedReadStatus(response.status())
  71 |   })
  72 | 
  73 |   test('6) export audit pack route is role and org constrained', async ({ request }) => {
  74 |     await loginAsTestUser(request, UE_TEST_USERS.memberPrimary.email)
  75 | 
  76 |     const response = await request.get('/api/exports')
  77 | 
  78 |     expect([200, 403, 404]).toContain(response.status())
  79 |   })
  80 | })
  81 | 
```