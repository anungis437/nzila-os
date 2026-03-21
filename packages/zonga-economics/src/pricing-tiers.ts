/**
 * @nzila/zonga-economics — Pricing Tiers
 *
 * Bridges app-level creator plans to the economics engine.
 * Maps plan tiers to fee rule overrides, split configurations,
 * and monetization entitlements. All money in integer minor units (cents).
 *
 * @module @nzila/zonga-economics/pricing-tiers
 */

import type { FeeRule, Currency, RevenueSource } from './types'
import { FeeType } from './types'
import { DEFAULT_FEE_RULES } from './fees'

// ── Plan Tiers ──────────────────────────────────────────────────────────────

export type CreatorPlanTier = 'starter' | 'pro_creator' | 'business' | 'enterprise'

export interface PricingTier {
  readonly tier: CreatorPlanTier
  readonly name: string
  readonly priceMonthlyMinor: number | null
  readonly priceAnnualMinor: number | null
  readonly commissionOverrides: Readonly<Partial<Record<RevenueSource, number>>>
  readonly maxSplitParties: number
  readonly payoutMinimumMinor: number
  readonly payoutFrequency: 'monthly' | 'bi-weekly' | 'weekly' | 'on-demand'
  readonly revenueSharePercent: number
  readonly subscriptionRevenueSharePercent: number
}

/**
 * Canonical pricing tier definitions.
 * Commission overrides replace the DEFAULT_FEE_RULES percentages.
 * Null overrides mean "use platform default".
 */
export const PRICING_TIERS: Readonly<Record<CreatorPlanTier, PricingTier>> = {
  starter: {
    tier: 'starter',
    name: 'Starter',
    priceMonthlyMinor: 0,
    priceAnnualMinor: 0,
    commissionOverrides: {},
    maxSplitParties: 3,
    payoutMinimumMinor: 5000, // $50.00
    payoutFrequency: 'monthly',
    revenueSharePercent: 85,
    subscriptionRevenueSharePercent: 88,
  },
  pro_creator: {
    tier: 'pro_creator',
    name: 'Pro Creator',
    priceMonthlyMinor: 2900,
    priceAnnualMinor: 29000,
    commissionOverrides: {
      stream: 12,
      download: 10,
      ticket_sale: 6,
      tip: 8,
      subscription: 10,
    },
    maxSplitParties: 10,
    payoutMinimumMinor: 2500, // $25.00
    payoutFrequency: 'bi-weekly',
    revenueSharePercent: 88,
    subscriptionRevenueSharePercent: 90,
  },
  business: {
    tier: 'business',
    name: 'Business',
    priceMonthlyMinor: 14900,
    priceAnnualMinor: 149000,
    commissionOverrides: {
      stream: 10,
      download: 8,
      ticket_sale: 5,
      tip: 5,
      subscription: 8,
      sync_license: 12,
      merchandise: 7,
      sponsorship: 8,
    },
    maxSplitParties: 50,
    payoutMinimumMinor: 1000, // $10.00
    payoutFrequency: 'weekly',
    revenueSharePercent: 90,
    subscriptionRevenueSharePercent: 92,
  },
  enterprise: {
    tier: 'enterprise',
    name: 'Enterprise',
    priceMonthlyMinor: null,
    priceAnnualMinor: null,
    commissionOverrides: {},
    maxSplitParties: 999,
    payoutMinimumMinor: 0,
    payoutFrequency: 'on-demand',
    revenueSharePercent: 92,
    subscriptionRevenueSharePercent: 95,
  },
} as const

// ── Fee Rule Resolution ─────────────────────────────────────────────────────

/**
 * Resolve effective fee rules for a given plan tier.
 * Applies the tier's commission overrides on top of DEFAULT_FEE_RULES.
 * Returns a new array — never mutates the source.
 */
export function resolveTierFeeRules(
  tier: CreatorPlanTier,
  orgId: string,
): readonly FeeRule[] {
  const pricingTier = PRICING_TIERS[tier]
  const overrides = pricingTier.commissionOverrides

  return DEFAULT_FEE_RULES.map((rule): FeeRule => {
    if (rule.feeType !== FeeType.PLATFORM_COMMISSION) return rule

    const overrideRate = overrides[rule.revenueSource]
    if (overrideRate === undefined) return rule

    return {
      ...rule,
      id: `${rule.id}_${tier}`,
      orgId,
      ratePercent: overrideRate,
    }
  })
}

/**
 * Get the effective commission rate for a specific revenue source and plan tier.
 * Returns the overridden rate if the tier has one, otherwise the platform default.
 */
export function getEffectiveTierCommission(
  tier: CreatorPlanTier,
  source: RevenueSource,
): number {
  const pricingTier = PRICING_TIERS[tier]
  const override = pricingTier.commissionOverrides[source]
  if (override !== undefined) return override

  const defaultRule = DEFAULT_FEE_RULES.find(
    (r) => r.revenueSource === source && r.feeType === FeeType.PLATFORM_COMMISSION,
  )
  return defaultRule?.ratePercent ?? 0
}

/**
 * Compute the monthly subscription revenue the platform earns from a tier.
 * Enterprise returns 0 (custom pricing, not tracked here).
 */
export function computeSubscriptionRevenue(
  tier: CreatorPlanTier,
  subscriberCount: number,
): number {
  const price = PRICING_TIERS[tier].priceMonthlyMinor
  if (price === null) return 0
  return price * subscriberCount
}

/**
 * Check if a tier supports a given payout frequency.
 */
export function isTierPayoutFrequencyAllowed(
  tier: CreatorPlanTier,
  frequency: PricingTier['payoutFrequency'],
): boolean {
  const frequencies: readonly PricingTier['payoutFrequency'][] = [
    'monthly',
    'bi-weekly',
    'weekly',
    'on-demand',
  ]
  const tierIdx = frequencies.indexOf(PRICING_TIERS[tier].payoutFrequency)
  const requestedIdx = frequencies.indexOf(frequency)
  return requestedIdx <= tierIdx
}

/**
 * Compute the net creator payout from a gross revenue amount
 * after applying the tier's effective commission.
 */
export function computeCreatorNetRevenue(
  tier: CreatorPlanTier,
  source: RevenueSource,
  grossAmountMinor: number,
): { grossMinor: number; commissionMinor: number; netMinor: number; commissionPercent: number } {
  const rate = getEffectiveTierCommission(tier, source)
  const commissionMinor = Math.round((grossAmountMinor * rate) / 100)
  const netMinor = grossAmountMinor - commissionMinor
  return { grossMinor: grossAmountMinor, commissionMinor, netMinor, commissionPercent: rate }
}
