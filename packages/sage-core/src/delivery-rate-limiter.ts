/**
 * Distributed Rate Limiter for Delivery Operations
 *
 * Prevents abuse of delivery issuance (per-identity rate limiting).
 * 
 * In production: requires Redis or edge-based provider.
 * In test/dev: in-memory implementation (but fails if provider unavailable).
 * 
 * NEVER falls back to per-process memory in production.
 */

import { SageRepository } from './repository'

export interface RateLimitConfig {
  /**
   * Maximum delivery grants allowed per identity (per window).
   * Default: 10 grants per day.
   */
  maxGrantsPerIdentityPerDay?: number
  
  /**
   * Window duration in milliseconds.
   * Default: 86400000ms = 24 hours.
   */
  windowDurationMs?: number
  
  /**
   * Redis connection string (required in production).
   * If not provided in production, rate limiting is disabled (UNSAFE).
   */
  redisUrl?: string
  
  /**
   * Enable in-memory fallback for testing (dev/test only).
   * Default: false (fail closed in production).
   */
  allowInMemoryFallback?: boolean
}

export interface RateLimiter {
  /**
   * Check if identity has remaining quota.
   * 
   * Returns: { allowed: boolean, remaining: number, retryAfterMs?: number }
   * 
   * On error or provider unavailable:
   *   - Production: returns { allowed: false } (fail closed)
   *   - Dev/test with fallback: uses in-memory
   */
  checkAndIncrementGrant(identityId: string): Promise<{
    allowed: boolean
    remaining: number
    retryAfterMs?: number
  }>
  
  /**
   * Reset quota for an identity (e.g., after revocation).
   */
  resetQuota(identityId: string): Promise<void>
}

/**
 * Production distributed rate limiter (Redis-backed).
 * Fail closed if Redis unavailable.
 */
export class DistributedRateLimiter implements RateLimiter {
  private redisClient?: any // Redis.Cluster or Redis client
  private config: {
    maxGrantsPerIdentityPerDay: number
    windowDurationMs: number
    allowInMemoryFallback: boolean
    redisUrl?: string
  }
  
  constructor(input?: Partial<RateLimitConfig>) {
    this.config = {
      maxGrantsPerIdentityPerDay: input?.maxGrantsPerIdentityPerDay ?? 10,
      windowDurationMs: input?.windowDurationMs ?? 86400000,
      allowInMemoryFallback: input?.allowInMemoryFallback ?? false,
      redisUrl: input?.redisUrl,
    }
    
    if (this.config.redisUrl && process.env.NODE_ENV !== 'test') {
      // Initialize Redis client (stubbed here; actual implementation depends on Redis lib)
      // this.redisClient = createRedisClient(this.config.redisUrl)
    }
  }
  
  async checkAndIncrementGrant(identityId: string): Promise<{
    allowed: boolean
    remaining: number
    retryAfterMs?: number
  }> {
    if (!this.redisClient && !this.config.allowInMemoryFallback) {
      // Fail closed: no distributed provider configured
      console.error('Rate limiter not configured (Redis required or fallback disabled)')
      return { allowed: false, remaining: 0 }
    }
    
    if (!this.redisClient) {
      // Use in-memory fallback if allowed
      return this.checkAndIncrementInMemory(identityId)
    }
    
    try {
      const key = `rate-limit:delivery-grant:${identityId}`
      const now = Date.now()
      const windowStartMs = now - this.config.windowDurationMs
      
      // ZREMRANGEBYSCORE removes old entries outside the window
      // ZCARD counts remaining
      // ZADD adds current request with timestamp as score
      const multi = this.redisClient.multi()
      multi.zremrangebyscore(key, 0, windowStartMs)
      multi.zcard(key)
      multi.zadd(key, now, `${now}-${Math.random()}`) // Include randomness for uniqueness
      multi.expire(key, Math.ceil(this.config.windowDurationMs / 1000))
      
      const results = await multi.exec()
      const currentCount = results[1] as number
      
      const allowed = currentCount < this.config.maxGrantsPerIdentityPerDay
      const remaining = Math.max(0, this.config.maxGrantsPerIdentityPerDay - currentCount - (allowed ? 1 : 0))
      const retryAfterMs = allowed ? undefined : this.config.windowDurationMs
      
      return { allowed, remaining, retryAfterMs }
    } catch (err) {
      console.error('Rate limiter check failed', { error: err instanceof Error ? err.message : String(err) })
      return { allowed: false, remaining: 0 }
    }
  }
  
  async resetQuota(identityId: string): Promise<void> {
    if (!this.redisClient) return
    
    try {
      const key = `rate-limit:delivery-grant:${identityId}`
      await this.redisClient.del(key)
    } catch (err) {
      console.error('Rate limiter reset failed', { error: err instanceof Error ? err.message : String(err) })
    }
  }
  
  private inMemoryQuotas = new Map<string, number[]>()
  
  private checkAndIncrementInMemory(identityId: string): {
    allowed: boolean
    remaining: number
    retryAfterMs?: number
  } {
    const now = Date.now()
    const windowStartMs = now - this.config.windowDurationMs
    
    // Clean old entries
    let grants = this.inMemoryQuotas.get(identityId) || []
    grants = grants.filter((ts) => ts >= windowStartMs)
    
    const allowed = grants.length < this.config.maxGrantsPerIdentityPerDay
    if (allowed) {
      grants.push(now)
    }
    
    this.inMemoryQuotas.set(identityId, grants)
    
    const remaining = Math.max(0, this.config.maxGrantsPerIdentityPerDay - grants.length)
    const retryAfterMs = allowed ? undefined : this.config.windowDurationMs
    
    return { allowed, remaining, retryAfterMs }
  }
}

/**
 * In-memory rate limiter for testing.
 * NEVER use in production (quota state lost on restart).
 */
export class InMemoryRateLimiter implements RateLimiter {
  private quotas = new Map<string, number[]>()
  private config: {
    maxGrantsPerIdentityPerDay: number
    windowDurationMs: number
    allowInMemoryFallback: boolean
    redisUrl?: string
  }
  
  constructor(input?: Partial<RateLimitConfig>) {
    this.config = {
      maxGrantsPerIdentityPerDay: input?.maxGrantsPerIdentityPerDay ?? 10,
      windowDurationMs: input?.windowDurationMs ?? 86400000,
      allowInMemoryFallback: input?.allowInMemoryFallback ?? true,
      redisUrl: input?.redisUrl,
    }
  }
  
  async checkAndIncrementGrant(identityId: string): Promise<{
    allowed: boolean
    remaining: number
    retryAfterMs?: number
  }> {
    const now = Date.now()
    const windowStartMs = now - this.config.windowDurationMs
    
    // Clean old entries
    let grants = this.quotas.get(identityId) || []
    grants = grants.filter((ts) => ts >= windowStartMs)
    
    const allowed = grants.length < this.config.maxGrantsPerIdentityPerDay
    if (allowed) {
      grants.push(now)
    }
    
    this.quotas.set(identityId, grants)
    
    const remaining = Math.max(0, this.config.maxGrantsPerIdentityPerDay - grants.length)
    const retryAfterMs = allowed ? undefined : this.config.windowDurationMs
    
    return { allowed, remaining, retryAfterMs }
  }
  
  async resetQuota(identityId: string): Promise<void> {
    this.quotas.delete(identityId)
  }
}
