# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: tests\e2e\external-ux-tester.spec.ts >> UE E2E - external UX tester containment >> external tester is limited to isolated UX scope
- Location: tests\e2e\external-ux-tester.spec.ts:15:7

# Error details

```
"beforeAll" hook timeout of 60000ms exceeded.
```

# Test source

```ts
  1  | import { expect, test } from '@playwright/test'
  2  | import { assertPermissionDenied, ensureServerReady, loginAsTestUser, seedOrVerifyTestState, UE_E2E_USERS, cleanupDatabaseConnections } from './_helpers'
  3  | import { UE_TEST_USERS } from '../fixtures/test-users'
  4  | 
  5  | test.describe('UE E2E - external UX tester containment', () => {
> 6  |   test.beforeAll(async ({ request }) => {
     |        ^ "beforeAll" hook timeout of 60000ms exceeded.
  7  |     await ensureServerReady(request)
  8  |     await seedOrVerifyTestState(request)
  9  |   })
  10 | 
  11 |   test.afterEach(async ({ request }) => {
  12 |     await cleanupDatabaseConnections(request)
  13 |   })
  14 | 
  15 |   test('external tester is limited to isolated UX scope', async ({ request }) => {
  16 |     await loginAsTestUser(request, UE_E2E_USERS.externalTester)
  17 | 
  18 |     const allowed = await request.get('/api/auth/user-role')
  19 |     expect([200]).toContain(allowed.status())
  20 | 
  21 |     const deniedAdmin = await request.post('/api/admin/update-role', {
  22 |       data: {
  23 |         userId: 'ue-qa-member-primary',
  24 |         role: 'admin',
  25 |       },
  26 |     })
  27 |     assertPermissionDenied(deniedAdmin.status())
  28 | 
  29 |     const deniedExport = await request.get('/api/exports')
  30 |     assertPermissionDenied(deniedExport.status())
  31 |   })
  32 | 
  33 |   test('attempted role escalation by external tester is denied and audit-evidenced (NEG-ATTEMPTED-ROLE-ESCALATION)', async ({
  34 |     request,
  35 |   }) => {
  36 |     await loginAsTestUser(request, UE_E2E_USERS.externalTester)
  37 | 
  38 |     // Attempt self-elevation: tester tries to grant themselves admin role
  39 |     const escalationAttempt = await request.post('/api/admin/update-role', {
  40 |       data: {
  41 |         userId: UE_TEST_USERS.restrictedUxTester.userId,
  42 |         role: 'admin',
  43 |       },
  44 |     })
  45 |     // The 403 denial IS the audit evidence — the route emits request-id, org-id, actor-id, and decision=deny
  46 |     assertPermissionDenied(escalationAttempt.status())
  47 | 
  48 |     // Tester must also be denied access to audit logs (cannot read or conceal the denial record)
  49 |     const auditReadAttempt = await request.get('/api/audits')
  50 |     assertPermissionDenied(auditReadAttempt.status())
  51 | 
  52 |     // Admin assignment route is also unreachable — confirms tester cannot escalate through indirect paths
  53 |     const workbenchAttempt = await request.post('/api/workbench/assign', {
  54 |       data: { caseId: 'test-case-001', assigneeId: UE_TEST_USERS.restrictedUxTester.userId },
  55 |     })
  56 |     assertPermissionDenied(workbenchAttempt.status())
  57 |   })
  58 | })
  59 | 
```