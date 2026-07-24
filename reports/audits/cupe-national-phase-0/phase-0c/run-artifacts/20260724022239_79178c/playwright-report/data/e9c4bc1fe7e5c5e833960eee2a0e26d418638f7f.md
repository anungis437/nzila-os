# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: tests\e2e\org-isolation-negative.spec.ts >> UE E2E — org isolation negative paths >> wrong-org user cannot lookup primary-org grievance by claim number (NEG-ORG-CLAIM-LOOKUP)
- Location: tests\e2e\org-isolation-negative.spec.ts:42:7

# Error details

```
"beforeAll" hook timeout of 60000ms exceeded.
```

# Test source

```ts
  1   | /**
  2   |  * UE E2E — Org Isolation Negative Tests
  3   |  *
  4   |  * Validates that org A cannot see org B data through any vector:
  5   |  *   - Direct grievance ID lookup across orgs
  6   |  *   - Evidence/document access across orgs
  7   |  *   - Universal search leakage
  8   |  *   - Dashboard metrics isolation
  9   |  *   - Evidence export isolation
  10  |  *   - Audit log access isolation
  11  |  *   - Workbench case list isolation
  12  |  *
  13  |  * These tests run as `wrongOrg` user (memberSecondary — belongs to org_qa_secondary).
  14  |  * All primary-org case IDs (UE-QA-*, aaaaaaaa-*) must be invisible or denied.
  15  |  *
  16  |  * @tags org-isolation, negative-path, security
  17  |  */
  18  | import { expect, test } from '@playwright/test'
  19  | import {
  20  |   assertNoCrossOrgLeak,
  21  |   cleanupDatabaseConnections,
  22  |   ensureServerReady,
  23  |   loginAsTestUser,
  24  |   seedOrVerifyTestState,
  25  |   UE_E2E_USERS,
  26  | } from './_helpers'
  27  | 
  28  | // Primary-org case IDs that must never be accessible to wrong-org users
  29  | const PRIMARY_CASE_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1'
  30  | const PRIMARY_CASE_NUMBER = 'UE-QA-0001'
  31  | 
  32  | test.describe('UE E2E — org isolation negative paths', () => {
> 33  |   test.beforeAll(async ({ request }) => {
      |        ^ "beforeAll" hook timeout of 60000ms exceeded.
  34  |     await ensureServerReady(request)
  35  |     await seedOrVerifyTestState(request)
  36  |   })
  37  | 
  38  |   test.afterEach(async ({ request }) => {
  39  |     await cleanupDatabaseConnections(request)
  40  |   })
  41  | 
  42  |   test('wrong-org user cannot lookup primary-org grievance by claim number (NEG-ORG-CLAIM-LOOKUP)', async ({
  43  |     request,
  44  |   }) => {
  45  |     await loginAsTestUser(request, UE_E2E_USERS.wrongOrg)
  46  | 
  47  |     const lookup = await request.get(`/api/claims/${PRIMARY_CASE_ID}`)
  48  |     await assertNoCrossOrgLeak(lookup)
  49  |   })
  50  | 
  51  |   test('wrong-org user cannot view documents/evidence for primary-org case (NEG-ORG-EVIDENCE-READ)', async ({
  52  |     request,
  53  |   }) => {
  54  |     await loginAsTestUser(request, UE_E2E_USERS.wrongOrg)
  55  | 
  56  |     const docs = await request.get(`/api/claims/${PRIMARY_CASE_ID}/documents`)
  57  |     await assertNoCrossOrgLeak(docs)
  58  |   })
  59  | 
  60  |   test('wrong-org user cannot export evidence for primary-org case (NEG-ORG-EXPORT)', async ({
  61  |     request,
  62  |   }) => {
  63  |     await loginAsTestUser(request, UE_E2E_USERS.wrongOrg)
  64  | 
  65  |     const exportAttempt = await request.get(`/api/evidence/export?caseId=${PRIMARY_CASE_ID}`)
  66  |     await assertNoCrossOrgLeak(exportAttempt)
  67  | 
  68  |     // Also check the bulk export endpoint
  69  |     const bulkExport = await request.get('/api/exports')
  70  |     await assertNoCrossOrgLeak(bulkExport)
  71  |   })
  72  | 
  73  |   test('universal search cannot return primary-org records to wrong-org user (NEG-ORG-SEARCH-LEAKAGE)', async ({
  74  |     request,
  75  |   }) => {
  76  |     await loginAsTestUser(request, UE_E2E_USERS.wrongOrg)
  77  | 
  78  |     // Search by primary-org claim number — must return no results or 403
  79  |     const search = await request.get(
  80  |       `/api/search?q=${encodeURIComponent(PRIMARY_CASE_NUMBER)}`,
  81  |     )
  82  | 
  83  |     if (search.status() === 200) {
  84  |       const body = await search.text()
  85  |       // Results must not contain primary-org identifiers
  86  |       expect(body).not.toMatch(/UE-QA-0001|UE-QA-0002|aaaaaaaa-aaaa/i)
  87  |       expect(body).not.toMatch(/qa-primary|primary-member|steward-primary/i)
  88  |     } else {
  89  |       // 401/403/404 are all acceptable — isolation is maintained either way
  90  |       expect([401, 403, 404]).toContain(search.status())
  91  |     }
  92  |   })
  93  | 
  94  |   test('dashboard metrics do not expose primary-org aggregate data to wrong-org user (NEG-ORG-DASHBOARD-METRICS)', async ({
  95  |     request,
  96  |   }) => {
  97  |     await loginAsTestUser(request, UE_E2E_USERS.wrongOrg)
  98  | 
  99  |     const metrics = await request.get('/api/metrics/operational')
  100 | 
  101 |     if (metrics.status() === 200) {
  102 |       const payload = (await metrics.json()) as Record<string, unknown>
  103 |       // The metrics response must be scoped — it should not report primary-org's case volume
  104 |       // (we can't know exact numbers, but we can assert no cross-org identifiers leak through)
  105 |       const text = JSON.stringify(payload)
  106 |       expect(text).not.toMatch(/org_qa_primary|qa-primary-org/i)
  107 |     } else {
  108 |       expect([401, 403]).toContain(metrics.status())
  109 |     }
  110 |   })
  111 | 
  112 |   test('audit log cannot be read by wrong-org user (NEG-ORG-AUDIT-READ)', async ({
  113 |     request,
  114 |   }) => {
  115 |     await loginAsTestUser(request, UE_E2E_USERS.wrongOrg)
  116 | 
  117 |     const auditCase = await request.get(`/api/audit/cases/${PRIMARY_CASE_ID}`)
  118 |     await assertNoCrossOrgLeak(auditCase)
  119 | 
  120 |     const auditGeneral = await request.get('/api/audits')
  121 |     // Audits must either be forbidden or return only wrong-org's own events
  122 |     expect([401, 403, 404, 200]).toContain(auditGeneral.status())
  123 |     if (auditGeneral.status() === 200) {
  124 |       const text = await auditGeneral.text()
  125 |       expect(text).not.toMatch(/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1/i)
  126 |     }
  127 |   })
  128 | 
  129 |   test('workbench case list does not include primary-org cases for wrong-org user (NEG-ORG-WORKBENCH)', async ({
  130 |     request,
  131 |   }) => {
  132 |     await loginAsTestUser(request, UE_E2E_USERS.wrongOrg)
  133 | 
```