/**
 * UE E2E — Org Isolation Negative Tests
 *
 * Validates that org A cannot see org B data through any vector:
 *   - Direct grievance ID lookup across orgs
 *   - Evidence/document access across orgs
 *   - Universal search leakage
 *   - Dashboard metrics isolation
 *   - Evidence export isolation
 *   - Audit log access isolation
 *   - Workbench case list isolation
 *
 * These tests run as `wrongOrg` user (memberSecondary — belongs to org_qa_secondary).
 * All primary-org case IDs (UE-QA-*, aaaaaaaa-*) must be invisible or denied.
 *
 * @tags org-isolation, negative-path, security
 */
import { expect, test } from '@playwright/test'
import {
  assertNoCrossOrgLeak,
  cleanupDatabaseConnections,
  ensureServerReady,
  loginAsTestUser,
  seedOrVerifyTestState,
  UE_E2E_USERS,
} from './_helpers'

// Primary-org case IDs that must never be accessible to wrong-org users
const PRIMARY_CASE_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1'
const PRIMARY_CASE_NUMBER = 'UE-QA-0001'

test.describe('UE E2E — org isolation negative paths', () => {
  test.beforeAll(async ({ request }) => {
    await ensureServerReady(request)
    await seedOrVerifyTestState(request)
  })

  test.afterEach(async ({ request }) => {
    await cleanupDatabaseConnections(request)
  })

  test('wrong-org user cannot lookup primary-org grievance by claim number (NEG-ORG-CLAIM-LOOKUP)', async ({
    request,
  }) => {
    await loginAsTestUser(request, UE_E2E_USERS.wrongOrg)

    const lookup = await request.get(`/api/claims/${PRIMARY_CASE_ID}`)
    await assertNoCrossOrgLeak(lookup)
  })

  test('wrong-org user cannot view documents/evidence for primary-org case (NEG-ORG-EVIDENCE-READ)', async ({
    request,
  }) => {
    await loginAsTestUser(request, UE_E2E_USERS.wrongOrg)

    const docs = await request.get(`/api/claims/${PRIMARY_CASE_ID}/documents`)
    await assertNoCrossOrgLeak(docs)
  })

  test('wrong-org user cannot export evidence for primary-org case (NEG-ORG-EXPORT)', async ({
    request,
  }) => {
    await loginAsTestUser(request, UE_E2E_USERS.wrongOrg)

    const exportAttempt = await request.get(`/api/evidence/export?caseId=${PRIMARY_CASE_ID}`)
    await assertNoCrossOrgLeak(exportAttempt)

    // Also check the bulk export endpoint
    const bulkExport = await request.get('/api/exports')
    await assertNoCrossOrgLeak(bulkExport)
  })

  test('universal search cannot return primary-org records to wrong-org user (NEG-ORG-SEARCH-LEAKAGE)', async ({
    request,
  }) => {
    await loginAsTestUser(request, UE_E2E_USERS.wrongOrg)

    // Search by primary-org claim number — must return no results or 403
    const search = await request.get(
      `/api/search?q=${encodeURIComponent(PRIMARY_CASE_NUMBER)}`,
    )

    if (search.status() === 200) {
      const body = await search.text()
      // Results must not contain primary-org identifiers
      expect(body).not.toMatch(/UE-QA-0001|UE-QA-0002|aaaaaaaa-aaaa/i)
      expect(body).not.toMatch(/qa-primary|primary-member|steward-primary/i)
    } else {
      // 401/403/404 are all acceptable — isolation is maintained either way
      expect([401, 403, 404]).toContain(search.status())
    }
  })

  test('dashboard metrics do not expose primary-org aggregate data to wrong-org user (NEG-ORG-DASHBOARD-METRICS)', async ({
    request,
  }) => {
    await loginAsTestUser(request, UE_E2E_USERS.wrongOrg)

    const metrics = await request.get('/api/metrics/operational')

    if (metrics.status() === 200) {
      const payload = (await metrics.json()) as Record<string, unknown>
      // The metrics response must be scoped — it should not report primary-org's case volume
      // (we can't know exact numbers, but we can assert no cross-org identifiers leak through)
      const text = JSON.stringify(payload)
      expect(text).not.toMatch(/org_qa_primary|qa-primary-org/i)
    } else {
      expect([401, 403]).toContain(metrics.status())
    }
  })

  test('audit log cannot be read by wrong-org user (NEG-ORG-AUDIT-READ)', async ({
    request,
  }) => {
    await loginAsTestUser(request, UE_E2E_USERS.wrongOrg)

    const auditCase = await request.get(`/api/audit/cases/${PRIMARY_CASE_ID}`)
    await assertNoCrossOrgLeak(auditCase)

    const auditGeneral = await request.get('/api/audits')
    // Audits must either be forbidden or return only wrong-org's own events
    expect([401, 403, 404, 200]).toContain(auditGeneral.status())
    if (auditGeneral.status() === 200) {
      const text = await auditGeneral.text()
      expect(text).not.toMatch(/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1/i)
    }
  })

  test('workbench case list does not include primary-org cases for wrong-org user (NEG-ORG-WORKBENCH)', async ({
    request,
  }) => {
    await loginAsTestUser(request, UE_E2E_USERS.wrongOrg)

    const workbench = await request.get('/api/workbench/assigned')
    expect([200, 401, 403]).toContain(workbench.status())

    if (workbench.status() === 200) {
      const text = await workbench.text()
      expect(text).not.toMatch(/UE-QA-0001|UE-QA-0002|aaaaaaaa-aaaa-4aaa/i)
    }
  })

  test('workflow transition on primary-org case is denied to wrong-org user (NEG-ORG-WORKFLOW-MUTATION)', async ({
    request,
  }) => {
    await loginAsTestUser(request, UE_E2E_USERS.wrongOrg)

    const transition = await request.post('/api/workflow/transition', {
      data: {
        claimNumber: PRIMARY_CASE_NUMBER,
        targetStatus: 'under_review',
      },
    })
    await assertNoCrossOrgLeak(transition)
  })
})
