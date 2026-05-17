/**
 * UE E2E — Evidence Misuse & Access Control
 *
 * Validates that evidence access control is properly enforced:
 *   - Invalid evidence ID returns safe error (no info leakage)
 *   - Cross-org evidence request is denied
 *   - Evidence export without permission is denied
 *   - Evidence export structure is audit-safe (no internal metadata leakage)
 *   - Evidence cannot be deleted by non-admin
 *   - Evidence upload is role-gated
 *
 * @tags evidence, access-control, negative-path, security
 */
import { expect, test } from '@playwright/test'
import {
  assertNoCrossOrgLeak,
  assertPermissionDenied,
  cleanupDatabaseConnections,
  ensureServerReady,
  loginAsTestUser,
  seedOrVerifyTestState,
  UE_E2E_USERS,
} from './_helpers'

// Cross-org evidence IDs that must be inaccessible to primary-org users
const CROSS_ORG_CASE_ID = 'aaaaaaaa-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
const INVALID_EVIDENCE_ID = '00000000-0000-0000-0000-000000000000'
const PRIMARY_CASE_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1'

test.describe('UE E2E — evidence misuse and access control', () => {
  test.beforeAll(async ({ request }) => {
    await ensureServerReady(request)
    await seedOrVerifyTestState(request)
  })

  test.afterEach(async ({ request }) => {
    await cleanupDatabaseConnections(request)
  })

  test('invalid evidence ID returns safe error — no server crash or data leak (NEG-EVIDENCE-INVALID-ID)', async ({
    request,
  }) => {
    await loginAsTestUser(request, UE_E2E_USERS.admin)

    const invalid = await request.get(`/api/claims/${INVALID_EVIDENCE_ID}/documents`)

    // Must not return 500 — must be a safe 404 or auth boundary
    expect([401, 403, 404]).toContain(invalid.status())
    expect([500, 502, 503]).not.toContain(invalid.status())
  })

  test('cross-org evidence request is denied (NEG-EVIDENCE-CROSS-ORG)', async ({
    request,
  }) => {
    await loginAsTestUser(request, UE_E2E_USERS.wrongOrg)

    // Try to access a document from the primary org's case
    const crossOrgDocs = await request.get(`/api/claims/${PRIMARY_CASE_ID}/documents`)
    await assertNoCrossOrgLeak(crossOrgDocs)

    // Try to access evidence export for primary-org case
    const crossOrgExport = await request.get(
      `/api/evidence/export?caseId=${PRIMARY_CASE_ID}`,
    )
    await assertNoCrossOrgLeak(crossOrgExport)
  })

  test('member cannot export evidence (insufficient role) (NEG-EVIDENCE-MEMBER-EXPORT)', async ({
    request,
  }) => {
    await loginAsTestUser(request, UE_E2E_USERS.member)

    const exportAttempt = await request.get('/api/evidence/export')
    assertPermissionDenied(exportAttempt.status())

    // Also try case-specific export
    const caseExport = await request.get(`/api/evidence/export?caseId=${PRIMARY_CASE_ID}`)
    assertPermissionDenied(caseExport.status())
  })

  test('authorized evidence export returns audit-safe structure only (NEG-EVIDENCE-EXPORT-SHAPE)', async ({
    request,
  }) => {
    await loginAsTestUser(request, UE_E2E_USERS.admin)

    const exportResponse = await request.get('/api/evidence/export')

    if (exportResponse.status() === 200) {
      const payload = (await exportResponse.json()) as Record<string, unknown>
      const text = JSON.stringify(payload)

      // Must not expose internal infrastructure identifiers
      expect(text).not.toMatch(/postgresql:\/\/|neon\.tech|supabase\.co/i)
      // Must not expose raw connection strings or secrets
      expect(text).not.toMatch(/password=|secret_key|CLERK_SECRET/i)
      // Must have at least a generated_at or timestamp field (evidence chain requires it)
      const hasTimestamp =
        'generated_at' in payload ||
        'generatedAt' in payload ||
        'timestamp' in payload ||
        'sealed_at' in payload
      expect(hasTimestamp, 'Evidence export must include a timestamp field').toBe(true)
    } else {
      // 404 (no evidence yet) or 401/403 are acceptable
      expect([401, 403, 404]).toContain(exportResponse.status())
    }
  })

  test('member cannot delete evidence (NEG-EVIDENCE-MEMBER-DELETE)', async ({
    request,
  }) => {
    await loginAsTestUser(request, UE_E2E_USERS.member)

    const deleteAttempt = await request.delete(
      `/api/claims/${PRIMARY_CASE_ID}/documents/${INVALID_EVIDENCE_ID}`,
    )
    assertPermissionDenied(deleteAttempt.status())
  })

  test('evidence upload without session is denied (NEG-EVIDENCE-ANON-UPLOAD)', async ({
    request,
  }) => {
    await request.post('/api/auth/logout').catch(() => undefined)

    const uploadAttempt = await request.post(`/api/claims/${PRIMARY_CASE_ID}/documents`, {
      data: { filename: 'malicious.pdf', content: 'fake-content' },
    })
    assertPermissionDenied(uploadAttempt.status())
  })

  test('evidence governance telemetry does not expose sensitive case content (NEG-EVIDENCE-TELEMETRY-SAFE)', async ({
    request,
  }) => {
    await loginAsTestUser(request, UE_E2E_USERS.admin)

    const telemetry = await request.get('/api/governance/telemetry')
    expect([200, 401, 403]).toContain(telemetry.status())

    if (telemetry.status() === 200) {
      const payload = (await telemetry.json()) as Record<string, unknown>
      const text = JSON.stringify(payload)

      // Governance telemetry must be aggregate counts, not case content
      expect(text).not.toMatch(/"description"\s*:\s*"[A-Z].*grievance/i)
      expect(text).not.toMatch(/member.*name|worker.*name|complainant/i)
    }
  })
})
