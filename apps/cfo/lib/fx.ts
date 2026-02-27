/**
 * FX / Multi-Currency — CFO app.
 *
 * Wires @nzila/fx for exchange rate lookup, currency conversion,
 * FX gain/loss calculation (ITA s.39), and multi-currency ledger helpers.
 *
 * Bank of Canada Valet API integration for live CAD exchange rates.
 */

// ── Types ────────────────────────────────────────────────────────────────────
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
  RateProvider,
  RateCacheOptions,
  FxTransaction,
  FxSettlement,
  OpenPosition,
  RevaluationResult,
  MultiCurrencyEntry,
  TrialBalanceLine,
  CurrencyExposure,
} from '@nzila/fx'

// ── Constants & Schemas ─────────────────────────────────────────────────────
export {
  SUPPORTED_CURRENCIES,
  CURRENCY_INFO,
  CurrencyCodeSchema,
  MonetaryAmountSchema,
  ConversionRequestSchema,
  EntityCurrencyConfigSchema,
  BOC_SERIES,
  BOC_SUPPORTED_CURRENCIES,
  ITA_S39_PERSONAL_EXEMPTION,
} from '@nzila/fx'

// ── Rate Providers ──────────────────────────────────────────────────────────
export {
  createBocRateProvider,
  createManualRateProvider,
  fetchBocRate,
  fetchBocDailyRates,
  fetchBocRateRange,
} from '@nzila/fx'

// ── Cache ────────────────────────────────────────────────────────────────────
export { RateCache, globalRateCache } from '@nzila/fx'

// ── Rate Lookup ─────────────────────────────────────────────────────────────
export {
  getRate,
  getDailyRates,
  invertRate,
  setDefaultRateProvider,
  getDefaultRateProvider,
  todayISO,
  previousBusinessDay,
  isBusinessDay,
} from '@nzila/fx'

// ── Conversion ──────────────────────────────────────────────────────────────
export {
  convertCurrency,
  convertToFunctional,
  convertFromFunctional,
  formatMoney,
  formatDualCurrency,
  roundAmount,
} from '@nzila/fx'

// ── FX Gain/Loss (ITA s.39) ─────────────────────────────────────────────────
export {
  calculateRealizedGainLoss,
  calculateUnrealizedGainLoss,
  revaluePositions,
} from '@nzila/fx'

// ── Multi-Currency Ledger ───────────────────────────────────────────────────
export {
  createDualAmount,
  createDualAmountFromRate,
  aggregateToFunctional,
  aggregateToFunctionalSync,
  calculateExposure,
  multiCurrencyTrialBalance,
} from '@nzila/fx'
