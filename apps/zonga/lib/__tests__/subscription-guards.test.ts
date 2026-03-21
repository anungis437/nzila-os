/**
 * Zonga — Subscription Guard Tests (S1–S6)
 *
 * Validates all subscription-based invariant guards enforce correctly.
 */
import { describe, it, expect } from 'vitest'
import {
  guardListenerFeature,
  guardCanDownload,
  guardAudioQuality,
  guardSubscriptionActive,
  guardCreatorFeature,
  guardCreatorPlanTier,
  isListenerPremium,
  isCreatorLabel,
  maxAudioQuality,
} from '../guards/subscription-guards'

describe('Subscription invariant guards', () => {
  // ── S1: Listener Feature Access ──────────────────────────────────────────

  describe('S1: guardListenerFeature', () => {
    it('grants premium user access to premium-only features', () => {
      expect(guardListenerFeature('premium', 'offline_downloads').passed).toBe(true)
      expect(guardListenerFeature('premium', 'hifi_audio').passed).toBe(true)
      expect(guardListenerFeature('premium', 'ad_free').passed).toBe(true)
      expect(guardListenerFeature('premium', 'exclusive_releases').passed).toBe(true)
      expect(guardListenerFeature('premium', 'enhanced_playlists').passed).toBe(true)
    })

    it('grants free user access to free features', () => {
      expect(guardListenerFeature('free', 'ad_supported_streaming').passed).toBe(true)
      expect(guardListenerFeature('free', 'create_playlists').passed).toBe(true)
      expect(guardListenerFeature('free', 'follow_artists').passed).toBe(true)
      expect(guardListenerFeature('free', 'event_discovery').passed).toBe(true)
      expect(guardListenerFeature('free', 'standard_audio').passed).toBe(true)
      expect(guardListenerFeature('free', 'tip_artists').passed).toBe(true)
    })

    it('blocks free user from premium-only features', () => {
      const result = guardListenerFeature('free', 'offline_downloads')
      expect(result.passed).toBe(false)
      expect(result.invariant).toBe('S1_LISTENER_FEATURE_ACCESS')
      expect(result.details).toContain('premium')
    })

    it('blocks free user from all premium-only features', () => {
      const premiumFeatures = ['ad_free', 'offline_downloads', 'hifi_audio', 'exclusive_releases', 'enhanced_playlists'] as const
      for (const feature of premiumFeatures) {
        expect(guardListenerFeature('free', feature).passed).toBe(false)
      }
    })
  })

  // ── S2: Creator Feature Access ───────────────────────────────────────────

  describe('S2: guardCreatorFeature', () => {
    it('grants business user access to business features', () => {
      expect(guardCreatorFeature('business', 'roster_management').passed).toBe(true)
      expect(guardCreatorFeature('business', 'automated_royalty_splits').passed).toBe(true)
      expect(guardCreatorFeature('business', 'advanced_analytics').passed).toBe(true)
      expect(guardCreatorFeature('business', 'bulk_upload').passed).toBe(true)
      expect(guardCreatorFeature('business', 'compliance_exports').passed).toBe(true)
    })

    it('grants starter user access to starter features', () => {
      expect(guardCreatorFeature('starter', 'upload_content').passed).toBe(true)
      expect(guardCreatorFeature('starter', 'basic_analytics').passed).toBe(true)
      expect(guardCreatorFeature('starter', 'payouts').passed).toBe(true)
    })

    it('blocks starter user from business features', () => {
      const result = guardCreatorFeature('starter', 'roster_management')
      expect(result.passed).toBe(false)
      expect(result.invariant).toBe('S2_CREATOR_FEATURE_ACCESS')
      expect(result.details).toContain('higher plan')
    })

    it('blocks starter from all non-starter features', () => {
      const higherFeatures = [
        'roster_management', 'automated_royalty_splits', 'advanced_analytics',
        'priority_review', 'bulk_upload', 'dedicated_manager', 'compliance_exports',
      ] as const
      for (const feature of higherFeatures) {
        expect(guardCreatorFeature('starter', feature).passed).toBe(false)
      }
    })

    it('grants enterprise user access to all features', () => {
      expect(guardCreatorFeature('enterprise', 'api_access').passed).toBe(true)
      expect(guardCreatorFeature('enterprise', 'white_label').passed).toBe(true)
      expect(guardCreatorFeature('enterprise', 'sla_guarantees').passed).toBe(true)
      expect(guardCreatorFeature('enterprise', 'roster_management').passed).toBe(true)
    })
  })

  // ── S3: Enterprise Feature Access ────────────────────────────────────────

  describe('S3: guardCreatorFeature (enterprise)', () => {
    it('blocks business user from enterprise-only features', () => {
      const result = guardCreatorFeature('business', 'white_label')
      expect(result.passed).toBe(false)
      expect(result.invariant).toBe('S3_ENTERPRISE_FEATURE_ACCESS')
      expect(result.details).toContain('enterprise')
    })

    it('blocks starter from enterprise-only features', () => {
      const result = guardCreatorFeature('starter', 'white_label')
      expect(result.passed).toBe(false)
      expect(result.invariant).toBe('S3_ENTERPRISE_FEATURE_ACCESS')
    })

    it('blocks all enterprise-only features for non-enterprise plans', () => {
      const enterpriseFeatures = [
        'white_label', 'sla_guarantees',
        'on_premise', 'custom_payment_rails',
      ] as const
      for (const feature of enterpriseFeatures) {
        expect(guardCreatorFeature('business', feature).passed).toBe(false)
        expect(guardCreatorFeature('starter', feature).passed).toBe(false)
      }
    })
  })

  // ── S4: Download Access ──────────────────────────────────────────────────

  describe('S4: guardCanDownload', () => {
    it('allows premium user to download', () => {
      const result = guardCanDownload('premium')
      expect(result.passed).toBe(true)
      expect(result.invariant).toBe('S4_DOWNLOAD_ACCESS')
    })

    it('blocks free user from downloading', () => {
      const result = guardCanDownload('free')
      expect(result.passed).toBe(false)
      expect(result.invariant).toBe('S4_DOWNLOAD_ACCESS')
      expect(result.details).toContain('premium')
    })
  })

  // ── S5: Audio Quality ────────────────────────────────────────────────────

  describe('S5: guardAudioQuality', () => {
    it('allows premium user to request hifi', () => {
      expect(guardAudioQuality('premium', 'hifi').passed).toBe(true)
    })

    it('allows premium user to request standard', () => {
      expect(guardAudioQuality('premium', 'standard').passed).toBe(true)
    })

    it('allows premium user to request high', () => {
      expect(guardAudioQuality('premium', 'high').passed).toBe(true)
    })

    it('allows free user to request standard', () => {
      expect(guardAudioQuality('free', 'standard').passed).toBe(true)
    })

    it('allows free user to request high', () => {
      expect(guardAudioQuality('free', 'high').passed).toBe(true)
    })

    it('blocks free user from requesting hifi', () => {
      const result = guardAudioQuality('free', 'hifi')
      expect(result.passed).toBe(false)
      expect(result.invariant).toBe('S5_AUDIO_QUALITY')
      expect(result.details).toContain('Hi-Fi')
    })
  })

  // ── S6: Subscription Active ──────────────────────────────────────────────

  describe('S6: guardSubscriptionActive', () => {
    it('passes for active subscription', () => {
      expect(guardSubscriptionActive('active').passed).toBe(true)
    })

    it('passes for trialing subscription', () => {
      expect(guardSubscriptionActive('trialing').passed).toBe(true)
    })

    it('passes for null status (no subscription — free user)', () => {
      expect(guardSubscriptionActive(null).passed).toBe(true)
    })

    it('passes for undefined status', () => {
      expect(guardSubscriptionActive(undefined).passed).toBe(true)
    })

    it('fails for past_due subscription', () => {
      const result = guardSubscriptionActive('past_due')
      expect(result.passed).toBe(false)
      expect(result.invariant).toBe('S6_SUBSCRIPTION_ACTIVE')
    })

    it('fails for canceled subscription', () => {
      const result = guardSubscriptionActive('canceled')
      expect(result.passed).toBe(false)
      expect(result.invariant).toBe('S6_SUBSCRIPTION_ACTIVE')
    })

    it('fails for incomplete subscription', () => {
      const result = guardSubscriptionActive('incomplete')
      expect(result.passed).toBe(false)
    })
  })

  // ── Plan Tier Check ──────────────────────────────────────────────────────

  describe('guardCreatorPlanTier', () => {
    it('passes when current plan meets required tier', () => {
      expect(guardCreatorPlanTier('business', 'business').passed).toBe(true)
      expect(guardCreatorPlanTier('enterprise', 'business').passed).toBe(true)
      expect(guardCreatorPlanTier('enterprise', 'starter').passed).toBe(true)
      expect(guardCreatorPlanTier('starter', 'starter').passed).toBe(true)
    })

    it('fails when current plan is below required tier', () => {
      const result = guardCreatorPlanTier('starter', 'business')
      expect(result.passed).toBe(false)
      expect(result.invariant).toBe('S2_PLAN_TIER_CHECK')
      expect(result.details).toContain('starter')
      expect(result.details).toContain('business')
    })

    it('fails business when enterprise required', () => {
      expect(guardCreatorPlanTier('business', 'enterprise').passed).toBe(false)
    })
  })

  // ── Composite Helpers ────────────────────────────────────────────────────

  describe('isListenerPremium', () => {
    it('returns true for premium + active', () => {
      expect(isListenerPremium('premium', 'active')).toBe(true)
    })

    it('returns true for premium + trialing', () => {
      expect(isListenerPremium('premium', 'trialing')).toBe(true)
    })

    it('returns false for premium + canceled', () => {
      expect(isListenerPremium('premium', 'canceled')).toBe(false)
    })

    it('returns false for premium + past_due', () => {
      expect(isListenerPremium('premium', 'past_due')).toBe(false)
    })

    it('returns false for free plan', () => {
      expect(isListenerPremium('free', 'active')).toBe(false)
    })

    it('returns false for null plan', () => {
      expect(isListenerPremium(null, null)).toBe(false)
    })
  })

  describe('isCreatorLabel', () => {
    it('returns true for business + active', () => {
      expect(isCreatorLabel('business', 'active')).toBe(true)
    })

    it('returns true for enterprise + active', () => {
      expect(isCreatorLabel('enterprise', 'active')).toBe(true)
    })

    it('returns true for business + trialing', () => {
      expect(isCreatorLabel('business', 'trialing')).toBe(true)
    })

    it('returns false for starter plan', () => {
      expect(isCreatorLabel('starter', 'active')).toBe(false)
    })

    it('returns false for business + canceled', () => {
      expect(isCreatorLabel('business', 'canceled')).toBe(false)
    })

    it('returns false for null plan', () => {
      expect(isCreatorLabel(null, null)).toBe(false)
    })
  })

  describe('maxAudioQuality', () => {
    it('returns hifi for premium', () => {
      expect(maxAudioQuality('premium')).toBe('hifi')
    })

    it('returns high for free', () => {
      expect(maxAudioQuality('free')).toBe('high')
    })
  })
})
