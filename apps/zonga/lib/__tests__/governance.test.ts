/**
 * Zonga — Governance Gate Tests
 *
 * Tests all governance gate evaluators for payouts, releases,
 * events, and creator suspension.
 */
import { describe, it, expect } from 'vitest'
import type { PayoutEntity, ReleaseEntity, EventEntity, CreatorEntity } from '../governance'
import {
  resolveZongaPolicy,
  evaluatePayoutMinimumGate,
  evaluatePayoutApprovalGate,
  evaluatePayoutEvidenceGate,
  evaluatePayoutDisputeFreezeGate,
  evaluatePayoutGates,
  evaluateReleasePublishGates,
  evaluateEventPublishGates,
  evaluateCreatorSuspensionGate,
  allGatesPassed,
  failedGates,
} from '../governance'

// ── Helpers ──────────────────────────────────────────────────────────────────

function makePayout(partial?: Partial<PayoutEntity>): PayoutEntity {
  return {
    orgId: 'org-1',
    creatorId: 'creator-1',
    amount: 100,
    currency: 'KES',
    hasApproval: false,
    hasEvidencePack: true,
    pendingDisputeCount: 0,
    ...partial,
  }
}

function makeRelease(partial?: Partial<ReleaseEntity>): ReleaseEntity {
  return {
    orgId: 'org-1',
    hasAudio: true,
    hasCoverArt: true,
    hasMetadata: true,
    hasFinalizedSplits: true,
    pendingIntegritySignals: 0,
    collaboratorCount: 2,
    ...partial,
  }
}

function makeEvent(partial?: Partial<EventEntity>): EventEntity {
  return {
    orgId: 'org-1',
    hasVenue: true,
    hasDate: true,
    ticketTypeCount: 3,
    maxTicketPrice: 500,
    eventDate: '2025-12-01',
    ...partial,
  }
}

function makeCreator(partial?: Partial<CreatorEntity>): CreatorEntity {
  return {
    orgId: 'org-1',
    status: 'active',
    profileComplete: true,
    payoutConfigured: true,
    copyrightStrikeCount: 0,
    ...partial,
  }
}

// ── Policy ───────────────────────────────────────────────────────────────────

describe('resolveZongaPolicy', () => {
  it('returns defaults when no partial is given', () => {
    const policy = resolveZongaPolicy()
    expect(policy.payoutMinimumThreshold).toBe(10)
    expect(policy.payoutApprovalThreshold).toBe(5_000)
    expect(policy.copyrightStrikeLimit).toBe(3)
  })

  it('overrides specific fields', () => {
    const policy = resolveZongaPolicy({ payoutMinimumThreshold: 50 })
    expect(policy.payoutMinimumThreshold).toBe(50)
    expect(policy.payoutApprovalThreshold).toBe(5_000) // still default
  })
})

// ── Payout Gates ─────────────────────────────────────────────────────────────

describe('payout gates', () => {
  it('minimum gate passes when amount meets threshold', () => {
    const result = evaluatePayoutMinimumGate(makePayout({ amount: 100 }))
    expect(result.passed).toBe(true)
  })

  it('minimum gate fails when amount below threshold', () => {
    const result = evaluatePayoutMinimumGate(makePayout({ amount: 5 }))
    expect(result.passed).toBe(false)
    expect(result.reason).toContain('below')
  })

  it('approval gate passes when amount below approval threshold', () => {
    const result = evaluatePayoutApprovalGate(makePayout({ amount: 100 }))
    expect(result.passed).toBe(true)
  })

  it('approval gate requires approval for high-value payouts', () => {
    const result = evaluatePayoutApprovalGate(makePayout({ amount: 10_000, hasApproval: false }))
    expect(result.passed).toBe(false)
    expect(result.reason).toContain('approval required')
  })

  it('approval gate passes with approval for high-value payouts', () => {
    const result = evaluatePayoutApprovalGate(makePayout({ amount: 10_000, hasApproval: true }))
    expect(result.passed).toBe(true)
  })

  it('evidence gate passes when evidence pack attached', () => {
    const result = evaluatePayoutEvidenceGate(makePayout({ hasEvidencePack: true }))
    expect(result.passed).toBe(true)
  })

  it('evidence gate fails when evidence missing', () => {
    const result = evaluatePayoutEvidenceGate(makePayout({ hasEvidencePack: false }))
    expect(result.passed).toBe(false)
  })

  it('evidence gate passes when policy disables evidence requirement', () => {
    const result = evaluatePayoutEvidenceGate(
      makePayout({ hasEvidencePack: false }),
      { requirePayoutEvidence: false },
    )
    expect(result.passed).toBe(true)
  })

  it('dispute freeze gate blocks when disputes pending', () => {
    const result = evaluatePayoutDisputeFreezeGate(makePayout({ pendingDisputeCount: 2 }))
    expect(result.passed).toBe(false)
    expect(result.reason).toContain('dispute')
  })

  it('dispute freeze gate passes with no disputes', () => {
    const result = evaluatePayoutDisputeFreezeGate(makePayout({ pendingDisputeCount: 0 }))
    expect(result.passed).toBe(true)
  })

  it('evaluatePayoutGates runs all gates', () => {
    const results = evaluatePayoutGates(makePayout())
    expect(results).toHaveLength(4)
    expect(allGatesPassed(results)).toBe(true)
  })

  it('evaluatePayoutGates catches failures', () => {
    const results = evaluatePayoutGates(makePayout({ amount: 5, hasEvidencePack: false }))
    expect(allGatesPassed(results)).toBe(false)
    const failed = failedGates(results)
    expect(failed.length).toBeGreaterThanOrEqual(2) // minimum + evidence
  })
})

// ── Release Publish Gates ────────────────────────────────────────────────────

describe('release publish gates', () => {
  it('all pass for complete release', () => {
    const results = evaluateReleasePublishGates(makeRelease())
    expect(allGatesPassed(results)).toBe(true)
  })

  it('fails when audio missing', () => {
    const results = evaluateReleasePublishGates(makeRelease({ hasAudio: false }))
    const failed = failedGates(results)
    expect(failed.some(g => g.gate === 'release_audio_uploaded')).toBe(true)
  })

  it('fails when splits not finalized with collaborators', () => {
    const results = evaluateReleasePublishGates(
      makeRelease({ hasFinalizedSplits: false, collaboratorCount: 3 }),
    )
    const failed = failedGates(results)
    expect(failed.some(g => g.gate === 'release_splits_finalized')).toBe(true)
  })

  it('skips split check for solo release when policy requires splits', () => {
    const results = evaluateReleasePublishGates(
      makeRelease({ hasFinalizedSplits: false, collaboratorCount: 0 }),
    )
    // solo release — no split gate at all
    expect(results.every(r => r.gate !== 'release_splits_finalized')).toBe(true)
  })

  it('fails when integrity signals pending', () => {
    const results = evaluateReleasePublishGates(
      makeRelease({ pendingIntegritySignals: 2 }),
    )
    const failed = failedGates(results)
    expect(failed.some(g => g.gate === 'release_no_pending_signals')).toBe(true)
  })
})

// ── Event Publish Gates ──────────────────────────────────────────────────────

describe('event publish gates', () => {
  it('all pass for complete event', () => {
    const results = evaluateEventPublishGates(makeEvent())
    expect(allGatesPassed(results)).toBe(true)
  })

  it('fails when no venue', () => {
    const results = evaluateEventPublishGates(makeEvent({ hasVenue: false }))
    expect(failedGates(results).some(g => g.gate === 'event_has_venue')).toBe(true)
  })

  it('fails when ticket price exceeds cap', () => {
    const results = evaluateEventPublishGates(makeEvent({ maxTicketPrice: 100_000 }))
    expect(failedGates(results).some(g => g.gate === 'event_ticket_price_cap')).toBe(true)
  })

  it('fails when no ticket types', () => {
    const results = evaluateEventPublishGates(makeEvent({ ticketTypeCount: 0 }))
    expect(failedGates(results).some(g => g.gate === 'event_has_tickets')).toBe(true)
  })
})

// ── Creator Suspension ───────────────────────────────────────────────────────

describe('creator suspension gate', () => {
  it('passes when strikes below limit', () => {
    const result = evaluateCreatorSuspensionGate(makeCreator({ copyrightStrikeCount: 2 }))
    expect(result.passed).toBe(true)
  })

  it('fails when strikes at limit', () => {
    const result = evaluateCreatorSuspensionGate(makeCreator({ copyrightStrikeCount: 3 }))
    expect(result.passed).toBe(false)
    expect(result.reason).toContain('suspension required')
  })

  it('uses custom policy strike limit', () => {
    const result = evaluateCreatorSuspensionGate(
      makeCreator({ copyrightStrikeCount: 5 }),
      { copyrightStrikeLimit: 10 },
    )
    expect(result.passed).toBe(true)
  })
})

// ── Utility Functions ────────────────────────────────────────────────────────

describe('gate utilities', () => {
  it('allGatesPassed returns true when all pass', () => {
    const results = [
      { gate: 'a', passed: true, reason: '' },
      { gate: 'b', passed: true, reason: '' },
    ]
    expect(allGatesPassed(results)).toBe(true)
  })

  it('allGatesPassed returns false when any fails', () => {
    const results = [
      { gate: 'a', passed: true, reason: '' },
      { gate: 'b', passed: false, reason: 'fail' },
    ]
    expect(allGatesPassed(results)).toBe(false)
  })

  it('failedGates returns only failed', () => {
    const results = [
      { gate: 'a', passed: true, reason: '' },
      { gate: 'b', passed: false, reason: 'fail' },
      { gate: 'c', passed: false, reason: 'bad' },
    ]
    expect(failedGates(results)).toHaveLength(2)
  })
})
