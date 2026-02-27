/**
 * @nzila/fx — Bank of Canada Rate Provider
 *
 * Fetches daily noon exchange rates from the Bank of Canada Valet API.
 * The BoC publishes rates at 12:15 ET each business day.
 *
 * API docs: https://www.bankofcanada.ca/valet/docs
 *
 * @module @nzila/fx/boc
 */
import type { CurrencyCode, DailyRateSheet, ExchangeRate, RateSource } from './types'
import { RateCache, globalRateCache } from './cache'

// ── BoC Valet API Series Names ──────────────────────────────────────────────

/**
 * BoC publishes FX rates as individual series.
 * Series name pattern: FXCADUSD → 1 CAD = x USD (CAD is base).
 * For our convention we want: 1 USD = x CAD, so we invert.
 */
export const BOC_SERIES: Partial<Record<CurrencyCode, string>> = {
  USD: 'FXUSDCAD',
  EUR: 'FXEURCAD',
  GBP: 'FXGBPCAD',
  JPY: 'FXJPYCAD',
  CHF: 'FXCHFCAD',
  AUD: 'FXAUDCAD',
  NZD: 'FXNZDCAD',
  CNY: 'FXCNYCAD',
  HKD: 'FXHKDCAD',
  SGD: 'FXSGDCAD',
  MXN: 'FXMXNCAD',
  BRL: 'FXBRLCAD',
  INR: 'FXINRCAD',
  KRW: 'FXKRWCAD',
  SEK: 'FXSEKCAD',
  NOK: 'FXNOKCAD',
  DKK: 'FXDKKCAD',
  ZAR: 'FXZARCAD',
  SAR: 'FXSARCAD',
  TRY: 'FXTRYCAD',
  PLN: 'FXPLNCAD',
}

/** Currencies the BoC publishes rates for */
export const BOC_SUPPORTED_CURRENCIES = Object.keys(BOC_SERIES) as CurrencyCode[]

// ── BoC API Types ───────────────────────────────────────────────────────────

interface BocObservation {
  d: string // date YYYY-MM-DD
  [seriesName: string]: { v: string } | string
}

interface BocValetResponse {
  observations: BocObservation[]
}

// ── Rate Fetching ───────────────────────────────────────────────────────────

const BOC_BASE_URL = 'https://www.bankofcanada.ca/valet/observations'

/**
 * Fetch a single currency rate from Bank of Canada for a specific date.
 *
 * @param currency - The foreign currency code (e.g., 'USD')
 * @param date - ISO date string (e.g., '2026-02-26')
 * @returns The exchange rate (1 foreign = x CAD), or null if unavailable
 */
export async function fetchBocRate(
  currency: CurrencyCode,
  date: string,
  options?: { cache?: RateCache },
): Promise<ExchangeRate | null> {
  if (currency === 'CAD') {
    return {
      baseCurrency: 'CAD',
      quoteCurrency: 'CAD',
      rate: 1,
      rateDate: date,
      source: 'bank_of_canada',
      fetchedAt: new Date().toISOString(),
    }
  }

  const cache = options?.cache ?? globalRateCache

  // Check cache first
  const cached = cache.get(currency, 'CAD', date)
  if (cached) return cached

  const series = BOC_SERIES[currency]
  if (!series) return null

  const url = `${BOC_BASE_URL}/${series}/json?start_date=${date}&end_date=${date}`

  const response = await fetch(url)
  if (!response.ok) return null

  const data = (await response.json()) as BocValetResponse
  const obs = data.observations?.[0]
  if (!obs) return null

  const rateValue = obs[series]
  if (!rateValue || typeof rateValue === 'string') return null
  const rate = parseFloat(rateValue.v)
  if (isNaN(rate) || rate <= 0) return null

  const result: ExchangeRate = {
    baseCurrency: currency,
    quoteCurrency: 'CAD',
    rate,
    rateDate: date,
    source: 'bank_of_canada',
    fetchedAt: new Date().toISOString(),
  }

  cache.set(result)
  return result
}

/**
 * Fetch all available BoC rates for a specific date.
 * Returns a DailyRateSheet with all currency rates.
 */
export async function fetchBocDailyRates(
  date: string,
  options?: { cache?: RateCache },
): Promise<DailyRateSheet> {
  const seriesNames = Object.values(BOC_SERIES).join(',')
  const url = `${BOC_BASE_URL}/${seriesNames}/json?start_date=${date}&end_date=${date}`

  const cache = options?.cache ?? globalRateCache

  const sheet: DailyRateSheet = {
    date,
    baseCurrency: 'CAD',
    source: 'bank_of_canada',
    fetchedAt: new Date().toISOString(),
    rates: { CAD: 1 },
  }

  try {
    const response = await fetch(url)
    if (!response.ok) return sheet

    const data = (await response.json()) as BocValetResponse
    const obs = data.observations?.[0]
    if (!obs) return sheet

    for (const [currency, seriesName] of Object.entries(BOC_SERIES)) {
      const rateValue = obs[seriesName]
      if (!rateValue || typeof rateValue === 'string') continue
      const rate = parseFloat(rateValue.v)
      if (isNaN(rate) || rate <= 0) continue
      sheet.rates[currency] = rate
    }

    cache.setDailyRates('CAD', date, sheet.rates, 'bank_of_canada')
  } catch {
    // Network failure — return sheet with only CAD = 1
  }

  return sheet
}

/**
 * Fetch a rate for a date range (e.g., for historical charts).
 * Returns an array of rates sorted by date.
 */
export async function fetchBocRateRange(
  currency: CurrencyCode,
  startDate: string,
  endDate: string,
): Promise<ExchangeRate[]> {
  if (currency === 'CAD') {
    return [{
      baseCurrency: 'CAD',
      quoteCurrency: 'CAD',
      rate: 1,
      rateDate: startDate,
      source: 'bank_of_canada',
      fetchedAt: new Date().toISOString(),
    }]
  }

  const series = BOC_SERIES[currency]
  if (!series) return []

  const url = `${BOC_BASE_URL}/${series}/json?start_date=${startDate}&end_date=${endDate}`

  try {
    const response = await fetch(url)
    if (!response.ok) return []

    const data = (await response.json()) as BocValetResponse
    const results: ExchangeRate[] = []

    for (const obs of data.observations ?? []) {
      const rateValue = obs[series]
      if (!rateValue || typeof rateValue === 'string') continue
      const rate = parseFloat(rateValue.v)
      if (isNaN(rate) || rate <= 0) continue

      results.push({
        baseCurrency: currency,
        quoteCurrency: 'CAD',
        rate,
        rateDate: obs.d,
        source: 'bank_of_canada',
        fetchedAt: new Date().toISOString(),
      })
    }

    return results
  } catch {
    return []
  }
}

// ── Rate Provider Interface ─────────────────────────────────────────────────

/**
 * A rate provider abstracts the source of exchange rates.
 * Implementations can wrap BoC, ECB, manual entry, or DB lookups.
 */
export interface RateProvider {
  source: RateSource
  getRate(base: CurrencyCode, quote: CurrencyCode, date: string): Promise<ExchangeRate | null>
  getDailyRates(date: string): Promise<DailyRateSheet>
}

/**
 * Bank of Canada rate provider — the default for Canadian entities.
 */
export function createBocRateProvider(cache?: RateCache): RateProvider {
  const rateCache = cache ?? globalRateCache

  return {
    source: 'bank_of_canada',

    async getRate(base: CurrencyCode, quote: CurrencyCode, date: string): Promise<ExchangeRate | null> {
      if (base === quote) {
        return {
          baseCurrency: base,
          quoteCurrency: quote,
          rate: 1,
          rateDate: date,
          source: 'bank_of_canada',
          fetchedAt: new Date().toISOString(),
        }
      }

      // BoC rates are always quote=CAD
      if (quote === 'CAD') {
        return fetchBocRate(base, date, { cache: rateCache })
      }

      if (base === 'CAD') {
        // Invert: 1 CAD = 1/rate quote
        const fwdRate = await fetchBocRate(quote, date, { cache: rateCache })
        if (!fwdRate) return null
        return {
          baseCurrency: 'CAD',
          quoteCurrency: quote,
          rate: 1 / fwdRate.rate,
          rateDate: date,
          source: 'bank_of_canada',
          fetchedAt: new Date().toISOString(),
        }
      }

      // Cross rate: base → CAD → quote
      const baseToCAD = await fetchBocRate(base, date, { cache: rateCache })
      const quoteToCAD = await fetchBocRate(quote, date, { cache: rateCache })
      if (!baseToCAD || !quoteToCAD) return null

      return {
        baseCurrency: base,
        quoteCurrency: quote,
        rate: baseToCAD.rate / quoteToCAD.rate,
        rateDate: date,
        source: 'bank_of_canada',
        fetchedAt: new Date().toISOString(),
      }
    },

    async getDailyRates(date: string): Promise<DailyRateSheet> {
      return fetchBocDailyRates(date, { cache: rateCache })
    },
  }
}

/**
 * Manual/static rate provider for testing and offline use.
 * Accepts an array of ExchangeRate objects (date-aware).
 */
export function createManualRateProvider(
  rateList: ExchangeRate[],
): RateProvider {
  // Index rates by "base/quote:date"
  const rateMap = new Map<string, ExchangeRate>()
  for (const r of rateList) {
    rateMap.set(`${r.baseCurrency}/${r.quoteCurrency}:${r.rateDate}`, r)
  }

  function findDirect(base: CurrencyCode, quote: CurrencyCode, date: string): ExchangeRate | null {
    return rateMap.get(`${base}/${quote}:${date}`) ?? null
  }

  return {
    source: 'manual',

    async getRate(base: CurrencyCode, quote: CurrencyCode, date: string): Promise<ExchangeRate | null> {
      if (base === quote) {
        return {
          baseCurrency: base, quoteCurrency: quote, rate: 1,
          rateDate: date, source: 'manual', fetchedAt: new Date().toISOString(),
        }
      }

      // Try direct lookup
      const direct = findDirect(base, quote, date)
      if (direct) return direct

      // Try inverse
      const inverse = findDirect(quote, base, date)
      if (inverse) {
        return {
          baseCurrency: base, quoteCurrency: quote, rate: 1 / inverse.rate,
          rateDate: date, source: 'manual', fetchedAt: new Date().toISOString(),
        }
      }

      // Try via CAD cross rate
      const baseToCAD = findDirect(base, 'CAD', date)?.rate
        ?? (findDirect('CAD', base, date) ? 1 / findDirect('CAD', base, date)!.rate : undefined)
      const quoteToCAD = findDirect(quote, 'CAD', date)?.rate
        ?? (findDirect('CAD', quote, date) ? 1 / findDirect('CAD', quote, date)!.rate : undefined)

      if (baseToCAD !== undefined && quoteToCAD !== undefined) {
        return {
          baseCurrency: base, quoteCurrency: quote, rate: baseToCAD / quoteToCAD,
          rateDate: date, source: 'manual', fetchedAt: new Date().toISOString(),
        }
      }

      return null
    },

    async getDailyRates(date: string): Promise<DailyRateSheet> {
      const cadRates: Record<string, number> = { CAD: 1 }
      for (const [key, r] of rateMap) {
        if (r.quoteCurrency === 'CAD' && r.rateDate === date) {
          cadRates[r.baseCurrency] = r.rate
        }
      }
      return {
        date, baseCurrency: 'CAD', source: 'manual',
        fetchedAt: new Date().toISOString(), rates: cadRates,
      }
    },
  }
}
