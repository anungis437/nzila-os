/**
 * @nzila/fx — Currency Conversion
 *
 * Core conversion functions for multi-currency accounting:
 *   - convertCurrency: raw A→B conversion
 *   - convertToFunctional: transaction → entity's functional currency
 *   - convertFromFunctional: functional → target foreign currency
 *   - formatMoney: locale-aware money formatting
 *
 * All conversions produce a full FxConversion audit record.
 *
 * @module @nzila/fx/convert
 */
import { randomUUID } from 'crypto'
import type {
  CurrencyCode,
  ConversionRequest,
  FxConversion,
  MonetaryAmount,
  DualCurrencyAmount,
  EntityCurrencyConfig,
  ExchangeRate,
} from './types'
import { CURRENCY_INFO } from './types'
import { getRate } from './rates'
import type { RateProvider } from './boc'

// ── Core Conversion ─────────────────────────────────────────────────────────

/**
 * Convert an amount from one currency to another.
 *
 * Returns a full FxConversion record with rate metadata for audit trail.
 * Uses banker's rounding to the target currency's decimal places.
 *
 * @param request - The conversion request (amount, from, to, date)
 * @param options - Optional rate provider or pre-fetched rate
 */
export async function convertCurrency(
  request: ConversionRequest,
  options?: { provider?: RateProvider; rate?: ExchangeRate },
): Promise<FxConversion> {
  const { amount, from, to, date, rounding } = request

  // Same currency — no conversion needed
  if (from === to) {
    return {
      conversionId: randomUUID(),
      originalAmount: amount,
      originalCurrency: from,
      convertedAmount: amount,
      targetCurrency: to,
      exchangeRate: 1,
      inverseRate: 1,
      rateDate: date ?? new Date().toISOString().slice(0, 10),
      rateSource: 'fallback',
      convertedAt: new Date().toISOString(),
    }
  }

  // Get exchange rate
  const rate = options?.rate ?? (await getRate(from, to, date, { provider: options?.provider }))
  if (!rate) {
    throw new Error(
      `No exchange rate available for ${from}/${to} on ${date ?? 'today'}. ` +
        `Ensure the Bank of Canada publishes this pair or provide a manual rate.`,
    )
  }

  const targetDecimals = CURRENCY_INFO[to]?.decimals ?? 2
  const roundingMode = rounding ?? 'half-even'
  const rawConverted = amount * rate.rate
  const convertedAmount = roundAmount(rawConverted, targetDecimals, roundingMode)

  return {
    conversionId: randomUUID(),
    originalAmount: amount,
    originalCurrency: from,
    convertedAmount,
    targetCurrency: to,
    exchangeRate: rate.rate,
    inverseRate: 1 / rate.rate,
    rateDate: rate.rateDate,
    rateSource: rate.source,
    convertedAt: new Date().toISOString(),
  }
}

// ── Functional Currency Helpers ─────────────────────────────────────────────

/**
 * Convert a monetary amount to the entity's functional currency.
 *
 * Example: An entity with functional currency CAD receives a USD invoice.
 *   convertToFunctional({ amount: 100, currency: 'USD' }, config, '2025-01-15')
 *   → DualCurrencyAmount with original USD and functional CAD values
 */
export async function convertToFunctional(
  amount: MonetaryAmount,
  config: EntityCurrencyConfig,
  date?: string,
  options?: { provider?: RateProvider },
): Promise<DualCurrencyAmount> {
  const d = date ?? new Date().toISOString().slice(0, 10)

  if (amount.currency === config.functionalCurrency) {
    return {
      original: amount,
      functional: { ...amount },
      exchangeRate: 1,
      rateDate: d,
      rateSource: 'fallback',
    }
  }

  const conversion = await convertCurrency(
    { amount: amount.amount, from: amount.currency, to: config.functionalCurrency, date: d },
    options,
  )

  return {
    original: amount,
    functional: {
      amount: conversion.convertedAmount,
      currency: config.functionalCurrency,
    },
    exchangeRate: conversion.exchangeRate,
    rateDate: conversion.rateDate,
    rateSource: conversion.rateSource,
  }
}

/**
 * Convert from the entity's functional currency to a target foreign currency.
 *
 * Example: A CAD-functional entity pays a supplier in EUR.
 *   convertFromFunctional({ amount: 500, currency: 'CAD' }, 'EUR', config, '2025-01-15')
 *   → DualCurrencyAmount with functional CAD and original EUR values
 */
export async function convertFromFunctional(
  amount: MonetaryAmount,
  targetCurrency: CurrencyCode,
  config: EntityCurrencyConfig,
  date?: string,
  options?: { provider?: RateProvider },
): Promise<DualCurrencyAmount> {
  const d = date ?? new Date().toISOString().slice(0, 10)

  if (amount.currency !== config.functionalCurrency) {
    throw new Error(
      `Amount currency ${amount.currency} does not match entity functional currency ${config.functionalCurrency}`,
    )
  }

  if (targetCurrency === config.functionalCurrency) {
    return {
      original: { amount: amount.amount, currency: targetCurrency },
      functional: { ...amount },
      exchangeRate: 1,
      rateDate: d,
      rateSource: 'fallback',
    }
  }

  const conversion = await convertCurrency(
    { amount: amount.amount, from: config.functionalCurrency, to: targetCurrency, date: d },
    options,
  )

  return {
    original: {
      amount: conversion.convertedAmount,
      currency: targetCurrency,
    },
    functional: amount,
    exchangeRate: conversion.exchangeRate,
    rateDate: conversion.rateDate,
    rateSource: conversion.rateSource,
  }
}

// ── Money Formatting ────────────────────────────────────────────────────────

/**
 * Format a monetary amount with its currency symbol.
 *
 * @param amount - The MonetaryAmount to format
 * @param locale - BCP 47 locale string (default: 'en-CA')
 * @returns Formatted string (e.g., "$1,234.56 CAD", "¥1,234 JPY")
 */
export function formatMoney(
  amount: MonetaryAmount,
  locale: string = 'en-CA',
): string {
  const info = CURRENCY_INFO[amount.currency]
  const decimals = info?.decimals ?? 2

  const formatted = new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: amount.currency,
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(amount.amount)

  return formatted
}

/**
 * Format a dual-currency amount for display.
 *
 * @returns "CA$1,350.00 (US$1,000.00 @ 1.3500)"
 */
export function formatDualCurrency(
  dual: DualCurrencyAmount,
  locale: string = 'en-CA',
): string {
  const functional = formatMoney(dual.functional, locale)
  const original = formatMoney(dual.original, locale)

  if (dual.original.currency === dual.functional.currency) {
    return functional
  }

  return `${functional} (${original} @ ${dual.exchangeRate.toFixed(4)})`
}

// ── Rounding ────────────────────────────────────────────────────────────────

/**
 * Round a number to the specified decimal places.
 * Supports standard and banker's rounding (half-even).
 */
export function roundAmount(
  value: number,
  decimals: number,
  mode: 'half-up' | 'half-even' = 'half-even',
): number {
  if (mode === 'half-up') {
    const factor = Math.pow(10, decimals)
    return Math.round(value * factor) / factor
  }

  // Banker's rounding (half-even) — default for financial calculations
  const factor = Math.pow(10, decimals)
  const shifted = value * factor
  const floored = Math.floor(shifted)
  const remainder = shifted - floored

  if (Math.abs(remainder - 0.5) < 1e-10) {
    // Exactly 0.5 — round to even
    return (floored % 2 === 0 ? floored : floored + 1) / factor
  }

  return Math.round(shifted) / factor
}
