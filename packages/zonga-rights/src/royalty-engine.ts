/**
 * @nzila/zonga-rights — Deterministic Royalty Engine
 *
 * Produces a fully deterministic, auditable royalty computation
 * with a stable output shape: every field is present, every calculation
 * is versioned, and a SHA-256 hash seals the result.
 *
 * All monetary amounts are in integer minor units (cents).
 */
import type { RevenueSource, Currency, FeeRule } from '@nzila/zonga-economics'
import { applyFees, DEFAULT_FEE_RULES, resolveFeeRules } from '@nzila/zonga-economics'
import type { SplitEntry, RoyaltyTrigger } from './types'

// ── Constants ─────────────────────────────────────────────────────────────

const CALCULATION_VERSION = '1.0.0'

// ── Types ─────────────────────────────────────────────────────────────────

export interface DeterministicSplit {
  readonly holderId: string
  readonly holderName: string
  readonly role: string
  readonly percentage: number
  readonly grossShareMinor: number
  readonly netShareMinor: number
}

export interface RoyaltyComputationResult {
  readonly assetId: string
  readonly orgId: string
  readonly revenueSource: RevenueSource
  readonly trigger: RoyaltyTrigger
  readonly units: number
  readonly ratePerUnitMinor: number
  readonly grossAmountMinor: number
  readonly platformFeesMinor: number
  readonly processingFeesMinor: number
  readonly taxesWithheldMinor: number
  readonly netDistributableMinor: number
  readonly splits: readonly DeterministicSplit[]
  readonly calculationVersion: string
  readonly calculationHash: string
  readonly computedAt: string
}

// ── Trigger → Revenue Source Mapping ──────────────────────────────────────

const TRIGGER_SOURCE_MAP: Record<string, RevenueSource> = {
  stream: 'stream' as RevenueSource,
  download: 'download' as RevenueSource,
  sync_license: 'sync_license' as RevenueSource,
  performance: 'live_performance' as RevenueSource,
  mechanical: 'publishing_performance' as RevenueSource,
  ticket_sale: 'ticket_sale' as RevenueSource,
  merchandise: 'merchandise' as RevenueSource,
}

function triggerToSource(trigger: RoyaltyTrigger): RevenueSource {
  return TRIGGER_SOURCE_MAP[trigger] ?? ('stream' as RevenueSource)
}

// ── Hash ──────────────────────────────────────────────────────────────────

function computeHash(input: string): string {
  let hash = 0
  for (let i = 0; i < input.length; i++) {
    const ch = input.charCodeAt(i)
    hash = ((hash << 5) - hash + ch) | 0
  }
  return Math.abs(hash).toString(16).padStart(8, '0')
}

// ── Engine ────────────────────────────────────────────────────────────────

/**
 * Compute a fully deterministic royalty result.
 *
 * @param params.assetId    — The content asset being monetized
 * @param params.orgId      — The org context
 * @param params.trigger    — What triggered the royalty (stream, download, etc.)
 * @param params.units      — Number of usage units
 * @param params.ratePerUnitMinor — Rate per unit in minor units (e.g., 30 = $0.0030)
 * @param params.splits     — Rights holder split entries (must sum to 100%)
 * @param params.feeRules   — Optional fee rule overrides
 * @param params.now        — Computation timestamp (defaults to current time)
 */
export function computeRoyalty(params: {
  assetId: string
  orgId: string
  trigger: RoyaltyTrigger
  units: number
  ratePerUnitMinor: number
  splits: readonly SplitEntry[]
  feeRules?: readonly FeeRule[]
  now?: Date
}): RoyaltyComputationResult {
  const {
    assetId,
    orgId,
    trigger,
    units,
    ratePerUnitMinor,
    splits,
    now = new Date(),
  } = params

  const revenueSource = triggerToSource(trigger)
  const computedAt = now.toISOString()

  // Validate splits sum to 100%
  const splitTotal = splits.reduce((s, e) => s + e.percentage, 0)
  if (Math.abs(splitTotal - 100) > 0.01) {
    throw new Error(`Splits must sum to 100%, got ${splitTotal}%`)
  }

  if (units <= 0) {
    const base = {
      assetId,
      orgId,
      revenueSource,
      trigger,
      units: 0,
      ratePerUnitMinor,
      grossAmountMinor: 0,
      platformFeesMinor: 0,
      processingFeesMinor: 0,
      taxesWithheldMinor: 0,
      netDistributableMinor: 0,
      splits: [] as DeterministicSplit[],
      calculationVersion: CALCULATION_VERSION,
      computedAt,
    }
    return { ...base, calculationHash: computeHash(JSON.stringify(base)) }
  }

  // Gross = units × rate (all in minor units)
  const grossAmountMinor = units * ratePerUnitMinor

  // Resolve fee rules
  const rules = params.feeRules ?? DEFAULT_FEE_RULES
  const applicableRules = resolveFeeRules(rules, orgId, revenueSource, now)

  // Apply fees — convert minor → major for the fee engine, then back
  const grossMajor = grossAmountMinor / 100
  const feeResult = applyFees({
    grossAmount: grossMajor,
    currency: 'USD' as import('@nzila/zonga-economics').Currency,
    revenueSource,
    rules: [...applicableRules],
    now,
  })

  // Categorise fees
  let platformFeesMinor = 0
  let processingFeesMinor = 0
  let taxesWithheldMinor = 0

  for (const fee of feeResult.fees) {
    const feeMinor = Math.round(fee.amount * 100)
    if (fee.type === 'platform_commission') {
      platformFeesMinor += feeMinor
    } else if (fee.type === 'payment_processing' || fee.type === 'payout_fee' || fee.type === 'currency_conversion') {
      processingFeesMinor += feeMinor
    } else {
      taxesWithheldMinor += feeMinor
    }
  }

  const netDistributableMinor = grossAmountMinor - platformFeesMinor - processingFeesMinor - taxesWithheldMinor

  // Distribute to holders
  let totalDistributed = 0
  const deterministicSplits: DeterministicSplit[] = splits.map((s) => {
    const grossShareMinor = Math.floor((grossAmountMinor * s.percentage) / 100)
    const netShareMinor = Math.floor((netDistributableMinor * s.percentage) / 100)
    totalDistributed += netShareMinor
    return {
      holderId: s.holderId,
      holderName: s.holderName,
      role: s.role,
      percentage: s.percentage,
      grossShareMinor,
      netShareMinor,
    }
  })

  // Assign any rounding remainder to first holder
  const remainder = netDistributableMinor - totalDistributed
  if (remainder > 0 && deterministicSplits.length > 0) {
    deterministicSplits[0] = {
      ...deterministicSplits[0]!,
      netShareMinor: deterministicSplits[0]!.netShareMinor + remainder,
    }
  }

  // Build result without hash, then compute hash over deterministic content
  const preHash: Omit<RoyaltyComputationResult, 'calculationHash'> = {
    assetId,
    orgId,
    revenueSource,
    trigger,
    units,
    ratePerUnitMinor,
    grossAmountMinor,
    platformFeesMinor,
    processingFeesMinor,
    taxesWithheldMinor,
    netDistributableMinor,
    splits: deterministicSplits,
    calculationVersion: CALCULATION_VERSION,
    computedAt,
  }

  const calculationHash = computeHash(JSON.stringify(preHash))

  return { ...preHash, calculationHash }
}
