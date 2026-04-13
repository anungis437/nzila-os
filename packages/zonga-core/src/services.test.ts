import { describe, it, expect } from 'vitest'
import { computePayoutPreview } from './services/payout'
import { buildZongaAuditEvent, ZongaAuditAction, ZongaEntityType } from './services/audit'
import {
  checkInventory,
  validatePromoCode,
  verifyTicketScan,
  computeEventSettlement,
  computeOrderTotal,
  validateMediaFile,
  estimateDownloadSize,
  filterRecommendations,
  mergeRecommendations,
  buildSimilarTracksRequest,
  buildRegionalDiscoveryRequest,
  buildSessionContinuationRequest,
} from './services/index'
import { CreatorOnboardingFlow } from './creator-onboarding-flow'
import type { RevenueEvent } from './types/index'
import type { PromoCode, TicketHolder, TicketInventory, RecommendationResponse } from './types/index'
import { CreatorOnboardingStatus, RevenueType } from './enums'
import * as zongaCore from './index'

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

  describe('events service helpers', () => {
    it('checks ticket inventory availability and totals', () => {
      const inventory: TicketInventory = {
        ticketTypeId: 'vip',
        totalQuantity: 200,
        sold: 120,
        held: 10,
        available: 70,
        lastUpdatedAt: '2025-01-10T00:00:00Z',
      }

      expect(checkInventory(inventory, 50)).toMatchObject({ available: true, remainingQuantity: 70 })
      expect(checkInventory(inventory, 80)).toMatchObject({ available: false, soldQuantity: 120 })
    })

    it('validates promo code lifecycle and discount modes', () => {
      const basePromo: PromoCode = {
        id: 'promo-1',
        eventId: 'event-1',
        code: 'SAVE20',
        type: 'percentage',
        value: 20,
        maxUses: 10,
        currentUses: 2,
        validFrom: '2025-01-01T00:00:00Z',
        validUntil: '2025-12-31T00:00:00Z',
        createdBy: 'admin',
        createdAt: '2025-01-01T00:00:00Z',
      }

      expect(validatePromoCode({ ...basePromo, currentUses: 10 }, 100, new Date('2025-05-01T00:00:00Z'))).toMatchObject({ valid: false, error: 'Promo code has reached its usage limit' })
      expect(validatePromoCode(basePromo, 100, new Date('2024-12-01T00:00:00Z'))).toMatchObject({ valid: false, error: 'Promo code is not yet active' })
      expect(validatePromoCode(basePromo, 100, new Date('2026-01-01T00:00:00Z'))).toMatchObject({ valid: false, error: 'Promo code has expired' })
      expect(validatePromoCode(basePromo, 100, new Date('2025-05-01T00:00:00Z'))).toMatchObject({ valid: true, discountAmount: 20 })
      expect(validatePromoCode({ ...basePromo, type: 'fixed_amount', value: 150 }, 99, new Date('2025-05-01T00:00:00Z'))).toMatchObject({ valid: true, discountAmount: 99 })
      expect(validatePromoCode({ ...basePromo, type: 'free_ticket' }, 42, new Date('2025-05-01T00:00:00Z'))).toMatchObject({ valid: true, discountAmount: 42 })
    })

    it('verifies ticket scans across invalid, transferred, duplicate and valid cases', () => {
      const holder: TicketHolder = {
        id: 'holder-1',
        orderId: 'order-1',
        ticketTypeId: 'vip',
        eventId: 'event-1',
        holderId: 'user-1',
        holderName: 'Jane Doe',
        holderEmail: 'jane@example.com',
        qrCode: 'qr-1',
        scanned: false,
        scannedAt: null,
        transferredTo: null,
        createdAt: '2025-01-01T00:00:00Z',
      }

      expect(verifyTicketScan(holder, 'event-2').result).toBe('invalid')
      expect(verifyTicketScan({ ...holder, transferredTo: 'friend@example.com' }, 'event-1').result).toBe('transferred')
      expect(verifyTicketScan({ ...holder, scanned: true, scannedAt: '2025-01-10T10:00:00Z' }, 'event-1').result).toBe('already_scanned')
      expect(verifyTicketScan(holder, 'event-1')).toMatchObject({ result: 'valid', holderName: 'Jane Doe' })
    })

    it('computes settlement and order totals deterministically', () => {
      const settlement = computeEventSettlement({
        ticketSalesTotal: 1000,
        refundsTotal: 120,
        chargebacksTotal: 30,
        platformFeePercent: 12.5,
        currency: 'USD',
      })
      expect(settlement).toMatchObject({
        grossTicketSales: 1000,
        totalRefunds: 120,
        totalChargebacks: 30,
        platformFees: 106.25,
        netRevenue: 743.75,
      })

      expect(computeOrderTotal([
        { quantity: 2, unitPrice: 9.99 },
        { quantity: 1, unitPrice: 3.5 },
      ], 5)).toMatchObject({ subtotal: 23.48, discount: 5, total: 18.48, itemCount: 3 })

      expect(computeOrderTotal([{ quantity: 1, unitPrice: 4 }], 100).total).toBe(0)
    })
  })

  describe('media and recommendation helpers', () => {
    it('validates media files across format, size, duration and valid paths', () => {
      expect(validateMediaFile({ fileName: 'song.bin', contentType: 'application/octet-stream', fileSizeBytes: 1000, durationSeconds: 30 })).toMatchObject({ result: 'invalid_format' })
      expect(validateMediaFile({ fileName: 'song.mp3', contentType: 'audio/mpeg', fileSizeBytes: 600_000_000, durationSeconds: 30 })).toMatchObject({ result: 'exceeds_size_limit' })
      expect(validateMediaFile({ fileName: 'song.mp3', contentType: 'audio/mpeg', fileSizeBytes: 10_000, durationSeconds: 2 })).toMatchObject({ result: 'duration_too_short' })
      expect(validateMediaFile({ fileName: 'song.mp3', contentType: 'audio/mpeg', fileSizeBytes: 10_000, durationSeconds: 9000 })).toMatchObject({ result: 'duration_too_long' })
      expect(validateMediaFile({ fileName: 'song.mp3', contentType: 'audio/mpeg', fileSizeBytes: 10_000, durationSeconds: null })).toMatchObject({ result: 'valid' })
    })

    it('estimates download sizes by quality', () => {
      expect(estimateDownloadSize(60, 'low')).toBe(240000)
      expect(estimateDownloadSize(60, 'lossless')).toBe(2400000)
    })

    it('filters and merges recommendation responses', () => {
      const responseA: RecommendationResponse = {
        requestId: 'r1',
        type: 'similar_tracks',
        items: [
          { assetId: 'a1', score: 0.9, reason: 'match', metadata: {} },
          { assetId: 'a2', score: 0.5, reason: 'genre', metadata: {} },
        ],
        modelVersion: 'v1',
        computedAt: '2025-01-01T00:00:00Z',
        featureFlags: [],
      }
      const responseB: RecommendationResponse = {
        requestId: 'r2',
        type: 'similar_tracks',
        items: [
          { assetId: 'a1', score: 0.95, reason: 'better', metadata: {} },
          { assetId: 'a3', score: 0.7, reason: 'regional', metadata: {} },
        ],
        modelVersion: 'v1',
        computedAt: '2025-01-01T00:00:00Z',
        featureFlags: [],
      }

      expect(filterRecommendations(responseA.items, { excludeAssetIds: ['a2'], minScore: 0.8, limit: 1 })).toEqual([
        { assetId: 'a1', score: 0.9, reason: 'match', metadata: {} },
      ])

      expect(mergeRecommendations([responseA, responseB], 2)).toEqual([
        { assetId: 'a1', score: 0.95, reason: 'better', metadata: {} },
        { assetId: 'a3', score: 0.7, reason: 'regional', metadata: {} },
      ])
    })

    it('builds recommendation request payloads with defaults', () => {
      const similar = buildSimilarTracksRequest({ listenerId: 'l1', seedAssetId: 'a1', genre: 'afrobeats' })
      const regional = buildRegionalDiscoveryRequest({ listenerId: 'l1', region: 'east' })
      const session = buildSessionContinuationRequest({ listenerId: 'l1', recentAssetIds: ['a1', 'a2'] })

      expect(similar).toMatchObject({ type: 'similar_tracks', limit: 20, excludeAssetIds: ['a1'] })
      expect(regional).toMatchObject({ type: 'regional_discovery', limit: 30, excludeAssetIds: [] })
      expect(session).toMatchObject({ type: 'session_continuation', limit: 10, excludeAssetIds: ['a1', 'a2'] })
    })
  })

  describe('onboarding flow and barrels', () => {
    it('defines creator onboarding sequence and step validators', () => {
      expect(CreatorOnboardingFlow.id).toBe('zonga_creator_onboarding')
      expect(CreatorOnboardingFlow.steps.map((s) => s.name)).toEqual([
        CreatorOnboardingStatus.REGISTERED,
        CreatorOnboardingStatus.PROFILE_COMPLETE,
        CreatorOnboardingStatus.PAYOUT_READY,
        CreatorOnboardingStatus.ACTIVE,
      ])

      const [registration, profile, payout, activation] = CreatorOnboardingFlow.steps
      expect(registration.validate?.({ email: 'creator@zonga.africa', acceptedTerms: true })).toBe(true)
      expect(profile.validate?.({ displayName: 'Amina', genre: 'afropop', bio: 'Artist bio' })).toBe(true)
      expect(payout.validate?.({ payoutMethod: 'mobile_money', payoutVerified: true })).toBe(true)
      expect(activation.canStart?.({ payoutVerified: true })).toBe(true)
      expect(activation.canStart?.({ payoutVerified: false })).toBe(false)
    })

    it('re-exports expected symbols from package barrel', () => {
      expect(typeof zongaCore.computePayoutPreview).toBe('function')
      expect(typeof zongaCore.checkInventory).toBe('function')
      expect(typeof zongaCore.validateMediaFile).toBe('function')
      expect(zongaCore.CreatorOnboardingFlow.id).toBe('zonga_creator_onboarding')
    })
  })
})
