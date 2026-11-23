import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { claimTransitionFacts, type ClaimTransitionFactSource } from '../claim-transition-facts'
import { claimTransitionTarget, validateClaimCaseTransition } from '../claim-transition-policy'

const now = new Date('2026-11-23T12:00:00Z')
const old = new Date('2026-11-14T12:00:00Z')
const claim: ClaimTransitionFactSource = {
  claimId: 'synthetic-case',
  status: 'investigation',
  priority: 'medium',
  assignedTo: 'synthetic-steward',
  description: 'Recorded synthetic investigation narrative.',
  createdAt: old,
  statusChangedAt: old,
  updatedAt: now,
}
beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(now)
})
afterEach(() => vi.useRealTimers())

describe('claim transition facts and real lifecycle validation', () => {
  it('allows a documented, matured investigation to resolve using stored facts', () => {
    expect(validateClaimCaseTransition(claim, 'steward', 'resolved').allowed).toBe(true)
  })
  it('refuses resolution without documentation and accepts the authorized transition reason as documentation', () => {
    const undocumented = { ...claim, description: 'Short' }
    expect(validateClaimCaseTransition(undocumented, 'steward', 'resolved')).toMatchObject({
      allowed: false,
      reason: expect.stringMatching(/documentation/i),
    })
    expect(
      validateClaimCaseTransition(
        undocumented,
        'steward',
        'resolved',
        'Recorded synthetic investigation outcome.',
      ).allowed,
    ).toBe(true)
  })
  it('uses the last status change, even if creation was old enough', () => {
    expect(
      validateClaimCaseTransition({ ...claim, statusChangedAt: now }, 'steward', 'resolved'),
    ).toMatchObject({ allowed: false, reason: expect.stringMatching(/minimum time/i) })
  })
  it('falls back to creation for unknown history without using the last edit', () => {
    const legacy = { ...claim, statusChangedAt: null }
    expect(claimTransitionFacts(legacy).statusChangedAt).toEqual(old)
    expect(validateClaimCaseTransition(legacy, 'steward', 'resolved').allowed).toBe(true)
  })
  it('does not disable elapsed-time guards when both stored dates are unavailable', () => {
    expect(
      validateClaimCaseTransition(
        { ...claim, statusChangedAt: null, createdAt: null },
        'steward',
        'resolved',
      ),
    ).toMatchObject({ allowed: false, reason: expect.stringMatching(/minimum time/i) })
  })
  it('keeps the seven-day closure clock and documented closure policy', () => {
    const resolved = { ...claim, status: 'resolved' }
    expect(validateClaimCaseTransition(resolved, 'admin', 'closed').allowed).toBe(true)
    expect(validateClaimCaseTransition(resolved, 'admin', 'rejected').allowed).toBe(false)
    expect(
      validateClaimCaseTransition({ ...resolved, statusChangedAt: now }, 'admin', 'closed').allowed,
    ).toBe(false)
    expect(
      validateClaimCaseTransition({ ...resolved, description: null }, 'admin', 'closed'),
    ).toMatchObject({ allowed: false, reason: expect.stringMatching(/documentation/i) })
    expect(validateClaimCaseTransition(resolved, 'steward', 'closed').allowed).toBe(true)
  })
  it('maps document waiting directly to pending_docs so a case can return to investigation', () => {
    expect(claimTransitionTarget('response_due')).toBe('pending_documentation')
    expect(validateClaimCaseTransition(claim, 'steward', 'pending_documentation').allowed).toBe(
      true,
    )
    expect(
      validateClaimCaseTransition(
        { ...claim, status: 'pending_documentation' },
        'steward',
        'investigation',
      ).allowed,
    ).toBe(true)
  })
  it('retains supported CUPE request aliases', () => {
    expect(claimTransitionTarget('settled')).toBe('resolved')
    expect(claimTransitionTarget('acknowledged')).toBe('under_review')
    expect(claimTransitionTarget('assigned')).toBe('under_review')
    expect(claimTransitionTarget('withdrawn')).toBe('closed')
  })
  it.each(['arbitration', 'mediation', 'escalated', 'draft', 'toString', '__proto__'])(
    'refuses an unsupported claim target %s instead of persisting another stage',
    (target) => {
      expect(claimTransitionTarget(target)).toBeNull()
    },
  )
  it('does not invent an initial state for an unknown stored state', () => {
    expect(
      validateClaimCaseTransition({ ...claim, status: 'unknown' }, 'admin', 'closed').allowed,
    ).toBe(false)
  })
})
