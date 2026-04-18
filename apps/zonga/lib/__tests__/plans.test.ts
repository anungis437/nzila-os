import { describe, it, expect } from 'vitest'
import {
  LISTENER_PLANS,
  CREATOR_PLANS,
  hasListenerFeature,
  hasCreatorFeature,
  getCreatorLimit,
  getEffectiveCommission,
} from '@/lib/plans'

// ── Listener Plan Configs ───────────────────────────────────────────────────

describe('LISTENER_PLANS', () => {
  it('free plan costs $0', () => {
    expect(LISTENER_PLANS.free.priceMonthlyMinor).toBe(0)
  })

  it('premium plan costs $4.99 (499 minor units)', () => {
    expect(LISTENER_PLANS.premium.priceMonthlyMinor).toBe(499)
  })

  it('free plan has skip limit', () => {
    expect(LISTENER_PLANS.free.limits.skipLimit).toBe(6)
  })

  it('premium plan has no skip limit', () => {
    expect(LISTENER_PLANS.premium.limits.skipLimit).toBeNull()
  })

  it('free plan has no offline', () => {
    expect(LISTENER_PLANS.free.limits.offlineTracksLimit).toBeNull()
  })

  it('premium plan has 10000 offline tracks', () => {
    expect(LISTENER_PLANS.premium.limits.offlineTracksLimit).toBe(10000)
  })
})

// ── Creator Plan Configs ────────────────────────────────────────────────────

describe('CREATOR_PLANS', () => {
  it('starter is free', () => {
    expect(CREATOR_PLANS.starter.priceMonthlyMinor).toBe(0)
  })

  it('pro costs $29 (2900 minor units)', () => {
    expect(CREATOR_PLANS.pro.priceMonthlyMinor).toBe(2900)
  })

  it('business costs $149 (14900 minor units)', () => {
    expect(CREATOR_PLANS.business.priceMonthlyMinor).toBe(14900)
  })

  it('enterprise has custom pricing (null)', () => {
    expect(CREATOR_PLANS.enterprise.priceMonthlyMinor).toBeNull()
  })

  it('starter has 5 uploads/month', () => {
    expect(CREATOR_PLANS.starter.limits.uploadLimitPerMonth).toBe(5)
  })

  it('business has unlimited uploads', () => {
    expect(CREATOR_PLANS.business.limits.uploadLimitPerMonth).toBeNull()
  })

  it('pro has fee overrides lower than defaults', () => {
    expect(CREATOR_PLANS.pro.feeOverrides.streamCommissionPercent).toBe(12)
    expect(CREATOR_PLANS.pro.feeOverrides.ticketCommissionPercent).toBe(6)
    expect(CREATOR_PLANS.pro.feeOverrides.tipCommissionPercent).toBe(8)
  })

  it('starter has null fee overrides (uses defaults)', () => {
    expect(CREATOR_PLANS.starter.feeOverrides.streamCommissionPercent).toBeNull()
    expect(CREATOR_PLANS.starter.feeOverrides.ticketCommissionPercent).toBeNull()
    expect(CREATOR_PLANS.starter.feeOverrides.tipCommissionPercent).toBeNull()
  })
})

// ── Entitlement Checks ──────────────────────────────────────────────────────

describe('hasListenerFeature', () => {
  it('free plan has basic streaming', () => {
    expect(hasListenerFeature('free', 'ad_supported_streaming')).toBe(true)
  })

  it('free plan does not have ad_free', () => {
    expect(hasListenerFeature('free', 'ad_free')).toBe(false)
  })

  it('premium plan has all free features plus premium', () => {
    expect(hasListenerFeature('premium', 'ad_supported_streaming')).toBe(true)
    expect(hasListenerFeature('premium', 'ad_free')).toBe(true)
    expect(hasListenerFeature('premium', 'offline_downloads')).toBe(true)
    expect(hasListenerFeature('premium', 'hifi_audio')).toBe(true)
  })
})

describe('hasCreatorFeature', () => {
  it('starter has basic features', () => {
    expect(hasCreatorFeature('starter', 'upload_content')).toBe(true)
    expect(hasCreatorFeature('starter', 'basic_analytics')).toBe(true)
    expect(hasCreatorFeature('starter', 'payouts')).toBe(true)
  })

  it('starter does not have pro features', () => {
    expect(hasCreatorFeature('starter', 'advanced_analytics')).toBe(false)
    expect(hasCreatorFeature('starter', 'promoted_placement')).toBe(false)
    expect(hasCreatorFeature('starter', 'creator_assist_ai')).toBe(false)
  })

  it('pro has promoted_placement and creator_assist_ai', () => {
    expect(hasCreatorFeature('pro', 'promoted_placement')).toBe(true)
    expect(hasCreatorFeature('pro', 'creator_assist_ai')).toBe(true)
  })

  it('enterprise has all features', () => {
    expect(hasCreatorFeature('enterprise', 'white_label')).toBe(true)
    expect(hasCreatorFeature('enterprise', 'sla_guarantees')).toBe(true)
    expect(hasCreatorFeature('enterprise', 'custom_payment_rails')).toBe(true)
  })
})

// ── Limit Checks ────────────────────────────────────────────────────────────

describe('getCreatorLimit', () => {
  it('returns starter upload limit', () => {
    expect(getCreatorLimit('starter', 'uploadLimitPerMonth')).toBe(5)
  })

  it('returns null for unlimited business uploads', () => {
    expect(getCreatorLimit('business', 'uploadLimitPerMonth')).toBeNull()
  })

  it('returns team members limit', () => {
    expect(getCreatorLimit('starter', 'teamMembers')).toBe(1)
    expect(getCreatorLimit('pro', 'teamMembers')).toBe(3)
    expect(getCreatorLimit('business', 'teamMembers')).toBe(10)
  })
})

// ── Effective Commission ────────────────────────────────────────────────────

describe('getEffectiveCommission', () => {
  it('returns default when no override (starter)', () => {
    expect(getEffectiveCommission('starter', 'streamCommissionPercent', 15)).toBe(15)
  })

  it('returns override for pro', () => {
    expect(getEffectiveCommission('pro', 'streamCommissionPercent', 15)).toBe(12)
  })

  it('returns override for business', () => {
    expect(getEffectiveCommission('business', 'streamCommissionPercent', 15)).toBe(10)
    expect(getEffectiveCommission('business', 'ticketCommissionPercent', 7.5)).toBe(5)
    expect(getEffectiveCommission('business', 'tipCommissionPercent', 10)).toBe(5)
  })

  it('returns default when enterprise has no override', () => {
    expect(getEffectiveCommission('enterprise', 'streamCommissionPercent', 15)).toBe(15)
  })
})

