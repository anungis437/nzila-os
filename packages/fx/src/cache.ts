/**
 * @nzila/fx — Exchange Rate Cache
 *
 * In-memory LRU cache for exchange rates with configurable TTL.
 * Prevents excessive Bank of Canada API calls while keeping rates fresh.
 *
 * @module @nzila/fx/cache
 */
import type { ExchangeRate, CurrencyCode } from './types'

export interface RateCacheOptions {
  /** Maximum number of rate entries to cache */
  maxSize?: number
  /** Time-to-live in milliseconds (default: 15 minutes) */
  ttlMs?: number
}

interface CacheEntry {
  rate: ExchangeRate
  expiresAt: number
}

/**
 * Build a cache key from currency pair + date.
 */
function cacheKey(base: CurrencyCode, quote: CurrencyCode, date: string): string {
  return `${base}/${quote}:${date}`
}

/**
 * In-memory exchange rate cache with TTL expiry and LRU eviction.
 */
export class RateCache {
  private readonly cache = new Map<string, CacheEntry>()
  private readonly maxSize: number
  private readonly ttlMs: number

  constructor(options: RateCacheOptions = {}) {
    this.maxSize = options.maxSize ?? 1000
    this.ttlMs = options.ttlMs ?? 15 * 60 * 1000 // 15 minutes
  }

  /**
   * Get a cached rate if it exists and hasn't expired.
   */
  get(base: CurrencyCode, quote: CurrencyCode, date: string): ExchangeRate | null {
    const key = cacheKey(base, quote, date)
    const entry = this.cache.get(key)

    if (!entry) return null

    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key)
      return null
    }

    // Move to end for LRU
    this.cache.delete(key)
    this.cache.set(key, entry)

    return entry.rate
  }

  /**
   * Store a rate in the cache.
   */
  set(rate: ExchangeRate): void {
    const key = cacheKey(rate.baseCurrency, rate.quoteCurrency, rate.rateDate)

    // Evict oldest if at capacity
    if (this.cache.size >= this.maxSize && !this.cache.has(key)) {
      const firstKey = this.cache.keys().next().value
      if (firstKey) this.cache.delete(firstKey)
    }

    this.cache.set(key, {
      rate,
      expiresAt: Date.now() + this.ttlMs,
    })
  }

  /**
   * Store a full day's rates (all currencies against a base).
   */
  setDailyRates(
    baseCurrency: CurrencyCode,
    date: string,
    rates: Record<string, number>,
    source: 'bank_of_canada' | 'manual' | 'ecb' | 'fallback',
  ): void {
    const now = new Date().toISOString()
    for (const [code, rate] of Object.entries(rates)) {
      this.set({
        baseCurrency: code as CurrencyCode,
        quoteCurrency: baseCurrency,
        rate,
        rateDate: date,
        source,
        fetchedAt: now,
      })
    }
  }

  /**
   * Clear all cached rates.
   */
  clear(): void {
    this.cache.clear()
  }

  /**
   * Number of entries currently in the cache.
   */
  get size(): number {
    return this.cache.size
  }

  /**
   * Purge all expired entries.
   */
  purgeExpired(): number {
    const now = Date.now()
    let purged = 0
    for (const [key, entry] of this.cache) {
      if (now > entry.expiresAt) {
        this.cache.delete(key)
        purged++
      }
    }
    return purged
  }
}

/**
 * Global singleton cache instance (15-minute TTL, 1000 entries).
 */
export const globalRateCache = new RateCache()
