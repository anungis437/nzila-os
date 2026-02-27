/**
 * Unit tests — @nzila/fx/cache
 *
 * Covers: RateCache LRU eviction, TTL expiry, set/get, purge
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { RateCache, globalRateCache } from '../cache'
import type { ExchangeRate } from '../types'

function makeRate(base: string, quote: string, rate: number, date: string): ExchangeRate {
  return {
    baseCurrency: base as any,
    quoteCurrency: quote as any,
    rate,
    rateDate: date,
    source: 'bank_of_canada',
    fetchedAt: new Date().toISOString(),
  }
}

describe('RateCache', () => {
  let cache: RateCache

  beforeEach(() => {
    cache = new RateCache({ maxSize: 5, ttlMs: 60_000 })
  })

  it('stores and retrieves a rate', () => {
    const rate = makeRate('USD', 'CAD', 1.35, '2025-01-15')
    cache.set(rate)
    expect(cache.get('USD', 'CAD', '2025-01-15')).toEqual(rate)
  })

  it('returns null for a missing rate', () => {
    expect(cache.get('USD', 'CAD', '2025-01-15')).toBeNull()
  })

  it('evicts LRU entries when max size exceeded', () => {
    for (let i = 0; i < 6; i++) {
      cache.set(makeRate('USD', 'CAD', 1.3 + i * 0.01, `2025-01-${String(10 + i).padStart(2, '0')}`))
    }
    // First entry should have been evicted (LRU)
    expect(cache.get('USD', 'CAD', '2025-01-10')).toBeNull()
    // Last entry should still be there
    expect(cache.get('USD', 'CAD', '2025-01-15')).not.toBeNull()
    expect(cache.size).toBe(5)
  })

  it('expires entries after TTL', () => {
    vi.useFakeTimers()
    const shortCache = new RateCache({ maxSize: 10, ttlMs: 1000 })
    shortCache.set(makeRate('USD', 'CAD', 1.35, '2025-01-15'))

    expect(shortCache.get('USD', 'CAD', '2025-01-15')).not.toBeNull()

    vi.advanceTimersByTime(1500)
    expect(shortCache.get('USD', 'CAD', '2025-01-15')).toBeNull()

    vi.useRealTimers()
  })

  it('clears all entries', () => {
    cache.set(makeRate('USD', 'CAD', 1.35, '2025-01-15'))
    cache.set(makeRate('EUR', 'CAD', 1.50, '2025-01-15'))
    expect(cache.size).toBe(2)

    cache.clear()
    expect(cache.size).toBe(0)
    expect(cache.get('USD', 'CAD', '2025-01-15')).toBeNull()
  })

  it('purges only expired entries', () => {
    vi.useFakeTimers()
    const c = new RateCache({ maxSize: 10, ttlMs: 1000 })
    c.set(makeRate('USD', 'CAD', 1.35, '2025-01-15'))

    vi.advanceTimersByTime(500)
    c.set(makeRate('EUR', 'CAD', 1.50, '2025-01-15'))

    vi.advanceTimersByTime(600)
    c.purgeExpired()

    // USD entry expired (1100ms old), EUR entry still valid (600ms old)
    expect(c.get('USD', 'CAD', '2025-01-15')).toBeNull()
    expect(c.get('EUR', 'CAD', '2025-01-15')).not.toBeNull()

    vi.useRealTimers()
  })

  it('setDailyRates populates multiple entries', () => {
    cache.setDailyRates('CAD', '2025-01-15', { USD: 0.74, EUR: 0.68 }, 'bank_of_canada')
    // setDailyRates stores as baseCurrency=code, quoteCurrency=CAD
    expect(cache.get('USD', 'CAD', '2025-01-15')?.rate).toBe(0.74)
    expect(cache.get('EUR', 'CAD', '2025-01-15')?.rate).toBe(0.68)
  })
})

describe('globalRateCache', () => {
  it('is a singleton instance', () => {
    expect(globalRateCache).toBeInstanceOf(RateCache)
  })
})
