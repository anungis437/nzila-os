import { describe, it, expect, beforeEach } from 'vitest'
import type { ControlPlaneContext } from './types'
import { SystemEventType } from './types'
import { clearEventLog, getEventLog } from './system-events'
import {
  resolveDisputeImpact,
  resolveDisputeFreeze,
  type DisputeRecord,
} from './dispute-impact'

function makeContext(overrides?: Partial<ControlPlaneContext>): ControlPlaneContext {
  return {
    orgId: 'org-test',
    actorId: 'actor-test',
    actorRole: 'admin',
    correlationId: 'corr-test',
    requestId: 'req-test',
    timestamp: new Date(),
    ...overrides,
  }
}

function makeDispute(overrides?: Partial<DisputeRecord>): DisputeRecord {
  return {
    id: 'disp-1',
    type: 'payment',
    status: 'open',
    filedBy: 'creator-a',
    targetCreatorId: 'creator-b',
    relatedReleaseIds: ['rel-1'],
    relatedPayoutIds: ['pay-1', 'pay-2'],
    relatedRoyaltyAccrualIds: ['roy-1'],
    evidence: [],
    filedAt: new Date(),
    ...overrides,
  }
}

describe('@nzila/zonga-control-plane — Dispute Impact', () => {
  beforeEach(() => {
    clearEventLog()
  })

  // ── resolveDisputeImpact ──────────────────────────────────────────

  describe('resolveDisputeImpact', () => {
    it('freezes explicitly listed payouts and royalties', () => {
      const ctx = makeContext()
      const dispute = makeDispute()
      const payouts = [
        { payoutId: 'pay-1', amount: 100, creatorId: 'creator-b' },
        { payoutId: 'pay-2', amount: 200, creatorId: 'creator-b' },
        { payoutId: 'pay-3', amount: 50, creatorId: 'creator-c' },
      ]
      const royalties = [
        { accrualId: 'roy-1', amount: 30, holderId: 'creator-b' },
      ]

      const result = resolveDisputeImpact(ctx, dispute, payouts, royalties)

      expect(result.frozenPayoutIds).toEqual(['pay-1', 'pay-2'])
      expect(result.frozenRoyaltyAccrualIds).toEqual(['roy-1'])
      expect(result.totalFrozenAmount).toBe(330) // 100 + 200 + 30
    })

    it('falls back to creator-based filtering when no explicit IDs', () => {
      const ctx = makeContext()
      const dispute = makeDispute({
        relatedPayoutIds: [],
        relatedRoyaltyAccrualIds: [],
      })
      const payouts = [
        { payoutId: 'pay-10', amount: 150, creatorId: 'creator-b' },
        { payoutId: 'pay-11', amount: 50, creatorId: 'creator-c' },
      ]
      const royalties = [
        { accrualId: 'roy-10', amount: 25, holderId: 'creator-b' },
        { accrualId: 'roy-11', amount: 10, holderId: 'creator-d' },
      ]

      const result = resolveDisputeImpact(ctx, dispute, payouts, royalties)

      expect(result.frozenPayoutIds).toEqual(['pay-10'])
      expect(result.frozenRoyaltyAccrualIds).toEqual(['roy-10'])
      expect(result.totalFrozenAmount).toBe(175) // 150 + 25
    })

    it('includes all affected creators (filer + target + frozen payout creators)', () => {
      const ctx = makeContext()
      const dispute = makeDispute()
      const payouts = [
        { payoutId: 'pay-1', amount: 100, creatorId: 'creator-b' },
        { payoutId: 'pay-2', amount: 200, creatorId: 'creator-x' },
      ]
      const royalties: { accrualId: string; amount: number; holderId: string }[] = []

      const result = resolveDisputeImpact(ctx, dispute, payouts, royalties)

      expect(result.affectedCreators).toContain('creator-a') // filer
      expect(result.affectedCreators).toContain('creator-b') // target
      expect(result.affectedCreators).toContain('creator-x') // pay-2 creator
    })

    it('requires manual review for ownership disputes', () => {
      const ctx = makeContext()
      const dispute = makeDispute({ type: 'ownership' })

      const result = resolveDisputeImpact(ctx, dispute, [], [])

      expect(result.requiresManualReview).toBe(true)
      expect(result.recommendedAction).toContain('rights documentation')
    })

    it('requires manual review for territory disputes', () => {
      const ctx = makeContext()
      const dispute = makeDispute({ type: 'territory' })

      const result = resolveDisputeImpact(ctx, dispute, [], [])

      expect(result.requiresManualReview).toBe(true)
    })

    it('requires manual review when frozen amount > 10000', () => {
      const ctx = makeContext()
      const dispute = makeDispute({ type: 'payment' })
      const payouts = [
        { payoutId: 'pay-1', amount: 8000, creatorId: 'creator-b' },
        { payoutId: 'pay-2', amount: 5000, creatorId: 'creator-b' },
      ]

      const result = resolveDisputeImpact(ctx, dispute, payouts, [])

      expect(result.requiresManualReview).toBe(true)
    })

    it('recommends correct action per dispute type', () => {
      const ctx = makeContext()

      const paymentResult = resolveDisputeImpact(ctx, makeDispute({ type: 'payment' }), [], [])
      expect(paymentResult.recommendedAction).toContain('payment records')

      const splitResult = resolveDisputeImpact(ctx, makeDispute({ type: 'split' }), [], [])
      expect(splitResult.recommendedAction).toContain('split agreement')

      const takedownResult = resolveDisputeImpact(ctx, makeDispute({ type: 'takedown' }), [], [])
      expect(takedownResult.recommendedAction).toContain('legal review')
    })

    it('emits payout frozen and dispute filed events', () => {
      const ctx = makeContext()
      const dispute = makeDispute()
      const payouts = [{ payoutId: 'pay-1', amount: 100, creatorId: 'creator-b' }]

      resolveDisputeImpact(ctx, dispute, payouts, [])

      const events = getEventLog()
      expect(events.some((e) => e.type === SystemEventType.PAYOUT_FROZEN)).toBe(true)
      expect(events.some((e) => e.type === SystemEventType.RIGHTS_DISPUTE_FILED)).toBe(true)
    })
  })

  // ── resolveDisputeFreeze ──────────────────────────────────────────

  describe('resolveDisputeFreeze', () => {
    it('unfreezes everything when dismissed', () => {
      const ctx = makeContext()
      const result = resolveDisputeFreeze(
        ctx,
        'disp-1',
        'dismissed',
        ['pay-1', 'pay-2'],
        ['roy-1'],
      )

      expect(result.unfrozenPayoutIds).toEqual(['pay-1', 'pay-2'])
      expect(result.unfrozenRoyaltyAccrualIds).toEqual(['roy-1'])
      expect(result.requiresPayoutAdjustment).toBe(false)
    })

    it('unfreezes everything when in favor of target', () => {
      const ctx = makeContext()
      const result = resolveDisputeFreeze(
        ctx,
        'disp-1',
        'in_favor_of_target',
        ['pay-1'],
        ['roy-1'],
      )

      expect(result.unfrozenPayoutIds).toEqual(['pay-1'])
      expect(result.requiresPayoutAdjustment).toBe(false)
    })

    it('keeps everything frozen when in favor of filer', () => {
      const ctx = makeContext()
      const result = resolveDisputeFreeze(
        ctx,
        'disp-1',
        'in_favor_of_filer',
        ['pay-1', 'pay-2'],
        ['roy-1'],
      )

      expect(result.unfrozenPayoutIds).toEqual([])
      expect(result.unfrozenRoyaltyAccrualIds).toEqual([])
      expect(result.requiresPayoutAdjustment).toBe(true)
    })

    it('unfreezes with adjustment required for split resolution', () => {
      const ctx = makeContext()
      const result = resolveDisputeFreeze(
        ctx,
        'disp-1',
        'split',
        ['pay-1'],
        ['roy-1'],
      )

      expect(result.unfrozenPayoutIds).toEqual(['pay-1'])
      expect(result.unfrozenRoyaltyAccrualIds).toEqual(['roy-1'])
      expect(result.requiresPayoutAdjustment).toBe(true)
    })

    it('emits unfreeze and resolution events', () => {
      const ctx = makeContext()
      resolveDisputeFreeze(ctx, 'disp-1', 'dismissed', ['pay-1'], [])

      const events = getEventLog()
      expect(events.some((e) => e.type === SystemEventType.PAYOUT_UNFROZEN)).toBe(true)
      expect(events.some((e) => e.type === SystemEventType.RIGHTS_DISPUTE_RESOLVED)).toBe(true)
    })
  })
})
