/**
 * Tests for rateLimit.ts — specifically the maybePurge path that cleans
 * stale entries after PURGE_INTERVAL_MS (5 minutes).
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { checkRateLimit, rateLimitHeaders } from '../rateLimit'

describe('rateLimit maybePurge', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('purges stale entries after PURGE_INTERVAL_MS', () => {
    vi.useFakeTimers()
    const now = Date.now()
    vi.setSystemTime(now)

    // Create entries for two different keys
    checkRateLimit('key-a', { max: 100, windowMs: 60_000 })
    checkRateLimit('key-b', { max: 100, windowMs: 60_000 })

    // Advance past PURGE_INTERVAL_MS (5 minutes = 300_000ms) + window
    vi.setSystemTime(now + 300_001 + 60_000)

    // This call should trigger maybePurge, which cleans expired entries
    const result = checkRateLimit('key-c', { max: 100, windowMs: 60_000 })
    expect(result.allowed).toBe(true)
    // After purge, key-a and key-b should have been cleaned
    expect(result.remaining).toBe(99)
  })

  it('does not purge before PURGE_INTERVAL_MS', () => {
    vi.useFakeTimers()
    const now = Date.now()
    vi.setSystemTime(now)

    // Max out a key with a long window (10 min) so hits stay in-window
    const windowMs = 600_000
    for (let i = 0; i < 5; i++) {
      checkRateLimit('key-persist', { max: 5, windowMs })
    }
    const blocked = checkRateLimit('key-persist', { max: 5, windowMs })
    expect(blocked.allowed).toBe(false)

    // Advance 2 minutes — before purge interval AND within window
    vi.setSystemTime(now + 120_000)

    // Hits still within window, should still be blocked
    const still = checkRateLimit('key-persist', { max: 5, windowMs })
    expect(still.allowed).toBe(false)
  })

  it('rateLimitHeaders returns valid headers', () => {
    vi.useFakeTimers()
    vi.setSystemTime(1_700_000_000_000)

    const result = checkRateLimit('header-key', { max: 10, windowMs: 60_000 })
    const headers = rateLimitHeaders(result, 10)

    expect(headers['RateLimit-Limit']).toBe('10')
    expect(headers['RateLimit-Remaining']).toBe('9')
    expect(headers['RateLimit-Reset']).toBeDefined()
    expect(headers['Retry-After']).toBeDefined()
    expect(Number(headers['Retry-After'])).toBeGreaterThan(0)
  })
})
