/**
 * @nzila/os-core — Rate limiter tests
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { checkRateLimit, rateLimitHeaders } from '../rateLimit'

describe('checkRateLimit', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2025-01-01T00:00:00Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('allows requests within limit', () => {
    const result = checkRateLimit('test-key-1', { max: 5, windowMs: 60_000 })
    expect(result.allowed).toBe(true)
    expect(result.remaining).toBe(4) // max - 1
  })

  it('decrements remaining on each call', () => {
    const opts = { max: 3, windowMs: 60_000 }
    const r1 = checkRateLimit('test-key-2', opts)
    const r2 = checkRateLimit('test-key-2', opts)
    const r3 = checkRateLimit('test-key-2', opts)

    expect(r1.remaining).toBe(2)
    expect(r2.remaining).toBe(1)
    expect(r3.remaining).toBe(0)
  })

  it('rejects when limit exceeded', () => {
    const opts = { max: 2, windowMs: 60_000 }
    checkRateLimit('test-key-3', opts)
    checkRateLimit('test-key-3', opts)
    const r3 = checkRateLimit('test-key-3', opts)

    expect(r3.allowed).toBe(false)
    expect(r3.remaining).toBe(0)
  })

  it('resets after window elapses', () => {
    const opts = { max: 1, windowMs: 60_000 }
    const r1 = checkRateLimit('test-key-4', opts)
    expect(r1.allowed).toBe(true)

    const r2 = checkRateLimit('test-key-4', opts)
    expect(r2.allowed).toBe(false)

    // Advance past the window
    vi.advanceTimersByTime(61_000)

    const r3 = checkRateLimit('test-key-4', opts)
    expect(r3.allowed).toBe(true)
  })

  it('uses separate windows per key', () => {
    const opts = { max: 1, windowMs: 60_000 }
    checkRateLimit('key-a', opts)
    const rA = checkRateLimit('key-a', opts)
    const rB = checkRateLimit('key-b', opts)

    expect(rA.allowed).toBe(false) // exhausted
    expect(rB.allowed).toBe(true) // fresh key
  })
})

describe('rateLimitHeaders', () => {
  it('returns standard rate limit headers', () => {
    const result = {
      allowed: true,
      remaining: 8,
      resetAt: 1_735_689_660_000, // arbitrary future timestamp
    }

    const headers = rateLimitHeaders(result, 10)
    expect(headers['RateLimit-Limit']).toBe('10')
    expect(headers['RateLimit-Remaining']).toBe('8')
    expect(headers['RateLimit-Reset']).toBeDefined() // epoch seconds
    expect(headers['Retry-After']).toBeDefined()
  })

  it('Retry-After is at least 1', () => {
    const result = {
      allowed: false,
      remaining: 0,
      resetAt: Date.now() + 500, // 0.5 seconds → still rounds to 1
    }

    const headers = rateLimitHeaders(result, 5)
    expect(Number(headers['Retry-After'])).toBeGreaterThanOrEqual(1)
  })
})
