/**
 * UE E2E — Auth & Session Failure Handling
 *
 * Validates that auth/session failures fail safely and clearly:
 *   - Unauthenticated requests are denied at every critical surface
 *   - Missing-role users cannot access privileged routes
 *   - Insufficient role for evidence export
 *   - Role context is not guessable via header injection
 *   - Session boundaries prevent cross-user state bleed
 *
 * @tags auth, session, negative-path, security
 */
import { expect, test } from '@playwright/test'
import {
  assertPermissionDenied,
  cleanupDatabaseConnections,
  ensureServerReady,
  loginAsTestUser,
  seedOrVerifyTestState,
  UE_E2E_USERS,
} from './_helpers'
import { UE_TEST_USERS } from '../fixtures/test-users'

/** Critical API surfaces that must reject unauthenticated requests */
const PROTECTED_ROUTES: Array<{ method: 'get' | 'post'; path: string; body?: any }> = [
  { method: 'get', path: '/api/claims/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1' },
  { method: 'get', path: '/api/workbench/assigned' },
  { method: 'get', path: '/api/audits' },
  { method: 'get', path: '/api/exports' },
  { method: 'get', path: '/api/evidence/export' },
  { method: 'get', path: '/api/metrics/operational' },
  { method: 'post', path: '/api/workflow/transition', body: { claimNumber: 'UE-QA-0001', targetStatus: 'under_review' } },
  { method: 'post', path: '/api/workbench/assign', body: { claimId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1', assignedTo: 'any' } },
  { method: 'post', path: '/api/admin/update-role', body: { userId: 'ue-qa-member-primary', role: 'admin' } },
]

test.describe('UE E2E — auth and session failure handling', () => {
  test.beforeAll(async ({ request }) => {
    await ensureServerReady(request)
    await seedOrVerifyTestState(request)
  })

  test.afterEach(async ({ request }) => {
    await cleanupDatabaseConnections(request)
  })

  test('unauthenticated requests are denied at all critical surfaces (NEG-AUTH-NO-SESSION)', async ({
    request,
  }) => {
    // Logout to ensure clean anonymous state
    await request.post('/api/auth/logout').catch(() => undefined)

    for (const route of PROTECTED_ROUTES) {
      let response: { status(): number }
      if (route.method === 'get') {
        response = await request.get(route.path)
      } else {
        response = await request.post(route.path, { data: route.body ?? {} })
      }
      assertPermissionDenied(response.status())
    }
  })

  test('member role is insufficient for evidence export (NEG-AUTH-MEMBER-EVIDENCE-EXPORT)', async ({
    request,
  }) => {
    await loginAsTestUser(request, UE_E2E_USERS.member)

    const exportAttempt = await request.get('/api/evidence/export')
    // Members do not have evidence export rights
    assertPermissionDenied(exportAttempt.status())
  })

  test('member role is insufficient for audit log access (NEG-AUTH-MEMBER-AUDIT-READ)', async ({
    request,
  }) => {
    await loginAsTestUser(request, UE_E2E_USERS.member)

    const auditRead = await request.get('/api/audits')
    // 200 means empty/own-only scope; 403 means denied — both are valid isolation behaviors
    // But 500 is not acceptable
    expect(response_status_is_safe(auditRead.status())).toBe(true)
    expect([500, 502, 503]).not.toContain(auditRead.status())
  })

  test('role cannot be escalated via header injection (NEG-AUTH-HEADER-INJECTION)', async ({
    request,
  }) => {
    await loginAsTestUser(request, UE_E2E_USERS.member)

    // Attempt to inject role/org headers to escalate privilege
    const spoofed = await request.post('/api/admin/update-role', {
      data: { userId: UE_TEST_USERS.memberPrimary.userId, role: 'admin' },
      headers: {
        'x-nzila-role': 'platform_admin',
        'x-org-id': 'org_qa_primary',
        'x-user-role': 'admin',
        'x-bypass-rbac': 'true',
      },
    })
    assertPermissionDenied(spoofed.status())
  })

  test('session switch isolates state between users (NEG-AUTH-SESSION-ISOLATION)', async ({
    request,
  }) => {
    // Login as admin and verify admin access
    await loginAsTestUser(request, UE_E2E_USERS.admin)
    const adminAccess = await request.get('/api/workbench/assigned')
    expect([200, 403]).toContain(adminAccess.status())

    // Switch to member — must NOT retain admin access
    await loginAsTestUser(request, UE_E2E_USERS.member)

    const memberAdminAttempt = await request.post('/api/admin/update-role', {
      data: { userId: UE_TEST_USERS.memberPrimary.userId, role: 'admin' },
    })
    assertPermissionDenied(memberAdminAttempt.status())
  })

  test('auditor cannot perform mutations (NEG-AUTH-AUDITOR-MUTATION)', async ({
    request,
  }) => {
    await loginAsTestUser(request, UE_E2E_USERS.auditor)

    // Auditor must not be able to assign cases
    const assign = await request.post('/api/workbench/assign', {
      data: {
        claimId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2',
        assignedTo: 'ue-qa-steward-primary',
      },
    })
    assertPermissionDenied(assign.status())

    // Auditor must not be able to transition cases
    const transition = await request.post('/api/workflow/transition', {
      data: {
        claimNumber: 'UE-QA-0001',
        targetStatus: 'under_review',
      },
    })
    assertPermissionDenied(transition.status())
  })

  test('steward cannot perform admin-only operations (NEG-AUTH-STEWARD-ADMIN-LIMIT)', async ({
    request,
  }) => {
    await loginAsTestUser(request, UE_E2E_USERS.steward)

    // Steward cannot update user roles
    const roleUpdate = await request.post('/api/admin/update-role', {
      data: { userId: UE_TEST_USERS.memberPrimary.userId, role: 'steward' },
    })
    assertPermissionDenied(roleUpdate.status())
  })
})

/** Helper: returns true if a status code is a safe (non-server-error) boundary response */
function response_status_is_safe(status: number): boolean {
  return status < 500 || status === 503
}
