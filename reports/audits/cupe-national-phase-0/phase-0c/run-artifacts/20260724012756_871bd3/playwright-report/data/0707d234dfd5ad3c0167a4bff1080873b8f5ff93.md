# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: tests\e2e\auth-failure-handling.spec.ts >> UE E2E — auth and session failure handling >> unauthenticated requests are denied at all critical surfaces (NEG-AUTH-NO-SESSION)
- Location: tests\e2e\auth-failure-handling.spec.ts:47:7

# Error details

```
"beforeAll" hook timeout of 60000ms exceeded.
```

# Test source

```ts
  1   | /**
  2   |  * UE E2E — Auth & Session Failure Handling
  3   |  *
  4   |  * Validates that auth/session failures fail safely and clearly:
  5   |  *   - Unauthenticated requests are denied at every critical surface
  6   |  *   - Missing-role users cannot access privileged routes
  7   |  *   - Insufficient role for evidence export
  8   |  *   - Role context is not guessable via header injection
  9   |  *   - Session boundaries prevent cross-user state bleed
  10  |  *
  11  |  * @tags auth, session, negative-path, security
  12  |  */
  13  | import { expect, test } from '@playwright/test'
  14  | import {
  15  |   assertPermissionDenied,
  16  |   cleanupDatabaseConnections,
  17  |   ensureServerReady,
  18  |   loginAsTestUser,
  19  |   seedOrVerifyTestState,
  20  |   UE_E2E_USERS,
  21  | } from './_helpers'
  22  | import { UE_TEST_USERS } from '../fixtures/test-users'
  23  | 
  24  | /** Critical API surfaces that must reject unauthenticated requests */
  25  | const PROTECTED_ROUTES: Array<{ method: 'get' | 'post'; path: string; body?: any }> = [
  26  |   { method: 'get', path: '/api/claims/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1' },
  27  |   { method: 'get', path: '/api/workbench/assigned' },
  28  |   { method: 'get', path: '/api/audits' },
  29  |   { method: 'get', path: '/api/exports' },
  30  |   { method: 'get', path: '/api/evidence/export' },
  31  |   { method: 'get', path: '/api/metrics/operational' },
  32  |   { method: 'post', path: '/api/workflow/transition', body: { claimNumber: 'UE-QA-0001', targetStatus: 'under_review' } },
  33  |   { method: 'post', path: '/api/workbench/assign', body: { claimId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1', assignedTo: 'any' } },
  34  |   { method: 'post', path: '/api/admin/update-role', body: { userId: 'ue-qa-member-primary', role: 'admin' } },
  35  | ]
  36  | 
  37  | test.describe('UE E2E — auth and session failure handling', () => {
> 38  |   test.beforeAll(async ({ request }) => {
      |        ^ "beforeAll" hook timeout of 60000ms exceeded.
  39  |     await ensureServerReady(request)
  40  |     await seedOrVerifyTestState(request)
  41  |   })
  42  | 
  43  |   test.afterEach(async ({ request }) => {
  44  |     await cleanupDatabaseConnections(request)
  45  |   })
  46  | 
  47  |   test('unauthenticated requests are denied at all critical surfaces (NEG-AUTH-NO-SESSION)', async ({
  48  |     request,
  49  |   }) => {
  50  |     // Logout to ensure clean anonymous state
  51  |     await request.post('/api/auth/logout').catch(() => undefined)
  52  | 
  53  |     for (const route of PROTECTED_ROUTES) {
  54  |       let response: { status(): number }
  55  |       if (route.method === 'get') {
  56  |         response = await request.get(route.path)
  57  |       } else {
  58  |         response = await request.post(route.path, { data: route.body ?? {} })
  59  |       }
  60  |       assertPermissionDenied(response.status())
  61  |     }
  62  |   })
  63  | 
  64  |   test('member role is insufficient for evidence export (NEG-AUTH-MEMBER-EVIDENCE-EXPORT)', async ({
  65  |     request,
  66  |   }) => {
  67  |     await loginAsTestUser(request, UE_E2E_USERS.member)
  68  | 
  69  |     const exportAttempt = await request.get('/api/evidence/export')
  70  |     // Members do not have evidence export rights
  71  |     assertPermissionDenied(exportAttempt.status())
  72  |   })
  73  | 
  74  |   test('member role is insufficient for audit log access (NEG-AUTH-MEMBER-AUDIT-READ)', async ({
  75  |     request,
  76  |   }) => {
  77  |     await loginAsTestUser(request, UE_E2E_USERS.member)
  78  | 
  79  |     const auditRead = await request.get('/api/audits')
  80  |     // 200 means empty/own-only scope; 403 means denied — both are valid isolation behaviors
  81  |     // But 500 is not acceptable
  82  |     expect(response_status_is_safe(auditRead.status())).toBe(true)
  83  |     expect([500, 502, 503]).not.toContain(auditRead.status())
  84  |   })
  85  | 
  86  |   test('role cannot be escalated via header injection (NEG-AUTH-HEADER-INJECTION)', async ({
  87  |     request,
  88  |   }) => {
  89  |     await loginAsTestUser(request, UE_E2E_USERS.member)
  90  | 
  91  |     // Attempt to inject role/org headers to escalate privilege
  92  |     const spoofed = await request.post('/api/admin/update-role', {
  93  |       data: { userId: UE_TEST_USERS.memberPrimary.userId, role: 'admin' },
  94  |       headers: {
  95  |         'x-nzila-role': 'platform_admin',
  96  |         'x-org-id': 'org_qa_primary',
  97  |         'x-user-role': 'admin',
  98  |         'x-bypass-rbac': 'true',
  99  |       },
  100 |     })
  101 |     assertPermissionDenied(spoofed.status())
  102 |   })
  103 | 
  104 |   test('session switch isolates state between users (NEG-AUTH-SESSION-ISOLATION)', async ({
  105 |     request,
  106 |   }) => {
  107 |     // Login as admin and verify admin access
  108 |     await loginAsTestUser(request, UE_E2E_USERS.admin)
  109 |     const adminAccess = await request.get('/api/workbench/assigned')
  110 |     expect([200, 403]).toContain(adminAccess.status())
  111 | 
  112 |     // Switch to member — must NOT retain admin access
  113 |     await loginAsTestUser(request, UE_E2E_USERS.member)
  114 | 
  115 |     const memberAdminAttempt = await request.post('/api/admin/update-role', {
  116 |       data: { userId: UE_TEST_USERS.memberPrimary.userId, role: 'admin' },
  117 |     })
  118 |     assertPermissionDenied(memberAdminAttempt.status())
  119 |   })
  120 | 
  121 |   test('auditor cannot perform mutations (NEG-AUTH-AUDITOR-MUTATION)', async ({
  122 |     request,
  123 |   }) => {
  124 |     await loginAsTestUser(request, UE_E2E_USERS.auditor)
  125 | 
  126 |     // Auditor must not be able to assign cases
  127 |     const assign = await request.post('/api/workbench/assign', {
  128 |       data: {
  129 |         claimId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2',
  130 |         assignedTo: 'ue-qa-steward-primary',
  131 |       },
  132 |     })
  133 |     assertPermissionDenied(assign.status())
  134 | 
  135 |     // Auditor must not be able to transition cases
  136 |     const transition = await request.post('/api/workflow/transition', {
  137 |       data: {
  138 |         claimNumber: 'UE-QA-0001',
```