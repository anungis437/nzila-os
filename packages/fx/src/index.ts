/**
 * @nzila/fx — Exchange Rate & Multi-Currency Engine
 *
 * Complete multi-currency support for Canadian businesses:
 *   - Bank of Canada exchange rate integration (Valet API)
 *   - Currency conversion with audit trails
 *   - FX gain/loss calculation (ITA s.39 compliant)
 *   - Multi-currency ledger helpers
 *   - In-memory rate caching (LRU + TTL)
 *
 * @example
 * ```ts
 * import { convertCurrency, getRate, formatMoney } from '@nzila/fx'
 *
 * const rate = await getRate('USD', 'CAD', '2026-01-15')
 * const conversion = await convertCurrency({ amount: 1000, from: 'USD', to: 'CAD' })
 * console.log(formatMoney(conversion)) // CA$1,350.00
 * ```
 *
 * @packageDocumentation
 */

// ── Types ────────────────────────────────────────────────────────
export type {
  CurrencyCode,
  CurrencyInfo,
  ExchangeRate,
  RateSource,
  RatePair,
  DailyRateSheet,
  FxConversion,
  ConversionRequest,
  FxGainLossType,
  FxGainLoss,
  MonetaryAmount,
  DualCurrencyAmount,
  EntityCurrencyConfig,
} from './types'

export {
  SUPPORTED_CURRENCIES,
  CURRENCY_INFO,
  CurrencyCodeSchema,
  MonetaryAmountSchema,
  ConversionRequestSchema,
  EntityCurrencyConfigSchema,
} from './types'

// ── Cache ────────────────────────────────────────────────────────
export { RateCache, globalRateCache } from './cache'
export type { RateCacheOptions } from './cache'

// ── Bank of Canada ──────────────────────────────────────────────
export {
  BOC_SERIES,
  BOC_SUPPORTED_CURRENCIES,
  fetchBocRate,
  fetchBocDailyRates,
  fetchBocRateRange,
  createBocRateProvider,
  createManualRateProvider,
} from './boc'
export type { RateProvider } from './boc'

// ── Rate Lookup ─────────────────────────────────────────────────
export {
  getRate,
  getDailyRates,
  invertRate,
  setDefaultRateProvider,
  getDefaultRateProvider,
  todayISO,
  previousBusinessDay,
  isBusinessDay,
} from './rates'

// ── Conversion ──────────────────────────────────────────────────
export {
  convertCurrency,
  convertToFunctional,
  convertFromFunctional,
  formatMoney,
  formatDualCurrency,
  roundAmount,
} from './convert'

// ── FX Gain/Loss ────────────────────────────────────────────────
export {
  ITA_S39_PERSONAL_EXEMPTION,
  calculateRealizedGainLoss,
  calculateUnrealizedGainLoss,
  revaluePositions,
} from './gain-loss'
export type {
  FxTransaction,
  FxSettlement,
  OpenPosition,
  RevaluationResult,
} from './gain-loss'

// ── Multi-Currency Ledger ───────────────────────────────────────
export {
  createDualAmount,
  createDualAmountFromRate,
  aggregateToFunctional,
  aggregateToFunctionalSync,
  calculateExposure,
  multiCurrencyTrialBalance,
} from './ledger'
export type {
  MultiCurrencyEntry,
  TrialBalanceLine,
  CurrencyExposure,
} from './ledger'
