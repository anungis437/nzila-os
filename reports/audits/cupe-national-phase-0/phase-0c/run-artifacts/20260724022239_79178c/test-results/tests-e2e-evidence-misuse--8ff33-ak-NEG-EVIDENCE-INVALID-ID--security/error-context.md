# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: tests\e2e\evidence-misuse.spec.ts >> UE E2E — evidence misuse and access control >> invalid evidence ID returns safe error — no server crash or data leak (NEG-EVIDENCE-INVALID-ID)
- Location: tests\e2e\evidence-misuse.spec.ts:39:7

# Error details

```
"beforeAll" hook timeout of 60000ms exceeded.
```

# Test source

```ts
  1   | /**
  2   |  * UE E2E — Evidence Misuse & Access Control
  3   |  *
  4   |  * Validates that evidence access control is properly enforced:
  5   |  *   - Invalid evidence ID returns safe error (no info leakage)
  6   |  *   - Cross-org evidence request is denied
  7   |  *   - Evidence export without permission is denied
  8   |  *   - Evidence export structure is audit-safe (no internal metadata leakage)
  9   |  *   - Evidence cannot be deleted by non-admin
  10  |  *   - Evidence upload is role-gated
  11  |  *
  12  |  * @tags evidence, access-control, negative-path, security
  13  |  */
  14  | import { expect, test } from '@playwright/test'
  15  | import {
  16  |   assertNoCrossOrgLeak,
  17  |   assertPermissionDenied,
  18  |   cleanupDatabaseConnections,
  19  |   ensureServerReady,
  20  |   loginAsTestUser,
  21  |   seedOrVerifyTestState,
  22  |   UE_E2E_USERS,
  23  | } from './_helpers'
  24  | 
  25  | // Cross-org evidence IDs that must be inaccessible to primary-org users
  26  | const INVALID_EVIDENCE_ID = '00000000-0000-0000-0000-000000000000'
  27  | const PRIMARY_CASE_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1'
  28  | 
  29  | test.describe('UE E2E — evidence misuse and access control', () => {
> 30  |   test.beforeAll(async ({ request }) => {
      |        ^ "beforeAll" hook timeout of 60000ms exceeded.
  31  |     await ensureServerReady(request)
  32  |     await seedOrVerifyTestState(request)
  33  |   })
  34  | 
  35  |   test.afterEach(async ({ request }) => {
  36  |     await cleanupDatabaseConnections(request)
  37  |   })
  38  | 
  39  |   test('invalid evidence ID returns safe error — no server crash or data leak (NEG-EVIDENCE-INVALID-ID)', async ({
  40  |     request,
  41  |   }) => {
  42  |     await loginAsTestUser(request, UE_E2E_USERS.admin)
  43  | 
  44  |     const invalid = await request.get(`/api/claims/${INVALID_EVIDENCE_ID}/documents`)
  45  | 
  46  |     // Must not return 500 — must be a safe 404 or auth boundary
  47  |     expect([401, 403, 404]).toContain(invalid.status())
  48  |     expect([500, 502, 503]).not.toContain(invalid.status())
  49  |   })
  50  | 
  51  |   test('cross-org evidence request is denied (NEG-EVIDENCE-CROSS-ORG)', async ({
  52  |     request,
  53  |   }) => {
  54  |     await loginAsTestUser(request, UE_E2E_USERS.wrongOrg)
  55  | 
  56  |     // Try to access a document from the primary org's case
  57  |     const crossOrgDocs = await request.get(`/api/claims/${PRIMARY_CASE_ID}/documents`)
  58  |     await assertNoCrossOrgLeak(crossOrgDocs)
  59  | 
  60  |     // Try to access evidence export for primary-org case
  61  |     const crossOrgExport = await request.get(
  62  |       `/api/evidence/export?caseId=${PRIMARY_CASE_ID}`,
  63  |     )
  64  |     await assertNoCrossOrgLeak(crossOrgExport)
  65  |   })
  66  | 
  67  |   test('member cannot export evidence (insufficient role) (NEG-EVIDENCE-MEMBER-EXPORT)', async ({
  68  |     request,
  69  |   }) => {
  70  |     await loginAsTestUser(request, UE_E2E_USERS.member)
  71  | 
  72  |     const exportAttempt = await request.get('/api/evidence/export')
  73  |     assertPermissionDenied(exportAttempt.status())
  74  | 
  75  |     // Also try case-specific export
  76  |     const caseExport = await request.get(`/api/evidence/export?caseId=${PRIMARY_CASE_ID}`)
  77  |     assertPermissionDenied(caseExport.status())
  78  |   })
  79  | 
  80  |   test('authorized evidence export returns audit-safe structure only (NEG-EVIDENCE-EXPORT-SHAPE)', async ({
  81  |     request,
  82  |   }) => {
  83  |     await loginAsTestUser(request, UE_E2E_USERS.admin)
  84  | 
  85  |     const exportResponse = await request.get('/api/evidence/export')
  86  | 
  87  |     if (exportResponse.status() === 200) {
  88  |       const payload = (await exportResponse.json()) as Record<string, unknown>
  89  |       const text = JSON.stringify(payload)
  90  | 
  91  |       // Must not expose internal infrastructure identifiers
  92  |       expect(text).not.toMatch(/postgresql:\/\/|neon\.tech|supabase\.co/i)
  93  |       // Must not expose raw connection strings or secrets
  94  |       expect(text).not.toMatch(/password=|secret_key|CLERK_SECRET/i)
  95  |       // Must have at least a generated_at or timestamp field (evidence chain requires it)
  96  |       const hasTimestamp =
  97  |         'generated_at' in payload ||
  98  |         'generatedAt' in payload ||
  99  |         'timestamp' in payload ||
  100 |         'sealed_at' in payload
  101 |       expect(hasTimestamp, 'Evidence export must include a timestamp field').toBe(true)
  102 |     } else {
  103 |       // 404 (no evidence yet) or 401/403 are acceptable
  104 |       expect([401, 403, 404]).toContain(exportResponse.status())
  105 |     }
  106 |   })
  107 | 
  108 |   test('member cannot delete evidence (NEG-EVIDENCE-MEMBER-DELETE)', async ({
  109 |     request,
  110 |   }) => {
  111 |     await loginAsTestUser(request, UE_E2E_USERS.member)
  112 | 
  113 |     const deleteAttempt = await request.delete(
  114 |       `/api/claims/${PRIMARY_CASE_ID}/documents/${INVALID_EVIDENCE_ID}`,
  115 |     )
  116 |     assertPermissionDenied(deleteAttempt.status())
  117 |   })
  118 | 
  119 |   test('evidence upload without session is denied (NEG-EVIDENCE-ANON-UPLOAD)', async ({
  120 |     request,
  121 |   }) => {
  122 |     await request.post('/api/auth/logout').catch(() => undefined)
  123 | 
  124 |     const uploadAttempt = await request.post(`/api/claims/${PRIMARY_CASE_ID}/documents`, {
  125 |       data: { filename: 'malicious.pdf', content: 'fake-content' },
  126 |     })
  127 |     assertPermissionDenied(uploadAttempt.status())
  128 |   })
  129 | 
  130 |   test('evidence governance telemetry does not expose sensitive case content (NEG-EVIDENCE-TELEMETRY-SAFE)', async ({
```