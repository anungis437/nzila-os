/**
 * @nzila/platform-integrations — Rate Limiter
 *
 * Token bucket rate limiter for inbound connectors.
 * Prevents abuse by enforcing per-org, per-connection request limits.
 */

export interface RateLimitConfig {
  readonly maxRequestsPerMinute: number
  readonly maxRequestsPerHour: number
  readonly burstLimit: number
}

export interface RateLimitResult {
  readonly allowed: boolean
  readonly remaining: number
  readonly resetAt: string
  readonly retryAfterMs: number | null
}

interface BucketState {
  minuteCount: number
  hourCount: number
  minuteResetAt: number
  hourResetAt: number
}

export const DEFAULT_RATE_LIMIT: RateLimitConfig = {
  maxRequestsPerMinute: 60,
  maxRequestsPerHour: 1000,
  burstLimit: 10,
}

export class InMemoryRateLimiter {
  private readonly buckets = new Map<string, BucketState>()
  private readonly config: RateLimitConfig

  constructor(config: RateLimitConfig = DEFAULT_RATE_LIMIT) {
    this.config = config
  }

  check(key: string): RateLimitResult {
    const now = Date.now()
    let bucket = this.buckets.get(key)

    if (!bucket) {
      bucket = {
        minuteCount: 0,
        hourCount: 0,
        minuteResetAt: now + 60_000,
        hourResetAt: now + 3_600_000,
      }
      this.buckets.set(key, bucket)
    }

    // Reset windows
    if (now > bucket.minuteResetAt) {
      bucket.minuteCount = 0
      bucket.minuteResetAt = now + 60_000
    }
    if (now > bucket.hourResetAt) {
      bucket.hourCount = 0
      bucket.hourResetAt = now + 3_600_000
    }

    // Check limits
    if (bucket.minuteCount >= this.config.maxRequestsPerMinute) {
      return {
        allowed: false,
        remaining: 0,
        resetAt: new Date(bucket.minuteResetAt).toISOString(),
        retryAfterMs: bucket.minuteResetAt - now,
      }
    }

    if (bucket.hourCount >= this.config.maxRequestsPerHour) {
      return {
        allowed: false,
        remaining: 0,
        resetAt: new Date(bucket.hourResetAt).toISOString(),
        retryAfterMs: bucket.hourResetAt - now,
      }
    }

    // Consume token
    bucket.minuteCount++
    bucket.hourCount++

    return {
      allowed: true,
      remaining: this.config.maxRequestsPerMinute - bucket.minuteCount,
      resetAt: new Date(bucket.minuteResetAt).toISOString(),
      retryAfterMs: null,
    }
  }

  /** Build a rate limit key for org+connection */
  static key(orgId: string, connectionId: string): string {
    return `${orgId}:${connectionId}`
  }

  clear(): void {
    this.buckets.clear()
  }
}
