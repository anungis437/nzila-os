/**
 * @nzila/zonga-rights — Royalty Engine
 *
 * Computes royalty accruals from usage data, integrates with
 * the economic engine for split calculations, and manages
 * payout thresholds.
 */
import type { SplitRule, Currency, RevenueSource } from '@nzila/zonga-economics'
import { calculateSplits, DEFAULT_FEE_RULES } from '@nzila/zonga-economics'
import type {
  RoyaltyRule,
  RoyaltyAccrual,
  SplitEntry,
  RoyaltyTrigger,
} from './types'

// ── Revenue Source Mapping ────────────────────────────────────────────────

/**
 * Map a royalty trigger to the corresponding revenue source for fee lookup.
 * Ensures each trigger type uses the correct fee schedule.
 */
function triggerToRevenueSource(trigger: RoyaltyTrigger): RevenueSource {
  const mapping: Record<string, RevenueSource> = {
    stream: 'stream',
    download: 'download',
    sync_license: 'sync_license',
    radio_play: 'radio_broadcast',
    live_performance: 'live_performance',
    user_generated_content: 'stream',
    mechanical: 'publishing_performance',
  }
  return mapping[trigger] ?? ('stream' as RevenueSource)
}

// ── Types ─────────────────────────────────────────────────────────────────

export interface RoyaltyCalculation {
  readonly assetId: string
  readonly trigger: RoyaltyTrigger
  readonly units: number
  readonly grossAmount: number
  readonly netAmount: number
  readonly accruals: readonly HolderAccrual[]
}

export interface HolderAccrual {
  readonly holderId: string
  readonly holderName: string
  readonly percentage: number
  readonly grossAmount: number
  readonly netAmount: number
}

export interface PayoutReadiness {
  readonly holderId: string
  readonly totalAccrued: number
  readonly minimumPayout: number
  readonly ready: boolean
  readonly shortfall: number
}

// ── Royalty Calculation ───────────────────────────────────────────────────

/**
 * Calculate royalties for a usage period.
 *
 * @param rule - The royalty rule governing the rate
 * @param units - Number of usage units (streams, downloads, etc.)
 * @param splits - Rights holder splits for this asset
 * @returns Full royalty calculation with per-holder breakdowns
 */
export function calculateRoyalties(
  rule: RoyaltyRule,
  units: number,
  splits: readonly SplitEntry[],
): RoyaltyCalculation {
  if (units <= 0) {
    return {
      assetId: rule.assetId,
      trigger: rule.trigger,
      units: 0,
      grossAmount: 0,
      netAmount: 0,
      accruals: [],
    }
  }

  const grossAmount = Math.round(units * rule.ratePerUnit * 100) / 100

  const effectiveFrom = new Date('2024-01-01')
  // Convert SplitEntry to SplitRule for the economic engine
  const splitRules: SplitRule[] = splits.map((s, i) => ({
    id: `royalty-split-${i}`,
    orgId: '*',
    revenueSource: triggerToRevenueSource(rule.trigger),
    recipientAccountId: s.holderId,
    recipientName: s.holderName,
    sharePercent: s.percentage,
    priority: i,
    isActive: true,
    effectiveFrom,
    effectiveUntil: null,
  }))

  // Use the fee rules matching the actual revenue source (not hardcoded to stream)
  const revenueSource = triggerToRevenueSource(rule.trigger)
  const sourceFees = DEFAULT_FEE_RULES.filter(
    (r) => r.revenueSource === revenueSource,
  )
  // Fall back to stream fees only if no rules exist for this source
  const feeRules = sourceFees.length > 0
    ? sourceFees
    : DEFAULT_FEE_RULES.filter((r) => r.revenueSource === 'stream')

  const splitResult = calculateSplits({
    revenueEventId: `royalty-${rule.assetId}`,
    grossAmount,
    currency: 'USD' as Currency,
    revenueSource,
    splitRules,
    feeRules: [...feeRules],
  })
  const netAmount = splitResult.netAmount

  const accruals: HolderAccrual[] = splitResult.distributions.map((d) => {
    const split = splits.find((s) => s.holderId === d.recipientAccountId)
    return {
      holderId: d.recipientAccountId,
      holderName: split?.holderName ?? d.recipientName,
      percentage: split?.percentage ?? 0,
      grossAmount: Math.round((grossAmount * (split?.percentage ?? 0)) / 100 * 100) / 100,
      netAmount: d.amount,
    }
  })

  return {
    assetId: rule.assetId,
    trigger: rule.trigger,
    units,
    grossAmount,
    netAmount,
    accruals,
  }
}

// ── Payout Threshold ──────────────────────────────────────────────────────

/**
 * Check if a holder has accrued enough royalties for payout.
 */
export function checkPayoutReadiness(
  holderId: string,
  accruals: readonly RoyaltyAccrual[],
  minimumPayout: number = 1,
): PayoutReadiness {
  const holderAccruals = accruals.filter(
    (a) => a.holderId === holderId && a.status === 'approved',
  )
  const totalAccrued = holderAccruals.reduce((sum, a) => sum + a.netAmount, 0)
  const rounded = Math.round(totalAccrued * 100) / 100

  return {
    holderId,
    totalAccrued: rounded,
    minimumPayout,
    ready: rounded >= minimumPayout,
    shortfall: rounded >= minimumPayout ? 0 : Math.round((minimumPayout - rounded) * 100) / 100,
  }
}

// ── Aggregation ───────────────────────────────────────────────────────────

export interface RoyaltySummary {
  readonly assetId: string
  readonly totalUnits: number
  readonly totalGross: number
  readonly totalNet: number
  readonly byTrigger: Record<string, { units: number; gross: number; net: number }>
}

/**
 * Aggregate royalty accruals into a summary for a given asset.
 */
export function summarizeRoyalties(
  assetId: string,
  accruals: readonly RoyaltyAccrual[],
): RoyaltySummary {
  const relevant = accruals.filter((a) => a.assetId === assetId)

  const byTrigger: Record<string, { units: number; gross: number; net: number }> = {}

  for (const accrual of relevant) {
    const trigger = accrual.trigger
    if (!byTrigger[trigger]) {
      byTrigger[trigger] = { units: 0, gross: 0, net: 0 }
    }
    byTrigger[trigger]!.units += accrual.units
    byTrigger[trigger]!.gross += accrual.grossAmount
    byTrigger[trigger]!.net += accrual.netAmount
  }

  // Round all values
  for (const key of Object.keys(byTrigger)) {
    const entry = byTrigger[key]!
    byTrigger[key] = {
      units: entry.units,
      gross: Math.round(entry.gross * 100) / 100,
      net: Math.round(entry.net * 100) / 100,
    }
  }

  return {
    assetId,
    totalUnits: relevant.reduce((sum, a) => sum + a.units, 0),
    totalGross: Math.round(relevant.reduce((sum, a) => sum + a.grossAmount, 0) * 100) / 100,
    totalNet: Math.round(relevant.reduce((sum, a) => sum + a.netAmount, 0) * 100) / 100,
    byTrigger,
  }
}
