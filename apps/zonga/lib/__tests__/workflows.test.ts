/**
 * Zonga — Workflow State Machine Tests
 *
 * Tests all 7 Flow-orchestrated workflow state machines for:
 * - Valid transitions succeed
 * - Invalid transitions are rejected
 * - Available transitions computed correctly
 * - Terminal states have no outgoing transitions
 */
import { describe, it, expect } from 'vitest'
import { InvalidTransitionError } from '../workflows/types'
import {
  artistOnboarding,
  releasePublish,
  eventCreation,
  payoutSettlement,
  ticketSale,
  rightsDispute,
  moderation,
} from '../workflows'

// ── Artist Onboarding ────────────────────────────────────────────────────────

describe('artistOnboarding workflow', () => {
  it('validates applied → profile_submitted', () => {
    const r = artistOnboarding.validate('applied', 'profile_submitted')
    expect(r.ok).toBe(true)
    expect(r.auditEvent).toBe('artist_profile_submitted')
  })

  it('rejects applied → active (skip steps)', () => {
    const r = artistOnboarding.validate('applied', 'active')
    expect(r.ok).toBe(false)
  })

  it('attempt throws on invalid transition', () => {
    expect(() => artistOnboarding.attempt('applied', 'active')).toThrow(InvalidTransitionError)
  })

  it('getAvailable from applied returns profile_submitted and rejected', () => {
    const available = artistOnboarding.getAvailable('applied')
    const targets = available.map(t => t.to)
    expect(targets).toContain('profile_submitted')
    expect(targets).toContain('rejected')
  })

  it('terminal states have no exits', () => {
    const rejected = artistOnboarding.getAvailable('rejected')
    expect(rejected).toHaveLength(0)
  })

  it('suspended can be reinstated', () => {
    const r = artistOnboarding.validate('suspended', 'active')
    expect(r.ok).toBe(true)
  })
})

// ── Release Publish ──────────────────────────────────────────────────────────

describe('releasePublish workflow', () => {
  it('validates draft → metadata_complete', () => {
    const r = releasePublish.validate('draft', 'metadata_complete')
    expect(r.ok).toBe(true)
  })

  it('rejects draft → published', () => {
    const r = releasePublish.validate('draft', 'published')
    expect(r.ok).toBe(false)
  })

  it('published has takedown and archive transitions', () => {
    const available = releasePublish.getAvailable('published')
    const targets = available.map(t => t.to)
    expect(targets).toContain('taken_down')
    expect(targets).toContain('archived')
  })

  it('attempt returns ok result for valid transition', () => {
    const r = releasePublish.attempt('draft', 'metadata_complete')
    expect(r.ok).toBe(true)
    expect(r.from).toBe('draft')
    expect(r.to).toBe('metadata_complete')
  })
})

// ── Event Creation ───────────────────────────────────────────────────────────

describe('eventCreation workflow', () => {
  it('validates draft → venue_confirmed', () => {
    const r = eventCreation.validate('draft', 'venue_confirmed')
    expect(r.ok).toBe(true)
  })

  it('cancelled transitions to settling (refunds)', () => {
    const available = eventCreation.getAvailable('cancelled')
    expect(available).toHaveLength(1)
    expect(available[0]!.to).toBe('settling')
  })

  it('getAvailable from draft has multiple options', () => {
    const available = eventCreation.getAvailable('draft')
    expect(available.length).toBeGreaterThanOrEqual(1)
  })
})

// ── Payout Settlement ────────────────────────────────────────────────────────

describe('payoutSettlement workflow', () => {
  it('validates accruing → threshold_reached', () => {
    const r = payoutSettlement.validate('accruing', 'threshold_reached')
    expect(r.ok).toBe(true)
  })

  it('rejects accruing → disbursed (must go through approval)', () => {
    const r = payoutSettlement.validate('accruing', 'disbursed')
    expect(r.ok).toBe(false)
  })

  it('disbursed transitions to reconciled', () => {
    const available = payoutSettlement.getAvailable('disbursed')
    expect(available).toHaveLength(1)
    expect(available[0]!.to).toBe('reconciled')
  })
})

// ── Ticket Sale ──────────────────────────────────────────────────────────────

describe('ticketSale workflow', () => {
  it('validates browsing → selected', () => {
    const r = ticketSale.validate('browsing', 'selected')
    expect(r.ok).toBe(true)
  })

  it('rejects browsing → completed', () => {
    const r = ticketSale.validate('browsing', 'completed')
    expect(r.ok).toBe(false)
  })

  it('confirmed allows refund_requested', () => {
    const r = ticketSale.validate('confirmed', 'refund_requested')
    expect(r.ok).toBe(true)
  })

  it('expired is terminal', () => {
    expect(ticketSale.getAvailable('expired')).toHaveLength(0)
  })
})

// ── Rights Dispute ───────────────────────────────────────────────────────────

describe('rightsDispute workflow', () => {
  it('validates filed → under_review', () => {
    const r = rightsDispute.validate('filed', 'under_review')
    expect(r.ok).toBe(true)
  })

  it('mediation allows mediation_scheduled and escalated', () => {
    const available = rightsDispute.getAvailable('mediation')
    const targets = available.map(t => t.to)
    expect(targets).toContain('mediation_scheduled')
    expect(targets).toContain('escalated')
  })

  it('dismissed is terminal', () => {
    expect(rightsDispute.getAvailable('dismissed')).toHaveLength(0)
  })
})

// ── Content Moderation ───────────────────────────────────────────────────────

describe('contentModeration workflow', () => {
  it('validates submitted → auto_reviewing', () => {
    const r = moderation.validate('submitted', 'auto_reviewing')
    expect(r.ok).toBe(true)
  })

  it('auto_reviewing branches to auto_approved, auto_flagged, auto_rejected', () => {
    const available = moderation.getAvailable('auto_reviewing')
    const targets = available.map(t => t.to)
    expect(targets).toContain('auto_approved')
    expect(targets).toContain('auto_flagged')
    expect(targets).toContain('auto_rejected')
  })

  it('appeal_rejected is terminal', () => {
    expect(moderation.getAvailable('appeal_rejected')).toHaveLength(0)
  })

  it('rejected allows appealed', () => {
    const r = moderation.validate('rejected', 'appealed')
    expect(r.ok).toBe(true)
  })
})
