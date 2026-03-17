/**
 * Integration Tests — Staging Hardening
 *
 * Covers:
 * 1. Claim intake (submitted state)
 * 2. Workflow transition guards (FSM enforcement)
 * 3. Assignment validation
 * 4. SLA timer calculations
 * 5. Event emission on transitions
 */
import { describe, it, expect } from 'vitest'
import {
  validateClaimTransition,
  getAllowedClaimTransitions,
  CLAIM_SLA_STANDARDS,
  type ClaimTransitionContext,
  type ClaimStatus,
} from '@/lib/services/claim-workflow-fsm'

// ─── Helpers ────────────────────────────────────────────

function makeContext(
  overrides: Partial<ClaimTransitionContext>,
): ClaimTransitionContext {
  return {
    claimId: 'test-claim-001',
    currentStatus: 'submitted',
    targetStatus: 'under_review',
    userId: 'steward-001',
    userRole: 'steward',
    priority: 'medium',
    statusChangedAt: new Date(Date.now() - 48 * 60 * 60 * 1000), // 2 days ago
    hasUnresolvedCriticalSignals: false,
    hasRequiredDocumentation: true,
    ...overrides,
  }
}

// ─── 1. Claim Intake ────────────────────────────────────

describe('Claim Intake', () => {
  it('submitted is a valid initial state', () => {
    const allowed = getAllowedClaimTransitions('submitted', 'steward')
    expect(allowed.length).toBeGreaterThan(0)
    expect(allowed).toContain('under_review')
  })

  it('submitted → under_review is allowed for steward', () => {
    const result = validateClaimTransition(
      makeContext({
        currentStatus: 'submitted',
        targetStatus: 'under_review',
        userRole: 'steward',
      }),
    )
    expect(result.allowed).toBe(true)
  })

  it('submitted → under_review is allowed for admin', () => {
    const result = validateClaimTransition(
      makeContext({
        currentStatus: 'submitted',
        targetStatus: 'under_review',
        userRole: 'admin',
      }),
    )
    expect(result.allowed).toBe(true)
  })

  it('submitted → under_review is NOT allowed for member', () => {
    const result = validateClaimTransition(
      makeContext({
        currentStatus: 'submitted',
        targetStatus: 'under_review',
        userRole: 'member',
      }),
    )
    expect(result.allowed).toBe(false)
    expect(result.reason).toContain('not authorized')
  })
})

// ─── 2. Workflow Transition Guards ──────────────────────

describe('Workflow Transition Guards', () => {
  it('OPEN → RESOLVED is disallowed (must go through review)', () => {
    const result = validateClaimTransition(
      makeContext({
        currentStatus: 'submitted',
        targetStatus: 'resolved',
        userRole: 'admin',
      }),
    )
    expect(result.allowed).toBe(false)
    expect(result.reason).toContain('Invalid transition')
  })

  it('submitted → closed is disallowed', () => {
    const result = validateClaimTransition(
      makeContext({
        currentStatus: 'submitted',
        targetStatus: 'closed',
        userRole: 'admin',
      }),
    )
    expect(result.allowed).toBe(false)
  })

  it('under_review → investigation is allowed for steward', () => {
    const result = validateClaimTransition(
      makeContext({
        currentStatus: 'under_review',
        targetStatus: 'investigation',
        userRole: 'steward',
        statusChangedAt: new Date(Date.now() - 48 * 60 * 60 * 1000), // past min time
      }),
    )
    expect(result.allowed).toBe(true)
  })

  it('under_review → investigation is blocked if min time not elapsed', () => {
    const result = validateClaimTransition(
      makeContext({
        currentStatus: 'under_review',
        targetStatus: 'investigation',
        userRole: 'steward',
        statusChangedAt: new Date(), // just now — 24h minimum not met
      }),
    )
    expect(result.allowed).toBe(false)
    expect(result.reason).toContain('minimum duration')
  })

  it('resolved → closed requires admin/system', () => {
    const result = validateClaimTransition(
      makeContext({
        currentStatus: 'resolved',
        targetStatus: 'closed',
        userRole: 'steward',
        statusChangedAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
      }),
    )
    expect(result.allowed).toBe(false)
    expect(result.reason).toContain('not authorized')
  })

  it('resolved → closed blocks on critical signals', () => {
    const result = validateClaimTransition(
      makeContext({
        currentStatus: 'resolved',
        targetStatus: 'closed',
        userRole: 'admin',
        statusChangedAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
        hasUnresolvedCriticalSignals: true,
      }),
    )
    expect(result.allowed).toBe(false)
    expect(result.reason).toContain('critical signals')
  })

  it('closed is terminal — no transitions allowed', () => {
    const allowed = getAllowedClaimTransitions('closed', 'admin')
    expect(allowed).toHaveLength(0)
  })

  it('full valid lifecycle: submitted → under_review → investigation → resolved → closed', () => {
    const transitions: [ClaimStatus, ClaimStatus][] = [
      ['submitted', 'under_review'],
      ['under_review', 'investigation'],
      ['investigation', 'resolved'],
      ['resolved', 'closed'],
    ]

    for (const [from, to] of transitions) {
      const allowed = getAllowedClaimTransitions(from, 'admin')
      expect(allowed).toContain(to)
    }
  })
})

// ─── 3. Assignment ──────────────────────────────────────

describe('Assignment Validation', () => {
  it('submitted → assigned is allowed for steward', () => {
    const result = validateClaimTransition(
      makeContext({
        currentStatus: 'submitted',
        targetStatus: 'assigned',
        userRole: 'steward',
      }),
    )
    expect(result.allowed).toBe(true)
  })

  it('assigned → investigation is allowed', () => {
    const result = validateClaimTransition(
      makeContext({
        currentStatus: 'assigned',
        targetStatus: 'investigation',
        userRole: 'steward',
      }),
    )
    expect(result.allowed).toBe(true)
  })

  it('assigned → under_review requires admin', () => {
    const stewardResult = validateClaimTransition(
      makeContext({
        currentStatus: 'assigned',
        targetStatus: 'under_review',
        userRole: 'steward',
      }),
    )
    expect(stewardResult.allowed).toBe(false)

    const adminResult = validateClaimTransition(
      makeContext({
        currentStatus: 'assigned',
        targetStatus: 'under_review',
        userRole: 'admin',
      }),
    )
    expect(adminResult.allowed).toBe(true)
  })
})

// ─── 4. SLA Timer ───────────────────────────────────────

describe('SLA Timer', () => {
  it('has SLA standards for all non-closed states', () => {
    const states: ClaimStatus[] = [
      'submitted',
      'under_review',
      'assigned',
      'investigation',
      'pending_documentation',
      'resolved',
      'rejected',
    ]
    for (const s of states) {
      expect(CLAIM_SLA_STANDARDS[s]).toBeGreaterThan(0)
    }
  })

  it('closed state has zero SLA', () => {
    expect(CLAIM_SLA_STANDARDS.closed).toBe(0)
  })

  it('submitted SLA is 48 hours (2 days)', () => {
    expect(CLAIM_SLA_STANDARDS.submitted).toBe(48)
  })

  it('investigation SLA is 240 hours (10 days)', () => {
    expect(CLAIM_SLA_STANDARDS.investigation).toBe(240)
  })

  it('transition result includes SLA metadata', () => {
    const result = validateClaimTransition(
      makeContext({
        currentStatus: 'submitted',
        targetStatus: 'under_review',
        userRole: 'steward',
      }),
    )
    expect(result.allowed).toBe(true)
    expect(result.metadata).toBeDefined()
    expect(result.metadata?.slaCompliant).toBeDefined()
    expect(typeof result.metadata?.daysInState).toBe('number')
  })

  it('flags SLA non-compliance when overdue', () => {
    const result = validateClaimTransition(
      makeContext({
        currentStatus: 'submitted',
        targetStatus: 'under_review',
        userRole: 'steward',
        // Set statusChangedAt far in the past to exceed SLA
        statusChangedAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
      }),
    )
    expect(result.allowed).toBe(true)
    // Transition is still allowed but should show SLA non-compliance
    expect(result.metadata?.slaCompliant).toBe(false)
  })
})

// ─── 5. Event Emission Structure ────────────────────────

describe('Event Bus Integration', () => {
  it('EventBus can be imported', async () => {
    const { eventBus } = await import('@/lib/events/event-bus')
    expect(eventBus).toBeDefined()
    expect(typeof eventBus.emit).toBe('function')
    expect(typeof eventBus.on).toBe('function')
  })

  it('EventBus handles claim_events subscriptions', async () => {
    const { eventBus } = await import('@/lib/events/event-bus')
    const received: unknown[] = []
    const unsub = eventBus.on('claim_events', (event) => {
      received.push(event.data)
    })

    eventBus.emit('claim_events', {
      claim_id: 'test-123',
      event_type: 'transition:submitted→under_review',
      actor: 'steward-001',
      timestamp: new Date().toISOString(),
      payload: { previousStatus: 'submitted', newStatus: 'under_review' },
    })

    // Fire-and-forget — handler runs async but in-memory is synchronous-ish
    await new Promise((r) => setTimeout(r, 50))

    expect(received.length).toBe(1)
    expect((received[0] as Record<string, unknown>).claim_id).toBe('test-123')

    unsub()
  })
})
