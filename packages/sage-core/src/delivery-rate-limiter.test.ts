/**
 * Rate Limiter Tests
 */

import { describe, it, expect } from 'vitest'
import { DistributedRateLimiter, InMemoryRateLimiter } from '../src'

describe('InMemoryRateLimiter', () => {
  it('should allow grants within quota', async () => {
    const limiter = new InMemoryRateLimiter({
      maxGrantsPerIdentityPerDay: 3,
      windowDurationMs: 3600000, // 1 hour
    })
    
    const result1 = await limiter.checkAndIncrementGrant('user-1')
    expect(result1.allowed).toBe(true)
    expect(result1.remaining).toBe(2)
    
    const result2 = await limiter.checkAndIncrementGrant('user-1')
    expect(result2.allowed).toBe(true)
    expect(result2.remaining).toBe(1)
  })
  
  it('should block grants exceeding quota', async () => {
    const limiter = new InMemoryRateLimiter({
      maxGrantsPerIdentityPerDay: 2,
      windowDurationMs: 3600000,
    })
    
    await limiter.checkAndIncrementGrant('user-2')
    await limiter.checkAndIncrementGrant('user-2')
    
    const result = await limiter.checkAndIncrementGrant('user-2')
    expect(result.allowed).toBe(false)
    expect(result.remaining).toBe(0)
    expect(result.retryAfterMs).toBe(3600000)
  })
  
  it('should isolate quotas per identity', async () => {
    const limiter = new InMemoryRateLimiter({
      maxGrantsPerIdentityPerDay: 1,
      windowDurationMs: 3600000,
    })
    
    const result1 = await limiter.checkAndIncrementGrant('user-3')
    expect(result1.allowed).toBe(true)
    
    const result2 = await limiter.checkAndIncrementGrant('user-4')
    expect(result2.allowed).toBe(true)
  })
  
  it('should reset quota', async () => {
    const limiter = new InMemoryRateLimiter({
      maxGrantsPerIdentityPerDay: 1,
      windowDurationMs: 3600000,
    })
    
    await limiter.checkAndIncrementGrant('user-5')
    const blocked = await limiter.checkAndIncrementGrant('user-5')
    expect(blocked.allowed).toBe(false)
    
    await limiter.resetQuota('user-5')
    const allowed = await limiter.checkAndIncrementGrant('user-5')
    expect(allowed.allowed).toBe(true)
  })
})

describe('DistributedRateLimiter', () => {
  it('should fail closed without Redis configured', async () => {
    const limiter = new DistributedRateLimiter({
      maxGrantsPerIdentityPerDay: 5,
      allowInMemoryFallback: false,
    })
    
    // Simulate production: no Redis means no rate limiting
    const result = await limiter.checkAndIncrementGrant('user-6')
    expect(result.allowed).toBe(false)
  })
  
  it('should use in-memory fallback when configured', async () => {
    const limiter = new DistributedRateLimiter({
      maxGrantsPerIdentityPerDay: 2,
      windowDurationMs: 3600000,
      allowInMemoryFallback: true,
    })
    
    const result1 = await limiter.checkAndIncrementGrant('user-7')
    expect(result1.allowed).toBe(true)
    
    const result2 = await limiter.checkAndIncrementGrant('user-7')
    expect(result2.allowed).toBe(true)
    
    const result3 = await limiter.checkAndIncrementGrant('user-7')
    expect(result3.allowed).toBe(false)
  })
})
