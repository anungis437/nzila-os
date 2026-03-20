import { describe, it, expect } from 'vitest'
import { computePayoutPreview } from './services/payout'
import { buildZongaAuditEvent, ZongaAuditAction, ZongaEntityType } from './services/audit'
import type { RevenueEvent } from './types/index'
import { RevenueType } from './enums'

const ENTITY_ID = '550e8400-e29b-41d4-a716-446655440000'
const CREATOR_ID = '660e8400-e29b-41d4-a716-446655440001'
const ACTOR_ID = '770e8400-e29b-41d4-a716-446655440002'

function makeRevenueEvent(overrides: Partial<RevenueEvent> = {}): RevenueEvent {
  return {
    id: '880e8400-e29b-41d4-a716-446655440003',
    orgId: ENTITY_ID,
    creatorId: CREATOR_ID,
    assetId: null,
    type: RevenueType.STREAM,
    amount: 0.003,
    currency: 'USD',
    description: null,
    externalRef: null,
    metadata: {},
    occurredAt: '2025-01-15T12:00:00Z',
    createdAt: '2025-01-15T12:00:00Z',
    ...overrides,
  }
}

describe('@nzila/zonga-core — services', () => {
  describe('computePayoutPreview', () => {
    it('computes correct totals with 15% platform fee', () => {
      const events: RevenueEvent[] = [
        makeRevenueEvent({ amount: 100, type: RevenueType.STREAM }),
        makeRevenueEvent({ amount: 50, type: RevenueType.DOWNLOAD }),
        makeRevenueEvent({ amount: 25, type: RevenueType.TIP }),
      ]

      const preview = computePayoutPreview({
        creatorId: CREATOR_ID,
        orgId: ENTITY_ID,
        periodStart: '2025-01-01T00:00:00Z',
        periodEnd: '2025-01-31T23:59:59Z',
        revenueEvents: events,
        platformFeePercent: 15,
        currency: 'USD',
      })

      expect(preview.totalRevenue).toBe(175)
      expect(preview.platformFee).toBeCloseTo(26.25)
      expect(preview.netPayout).toBeCloseTo(148.75)
      expect(preview.revenueEventCount).toBe(3)
      expect(preview.creatorId).toBe(CREATOR_ID)
      expect(preview.orgId).toBe(ENTITY_ID)
    })

    it('handles empty events list', () => {
      const preview = computePayoutPreview({
        creatorId: CREATOR_ID,
        orgId: ENTITY_ID,
        periodStart: '2025-01-01T00:00:00Z',
        periodEnd: '2025-01-31T23:59:59Z',
        revenueEvents: [],
        platformFeePercent: 15,
        currency: 'USD',
      })

      expect(preview.totalRevenue).toBe(0)
      expect(preview.platformFee).toBe(0)
      expect(preview.netPayout).toBe(0)
      expect(preview.revenueEventCount).toBe(0)
      expect(preview.breakdown).toHaveLength(0)
    })

    it('groups breakdown by revenue type', () => {
      const events: RevenueEvent[] = [
        makeRevenueEvent({ amount: 0.003, type: RevenueType.STREAM }),
        makeRevenueEvent({ amount: 0.003, type: RevenueType.STREAM }),
        makeRevenueEvent({ amount: 0.003, type: RevenueType.STREAM }),
        makeRevenueEvent({ amount: 1.29, type: RevenueType.DOWNLOAD }),
      ]

      const preview = computePayoutPreview({
        creatorId: CREATOR_ID,
        orgId: ENTITY_ID,
        periodStart: '2025-01-01T00:00:00Z',
        periodEnd: '2025-01-31T23:59:59Z',
        revenueEvents: events,
        platformFeePercent: 10,
        currency: 'USD',
      })

      expect(preview.breakdown).toHaveLength(2)

      const streamBreakdown = preview.breakdown.find(b => b.revenueType === RevenueType.STREAM)
      expect(streamBreakdown?.eventCount).toBe(3)
      expect(streamBreakdown?.totalAmount).toBeCloseTo(0.009)

      const downloadBreakdown = preview.breakdown.find(b => b.revenueType === RevenueType.DOWNLOAD)
      expect(downloadBreakdown?.eventCount).toBe(1)
      expect(downloadBreakdown?.totalAmount).toBe(1.29)
    })

    it('applies zero fee correctly', () => {
      const events: RevenueEvent[] = [makeRevenueEvent({ amount: 100 })]

      const preview = computePayoutPreview({
        creatorId: CREATOR_ID,
        orgId: ENTITY_ID,
        periodStart: '2025-01-01T00:00:00Z',
        periodEnd: '2025-01-31T23:59:59Z',
        revenueEvents: events,
        platformFeePercent: 0,
        currency: 'USD',
      })

      expect(preview.platformFee).toBe(0)
      expect(preview.netPayout).toBe(100)
    })

    it('allows 100% platform fee', () => {
      const events: RevenueEvent[] = [makeRevenueEvent({ amount: 100 })]

      const preview = computePayoutPreview({
        creatorId: CREATOR_ID,
        orgId: ENTITY_ID,
        periodStart: '2025-01-01T00:00:00Z',
        periodEnd: '2025-01-31T23:59:59Z',
        revenueEvents: events,
        platformFeePercent: 100,
        currency: 'USD',
      })

      expect(preview.platformFee).toBe(100)
      expect(preview.netPayout).toBe(0)
    })
  })

  describe('buildZongaAuditEvent', () => {
    it('builds a valid audit event', () => {
      const event = buildZongaAuditEvent({
        orgId: ENTITY_ID,
        actorId: ACTOR_ID,
        action: ZongaAuditAction.CONTENT_PUBLISH,
        entityType: ZongaEntityType.CONTENT_ASSET,
        targetId: 'asset-123',
        metadata: { title: 'Mama Africa' },
      })

      expect(event.orgId).toBe(ENTITY_ID)
      expect(event.actorId).toBe(ACTOR_ID)
      expect(event.action).toBe('content.publish')
      expect(event.entityType).toBe('content_asset')
      expect(event.targetId).toBe('asset-123')
      expect(event.metadata).toEqual({ title: 'Mama Africa' })
      expect(event.timestamp).toBeTruthy()
    })

    it('defaults metadata to empty object when omitted', () => {
      const event = buildZongaAuditEvent({
        orgId: ENTITY_ID,
        actorId: ACTOR_ID,
        action: ZongaAuditAction.PAYOUT_EXECUTE,
        entityType: ZongaEntityType.PAYOUT,
        targetId: 'payout-456',
      })

      expect(event.metadata).toEqual({})
    })

    it('all audit actions are valid string literals', () => {
      const actions = Object.values(ZongaAuditAction)
      expect(actions).toHaveLength(47)
      for (const action of actions) {
        expect(typeof action).toBe('string')
        expect(action).toMatch(/^[a-z]+\.[a-z_]+$/)
      }
    })
  })
})
