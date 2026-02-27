/**
 * @nzila/fx — Multi-Currency Ledger Helpers
 *
 * Utilities for recording and aggregating multi-currency ledger entries:
 *   - DualCurrencyAmount construction with rate lookup
 *   - Period-end revaluation of foreign-currency balances
 *   - Aggregation of multi-currency amounts to functional currency
 *   - Multi-currency trial balance support
 *
 * Conforms to:
 *   - IAS 21 — monetary/non-monetary classification for revaluation
 *   - ASPE 1651 — Canadian GAAP foreign currency translation
 *
 * @module @nzila/fx/ledger
 */
import type {
  CurrencyCode,
  DualCurrencyAmount,
  EntityCurrencyConfig,
  MonetaryAmount,
  RateSource,
} from './types'
import { CURRENCY_INFO } from './types'
import { convertToFunctional } from './convert'
import { roundAmount } from './convert'
import type { RateProvider } from './boc'

// ── Types ───────────────────────────────────────────────────────────────────

/** A single ledger entry with dual-currency recording */
export interface MultiCurrencyEntry {
  /** Unique entry identifier */
  entryId: string
  /** Account code (e.g., '1200' for AR, '2000' for AP) */
  accountCode: string
  /** Debit amount in transaction (original) currency */
  debit: DualCurrencyAmount | null
  /** Credit amount in transaction (original) currency */
  credit: DualCurrencyAmount | null
  /** ISO date of the entry */
  date: string
  /** Memo/description */
  memo?: string
  /** Entity this entry belongs to */
  entityId: string
}

/** Trial balance line in functional currency */
export interface TrialBalanceLine {
  accountCode: string
  currency: CurrencyCode
  foreignDebit: number
  foreignCredit: number
  functionalDebit: number
  functionalCredit: number
  exchangeRate: number
  rateDate: string
}

/** Summary of foreign-currency exposure for an entity */
export interface CurrencyExposure {
  currency: CurrencyCode
  /** Sum of debit balances in foreign currency */
  totalDebit: number
  /** Sum of credit balances in foreign currency */
  totalCredit: number
  /** Net position in foreign currency (debit - credit) */
  netPosition: number
  /** Net position converted to functional currency */
  netFunctional: number
  /** Count of entries in this currency */
  entryCount: number
}

// ── Dual-Currency Amount Builders ───────────────────────────────────────────

/**
 * Create a DualCurrencyAmount from a foreign-currency amount.
 * Automatically fetches the exchange rate and converts to functional currency.
 */
export async function createDualAmount(
  amount: number,
  currency: CurrencyCode,
  config: EntityCurrencyConfig,
  date?: string,
  options?: { provider?: RateProvider },
): Promise<DualCurrencyAmount> {
  return convertToFunctional(
    { amount, currency },
    config,
    date,
    options,
  )
}

/**
 * Create a DualCurrencyAmount from a known rate (no API call).
 * Use when the rate is already known (e.g., from a rate sheet or manual entry).
 */
export function createDualAmountFromRate(
  amount: number,
  currency: CurrencyCode,
  config: EntityCurrencyConfig,
  rate: number,
  rateDate: string,
  rateSource: RateSource = 'manual',
): DualCurrencyAmount {
  const decimals = CURRENCY_INFO[config.functionalCurrency]?.decimals ?? 2

  if (currency === config.functionalCurrency) {
    return {
      original: { amount, currency },
      functional: { amount, currency: config.functionalCurrency },
      exchangeRate: 1,
      rateDate,
      rateSource: 'fallback',
    }
  }

  return {
    original: { amount, currency },
    functional: {
      amount: roundAmount(amount * rate, decimals),
      currency: config.functionalCurrency,
    },
    exchangeRate: rate,
    rateDate,
    rateSource,
  }
}

// ── Aggregation ─────────────────────────────────────────────────────────────

/**
 * Aggregate multiple monetary amounts in different currencies to a single
 * functional currency total.
 *
 * @param amounts - Array of monetary amounts in various currencies
 * @param config - Entity currency configuration
 * @param date - Date for rate lookup
 * @returns Total in functional currency
 */
export async function aggregateToFunctional(
  amounts: MonetaryAmount[],
  config: EntityCurrencyConfig,
  date?: string,
  options?: { provider?: RateProvider },
): Promise<MonetaryAmount> {
  const decimals = CURRENCY_INFO[config.functionalCurrency]?.decimals ?? 2
  let total = 0

  for (const amt of amounts) {
    const dual = await convertToFunctional(amt, config, date, options)
    total += dual.functional.amount
  }

  return {
    amount: roundAmount(total, decimals),
    currency: config.functionalCurrency,
  }
}

/**
 * Aggregate monetary amounts synchronously using pre-fetched rates.
 */
export function aggregateToFunctionalSync(
  amounts: MonetaryAmount[],
  config: EntityCurrencyConfig,
  rates: Map<CurrencyCode, number>,
  rateDate: string,
): MonetaryAmount {
  const decimals = CURRENCY_INFO[config.functionalCurrency]?.decimals ?? 2
  let total = 0

  for (const amt of amounts) {
    if (amt.currency === config.functionalCurrency) {
      total += amt.amount
    } else {
      const rate = rates.get(amt.currency)
      if (rate === undefined) {
        throw new Error(
          `No rate available for ${amt.currency}/${config.functionalCurrency}`,
        )
      }
      total += amt.amount * rate
    }
  }

  return {
    amount: roundAmount(total, decimals),
    currency: config.functionalCurrency,
  }
}

// ── Currency Exposure ───────────────────────────────────────────────────────

/**
 * Calculate foreign-currency exposure from a set of ledger entries.
 * Groups by currency and computes net positions.
 */
export function calculateExposure(
  entries: MultiCurrencyEntry[],
  functionalCurrency: CurrencyCode,
): CurrencyExposure[] {
  const exposureMap = new Map<CurrencyCode, {
    totalDebit: number
    totalCredit: number
    netFunctionalDebit: number
    netFunctionalCredit: number
    count: number
  }>()

  for (const entry of entries) {
    const processSide = (side: DualCurrencyAmount | null, isDebit: boolean) => {
      if (!side) return
      const currency = side.original.currency
      if (currency === functionalCurrency) return // Skip functional currency entries

      let exp = exposureMap.get(currency)
      if (!exp) {
        exp = { totalDebit: 0, totalCredit: 0, netFunctionalDebit: 0, netFunctionalCredit: 0, count: 0 }
        exposureMap.set(currency, exp)
      }

      if (isDebit) {
        exp.totalDebit += side.original.amount
        exp.netFunctionalDebit += side.functional.amount
      } else {
        exp.totalCredit += side.original.amount
        exp.netFunctionalCredit += side.functional.amount
      }
      exp.count++
    }

    processSide(entry.debit, true)
    processSide(entry.credit, false)
  }

  const decimals = CURRENCY_INFO[functionalCurrency]?.decimals ?? 2
  const result: CurrencyExposure[] = []

  for (const [currency, exp] of exposureMap) {
    result.push({
      currency,
      totalDebit: roundAmount(exp.totalDebit, CURRENCY_INFO[currency]?.decimals ?? 2),
      totalCredit: roundAmount(exp.totalCredit, CURRENCY_INFO[currency]?.decimals ?? 2),
      netPosition: roundAmount(exp.totalDebit - exp.totalCredit, CURRENCY_INFO[currency]?.decimals ?? 2),
      netFunctional: roundAmount(
        exp.netFunctionalDebit - exp.netFunctionalCredit,
        decimals,
      ),
      entryCount: exp.count,
    })
  }

  return result.sort((a, b) => Math.abs(b.netFunctional) - Math.abs(a.netFunctional))
}

// ── Trial Balance ───────────────────────────────────────────────────────────

/**
 * Generate a multi-currency trial balance from ledger entries.
 * Groups by account × currency and shows both foreign and functional amounts.
 */
export function multiCurrencyTrialBalance(
  entries: MultiCurrencyEntry[],
): TrialBalanceLine[] {
  const lineMap = new Map<string, TrialBalanceLine>()

  for (const entry of entries) {
    const processSide = (side: DualCurrencyAmount | null, isDebit: boolean) => {
      if (!side) return
      const key = `${entry.accountCode}:${side.original.currency}`

      let line = lineMap.get(key)
      if (!line) {
        line = {
          accountCode: entry.accountCode,
          currency: side.original.currency,
          foreignDebit: 0,
          foreignCredit: 0,
          functionalDebit: 0,
          functionalCredit: 0,
          exchangeRate: side.exchangeRate,
          rateDate: side.rateDate,
        }
        lineMap.set(key, line)
      }

      if (isDebit) {
        line.foreignDebit += side.original.amount
        line.functionalDebit += side.functional.amount
      } else {
        line.foreignCredit += side.original.amount
        line.functionalCredit += side.functional.amount
      }

      // Use the latest rate
      if (side.rateDate > line.rateDate) {
        line.exchangeRate = side.exchangeRate
        line.rateDate = side.rateDate
      }
    }

    processSide(entry.debit, true)
    processSide(entry.credit, false)
  }

  return Array.from(lineMap.values()).sort((a, b) =>
    a.accountCode.localeCompare(b.accountCode) || a.currency.localeCompare(b.currency),
  )
}
