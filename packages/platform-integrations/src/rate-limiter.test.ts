import { describe, it, expect, beforeEach } from 'vitest'
import { InMemoryRateLimiter } from './rate-limiter'

describe('InMemoryRateLimiter', () => {
  let limiter: InMemoryRateLimiter

  beforeEach(() => {
    limiter = new InMemoryRateLimiter()
  })

  it('allows requests within limits', () => {
    const key = InMemoryRateLimiter.key('org-1', 'conn-1')
    const result = limiter.check(key)
    expect(result.allowed).toBe(true)
    expect(result.remaining).toBeGreaterThan(0)
  })

  it('decrements remaining tokens', () => {
    const key = InMemoryRateLimiter.key('org-1', 'conn-1')
    const r1 = limiter.check(key)
    const r2 = limiter.check(key)
    expect(r2.remaining).toBeLessThan(r1.remaining)
  })

  it('blocks requests when per-minute limit exhausted', () => {
    const smallLimiter = new InMemoryRateLimiter({
      maxRequestsPerMinute: 3,
      maxRequestsPerHour: 100,
      burstLimit: 3,
    })
    const key = 'org:conn'

    smallLimiter.check(key)
    smallLimiter.check(key)
    smallLimiter.check(key)
    const r4 = smallLimiter.check(key)
    expect(r4.allowed).toBe(false)
    expect(r4.retryAfterMs).toBeGreaterThan(0)
  })

  it('uses different buckets for different connections', () => {
    const smallLimiter = new InMemoryRateLimiter({
      maxRequestsPerMinute: 2,
      maxRequestsPerHour: 100,
      burstLimit: 2,
    })

    const keyA = InMemoryRateLimiter.key('org', 'conn-a')
    const keyB = InMemoryRateLimiter.key('org', 'conn-b')

    smallLimiter.check(keyA)
    smallLimiter.check(keyA)
    const blocked = smallLimiter.check(keyA)
    expect(blocked.allowed).toBe(false)

    // Different connection should still be allowed
    const allowed = smallLimiter.check(keyB)
    expect(allowed.allowed).toBe(true)
  })

  it('generates consistent rate limit keys', () => {
    const key1 = InMemoryRateLimiter.key('org-1', 'conn-1')
    const key2 = InMemoryRateLimiter.key('org-1', 'conn-1')
    expect(key1).toBe(key2)
    expect(key1).toBe('org-1:conn-1')
  })
})
