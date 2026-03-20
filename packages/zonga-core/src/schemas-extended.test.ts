import { describe, it, expect } from 'vitest'
import {
  CreateEventSchema,
  CreateTicketTypeSchema,
  PurchaseTicketSchema,
  CreatePlaylistSchema,
  CreateModerationCaseSchema,
  ResolveModerationCaseSchema,
  CreateRightsShareSchema,
  CreateSplitAgreementSchema,
  CreateDisputeSchema,
  RecordStreamEventSchema,
  CreatePromoCodeSchema,
  TicketScanSchema,
  CreateVenueSchema,
  CreateVerificationSchema,
  CreatePayoutAccountSchema,
  CreateLabelSchema,
  RecordConsentSchema,
  CreateExportJobSchema,
  CreateFraudReviewSchema,
  RecommendationRequestSchema,
  CreateDistributionSchema,
} from './schemas/index'

const UUID = '550e8400-e29b-41d4-a716-446655440000'
const UUID2 = '660e8400-e29b-41d4-a716-446655440001'

describe('@nzila/zonga-core — schemas (extended coverage)', () => {
  // ── Events ──

  describe('CreateEventSchema', () => {
    it('accepts valid event', () => {
      const r = CreateEventSchema.safeParse({
        title: 'Lagos Nights',
        startsAt: '2025-12-01T20:00:00Z',
      })
      expect(r.success).toBe(true)
    })

    it('requires non-empty title', () => {
      expect(CreateEventSchema.safeParse({ title: '', startsAt: '2025-12-01T20:00:00Z' }).success).toBe(false)
    })

    it('requires valid datetime for startsAt', () => {
      expect(CreateEventSchema.safeParse({ title: 'Test', startsAt: 'not-datetime' }).success).toBe(false)
    })
  })

  describe('CreateTicketTypeSchema', () => {
    it('accepts valid ticket type', () => {
      const r = CreateTicketTypeSchema.safeParse({
        eventId: UUID,
        ticketType: 'VIP',
        price: 5000,
        quantityAvailable: 200,
      })
      expect(r.success).toBe(true)
    })

    it('rejects negative price', () => {
      expect(CreateTicketTypeSchema.safeParse({
        eventId: UUID, ticketType: 'GA', price: -10, quantityAvailable: 100,
      }).success).toBe(false)
    })

    it('defaults currency to USD', () => {
      const r = CreateTicketTypeSchema.safeParse({
        eventId: UUID, ticketType: 'GA', price: 10, quantityAvailable: 50,
      })
      expect(r.success).toBe(true)
      if (r.success) expect(r.data.currency).toBe('USD')
    })
  })

  describe('PurchaseTicketSchema', () => {
    it('accepts valid ticket purchase', () => {
      const r = PurchaseTicketSchema.safeParse({
        eventId: UUID,
        ticketTypeId: UUID2,
        successUrl: 'https://zonga.app/success',
        cancelUrl: 'https://zonga.app/cancel',
      })
      expect(r.success).toBe(true)
    })

    it('rejects invalid successUrl', () => {
      expect(PurchaseTicketSchema.safeParse({
        eventId: UUID, ticketTypeId: UUID2, successUrl: 'bad', cancelUrl: 'https://x.com',
      }).success).toBe(false)
    })
  })

  // ── Playlist ──

  describe('CreatePlaylistSchema', () => {
    it('accepts valid playlist', () => {
      const r = CreatePlaylistSchema.safeParse({
        title: 'Afrobeats Mix',
        ownerType: 'listener',
        ownerId: UUID,
      })
      expect(r.success).toBe(true)
    })

    it('defaults visibility to public', () => {
      const r = CreatePlaylistSchema.safeParse({
        title: 'Chill Vibes',
        ownerType: 'system',
        ownerId: UUID,
      })
      expect(r.success).toBe(true)
      if (r.success) expect(r.data.visibility).toBe('public')
    })

    it('rejects invalid ownerType', () => {
      expect(CreatePlaylistSchema.safeParse({
        title: 'Test', ownerType: 'admin', ownerId: UUID,
      }).success).toBe(false)
    })
  })

  // ── Moderation ──

  describe('CreateModerationCaseSchema', () => {
    it('accepts valid moderation case', () => {
      const r = CreateModerationCaseSchema.safeParse({
        entityType: 'asset',
        targetEntityId: UUID,
        caseType: 'copyright',
      })
      expect(r.success).toBe(true)
    })

    it('defaults severity to medium', () => {
      const r = CreateModerationCaseSchema.safeParse({
        entityType: 'creator', targetEntityId: UUID, caseType: 'fraud',
      })
      expect(r.success).toBe(true)
      if (r.success) expect(r.data.severity).toBe('medium')
    })

    it('rejects invalid caseType', () => {
      expect(CreateModerationCaseSchema.safeParse({
        entityType: 'asset', targetEntityId: UUID, caseType: 'spam',
      }).success).toBe(false)
    })
  })

  describe('ResolveModerationCaseSchema', () => {
    it('accepts valid resolution', () => {
      const r = ResolveModerationCaseSchema.safeParse({
        caseId: UUID,
        resolution: 'resolved',
        notes: 'Issue addressed',
      })
      expect(r.success).toBe(true)
    })

    it('rejects invalid resolution', () => {
      expect(ResolveModerationCaseSchema.safeParse({
        caseId: UUID, resolution: 'banned',
      }).success).toBe(false)
    })
  })

  // ── Rights ──

  describe('CreateRightsShareSchema', () => {
    it('accepts valid rights share', () => {
      const r = CreateRightsShareSchema.safeParse({
        assetId: UUID,
        ownerId: UUID2,
        ownerRole: 'performer',
        sharePercent: 50,
        validFrom: '2025-01-01T00:00:00Z',
      })
      expect(r.success).toBe(true)
    })

    it('rejects sharePercent > 100', () => {
      expect(CreateRightsShareSchema.safeParse({
        assetId: UUID, ownerId: UUID2, ownerRole: 'master',
        sharePercent: 150, validFrom: '2025-01-01T00:00:00Z',
      }).success).toBe(false)
    })

    it('defaults territory to WORLDWIDE', () => {
      const r = CreateRightsShareSchema.safeParse({
        assetId: UUID, ownerId: UUID2, ownerRole: 'publisher',
        sharePercent: 30, validFrom: '2025-01-01T00:00:00Z',
      })
      expect(r.success).toBe(true)
      if (r.success) expect(r.data.territory).toBe('WORLDWIDE')
    })
  })

  describe('CreateSplitAgreementSchema', () => {
    it('accepts valid split agreement', () => {
      const r = CreateSplitAgreementSchema.safeParse({
        title: 'Revenue Split — Debut Album',
        shares: [
          { ownerId: UUID, ownerName: 'Artist', role: 'performer', sharePercent: 60 },
          { ownerId: UUID2, ownerName: 'Producer', role: 'producer', sharePercent: 40 },
        ],
        effectiveDate: '2025-06-01T00:00:00Z',
      })
      expect(r.success).toBe(true)
    })

    it('requires at least one share', () => {
      expect(CreateSplitAgreementSchema.safeParse({
        title: 'Empty', shares: [], effectiveDate: '2025-06-01T00:00:00Z',
      }).success).toBe(false)
    })

    it('rejects more than 20 shares', () => {
      const shares = Array.from({ length: 21 }, (_, i) => ({
        ownerId: UUID, ownerName: `Person ${i}`, role: 'performer' as const, sharePercent: 4,
      }))
      expect(CreateSplitAgreementSchema.safeParse({
        title: 'Too Many', shares, effectiveDate: '2025-06-01T00:00:00Z',
      }).success).toBe(false)
    })
  })

  describe('CreateDisputeSchema', () => {
    it('accepts valid dispute', () => {
      const r = CreateDisputeSchema.safeParse({
        disputeType: 'ownership',
        description: 'I am the original composer of this track',
        assetId: UUID,
      })
      expect(r.success).toBe(true)
    })

    it('requires description >= 10 chars', () => {
      expect(CreateDisputeSchema.safeParse({
        disputeType: 'ownership', description: 'short',
      }).success).toBe(false)
    })

    it('limits evidence URLs to 10', () => {
      const urls = Array.from({ length: 11 }, (_, i) => `https://evidence.com/${i}`)
      expect(CreateDisputeSchema.safeParse({
        disputeType: 'payout', description: 'This is a valid description',
        evidenceUrls: urls,
      }).success).toBe(false)
    })
  })

  // ── Streaming ──

  describe('RecordStreamEventSchema', () => {
    it('accepts valid stream event', () => {
      const r = RecordStreamEventSchema.safeParse({
        assetId: UUID,
        durationSeconds: 180,
        quality: 'high',
        completionPercent: 95,
      })
      expect(r.success).toBe(true)
    })

    it('defaults offline to false', () => {
      const r = RecordStreamEventSchema.safeParse({
        assetId: UUID, durationSeconds: 60, quality: 'low', completionPercent: 50,
      })
      expect(r.success).toBe(true)
      if (r.success) expect(r.data.offline).toBe(false)
    })

    it('rejects completionPercent > 100', () => {
      expect(RecordStreamEventSchema.safeParse({
        assetId: UUID, durationSeconds: 60, quality: 'medium', completionPercent: 150,
      }).success).toBe(false)
    })

    it('rejects invalid quality', () => {
      expect(RecordStreamEventSchema.safeParse({
        assetId: UUID, durationSeconds: 60, quality: 'ultra', completionPercent: 50,
      }).success).toBe(false)
    })
  })

  // ── Promo Code ──

  describe('CreatePromoCodeSchema', () => {
    it('accepts valid promo code', () => {
      const r = CreatePromoCodeSchema.safeParse({
        eventId: UUID,
        code: 'EARLY_20',
        type: 'percentage',
        value: 20,
        maxUses: 100,
        validFrom: '2025-06-01T00:00:00Z',
        validUntil: '2025-07-01T00:00:00Z',
      })
      expect(r.success).toBe(true)
    })

    it('rejects lowercase promo code', () => {
      expect(CreatePromoCodeSchema.safeParse({
        eventId: UUID, code: 'early20', type: 'percentage',
        value: 10, maxUses: 50,
        validFrom: '2025-06-01T00:00:00Z', validUntil: '2025-07-01T00:00:00Z',
      }).success).toBe(false)
    })

    it('rejects code shorter than 3', () => {
      expect(CreatePromoCodeSchema.safeParse({
        eventId: UUID, code: 'AB', type: 'fixed_amount',
        value: 5, maxUses: 10,
        validFrom: '2025-06-01T00:00:00Z', validUntil: '2025-07-01T00:00:00Z',
      }).success).toBe(false)
    })
  })

  // ── Ticket Scan ──

  describe('TicketScanSchema', () => {
    it('accepts valid scan', () => {
      const r = TicketScanSchema.safeParse({
        ticketHolderId: UUID,
        eventId: UUID2,
      })
      expect(r.success).toBe(true)
    })

    it('rejects latitude out of range', () => {
      expect(TicketScanSchema.safeParse({
        ticketHolderId: UUID, eventId: UUID2, latitude: 100,
      }).success).toBe(false)
    })

    it('rejects longitude out of range', () => {
      expect(TicketScanSchema.safeParse({
        ticketHolderId: UUID, eventId: UUID2, longitude: 200,
      }).success).toBe(false)
    })
  })

  // ── Venue ──

  describe('CreateVenueSchema', () => {
    it('accepts valid venue', () => {
      const r = CreateVenueSchema.safeParse({
        name: 'Eko Convention Centre',
        city: 'Lagos',
        country: 'Nigeria',
        capacity: 5000,
      })
      expect(r.success).toBe(true)
    })

    it('requires city and country', () => {
      expect(CreateVenueSchema.safeParse({ name: 'Test' }).success).toBe(false)
    })
  })

  // ── Verification ──

  describe('CreateVerificationSchema', () => {
    it('accepts valid verification', () => {
      const r = CreateVerificationSchema.safeParse({
        creatorId: UUID,
        verificationType: 'identity',
        evidenceUrls: ['https://storage.zonga.app/id/front.jpg'],
      })
      expect(r.success).toBe(true)
    })

    it('requires at least one evidence URL', () => {
      expect(CreateVerificationSchema.safeParse({
        creatorId: UUID, verificationType: 'label_affiliation', evidenceUrls: [],
      }).success).toBe(false)
    })
  })

  // ── Payout Account ──

  describe('CreatePayoutAccountSchema', () => {
    it('accepts M-Pesa payout account', () => {
      const r = CreatePayoutAccountSchema.safeParse({
        creatorId: UUID,
        rail: 'mpesa',
        accountRef: '+254712345678',
        currency: 'KES',
      })
      expect(r.success).toBe(true)
    })

    it('rejects empty accountRef', () => {
      expect(CreatePayoutAccountSchema.safeParse({
        creatorId: UUID, rail: 'bank_transfer', accountRef: '', currency: 'NGN',
      }).success).toBe(false)
    })
  })

  // ── Label ──

  describe('CreateLabelSchema', () => {
    it('accepts valid label', () => {
      const r = CreateLabelSchema.safeParse({
        name: 'mavin-records',
        displayName: 'Mavin Records',
      })
      expect(r.success).toBe(true)
    })

    it('rejects empty name', () => {
      expect(CreateLabelSchema.safeParse({
        name: '', displayName: 'X',
      }).success).toBe(false)
    })
  })

  // ── Consent ──

  describe('RecordConsentSchema', () => {
    it('accepts valid consent', () => {
      const r = RecordConsentSchema.safeParse({
        userId: UUID,
        consentType: 'data_processing',
        granted: true,
        version: '1.0',
      })
      expect(r.success).toBe(true)
    })

    it('rejects missing version', () => {
      expect(RecordConsentSchema.safeParse({
        userId: UUID, consentType: 'marketing', granted: false,
      }).success).toBe(false)
    })
  })

  // ── Export ──

  describe('CreateExportJobSchema', () => {
    it('accepts valid export job', () => {
      const r = CreateExportJobSchema.safeParse({
        entityType: 'revenue',
        format: 'csv',
      })
      expect(r.success).toBe(true)
    })

    it('rejects invalid entity type', () => {
      expect(CreateExportJobSchema.safeParse({
        entityType: 'users', format: 'csv',
      }).success).toBe(false)
    })

    it('rejects invalid format', () => {
      expect(CreateExportJobSchema.safeParse({
        entityType: 'streams', format: 'xml',
      }).success).toBe(false)
    })
  })

  // ── Fraud Review ──

  describe('CreateFraudReviewSchema', () => {
    it('accepts valid fraud review', () => {
      const r = CreateFraudReviewSchema.safeParse({
        signalType: 'bot_pattern',
        entityType: 'creator',
        targetEntityId: UUID,
        severity: 'high',
        score: 85,
        explanation: 'Automated stream pattern detected from single IP range',
      })
      expect(r.success).toBe(true)
    })

    it('rejects score > 100', () => {
      expect(CreateFraudReviewSchema.safeParse({
        signalType: 'stream_spike', entityType: 'asset', targetEntityId: UUID,
        severity: 'critical', score: 150, explanation: 'Very bad stuff happening',
      }).success).toBe(false)
    })
  })

  // ── Recommendation ──

  describe('RecommendationRequestSchema', () => {
    it('accepts valid request with defaults', () => {
      const r = RecommendationRequestSchema.safeParse({
        listenerId: UUID,
        type: 'mood_based',
      })
      expect(r.success).toBe(true)
      if (r.success) expect(r.data.limit).toBe(20)
    })

    it('rejects limit > 100', () => {
      expect(RecommendationRequestSchema.safeParse({
        listenerId: UUID, type: 'trending', limit: 500,
      }).success).toBe(false)
    })
  })

  // ── Distribution ──

  describe('CreateDistributionSchema', () => {
    it('accepts valid distribution to Boomplay', () => {
      const r = CreateDistributionSchema.safeParse({
        releaseId: UUID,
        target: 'boomplay',
      })
      expect(r.success).toBe(true)
    })

    it('rejects invalid DSP target', () => {
      expect(CreateDistributionSchema.safeParse({
        releaseId: UUID, target: 'soundcloud',
      }).success).toBe(false)
    })
  })
})
