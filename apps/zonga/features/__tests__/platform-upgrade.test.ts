/**
 * Zonga — Platform Upgrade Feature Tests
 *
 * Tests for state machines, fee calculations, validation logic,
 * and type contracts in the new feature modules.
 */
import { describe, it, expect } from 'vitest'

// ── Event State Transitions ─────────────────────────────────────────────────

import { EVENT_TRANSITIONS, TICKET_PLATFORM_FEE_PCT } from '@/features/events/types'
import type { EventLifecycleState } from '@/features/events/types'

describe('Event state transitions', () => {
  it('draft can only transition to published', () => {
    expect(EVENT_TRANSITIONS.draft).toEqual(['published'])
  })

  it('published can transition to on_sale or cancelled', () => {
    expect(EVENT_TRANSITIONS.published).toEqual(['on_sale', 'cancelled'])
  })

  it('on_sale can transition to sold_out, completed, or cancelled', () => {
    expect(EVENT_TRANSITIONS.on_sale).toEqual(['sold_out', 'completed', 'cancelled'])
  })

  it('completed and cancelled are terminal states', () => {
    expect(EVENT_TRANSITIONS.completed).toEqual([])
    expect(EVENT_TRANSITIONS.cancelled).toEqual([])
  })

  it('every declared state has a transition entry', () => {
    const states: EventLifecycleState[] = ['draft', 'published', 'on_sale', 'sold_out', 'completed', 'cancelled']
    for (const s of states) {
      expect(EVENT_TRANSITIONS).toHaveProperty(s)
    }
  })

  it('ticket fee is 5%', () => {
    expect(TICKET_PLATFORM_FEE_PCT).toBe(5.0)
  })
})

// ── Publishing State Machine ────────────────────────────────────────────────

import { PUBLISHING_TRANSITIONS } from '@/features/creator/types'
import type { PublishingState } from '@/features/creator/types'

describe('Publishing state transitions', () => {
  it('draft can transition to processing', () => {
    expect(PUBLISHING_TRANSITIONS.draft).toContain('processing')
  })

  it('ready_for_review can transition to published or back to draft', () => {
    expect(PUBLISHING_TRANSITIONS.ready_for_review).toContain('published')
    expect(PUBLISHING_TRANSITIONS.ready_for_review).toContain('draft')
  })

  it('removed is a terminal state', () => {
    expect(PUBLISHING_TRANSITIONS.removed).toEqual([])
  })

  it('published can be suspended or removed', () => {
    expect(PUBLISHING_TRANSITIONS.published).toContain('suspended')
    expect(PUBLISHING_TRANSITIONS.published).toContain('removed')
  })

  it('all states are declared', () => {
    const states: PublishingState[] = ['draft', 'processing', 'ready_for_review', 'published', 'suspended', 'removed']
    for (const s of states) {
      expect(PUBLISHING_TRANSITIONS).toHaveProperty(s)
    }
  })
})

// ── Platform Fees ───────────────────────────────────────────────────────────

import { PLATFORM_FEE_PCT, MIN_PAYOUT_THRESHOLD, PAYOUT_TRANSITIONS } from '@/features/payouts/types'
import type { PayoutStatus, EarningsSource } from '@/features/payouts/types'

describe('Platform fee configuration', () => {
  it('streaming fee is 30%', () => {
    expect(PLATFORM_FEE_PCT.streaming).toBe(30)
  })

  it('download fee is 20%', () => {
    expect(PLATFORM_FEE_PCT.download).toBe(20)
  })

  it('ticket_sale fee is 5%', () => {
    expect(PLATFORM_FEE_PCT.ticket_sale).toBe(5)
  })

  it('tip fee is 5%', () => {
    expect(PLATFORM_FEE_PCT.tip).toBe(5)
  })

  it('all fee sources have a percentage', () => {
    const sources: EarningsSource[] = ['streaming', 'download', 'ticket_sale', 'subscription_share', 'tip']
    for (const s of sources) {
      const fee = PLATFORM_FEE_PCT[s]
      expect(fee).toBeGreaterThanOrEqual(0)
      expect(fee).toBeLessThanOrEqual(100)
    }
  })
})

describe('Minimum payout thresholds', () => {
  it('USD threshold is $25', () => {
    expect(MIN_PAYOUT_THRESHOLD.USD).toBe(25)
  })

  it('ZAR threshold is R500', () => {
    expect(MIN_PAYOUT_THRESHOLD.ZAR).toBe(500)
  })

  it('NGN threshold is ₦10,000', () => {
    expect(MIN_PAYOUT_THRESHOLD.NGN).toBe(10000)
  })

  it('all thresholds are positive', () => {
    for (const [, threshold] of Object.entries(MIN_PAYOUT_THRESHOLD)) {
      expect(threshold).toBeGreaterThan(0)
    }
  })
})

describe('Payout state transitions', () => {
  it('requested can transition to approved or cancelled', () => {
    expect(PAYOUT_TRANSITIONS.requested).toContain('approved')
    expect(PAYOUT_TRANSITIONS.requested).toContain('cancelled')
  })

  it('approved can transition to processing', () => {
    expect(PAYOUT_TRANSITIONS.approved).toContain('processing')
  })

  it('processing can transition to completed or failed', () => {
    expect(PAYOUT_TRANSITIONS.processing).toContain('completed')
    expect(PAYOUT_TRANSITIONS.processing).toContain('failed')
  })

  it('completed is terminal', () => {
    expect(PAYOUT_TRANSITIONS.completed).toEqual([])
  })

  it('cancelled is terminal', () => {
    expect(PAYOUT_TRANSITIONS.cancelled).toEqual([])
  })

  it('failed can be retried (back to requested)', () => {
    expect(PAYOUT_TRANSITIONS.failed).toContain('requested')
  })

  it('every declared state has a transition entry', () => {
    const states: PayoutStatus[] = ['requested', 'approved', 'processing', 'completed', 'failed', 'cancelled']
    for (const s of states) {
      expect(PAYOUT_TRANSITIONS).toHaveProperty(s)
    }
  })
})

// ── Rights & Takedown State Machines ────────────────────────────────────────

import { TAKEDOWN_TRANSITIONS, CLAIM_TRANSITIONS } from '@/features/rights/types'
import type { TakedownStatus, RightsClaimStatus } from '@/features/rights/types'

describe('Takedown state transitions', () => {
  it('requested can go to under_review or rejected', () => {
    expect(TAKEDOWN_TRANSITIONS.requested).toContain('under_review')
    expect(TAKEDOWN_TRANSITIONS.requested).toContain('rejected')
  })

  it('under_review can be enforced or rejected', () => {
    expect(TAKEDOWN_TRANSITIONS.under_review).toContain('enforced')
    expect(TAKEDOWN_TRANSITIONS.under_review).toContain('rejected')
  })

  it('enforced can be counter-filed or resolved', () => {
    expect(TAKEDOWN_TRANSITIONS.enforced).toContain('counter_filed')
    expect(TAKEDOWN_TRANSITIONS.enforced).toContain('resolved')
  })

  it('resolved and rejected are terminal', () => {
    expect(TAKEDOWN_TRANSITIONS.resolved).toEqual([])
    expect(TAKEDOWN_TRANSITIONS.rejected).toEqual([])
  })

  it('every declared status has a transition entry', () => {
    const states: TakedownStatus[] = ['requested', 'under_review', 'enforced', 'counter_filed', 'resolved', 'rejected']
    for (const s of states) {
      expect(TAKEDOWN_TRANSITIONS).toHaveProperty(s)
    }
  })
})

describe('Claim state transitions', () => {
  it('pending can go to approved, rejected, or disputed', () => {
    expect(CLAIM_TRANSITIONS.pending).toContain('approved')
    expect(CLAIM_TRANSITIONS.pending).toContain('rejected')
    expect(CLAIM_TRANSITIONS.pending).toContain('disputed')
  })

  it('approved can be disputed', () => {
    expect(CLAIM_TRANSITIONS.approved).toContain('disputed')
  })

  it('disputed can be resolved to approved, rejected, or withdrawn', () => {
    expect(CLAIM_TRANSITIONS.disputed).toContain('approved')
    expect(CLAIM_TRANSITIONS.disputed).toContain('rejected')
    expect(CLAIM_TRANSITIONS.disputed).toContain('withdrawn')
  })

  it('withdrawn is terminal', () => {
    expect(CLAIM_TRANSITIONS.withdrawn).toEqual([])
  })

  it('rejected can be re-submitted (back to pending)', () => {
    expect(CLAIM_TRANSITIONS.rejected).toContain('pending')
  })

  it('every declared status has a transition entry', () => {
    const states: RightsClaimStatus[] = ['pending', 'approved', 'disputed', 'rejected', 'withdrawn']
    for (const s of states) {
      expect(CLAIM_TRANSITIONS).toHaveProperty(s)
    }
  })
})

// ── Processing Profiles ─────────────────────────────────────────────────────

import { PROCESSING_PROFILES } from '@/features/media/types'

describe('Audio processing profiles', () => {
  it('has standard, high, and preview tiers', () => {
    expect(PROCESSING_PROFILES).toHaveProperty('standard')
    expect(PROCESSING_PROFILES).toHaveProperty('high')
    expect(PROCESSING_PROFILES).toHaveProperty('preview')
  })

  it('standard profile is 128kbps AAC', () => {
    expect(PROCESSING_PROFILES.standard.bitrate).toBe(128)
    expect(PROCESSING_PROFILES.standard.codec).toBe('aac')
  })

  it('high profile has higher bitrate than standard', () => {
    expect(PROCESSING_PROFILES.high.bitrate).toBeGreaterThan(PROCESSING_PROFILES.standard.bitrate)
  })

  it('preview profile has lower bitrate', () => {
    expect(PROCESSING_PROFILES.preview.bitrate).toBeLessThan(PROCESSING_PROFILES.standard.bitrate)
  })

  it('all profiles have format and codec', () => {
    for (const [, profile] of Object.entries(PROCESSING_PROFILES)) {
      expect(profile.format).toBeTruthy()
      expect(profile.codec).toBeTruthy()
      expect(profile.bitrate).toBeGreaterThan(0)
    }
  })
})

// ── Nzila Platform Events ───────────────────────────────────────────────────

import { ZONGA_PLATFORM_EVENTS } from '@/features/nzila-integration/sync-service'

describe('Nzila platform event types', () => {
  it('includes track lifecycle events', () => {
    expect(ZONGA_PLATFORM_EVENTS).toHaveProperty('TRACK_PUBLISHED')
    expect(ZONGA_PLATFORM_EVENTS).toHaveProperty('TRACK_SUSPENDED')
  })

  it('includes payout events', () => {
    expect(ZONGA_PLATFORM_EVENTS).toHaveProperty('PAYOUT_COMPLETED')
    expect(ZONGA_PLATFORM_EVENTS).toHaveProperty('PAYOUT_FAILED')
  })

  it('includes moderation events', () => {
    expect(ZONGA_PLATFORM_EVENTS).toHaveProperty('MODERATION_ESCALATED')
  })

  it('includes takedown events', () => {
    expect(ZONGA_PLATFORM_EVENTS).toHaveProperty('TAKEDOWN_ENFORCED')
  })

  it('all events have string identifiers', () => {
    for (const [key, value] of Object.entries(ZONGA_PLATFORM_EVENTS)) {
      expect(typeof key).toBe('string')
      expect(typeof value).toBe('string')
      expect(value.length).toBeGreaterThan(0)
    }
  })
})

// ── Fee Calculation Sanity ──────────────────────────────────────────────────

describe('Fee calculation invariants', () => {
  it('platform fee never exceeds gross amount', () => {
    const grossAmount = 100
    for (const [, feePct] of Object.entries(PLATFORM_FEE_PCT)) {
      const fee = (grossAmount * feePct) / 100
      expect(fee).toBeLessThanOrEqual(grossAmount)
      expect(fee).toBeGreaterThanOrEqual(0)
    }
  })

  it('creator net is always non-negative', () => {
    const grossAmount = 100
    for (const [, feePct] of Object.entries(PLATFORM_FEE_PCT)) {
      const net = grossAmount - (grossAmount * feePct) / 100
      expect(net).toBeGreaterThanOrEqual(0)
    }
  })

  it('ticket sale fee matches the event constant', () => {
    expect(PLATFORM_FEE_PCT.ticket_sale).toBe(TICKET_PLATFORM_FEE_PCT)
  })
})
