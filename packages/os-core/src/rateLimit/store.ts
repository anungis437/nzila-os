/**
 * @nzila/os-core — Rate Limit Store Interface
 *
 * Abstracts the backing store for sliding-window rate limiting.
 * Implementations:
 *   - InMemoryRateLimitStore   (default, per-process)
 *   - RedisRateLimitStore      (distributed, multi-instance)
 *
 * The store interface is designed for both in-memory and Redis-backed
 * implementations to be hot-swappable without changing middleware code.
 *
 * @module @nzila/os-core/rateLimit/store
 */

// ── Interface ─────────────────────────────────────────────────────────────

export interface RateLimitStore {
  /**
   * Record a hit and return current window state.
   * @param key       Unique bucket identifier (e.g. `ip:1.2.3.4`, `org:abc:mutations`)
   * @param windowMs  Sliding window length in milliseconds
   * @param max       Maximum allowed hits within the window
   * @returns         Current hit count and whether the request is allowed
   */
  hit(key: string, windowMs: number, max: number): Promise<RateLimitStoreResult>

  /**
   * Reset a specific key (e.g. after org-level override or administrative action).
   */
  reset(key: string): Promise<void>

  /**
   * Get current hit count without recording a new hit.
   */
  peek(key: string, windowMs: number): Promise<number>

  /**
   * Health check — returns true if the store is operational.
   */
  healthy(): Promise<boolean>
}

export interface RateLimitStoreResult {
  /** Current number of hits within the window */
  count: number
  /** Whether the request is within limits */
  allowed: boolean
  /** Remaining requests in window */
  remaining: number
  /** Unix ms timestamp when window resets for this key */
  resetAt: number
}

// ── In-Memory Implementation ──────────────────────────────────────────────

/**
 * In-memory sliding-window store. Per-process only.
 * Suitable for single-instance deployment, dev, and test.
 */
export class InMemoryRateLimitStore implements RateLimitStore {
  private store = new Map<string, number[]>()
  private lastPurge = Date.now()
  private readonly purgeIntervalMs = 5 * 60 * 1_000

  async hit(key: string, windowMs: number, max: number): Promise<RateLimitStoreResult> {
    const now = Date.now()
    this.maybePurge(now, windowMs)

    const windowStart = now - windowMs
    const raw = this.store.get(key) ?? []
    const hits = raw.filter((t) => t > windowStart)

    if (hits.length >= max) {
      const resetAt = hits[0] + windowMs
      this.store.set(key, hits)
      return { count: hits.length, allowed: false, remaining: 0, resetAt }
    }

    hits.push(now)
    this.store.set(key, hits)

    return {
      count: hits.length,
      allowed: true,
      remaining: max - hits.length,
      resetAt: now + windowMs,
    }
  }

  async reset(key: string): Promise<void> {
    this.store.delete(key)
  }

  async peek(key: string, windowMs: number): Promise<number> {
    const now = Date.now()
    const windowStart = now - windowMs
    const raw = this.store.get(key) ?? []
    return raw.filter((t) => t > windowStart).length
  }

  async healthy(): Promise<boolean> {
    return true // in-memory is always healthy
  }

  private maybePurge(now: number, windowMs: number): void {
    if (now - this.lastPurge < this.purgeIntervalMs) return
    this.lastPurge = now
    const cutoff = now - windowMs
    for (const [key, hits] of this.store) {
      const active = hits.filter((t) => t > cutoff)
      if (active.length === 0) this.store.delete(key)
      else this.store.set(key, active)
    }
  }
}

// ── Redis Implementation ──────────────────────────────────────────────────

/**
 * Distributed sliding-window rate limiter using Redis sorted sets.
 *
 * Algorithm:
 *   1. ZREMRANGEBYSCORE to purge expired entries
 *   2. ZCARD to count current window hits
 *   3. ZADD NX to record the new hit (if under limit)
 *   4. PEXPIRE to auto-cleanup abandoned keys
 *
 * Requires any Redis 6.2+ compatible client: ioredis, @upstash/redis, etc.
 *
 * Configuration:
 *   REDIS_URL        — Redis connection string
 *   RATE_LIMIT_STORE — 'redis' to enable (default: 'memory')
 */
export interface RedisLike {
  /** Execute a pipeline of commands atomically */
  multi(): RedisPipeline
  /** Delete a key */
  del(key: string): Promise<number>
  /** Check connectivity */
  ping(): Promise<string>
}

export interface RedisPipeline {
  zremrangebyscore(key: string, min: number | string, max: number | string): RedisPipeline
  zcard(key: string): RedisPipeline
  zadd(key: string, score: number, member: string): RedisPipeline
  pexpire(key: string, ms: number): RedisPipeline
  exec(): Promise<Array<[Error | null, unknown]>>
}

export class RedisRateLimitStore implements RateLimitStore {
  private readonly prefix: string

  constructor(
    private readonly redis: RedisLike,
    opts?: { keyPrefix?: string },
  ) {
    this.prefix = opts?.keyPrefix ?? 'nzila:rl:'
  }

  async hit(key: string, windowMs: number, max: number): Promise<RateLimitStoreResult> {
    const redisKey = `${this.prefix}${key}`
    const now = Date.now()
    const windowStart = now - windowMs
    const member = `${now}:${Math.random().toString(36).slice(2, 8)}`

    const pipeline = this.redis
      .multi()
      .zremrangebyscore(redisKey, 0, windowStart)
      .zcard(redisKey)

    const results = await pipeline.exec()

    const currentCount = (results[1]?.[1] as number) ?? 0

    if (currentCount >= max) {
      return {
        count: currentCount,
        allowed: false,
        remaining: 0,
        resetAt: now + windowMs,
      }
    }

    // Record the hit
    await this.redis
      .multi()
      .zadd(redisKey, now, member)
      .pexpire(redisKey, windowMs)
      .exec()

    return {
      count: currentCount + 1,
      allowed: true,
      remaining: max - (currentCount + 1),
      resetAt: now + windowMs,
    }
  }

  async reset(key: string): Promise<void> {
    await this.redis.del(`${this.prefix}${key}`)
  }

  async peek(key: string, windowMs: number): Promise<number> {
    const redisKey = `${this.prefix}${key}`
    const now = Date.now()
    const windowStart = now - windowMs

    const results = await this.redis
      .multi()
      .zremrangebyscore(redisKey, 0, windowStart)
      .zcard(redisKey)
      .exec()

    return (results[1]?.[1] as number) ?? 0
  }

  async healthy(): Promise<boolean> {
    try {
      const result = await this.redis.ping()
      return result === 'PONG'
    } catch {
      return false
    }
  }
}

// ── Factory ───────────────────────────────────────────────────────────────

let _globalStore: RateLimitStore | undefined

/**
 * Get or create the rate-limit store singleton.
 *
 * If RATE_LIMIT_STORE=redis and REDIS_URL is set, returns a Redis-backed store.
 * Otherwise returns an in-memory store.
 *
 * @param redis  Optional Redis client (for DI / testing). If not provided,
 *               the factory will attempt dynamic import of ioredis.
 */
export async function getRateLimitStore(redis?: RedisLike): Promise<RateLimitStore> {
  if (_globalStore) return _globalStore

  const storeType = process.env.RATE_LIMIT_STORE ?? 'memory'

  // ── Upstash REST (Edge Runtime compatible) ──────────────────────────────
  const upstashUrl = process.env.UPSTASH_REDIS_REST_URL
  const upstashToken = process.env.UPSTASH_REDIS_REST_TOKEN

  if ((storeType === 'upstash' || storeType === 'redis') && upstashUrl && upstashToken) {
    const { UpstashRateLimitStore } = await import('./upstash-store')
    _globalStore = new UpstashRateLimitStore(upstashUrl, upstashToken)
    console.log('[rate-limit] Using Upstash Redis REST distributed store')
    return _globalStore
  }

  // ── ioredis (Node.js only — won't work in Edge Runtime) ────────────────
  if (storeType === 'redis') {
    if (redis) {
      _globalStore = new RedisRateLimitStore(redis)
      return _globalStore
    }

    const redisUrl = process.env.REDIS_URL
    if (!redisUrl) {
      console.warn(
        '[rate-limit] RATE_LIMIT_STORE=redis but REDIS_URL not set. ' +
          'Falling back to in-memory store.',
      )
      _globalStore = new InMemoryRateLimitStore()
      return _globalStore
    }

    try {
      // Dynamic import so ioredis isn't a hard dependency
      const { default: Redis } = await import('ioredis')
      const client = new Redis(redisUrl, {
        maxRetriesPerRequest: 3,
        enableReadyCheck: true,
        lazyConnect: true,
        connectTimeout: 5_000,
      })
      await client.connect()
      _globalStore = new RedisRateLimitStore(client as unknown as RedisLike)
      console.log('[rate-limit] Using Redis-backed distributed store')
      return _globalStore
    } catch (err) {
      console.warn(
        `[rate-limit] Failed to connect to Redis: ${err}. Falling back to in-memory store.`,
      )
      _globalStore = new InMemoryRateLimitStore()
      return _globalStore
    }
  }

  _globalStore = new InMemoryRateLimitStore()
  return _globalStore
}

/**
 * Reset the global store singleton (for testing).
 */
export function resetGlobalStore(): void {
  _globalStore = undefined
}
