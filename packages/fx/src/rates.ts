/**
 * @nzila/fx — Exchange Rate Lookup
 *
 * High-level rate lookup with fallback chain:
 *   1. In-memory cache
 *   2. Rate provider (BoC API / manual / DB)
 *   3. Previous business day fallback (weekends/holidays)
 *
 * @module @nzila/fx/rates
 */
import type { CurrencyCode, ExchangeRate, DailyRateSheet } from './types'
import type { RateProvider } from './boc'
import { createBocRateProvider } from './boc'

// ── Default Provider ────────────────────────────────────────────────────────

let defaultProvider: RateProvider = createBocRateProvider()

/**
 * Set the default rate provider for all conversions.
 * Useful for testing (manual provider) or different sources (ECB).
 */
export function setDefaultRateProvider(provider: RateProvider): void {
  defaultProvider = provider
}

/**
 * Get the current default rate provider.
 */
export function getDefaultRateProvider(): RateProvider {
  return defaultProvider
}

// ── Rate Lookup ─────────────────────────────────────────────────────────────

/**
 * Look up the exchange rate between two currencies on a given date.
 * Falls back to previous business days if the rate is unavailable (weekend/holiday).
 *
 * @param base - Base currency code
 * @param quote - Quote currency code
 * @param date - ISO date string (defaults to today)
 * @param options - Optional provider override and max fallback days
 * @returns The exchange rate, or null if unavailable after fallbacks
 */
export async function getRate(
  base: CurrencyCode,
  quote: CurrencyCode,
  date?: string,
  options?: { provider?: RateProvider; maxFallbackDays?: number },
): Promise<ExchangeRate | null> {
  if (base === quote) {
    const d = date ?? todayISO()
    return {
      baseCurrency: base,
      quoteCurrency: quote,
      rate: 1,
      rateDate: d,
      source: 'fallback',
      fetchedAt: new Date().toISOString(),
    }
  }

  const provider = options?.provider ?? defaultProvider
  const maxFallback = options?.maxFallbackDays ?? 5
  const startDate = date ?? todayISO()

  // Try the requested date, then fall back to previous business days
  let currentDate = startDate
  for (let i = 0; i <= maxFallback; i++) {
    const rate = await provider.getRate(base, quote, currentDate)
    if (rate) return rate
    currentDate = previousBusinessDay(currentDate)
  }

  return null
}

/**
 * Get all available rates for a specific date.
 */
export async function getDailyRates(
  date?: string,
  options?: { provider?: RateProvider },
): Promise<DailyRateSheet> {
  const provider = options?.provider ?? defaultProvider
  return provider.getDailyRates(date ?? todayISO())
}

/**
 * Get the reciprocal rate (e.g., if USD/CAD = 1.35, then CAD/USD = 0.7407).
 */
export function invertRate(rate: ExchangeRate): ExchangeRate {
  return {
    baseCurrency: rate.quoteCurrency,
    quoteCurrency: rate.baseCurrency,
    rate: 1 / rate.rate,
    rateDate: rate.rateDate,
    source: rate.source,
    fetchedAt: rate.fetchedAt,
  }
}

// ── Date Helpers ────────────────────────────────────────────────────────────

/**
 * Today's date in ISO format (YYYY-MM-DD).
 */
export function todayISO(): string {
  return new Date().toISOString().slice(0, 10)
}

/**
 * Get the previous business day (skips weekends).
 * Does NOT account for statutory holidays — BoC simply doesn't publish on those days,
 * and the fallback loop handles it.
 */
export function previousBusinessDay(dateStr: string): string {
  const date = new Date(dateStr + 'T12:00:00Z')
  const day = date.getUTCDay()

  if (day === 1) {
    // Monday → Friday
    date.setUTCDate(date.getUTCDate() - 3)
  } else if (day === 0) {
    // Sunday → Friday
    date.setUTCDate(date.getUTCDate() - 2)
  } else {
    // All other days → previous day
    date.setUTCDate(date.getUTCDate() - 1)
  }

  return date.toISOString().slice(0, 10)
}

/**
 * Check if a date is a business day (Mon-Fri).
 */
export function isBusinessDay(dateStr: string): boolean {
  const day = new Date(dateStr + 'T12:00:00Z').getUTCDay()
  return day >= 1 && day <= 5
}
