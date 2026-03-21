/**
 * @nzila/zonga-economics — Split Engine
 *
 * Revenue distribution across multiple recipients.
 * Validates splits sum to 100%, computes per-recipient amounts.
 */
import type {
  SplitRule,
  SplitCalculation,
  SplitDistribution,
  RevenueSource,
  Currency,
} from './types'
import { applyFees } from './fees'

export interface SplitValidation {
  readonly valid: boolean
  readonly totalPercent: number
  readonly errors: readonly string[]
}

/**
 * Validate that split rules sum to exactly 100%.
 */
export function validateSplitRules(rules: readonly SplitRule[]): SplitValidation {
  const errors: string[] = []

  if (rules.length === 0) {
    return { valid: false, totalPercent: 0, errors: ['No split rules provided'] }
  }

  const totalPercent = rules.reduce((sum, r) => sum + r.sharePercent, 0)

  if (Math.abs(totalPercent - 100) > 0.01) {
    errors.push(`Split rules must sum to 100% (got ${totalPercent.toFixed(2)}%)`)
  }

  for (const rule of rules) {
    if (rule.sharePercent < 0) {
      errors.push(`Negative share for ${rule.recipientName}: ${rule.sharePercent}%`)
    }
    if (rule.sharePercent === 0) {
      errors.push(`Zero share for ${rule.recipientName}`)
    }
  }

  // Check for duplicate recipients
  const seen = new Set<string>()
  for (const rule of rules) {
    if (seen.has(rule.recipientAccountId)) {
      errors.push(`Duplicate recipient: ${rule.recipientName}`)
    }
    seen.add(rule.recipientAccountId)
  }

  return { valid: errors.length === 0, totalPercent, errors }
}

/**
 * Calculate revenue splits from a gross amount.
 * Applies fees first, then distributes net amount per split rules.
 */
export function calculateSplits(params: {
  revenueEventId: string
  grossAmount: number
  currency: Currency
  revenueSource: RevenueSource
  splitRules: readonly SplitRule[]
  feeRules: readonly import('./types').FeeRule[]
  now?: Date
}): SplitCalculation {
  const { revenueEventId, grossAmount, currency, revenueSource, splitRules, feeRules } = params

  // 1. Apply fees
  const { fees, netAmount } = applyFees({
    grossAmount,
    currency,
    revenueSource,
    rules: feeRules,
    now: params.now,
  })

  // 2. Distribute net amount per split rules
  const distributions: SplitDistribution[] = []
  let totalDistributed = 0

  // Sort by priority (highest first), then by share percent (largest first)
  const sorted = [...splitRules].sort(
    (a, b) => b.priority - a.priority || b.sharePercent - a.sharePercent,
  )

  for (const rule of sorted) {
    const amount = Math.round((netAmount * rule.sharePercent) / 100 * 100) / 100
    distributions.push({
      recipientAccountId: rule.recipientAccountId,
      recipientName: rule.recipientName,
      sharePercent: rule.sharePercent,
      amount,
    })
    totalDistributed += amount
  }

  // Round remainder gets assigned to highest-priority recipient
  const remainder = Math.round((netAmount - totalDistributed) * 100) / 100

  return {
    revenueEventId,
    grossAmount,
    fees,
    netAmount,
    distributions,
    totalDistributed,
    remainder,
  }
}
