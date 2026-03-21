import { describe, it, expect } from 'vitest'
import {
  PRICING_TIERS,
  resolveTierFeeRules,
  getEffectiveTierCommission,
  computeSubscriptionRevenue,
  isTierPayoutFrequencyAllowed,
  computeCreatorNetRevenue,
} from './pricing-tiers'
import type { CreatorPlanTier } from './pricing-tiers'
import { FeeType } from './types'

// ── PRICING_TIERS constant ──────────────────────────────────────────────────

describe('@nzila/zonga-economics — pricing-tiers', () => {
  it('defines all four tiers', () => {
    const tiers: CreatorPlanTier[] = ['starter', 'pro_creator', 'business', 'enterprise']
    for (const t of tiers) {
      expect(PRICING_TIERS[t]).toBeDefined()
      expect(PRICING_TIERS[t].tier).toBe(t)
    }
  })

  it('starter is free', () => {
    expect(PRICING_TIERS.starter.priceMonthlyMinor).toBe(0)
    expect(PRICING_TIERS.starter.priceAnnualMinor).toBe(0)
  })

  it('pro_creator costs $29/month', () => {
    expect(PRICING_TIERS.pro_creator.priceMonthlyMinor).toBe(2900)
  })

  it('business costs $149/month', () => {
    expect(PRICING_TIERS.business.priceMonthlyMinor).toBe(14900)
  })

  it('enterprise has custom pricing (null)', () => {
    expect(PRICING_TIERS.enterprise.priceMonthlyMinor).toBeNull()
  })

  it('higher tiers have lower payout minimums', () => {
    expect(PRICING_TIERS.starter.payoutMinimumMinor).toBeGreaterThan(
      PRICING_TIERS.pro_creator.payoutMinimumMinor,
    )
    expect(PRICING_TIERS.pro_creator.payoutMinimumMinor).toBeGreaterThan(
      PRICING_TIERS.business.payoutMinimumMinor,
    )
  })

  // ── resolveTierFeeRules ─────────────────────────────────────────────────

  it('starter uses default fee rules (no overrides)', () => {
    const rules = resolveTierFeeRules('starter', 'org-1')
    const streamRule = rules.find(
      (r) => r.revenueSource === 'stream' && r.feeType === FeeType.PLATFORM_COMMISSION,
    )
    expect(streamRule?.ratePercent).toBe(15) // platform default
  })

  it('pro_creator overrides stream commission to 12%', () => {
    const rules = resolveTierFeeRules('pro_creator', 'org-1')
    const streamRule = rules.find(
      (r) => r.revenueSource === 'stream' && r.feeType === FeeType.PLATFORM_COMMISSION,
    )
    expect(streamRule?.ratePercent).toBe(12)
    expect(streamRule?.orgId).toBe('org-1')
  })

  it('business overrides ticket commission to 5%', () => {
    const rules = resolveTierFeeRules('business', 'org-2')
    const ticketRule = rules.find(
      (r) => r.revenueSource === 'ticket_sale' && r.feeType === FeeType.PLATFORM_COMMISSION,
    )
    expect(ticketRule?.ratePercent).toBe(5)
  })

  it('preserves non-commission rules unchanged', () => {
    const rules = resolveTierFeeRules('business', 'org-1')
    const processingRules = rules.filter(
      (r) => r.feeType === FeeType.PAYMENT_PROCESSING,
    )
    for (const r of processingRules) {
      expect(r.orgId).toBe('*') // not overridden
    }
  })

  // ── getEffectiveTierCommission ──────────────────────────────────────────

  it('returns override for pro_creator streams (12%)', () => {
    expect(getEffectiveTierCommission('pro_creator', 'stream')).toBe(12)
  })

  it('returns platform default for starter streams (15%)', () => {
    expect(getEffectiveTierCommission('starter', 'stream')).toBe(15)
  })

  it('returns platform default for enterprise (negotiable)', () => {
    // Enterprise has no overrides — falls back to default
    expect(getEffectiveTierCommission('enterprise', 'stream')).toBe(15)
  })

  // ── computeSubscriptionRevenue ──────────────────────────────────────────

  it('computes monthly revenue from pro_creator subscribers', () => {
    expect(computeSubscriptionRevenue('pro_creator', 100)).toBe(290000)
  })

  it('enterprise subscription revenue is 0 (custom pricing)', () => {
    expect(computeSubscriptionRevenue('enterprise', 50)).toBe(0)
  })

  it('free tier subscription revenue is 0', () => {
    expect(computeSubscriptionRevenue('starter', 1000)).toBe(0)
  })

  // ── isTierPayoutFrequencyAllowed ────────────────────────────────────────

  it('starter can only use monthly payouts', () => {
    expect(isTierPayoutFrequencyAllowed('starter', 'monthly')).toBe(true)
    expect(isTierPayoutFrequencyAllowed('starter', 'bi-weekly')).toBe(false)
    expect(isTierPayoutFrequencyAllowed('starter', 'weekly')).toBe(false)
  })

  it('pro_creator can use monthly or bi-weekly', () => {
    expect(isTierPayoutFrequencyAllowed('pro_creator', 'monthly')).toBe(true)
    expect(isTierPayoutFrequencyAllowed('pro_creator', 'bi-weekly')).toBe(true)
    expect(isTierPayoutFrequencyAllowed('pro_creator', 'weekly')).toBe(false)
  })

  it('enterprise can use any frequency', () => {
    expect(isTierPayoutFrequencyAllowed('enterprise', 'on-demand')).toBe(true)
    expect(isTierPayoutFrequencyAllowed('enterprise', 'weekly')).toBe(true)
  })

  // ── computeCreatorNetRevenue ────────────────────────────────────────────

  it('computes net revenue for starter stream ($100 gross)', () => {
    const result = computeCreatorNetRevenue('starter', 'stream', 10000)
    expect(result.grossMinor).toBe(10000)
    expect(result.commissionPercent).toBe(15)
    expect(result.commissionMinor).toBe(1500)
    expect(result.netMinor).toBe(8500)
  })

  it('computes net revenue for business stream ($100 gross)', () => {
    const result = computeCreatorNetRevenue('business', 'stream', 10000)
    expect(result.grossMinor).toBe(10000)
    expect(result.commissionPercent).toBe(10)
    expect(result.commissionMinor).toBe(1000)
    expect(result.netMinor).toBe(9000)
  })

  it('handles zero gross amount', () => {
    const result = computeCreatorNetRevenue('starter', 'stream', 0)
    expect(result.commissionMinor).toBe(0)
    expect(result.netMinor).toBe(0)
  })

  it('rounds commission to nearest cent', () => {
    // 15% of 333 = 49.95, rounds to 50
    const result = computeCreatorNetRevenue('starter', 'stream', 333)
    expect(result.commissionMinor).toBe(50)
    expect(result.netMinor).toBe(283)
  })
})
