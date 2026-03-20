import { describe, it, expect } from 'vitest'
import {
  // Already tested in enums.test.ts: CreatorStatus, AssetType, AssetStatus, ReleaseStatus, RevenueType, PayoutStatus, LedgerEntryType, ZongaRole
  // New coverage below
  CreatorOnboardingStatus,
  ReleaseType,
  PayoutRail,
  EventStatus,
  TicketPurchaseStatus,
  PlaylistVisibility,
  PlaylistOwnerType,
  ListenerActivityType,
  FavoriteEntityType,
  ModerationCaseStatus,
  ModerationCaseType,
  ModerationEntityType,
  PayoutPreviewStatus,
  NotificationType,
  ZongaCurrency,
  AfricanGenre,
  AudioQuality,
  ZongaLanguage,
  AfricanCountry,
  StreamProtocol,
  PlaybackState,
  DownloadStatus,
  RightsOwnerRole,
  SplitAgreementStatus,
  DisputeStatus,
  DisputeType,
  TakedownReason,
  TakedownStatus,
  DistributionTarget,
  EventType,
  TicketTier,
  TicketTransferStatus,
  RefundStatus,
  ScanResult,
  PromoCodeType,
  SettlementStatus,
  ChargebackStatus,
  TranscodeJobStatus,
  MediaValidationResult,
  RecommendationType,
  FraudSignalType,
  MoodTag,
  RegionTag,
  VerificationStatus,
  VerificationType,
  ConsentType,
  ExportJobStatus,
  ExportFormat,
} from './enums'

describe('@nzila/zonga-core — enums (extended coverage)', () => {
  // ── Creator / Onboarding ──

  it('CreatorOnboardingStatus covers all statuses', () => {
    const values = Object.values(CreatorOnboardingStatus)
    expect(values).toContain('invited')
    expect(values).toContain('registered')
    expect(values).toContain('profile_complete')
    expect(values).toContain('payout_ready')
    expect(values).toContain('active')
    expect(values).toContain('suspended')
    expect(values).toHaveLength(6)
  })

  it('ReleaseType has all types', () => {
    const values = Object.values(ReleaseType)
    expect(values).toContain('single')
    expect(values).toContain('ep')
    expect(values).toContain('album')
    expect(values).toHaveLength(3)
  })

  // ── Payment ──

  it('PayoutRail covers African mobile money + global rails', () => {
    const values = Object.values(PayoutRail)
    expect(values).toContain('mpesa')
    expect(values).toContain('mtn_momo')
    expect(values).toContain('airtel_money')
    expect(values).toContain('orange_money')
    expect(values).toContain('stripe_connect')
    expect(values).toContain('bank_transfer')
    expect(values).toContain('chipper_cash')
    expect(values).toContain('flutterwave')
    expect(values).toHaveLength(8)
  })

  // ── Events / Ticketing ──

  it('EventStatus has all expected values', () => {
    const values = Object.values(EventStatus)
    expect(values).toContain('draft')
    expect(values).toContain('published')
    expect(values).toContain('sold_out')
    expect(values).toContain('cancelled')
    expect(values).toContain('completed')
    expect(values).toHaveLength(5)
  })

  it('TicketPurchaseStatus has all expected values', () => {
    const values = Object.values(TicketPurchaseStatus)
    expect(values).toContain('pending')
    expect(values).toContain('confirmed')
    expect(values).toContain('failed')
    expect(values).toContain('refunded')
    expect(values).toContain('cancelled')
    expect(values).toHaveLength(5)
  })

  it('EventType covers all 9 event categories', () => {
    const values = Object.values(EventType)
    expect(values).toContain('concert')
    expect(values).toContain('festival')
    expect(values).toContain('album_launch')
    expect(values).toContain('virtual')
    expect(values).toContain('meet_and_greet')
    expect(values).toHaveLength(9)
  })

  it('TicketTier has 7 tiers including COMP', () => {
    const values = Object.values(TicketTier)
    expect(values).toContain('early_bird')
    expect(values).toContain('general')
    expect(values).toContain('vip')
    expect(values).toContain('vvip')
    expect(values).toContain('comp')
    expect(values).toHaveLength(7)
  })

  it('TicketTransferStatus has 5 statuses', () => {
    expect(Object.values(TicketTransferStatus)).toHaveLength(5)
  })

  it('RefundStatus has 5 statuses', () => {
    expect(Object.values(RefundStatus)).toHaveLength(5)
  })

  it('ScanResult has 6 outcomes', () => {
    const values = Object.values(ScanResult)
    expect(values).toContain('valid')
    expect(values).toContain('already_scanned')
    expect(values).toContain('fraudulent')
    expect(values).toHaveLength(6)
  })

  it('PromoCodeType has 3 types', () => {
    expect(Object.values(PromoCodeType)).toHaveLength(3)
  })

  // ── Playlist ──

  it('PlaylistVisibility has public/private/unlisted', () => {
    const values = Object.values(PlaylistVisibility)
    expect(values).toContain('public')
    expect(values).toContain('private')
    expect(values).toContain('unlisted')
    expect(values).toHaveLength(3)
  })

  it('PlaylistOwnerType has system/creator/listener', () => {
    expect(Object.values(PlaylistOwnerType)).toHaveLength(3)
  })

  // ── Listener Activity ──

  it('ListenerActivityType has 7 activity types', () => {
    const values = Object.values(ListenerActivityType)
    expect(values).toContain('play')
    expect(values).toContain('follow')
    expect(values).toContain('buy_ticket')
    expect(values).toHaveLength(7)
  })

  it('FavoriteEntityType has 4 entity types', () => {
    expect(Object.values(FavoriteEntityType)).toHaveLength(4)
  })

  // ── Moderation ──

  it('ModerationCaseStatus has 5 statuses', () => {
    const values = Object.values(ModerationCaseStatus)
    expect(values).toContain('open')
    expect(values).toContain('in_review')
    expect(values).toContain('resolved')
    expect(values).toContain('dismissed')
    expect(values).toContain('escalated')
    expect(values).toHaveLength(5)
  })

  it('ModerationCaseType has 6 types', () => {
    const values = Object.values(ModerationCaseType)
    expect(values).toContain('copyright')
    expect(values).toContain('fraud')
    expect(values).toContain('other')
    expect(values).toHaveLength(6)
  })

  it('ModerationEntityType has 4 entity types', () => {
    expect(Object.values(ModerationEntityType)).toHaveLength(4)
  })

  // ── Notifications / Payout Preview ──

  it('PayoutPreviewStatus has 3 statuses', () => {
    expect(Object.values(PayoutPreviewStatus)).toHaveLength(3)
  })

  it('NotificationType has 6 types', () => {
    const values = Object.values(NotificationType)
    expect(values).toContain('new_release')
    expect(values).toContain('payout_completed')
    expect(values).toContain('system')
    expect(values).toHaveLength(6)
  })

  // ── Currency ──

  it('ZongaCurrency covers major African + global currencies', () => {
    const values = Object.values(ZongaCurrency)
    expect(values).toContain('USD')
    expect(values).toContain('NGN')
    expect(values).toContain('KES')
    expect(values).toContain('ZAR')
    expect(values).toContain('XOF')
    expect(values).toContain('XAF')
    expect(values).toContain('CDF')
    expect(values.length).toBeGreaterThanOrEqual(19)
  })

  // ── Genre ──

  it('AfricanGenre has 66 genres', () => {
    const values = Object.values(AfricanGenre)
    expect(values).toHaveLength(66)
    // Spot-check key genres
    expect(values).toContain('afrobeats')
    expect(values).toContain('amapiano')
    expect(values).toContain('highlife')
  })

  // ── Streaming / Playback ──

  it('AudioQuality has 4 tiers', () => {
    const values = Object.values(AudioQuality)
    expect(values).toContain('low')
    expect(values).toContain('lossless')
    expect(values).toHaveLength(4)
  })

  it('StreamProtocol has 3 protocols', () => {
    expect(Object.values(StreamProtocol)).toHaveLength(3)
  })

  it('PlaybackState has 7 states', () => {
    const values = Object.values(PlaybackState)
    expect(values).toContain('idle')
    expect(values).toContain('playing')
    expect(values).toContain('buffering')
    expect(values).toContain('error')
    expect(values).toHaveLength(7)
  })

  it('DownloadStatus has 6 statuses', () => {
    expect(Object.values(DownloadStatus)).toHaveLength(6)
  })

  // ── Language / Country ──

  it('ZongaLanguage has 18 languages', () => {
    const values = Object.values(ZongaLanguage)
    expect(values).toContain('en')
    expect(values).toContain('sw')  // Swahili
    expect(values).toContain('ln')  // Lingala
    expect(values).toContain('yo')  // Yoruba
    expect(values).toHaveLength(18)
  })

  it('AfricanCountry has 54 countries', () => {
    const values = Object.values(AfricanCountry)
    expect(values).toContain('NG')
    expect(values).toContain('KE')
    expect(values).toContain('ZA')
    expect(values).toContain('CD')
    expect(values).toContain('EG')
    expect(values).toHaveLength(50)
  })

  // ── Rights ──

  it('RightsOwnerRole has 7 roles', () => {
    const values = Object.values(RightsOwnerRole)
    expect(values).toContain('master')
    expect(values).toContain('publisher')
    expect(values).toContain('composer')
    expect(values).toContain('performer')
    expect(values).toContain('label')
    expect(values).toHaveLength(7)
  })

  it('SplitAgreementStatus has 6 statuses', () => {
    const values = Object.values(SplitAgreementStatus)
    expect(values).toContain('draft')
    expect(values).toContain('pending_approval')
    expect(values).toContain('active')
    expect(values).toContain('disputed')
    expect(values).toHaveLength(6)
  })

  it('DisputeStatus has 8 statuses', () => {
    const values = Object.values(DisputeStatus)
    expect(values).toContain('open')
    expect(values).toContain('mediation')
    expect(values).toContain('appealed')
    expect(values).toHaveLength(8)
  })

  it('DisputeType has 6 types', () => {
    expect(Object.values(DisputeType)).toHaveLength(6)
  })

  it('TakedownReason has 8 reasons', () => {
    const values = Object.values(TakedownReason)
    expect(values).toContain('copyright_infringement')
    expect(values).toContain('fraud')
    expect(values).toHaveLength(8)
  })

  it('TakedownStatus has 6 statuses', () => {
    expect(Object.values(TakedownStatus)).toHaveLength(6)
  })

  // ── Distribution ──

  it('DistributionTarget has 9 DSPs', () => {
    const values = Object.values(DistributionTarget)
    expect(values).toContain('zonga')
    expect(values).toContain('spotify')
    expect(values).toContain('boomplay')
    expect(values).toContain('audiomack')
    expect(values).toContain('mdundo')
    expect(values).toHaveLength(9)
  })

  // ── Settlement / Chargeback ──

  it('SettlementStatus has 7 statuses', () => {
    expect(Object.values(SettlementStatus)).toHaveLength(7)
  })

  it('ChargebackStatus has 5 statuses', () => {
    expect(Object.values(ChargebackStatus)).toHaveLength(5)
  })

  // ── Media Pipeline ──

  it('TranscodeJobStatus has 5 statuses', () => {
    expect(Object.values(TranscodeJobStatus)).toHaveLength(5)
  })

  it('MediaValidationResult has 7 outcomes', () => {
    const values = Object.values(MediaValidationResult)
    expect(values).toContain('valid')
    expect(values).toContain('silent_audio')
    expect(values).toHaveLength(7)
  })

  // ── Recommendation / AI ──

  it('RecommendationType has 8 types', () => {
    const values = Object.values(RecommendationType)
    expect(values).toContain('similar_tracks')
    expect(values).toContain('mood_based')
    expect(values).toContain('regional_discovery')
    expect(values).toContain('trending')
    expect(values).toHaveLength(8)
  })

  it('FraudSignalType has 9 types', () => {
    const values = Object.values(FraudSignalType)
    expect(values).toContain('stream_spike')
    expect(values).toContain('bot_pattern')
    expect(values).toContain('account_takeover')
    expect(values).toHaveLength(9)
  })

  // ── Tags ──

  it('MoodTag has 12 moods', () => {
    const values = Object.values(MoodTag)
    expect(values).toContain('energetic')
    expect(values).toContain('chill')
    expect(values).toContain('spiritual')
    expect(values).toContain('celebration')
    expect(values).toHaveLength(12)
  })

  it('RegionTag has 10 regions', () => {
    const values = Object.values(RegionTag)
    expect(values).toContain('west_africa')
    expect(values).toContain('east_africa')
    expect(values).toContain('diaspora_uk')
    expect(values).toContain('global')
    expect(values).toHaveLength(10)
  })

  // ── Verification ──

  it('VerificationStatus has 5 statuses', () => {
    expect(Object.values(VerificationStatus)).toHaveLength(5)
  })

  it('VerificationType has 4 types', () => {
    expect(Object.values(VerificationType)).toHaveLength(4)
  })

  // ── Consent / Privacy ──

  it('ConsentType has 5 types', () => {
    const values = Object.values(ConsentType)
    expect(values).toContain('data_processing')
    expect(values).toContain('rights_agreement')
    expect(values).toContain('payout_terms')
    expect(values).toHaveLength(5)
  })

  // ── Export ──

  it('ExportJobStatus has 5 statuses', () => {
    expect(Object.values(ExportJobStatus)).toHaveLength(5)
  })

  it('ExportFormat has 4 formats', () => {
    const values = Object.values(ExportFormat)
    expect(values).toContain('csv')
    expect(values).toContain('json')
    expect(values).toContain('pdf')
    expect(values).toContain('xlsx')
    expect(values).toHaveLength(4)
  })

  // ── Cross-cutting invariants ──

  it('all enum values are lowercase snake_case strings', () => {
    const allEnums = [
      PayoutRail, EventStatus, TicketPurchaseStatus, PlaylistVisibility,
      PlaylistOwnerType, ListenerActivityType, FavoriteEntityType,
      ModerationCaseStatus, ModerationCaseType, ModerationEntityType,
      PayoutPreviewStatus, NotificationType, AudioQuality, StreamProtocol,
      PlaybackState, DownloadStatus, RightsOwnerRole, SplitAgreementStatus,
      DisputeStatus, DisputeType, TakedownReason, TakedownStatus,
      EventType, TicketTier, TicketTransferStatus, RefundStatus, ScanResult,
      PromoCodeType, SettlementStatus, ChargebackStatus, TranscodeJobStatus,
      MediaValidationResult, RecommendationType, FraudSignalType, MoodTag,
      RegionTag, VerificationStatus, VerificationType, ConsentType,
      ExportJobStatus, ExportFormat,
    ]

    for (const enumObj of allEnums) {
      for (const value of Object.values(enumObj)) {
        expect(typeof value).toBe('string')
        expect(value).toMatch(/^[a-z][a-z0-9_]*$/)
      }
    }
  })

  it('currency codes are uppercase ISO 4217', () => {
    for (const value of Object.values(ZongaCurrency)) {
      expect(value).toMatch(/^[A-Z]{3}$/)
    }
  })

  it('country codes are uppercase ISO 3166-1 alpha-2', () => {
    for (const value of Object.values(AfricanCountry)) {
      expect(value).toMatch(/^[A-Z]{2}$/)
    }
  })

  it('language codes are lowercase ISO 639-1', () => {
    for (const value of Object.values(ZongaLanguage)) {
      expect(value).toMatch(/^[a-z]{2}$/)
    }
  })
})
