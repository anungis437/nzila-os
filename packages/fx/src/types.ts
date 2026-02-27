/**
 * @nzila/fx — Types
 *
 * Core type definitions for multi-currency support, exchange rates,
 * and FX conversions across the Nzila platform.
 *
 * @module @nzila/fx/types
 */
import { z } from 'zod'

// ── ISO 4217 Currency Codes ─────────────────────────────────────────────────

/**
 * Supported ISO 4217 currency codes.
 * Bank of Canada publishes noon rates for ~25 currencies;
 * we support the primary currencies relevant to Canadian businesses.
 */
export const SUPPORTED_CURRENCIES = [
  'CAD', 'USD', 'EUR', 'GBP', 'JPY', 'CHF', 'AUD', 'NZD',
  'CNY', 'HKD', 'SGD', 'MXN', 'BRL', 'INR', 'KRW', 'SEK',
  'NOK', 'DKK', 'ZAR', 'AED', 'SAR', 'ILS', 'TRY', 'PLN',
] as const

export type CurrencyCode = (typeof SUPPORTED_CURRENCIES)[number]

export const CurrencyCodeSchema = z.enum(SUPPORTED_CURRENCIES)

/**
 * Currency metadata for display and computation.
 */
export interface CurrencyInfo {
  code: CurrencyCode
  name: string
  symbol: string
  /** Number of decimal places (JPY = 0, CAD/USD = 2) */
  decimals: number
  /** ISO 4217 numeric code */
  numericCode: number
}

export const CURRENCY_INFO: Record<CurrencyCode, CurrencyInfo> = {
  CAD: { code: 'CAD', name: 'Canadian Dollar', symbol: 'C$', decimals: 2, numericCode: 124 },
  USD: { code: 'USD', name: 'US Dollar', symbol: 'US$', decimals: 2, numericCode: 840 },
  EUR: { code: 'EUR', name: 'Euro', symbol: '€', decimals: 2, numericCode: 978 },
  GBP: { code: 'GBP', name: 'British Pound', symbol: '£', decimals: 2, numericCode: 826 },
  JPY: { code: 'JPY', name: 'Japanese Yen', symbol: '¥', decimals: 0, numericCode: 392 },
  CHF: { code: 'CHF', name: 'Swiss Franc', symbol: 'CHF', decimals: 2, numericCode: 756 },
  AUD: { code: 'AUD', name: 'Australian Dollar', symbol: 'A$', decimals: 2, numericCode: 36 },
  NZD: { code: 'NZD', name: 'New Zealand Dollar', symbol: 'NZ$', decimals: 2, numericCode: 554 },
  CNY: { code: 'CNY', name: 'Chinese Yuan', symbol: '¥', decimals: 2, numericCode: 156 },
  HKD: { code: 'HKD', name: 'Hong Kong Dollar', symbol: 'HK$', decimals: 2, numericCode: 344 },
  SGD: { code: 'SGD', name: 'Singapore Dollar', symbol: 'S$', decimals: 2, numericCode: 702 },
  MXN: { code: 'MXN', name: 'Mexican Peso', symbol: 'MX$', decimals: 2, numericCode: 484 },
  BRL: { code: 'BRL', name: 'Brazilian Real', symbol: 'R$', decimals: 2, numericCode: 986 },
  INR: { code: 'INR', name: 'Indian Rupee', symbol: '₹', decimals: 2, numericCode: 356 },
  KRW: { code: 'KRW', name: 'South Korean Won', symbol: '₩', decimals: 0, numericCode: 410 },
  SEK: { code: 'SEK', name: 'Swedish Krona', symbol: 'kr', decimals: 2, numericCode: 752 },
  NOK: { code: 'NOK', name: 'Norwegian Krone', symbol: 'kr', decimals: 2, numericCode: 578 },
  DKK: { code: 'DKK', name: 'Danish Krone', symbol: 'kr', decimals: 2, numericCode: 208 },
  ZAR: { code: 'ZAR', name: 'South African Rand', symbol: 'R', decimals: 2, numericCode: 710 },
  AED: { code: 'AED', name: 'UAE Dirham', symbol: 'د.إ', decimals: 2, numericCode: 784 },
  SAR: { code: 'SAR', name: 'Saudi Riyal', symbol: '﷼', decimals: 2, numericCode: 682 },
  ILS: { code: 'ILS', name: 'Israeli New Shekel', symbol: '₪', decimals: 2, numericCode: 376 },
  TRY: { code: 'TRY', name: 'Turkish Lira', symbol: '₺', decimals: 2, numericCode: 949 },
  PLN: { code: 'PLN', name: 'Polish Zloty', symbol: 'zł', decimals: 2, numericCode: 985 },
}

// ── Exchange Rate Types ─────────────────────────────────────────────────────

/**
 * A single exchange rate observation.
 *
 * All rates are expressed as: 1 unit of `baseCurrency` = `rate` units of `quoteCurrency`.
 * Bank of Canada convention: base = foreign currency, quote = CAD.
 * e.g., USD/CAD = 1.35 means 1 USD = 1.35 CAD.
 */
export interface ExchangeRate {
  baseCurrency: CurrencyCode
  quoteCurrency: CurrencyCode
  rate: number
  /** The date the rate applies to (ISO 8601 date, e.g., '2026-02-26') */
  rateDate: string
  /** Source of the rate */
  source: RateSource
  /** When this rate was fetched/recorded */
  fetchedAt: string
}

export type RateSource = 'bank_of_canada' | 'manual' | 'ecb' | 'fallback'

/**
 * A rate pair: bid (buy) and ask (sell) for spread-aware conversions.
 * For BoC noon rates, bid === ask (mid-market rate).
 */
export interface RatePair {
  mid: number
  bid?: number
  ask?: number
  spread?: number
}

/**
 * Daily rates for all supported currencies against a base (typically CAD).
 */
export interface DailyRateSheet {
  date: string
  baseCurrency: CurrencyCode
  source: RateSource
  fetchedAt: string
  rates: Record<string, number>
}

// ── Conversion Types ────────────────────────────────────────────────────────

/**
 * A completed currency conversion with full audit trail.
 */
export interface FxConversion {
  /** Unique conversion ID for audit trail */
  conversionId: string
  /** Original amount in source currency */
  originalAmount: number
  originalCurrency: CurrencyCode
  /** Converted amount in target currency */
  convertedAmount: number
  targetCurrency: CurrencyCode
  /** Exchange rate used */
  exchangeRate: number
  /** Inverse rate for display */
  inverseRate: number
  /** Date the rate applies to */
  rateDate: string
  /** Source of the rate */
  rateSource: RateSource
  /** When the conversion was performed */
  convertedAt: string
}

/**
 * Input for a conversion request.
 */
export interface ConversionRequest {
  amount: number
  from: CurrencyCode
  to: CurrencyCode
  /** Date for historical rate lookup (defaults to today) */
  date?: string
  /** Rounding mode (half-even = banker's rounding) */
  rounding?: 'half-up' | 'half-even'
}

// ── FX Gain/Loss Types ──────────────────────────────────────────────────────

/** Direction of FX gain/loss for ITA s.39 reporting */
export type FxGainLossType = 'realized' | 'unrealized'

/**
 * FX gain or loss calculation result.
 *
 * ITA s.39: capital gains/losses from currency fluctuations must be reported.
 * The $200 annual exemption for individuals applies (ITA s.39(1.1)).
 */
export interface FxGainLoss {
  /** Unique identifier */
  id: string
  type: FxGainLossType
  /** The gain (positive) or loss (negative) in functional currency, after exemptions */
  amount: number
  /** Raw gain/loss before any exemptions */
  rawAmount: number
  functionalCurrency: CurrencyCode
  /** Original transaction details */
  originalAmount: number
  originalCurrency: CurrencyCode
  /** Rate at time of original transaction */
  bookRate: number
  bookDate: string
  /** Rate at settlement (realized) or reporting date (unrealized) */
  currentRate: number
  currentDate: string
  /** Whether the $200 personal FX exemption applies (ITA s.39(1.1)) */
  personalExemptionApplies: boolean
  /** Amount of the personal exemption applied */
  personalExemptionAmount: number
  /** Reference to the originating transaction */
  referenceId?: string
  /** When the calculation was performed */
  calculatedAt: string
}

// ── Multi-Currency Ledger Types ─────────────────────────────────────────────

/**
 * A monetary amount with full currency context.
 * Use this instead of bare `number` for any cross-currency amounts.
 */
export interface MonetaryAmount {
  /** Amount in the original (transaction) currency */
  amount: number
  currency: CurrencyCode
}

/**
 * An amount recorded in both its original currency and the entity's functional currency.
 * This is the standard representation for ledger entries in multi-currency systems.
 */
export interface DualCurrencyAmount {
  /** Original transaction amount */
  original: MonetaryAmount
  /** Amount in the entity's functional currency */
  functional: MonetaryAmount
  /** Exchange rate used: 1 original = rate functional */
  exchangeRate: number
  /** Date the rate was observed */
  rateDate: string
  /** Source of the rate */
  rateSource: RateSource
}

/**
 * Entity-level currency configuration.
 */
export interface EntityCurrencyConfig {
  entityId: string
  /** The entity's functional (reporting) currency — typically CAD for Canadian corps */
  functionalCurrency: CurrencyCode
  /** Currencies the entity transacts in */
  transactionCurrencies: CurrencyCode[]
  /** How to source exchange rates */
  rateSource: RateSource
  /** Whether to auto-revalue foreign balances at period end */
  autoRevalue: boolean
}

// ── Zod Schemas ─────────────────────────────────────────────────────────────

export const MonetaryAmountSchema = z.object({
  amount: z.number(),
  currency: CurrencyCodeSchema,
})

export const ConversionRequestSchema = z.object({
  amount: z.number().positive('Amount must be positive'),
  from: CurrencyCodeSchema,
  to: CurrencyCodeSchema,
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  rounding: z.enum(['half-up', 'half-even']).default('half-even'),
})

export const EntityCurrencyConfigSchema = z.object({
  entityId: z.string().uuid(),
  functionalCurrency: CurrencyCodeSchema.default('CAD'),
  transactionCurrencies: z.array(CurrencyCodeSchema).default(['CAD']),
  rateSource: z.enum(['bank_of_canada', 'manual', 'ecb', 'fallback']).default('bank_of_canada'),
  autoRevalue: z.boolean().default(false),
})
