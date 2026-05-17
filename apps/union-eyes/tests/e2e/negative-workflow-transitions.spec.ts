/**
 * UE E2E — Negative Workflow Transition Tests
 *
 * Validates that invalid FSM transitions are structurally blocked,
 * not just UI-gated. Covers:
 *   - triage → resolved (must go via under_review first)
 *   - closed → investigation (must go via explicit reopen)
 *   - arbitration bypass (member cannot self-advance to arbitration)
 *   - member cannot resolve a case directly
 *   - re-submit a closed case (must be rejected)
 *
 * Acceptance: server returns 409/422 for every invalid transition attempt.
 *
 * @tags negative-path, fsm, workflow-invariant
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

test.describe('UE E2E — negative workflow transitions (FSM invariant)', () => {
  test.beforeAll(async ({ request }) => {
    await ensureServerReady(request)
    await seedOrVerifyTestState(request)
  })

  test.afterEach(async ({ request }) => {
    await cleanupDatabaseConnections(request)
  })

  test('triage → resolved is blocked — must go via under_review (NEG-FSM-TRIAGE-DIRECT-RESOLVE)', async ({
    request,
  }) => {
    await loginAsTestUser(request, UE_E2E_USERS.admin)

    // Attempt to jump from triage directly to resolved (skipping under_review)
    const skip = await request.post('/api/workflow/transition', {
      data: {
        claimNumber: 'UE-QA-0001',
        targetStatus: 'resolved',
        notes: 'Attempted triage-to-resolved bypass',
      },
    })

    // Server MUST reject this invalid transition
    expect(
      [400, 409, 422],
      `Expected FSM rejection (409/422) but got ${skip.status()}`,
    ).toContain(skip.status())
  })

  test('closed → investigation is blocked without explicit reopen (NEG-FSM-CLOSED-NO-INVESTIGATION)', async ({
    request,
  }) => {
    await loginAsTestUser(request, UE_E2E_USERS.admin)

    // Close a case first (may already be closed — 409 is acceptable)
    await request.post('/api/workflow/transition', {
      data: {
        claimNumber: 'UE-QA-0003',
        targetStatus: 'resolved',
      },
    })

    // Attempt to move directly from resolved/closed to investigation without reopen step
    const directInvestigation = await request.post('/api/workflow/transition', {
      data: {
        claimNumber: 'UE-QA-0003',
        targetStatus: 'under_investigation',
      },
    })

    expect(
      [400, 409, 422],
      `Closed→investigation bypass must be rejected; got ${directInvestigation.status()}`,
    ).toContain(directInvestigation.status())
  })

  test('member cannot self-advance case to arbitration (NEG-FSM-ARBITRATION-BYPASS)', async ({
    request,
  }) => {
    await loginAsTestUser(request, UE_E2E_USERS.member)

    const arbitrationAttempt = await request.post('/api/workflow/transition', {
      data: {
        claimNumber: 'UE-QA-0001',
        targetStatus: 'arbitration',
        notes: 'Member bypass attempt',
      },
    })

    // Either permission-denied (403) or FSM rejection (409/422)
    expect(
      [400, 401, 403, 409, 422],
      `Member arbitration bypass must be blocked; got ${arbitrationAttempt.status()}`,
    ).toContain(arbitrationAttempt.status())
  })

  test('member cannot directly resolve a case (NEG-FSM-MEMBER-DIRECT-RESOLVE)', async ({
    request,
  }) => {
    await loginAsTestUser(request, UE_E2E_USERS.member)

    const resolve = await request.post('/api/workflow/transition', {
      data: {
        claimNumber: 'UE-QA-0001',
        targetStatus: 'resolved',
      },
    })

    // Must be permission-denied or FSM-rejected
    expect(
      [400, 401, 403, 409, 422],
      `Member direct resolve must be blocked; got ${resolve.status()}`,
    ).toContain(resolve.status())
  })

  test('re-submitting a resolved case without reopen is rejected (NEG-FSM-RESUBMIT-CLOSED)', async ({
    request,
  }) => {
    await loginAsTestUser(request, UE_E2E_USERS.admin)

    // Ensure the case is resolved
    await request.post('/api/workflow/transition', {
      data: {
        claimNumber: 'UE-QA-0002',
        targetStatus: 'resolved',
      },
    })

    // Attempt to re-submit (move back to submitted from resolved)
    const resubmit = await request.post('/api/workflow/transition', {
      data: {
        claimNumber: 'UE-QA-0002',
        targetStatus: 'submitted',
      },
    })

    expect(
      [400, 409, 422],
      `Re-submit of resolved case must be rejected; got ${resubmit.status()}`,
    ).toContain(resubmit.status())
  })

  test('unauthorized user cannot perform any transition (NEG-FSM-UNAUTHORIZED-TRANSITION)', async ({
    request,
  }) => {
    // No login — anonymous request
    const anon = await request.post('/api/workflow/transition', {
      data: {
        claimNumber: 'UE-QA-0001',
        targetStatus: 'under_review',
      },
    })

    assertPermissionDenied(anon.status())
  })
})
