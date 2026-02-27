/**
 * @nzila/fx — FX Gain / Loss Calculator
 *
 * ITA s.39 compliant foreign exchange gain/loss computation:
 *   - Realized gain/loss on settlement of foreign-currency receivables/payables
 *   - Unrealized gain/loss for revaluation at period-end
 *   - ITA s.39(1.1) $200 personal exemption (per-disposition)
 *
 * References:
 *   - Income Tax Act, R.S.C. 1985, c. 1, s.39(1)(a),(b) — capital gains/losses
 *   - Income Tax Act, R.S.C. 1985, c. 1, s.39(1.1) — $200 exemption individuals
 *   - Income Tax Act, R.S.C. 1985, c. 1, s.39(2) — deemed capital gain/loss
 *   - IAS 21 — The Effects of Changes in Foreign Exchange Rates
 *   - ASPE Section 1651 — Foreign Currency Translation
 *
 * @module @nzila/fx/gain-loss
 */
import { randomUUID } from 'crypto'
import type {
  CurrencyCode,
  FxGainLoss,
  FxGainLossType,
  MonetaryAmount,
} from './types'
import { CURRENCY_INFO } from './types'
import { roundAmount } from './convert'

// ── Constants ───────────────────────────────────────────────────────────────

/**
 * ITA s.39(1.1) — Personal FX exemption per disposition.
 * First $200 of gain/loss on foreign currency dispositions
 * by individuals is exempt from capital gain/loss treatment.
 *
 * Applies per disposition, NOT aggregate annual.
 * Does NOT apply to corporations or trusts.
 */
export const ITA_S39_PERSONAL_EXEMPTION = 200

// ── Realized Gain/Loss ──────────────────────────────────────────────────────

export interface FxTransaction {
  /** Original foreign currency amount */
  foreignAmount: number
  /** Foreign currency code */
  foreignCurrency: CurrencyCode
  /** Functional currency code (typically CAD) */
  functionalCurrency: CurrencyCode
  /** Exchange rate at booking date (foreign → functional) */
  bookRate: number
  /** Date the transaction was booked */
  bookDate: string
}

export interface FxSettlement {
  /** Exchange rate at settlement date (foreign → functional) */
  settlementRate: number
  /** Date the transaction was settled */
  settlementDate: string
  /** Amount settled in foreign currency (partial settlements supported) */
  settledForeignAmount?: number
}

/**
 * Calculate realized FX gain/loss when a foreign-currency transaction is settled.
 *
 * Formula:
 *   Functional at settlement = foreignAmount × settlementRate
 *   Functional at booking    = foreignAmount × bookRate
 *   Gain/Loss = settlement - booking
 *
 * A positive result = gain (functional currency appreciated, or foreign depreciated).
 * A negative result = loss.
 *
 * For receivables:
 *   - Booked at $100 USD × 1.30 = $130 CAD
 *   - Settled at $100 USD × 1.35 = $135 CAD
 *   - Gain = $5 CAD (received more functional than expected)
 *
 * For payables:
 *   - Booked at $100 USD × 1.30 = $130 CAD
 *   - Settled at $100 USD × 1.35 = $135 CAD
 *   - Loss = -$5 CAD (paid more functional than expected)
 *   Note: for payables, negate the result since the direction is reversed.
 *
 * @param transaction - The original booked transaction
 * @param settlement - The settlement details
 * @param options - Whether to apply ITA s.39(1.1) exemption
 */
export function calculateRealizedGainLoss(
  transaction: FxTransaction,
  settlement: FxSettlement,
  options?: {
    /** Apply ITA s.39(1.1) $200 personal exemption */
    applyPersonalExemption?: boolean
    /** 'receivable' or 'payable' — determines gain/loss direction */
    direction?: 'receivable' | 'payable'
  },
): FxGainLoss {
  const settledAmount = settlement.settledForeignAmount ?? transaction.foreignAmount
  const decimals = CURRENCY_INFO[transaction.functionalCurrency]?.decimals ?? 2

  const functionalAtBook = roundAmount(settledAmount * transaction.bookRate, decimals)
  const functionalAtSettlement = roundAmount(settledAmount * settlement.settlementRate, decimals)

  let rawGainLoss = roundAmount(functionalAtSettlement - functionalAtBook, decimals)

  // Payables: paying more functional = loss (negate)
  if (options?.direction === 'payable') {
    rawGainLoss = -rawGainLoss
  }

  // ITA s.39(1.1) — personal exemption
  let personalExemptionApplies = false
  let amount = rawGainLoss

  if (options?.applyPersonalExemption) {
    const absGainLoss = Math.abs(rawGainLoss)
    if (absGainLoss <= ITA_S39_PERSONAL_EXEMPTION) {
      personalExemptionApplies = true
      amount = 0 // Entire amount exempt
    } else {
      personalExemptionApplies = true
      // Only the first $200 is exempt
      amount = rawGainLoss > 0
        ? rawGainLoss - ITA_S39_PERSONAL_EXEMPTION
        : rawGainLoss + ITA_S39_PERSONAL_EXEMPTION
    }
  }

  return {
    id: randomUUID(),
    type: 'realized' as FxGainLossType,
    amount: roundAmount(amount, decimals),
    rawAmount: rawGainLoss,
    functionalCurrency: transaction.functionalCurrency,
    originalAmount: settledAmount,
    originalCurrency: transaction.foreignCurrency,
    bookRate: transaction.bookRate,
    bookDate: transaction.bookDate,
    currentRate: settlement.settlementRate,
    currentDate: settlement.settlementDate,
    personalExemptionApplies,
    personalExemptionAmount: personalExemptionApplies
      ? Math.min(Math.abs(rawGainLoss), ITA_S39_PERSONAL_EXEMPTION)
      : 0,
    calculatedAt: new Date().toISOString(),
  }
}

// ── Unrealized Gain/Loss ────────────────────────────────────────────────────

export interface OpenPosition {
  /** Foreign currency amount still outstanding */
  foreignAmount: number
  /** Foreign currency code */
  foreignCurrency: CurrencyCode
  /** Functional currency code */
  functionalCurrency: CurrencyCode
  /** Rate at which the position was booked */
  bookRate: number
  /** Date the position was booked */
  bookDate: string
  /** Transaction reference for audit */
  referenceId?: string
}

/**
 * Calculate unrealized FX gain/loss for period-end revaluation.
 *
 * Used for:
 *   - Month-end / year-end balance sheet revaluation
 *   - IAS 21 / ASPE 1651 monetary item translation
 *   - Foreign currency bank account revaluation
 *
 * @param position - The open foreign-currency position
 * @param currentRate - Current exchange rate (foreign → functional)
 * @param revaluationDate - Date of revaluation (e.g., '2025-12-31')
 */
export function calculateUnrealizedGainLoss(
  position: OpenPosition,
  currentRate: number,
  revaluationDate: string,
): FxGainLoss {
  const decimals = CURRENCY_INFO[position.functionalCurrency]?.decimals ?? 2

  const functionalAtBook = roundAmount(position.foreignAmount * position.bookRate, decimals)
  const functionalAtCurrent = roundAmount(position.foreignAmount * currentRate, decimals)

  const gainLoss = roundAmount(functionalAtCurrent - functionalAtBook, decimals)

  return {
    id: randomUUID(),
    type: 'unrealized' as FxGainLossType,
    amount: gainLoss,
    rawAmount: gainLoss,
    functionalCurrency: position.functionalCurrency,
    originalAmount: position.foreignAmount,
    originalCurrency: position.foreignCurrency,
    bookRate: position.bookRate,
    bookDate: position.bookDate,
    currentRate,
    currentDate: revaluationDate,
    personalExemptionApplies: false,
    personalExemptionAmount: 0,
    referenceId: position.referenceId,
    calculatedAt: new Date().toISOString(),
  }
}

// ── Batch Revaluation ───────────────────────────────────────────────────────

export interface RevaluationResult {
  /** Total unrealized gain (positive amounts) */
  totalGain: number
  /** Total unrealized loss (negative amounts) */
  totalLoss: number
  /** Net unrealized gain/loss */
  net: number
  /** Functional currency */
  functionalCurrency: CurrencyCode
  /** Individual position results */
  positions: FxGainLoss[]
  /** Revaluation date */
  revaluationDate: string
}

/**
 * Revalue a batch of open foreign-currency positions at period-end.
 *
 * @param positions - Array of open positions to revalue
 * @param rates - Map of currency → current rate (foreign → functional)
 * @param revaluationDate - Date of revaluation
 */
export function revaluePositions(
  positions: OpenPosition[],
  rates: Map<CurrencyCode, number>,
  revaluationDate: string,
): RevaluationResult {
  if (positions.length === 0) {
    throw new Error('No positions to revalue')
  }

  const functionalCurrency = positions[0]!.functionalCurrency
  const decimals = CURRENCY_INFO[functionalCurrency]?.decimals ?? 2
  const results: FxGainLoss[] = []

  for (const position of positions) {
    if (position.functionalCurrency !== functionalCurrency) {
      throw new Error(
        `Mixed functional currencies: expected ${functionalCurrency}, got ${position.functionalCurrency}`,
      )
    }

    const currentRate = rates.get(position.foreignCurrency)
    if (currentRate === undefined) {
      throw new Error(
        `No current rate available for ${position.foreignCurrency}/${functionalCurrency}`,
      )
    }

    results.push(calculateUnrealizedGainLoss(position, currentRate, revaluationDate))
  }

  const totalGain = roundAmount(
    results.filter((r) => r.amount > 0).reduce((sum, r) => sum + r.amount, 0),
    decimals,
  )
  const totalLoss = roundAmount(
    results.filter((r) => r.amount < 0).reduce((sum, r) => sum + r.amount, 0),
    decimals,
  )

  return {
    totalGain,
    totalLoss,
    net: roundAmount(totalGain + totalLoss, decimals),
    functionalCurrency,
    positions: results,
    revaluationDate,
  }
}
