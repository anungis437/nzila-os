/**
 * @nzila/zonga-economics — Fee Engine
 *
 * Computes fees for revenue events based on configurable rules.
 * Supports percentage-based, flat, and tiered fees.
 */
import type { FeeRule, AppliedFee, RevenueSource, Currency } from './types'
import { FeeType } from './types'

/**
 * Default platform fee rules.
 * These are the baseline; orgs can override with custom rules.
 */
export const DEFAULT_FEE_RULES: readonly FeeRule[] = [
  {
    id: 'fee_platform_stream',
    orgId: '*',
    feeType: FeeType.PLATFORM_COMMISSION,
    revenueSource: 'stream' as RevenueSource,
    ratePercent: 30,
    flatAmount: 0,
    currency: 'USD' as Currency,
    minAmount: 0,
    maxAmount: null,
    isActive: true,
    effectiveFrom: new Date('2024-01-01'),
    effectiveUntil: null,
  },
  {
    id: 'fee_platform_ticket',
    orgId: '*',
    feeType: FeeType.PLATFORM_COMMISSION,
    revenueSource: 'ticket_sale' as RevenueSource,
    ratePercent: 10,
    flatAmount: 0.50,
    currency: 'USD' as Currency,
    minAmount: 0,
    maxAmount: null,
    isActive: true,
    effectiveFrom: new Date('2024-01-01'),
    effectiveUntil: null,
  },
  {
    id: 'fee_platform_tip',
    orgId: '*',
    feeType: FeeType.PLATFORM_COMMISSION,
    revenueSource: 'tip' as RevenueSource,
    ratePercent: 5,
    flatAmount: 0,
    currency: 'USD' as Currency,
    minAmount: 0,
    maxAmount: null,
    isActive: true,
    effectiveFrom: new Date('2024-01-01'),
    effectiveUntil: null,
  },
  {
    id: 'fee_platform_sync',
    orgId: '*',
    feeType: FeeType.PLATFORM_COMMISSION,
    revenueSource: 'sync_license' as RevenueSource,
    ratePercent: 15,
    flatAmount: 0,
    currency: 'USD' as Currency,
    minAmount: 0,
    maxAmount: null,
    isActive: true,
    effectiveFrom: new Date('2024-01-01'),
    effectiveUntil: null,
  },
  {
    id: 'fee_payment_processing',
    orgId: '*',
    feeType: FeeType.PAYMENT_PROCESSING,
    revenueSource: 'ticket_sale' as RevenueSource,
    ratePercent: 2.9,
    flatAmount: 0.30,
    currency: 'USD' as Currency,
    minAmount: 0,
    maxAmount: null,
    isActive: true,
    effectiveFrom: new Date('2024-01-01'),
    effectiveUntil: null,
  },
] as const

/**
 * Apply fee rules to a gross amount for a given revenue source.
 */
export function applyFees(params: {
  grossAmount: number
  currency: Currency
  revenueSource: RevenueSource
  rules: readonly FeeRule[]
  now?: Date
}): { fees: AppliedFee[]; netAmount: number } {
  const { grossAmount, currency, revenueSource, rules, now = new Date() } = params

  const applicableRules = rules.filter(
    (r) =>
      r.isActive &&
      r.revenueSource === revenueSource &&
      r.effectiveFrom <= now &&
      (!r.effectiveUntil || r.effectiveUntil > now),
  )

  const fees: AppliedFee[] = []
  let totalFees = 0

  for (const rule of applicableRules) {
    let feeAmount = rule.flatAmount + (grossAmount * rule.ratePercent) / 100

    if (rule.minAmount > 0 && feeAmount < rule.minAmount) {
      feeAmount = rule.minAmount
    }
    if (rule.maxAmount !== null && feeAmount > rule.maxAmount) {
      feeAmount = rule.maxAmount
    }

    // Round to 2 decimal places
    feeAmount = Math.round(feeAmount * 100) / 100

    fees.push({
      type: rule.feeType,
      amount: feeAmount,
      currency,
      ratePercent: rule.ratePercent,
      description: `${rule.feeType} (${rule.ratePercent}%${rule.flatAmount > 0 ? ` + ${rule.flatAmount}` : ''})`,
    })

    totalFees += feeAmount
  }

  return {
    fees,
    netAmount: Math.round((grossAmount - totalFees) * 100) / 100,
  }
}

/**
 * Resolve fee rules for a specific org + source.
 * Falls back to wildcard org rules if no org-specific rules exist.
 */
export function resolveFeeRules(
  allRules: readonly FeeRule[],
  orgId: string,
  revenueSource: RevenueSource,
  now?: Date,
): readonly FeeRule[] {
  const effective = now ?? new Date()
  const activeRules = allRules.filter(
    (r) =>
      r.isActive &&
      r.revenueSource === revenueSource &&
      r.effectiveFrom <= effective &&
      (!r.effectiveUntil || r.effectiveUntil > effective),
  )

  const orgRules = activeRules.filter((r) => r.orgId === orgId)
  if (orgRules.length > 0) return orgRules

  return activeRules.filter((r) => r.orgId === '*')
}
