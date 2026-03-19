/**
 * Per-tenant, per-route sliding-window rate limiter.
 *
 * Uses an in-memory store by default; swap `RateLimitStore` for Redis
 * or another distributed backend in production.
 */

export interface RateLimitConfig {
  /** Max requests allowed within the window. */
  maxRequests: number;
  /** Window size in milliseconds. */
  windowMs: number;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number; // epoch ms
}

export interface RateLimitStore {
  hit(key: string, windowMs: number): Promise<{ count: number; resetAt: number }>;
  reset(key: string): Promise<void>;
}

/**
 * Build a composite rate-limit key from tenant + route.
 */
export function rateLimitKey(tenantId: string, route: string): string {
  return `rl:${tenantId}:${route}`;
}

// ── In-memory store ─────────────────────────────────────────

interface Bucket {
  timestamps: number[];
}

export class InMemoryRateLimitStore implements RateLimitStore {
  private readonly buckets = new Map<string, Bucket>();

  async hit(
    key: string,
    windowMs: number,
  ): Promise<{ count: number; resetAt: number }> {
    const now = Date.now();
    const cutoff = now - windowMs;

    let bucket = this.buckets.get(key);
    if (!bucket) {
      bucket = { timestamps: [] };
      this.buckets.set(key, bucket);
    }

    // Slide: drop entries outside the window
    bucket.timestamps = bucket.timestamps.filter((t) => t > cutoff);
    bucket.timestamps.push(now);

    return {
      count: bucket.timestamps.length,
      resetAt: now + windowMs,
    };
  }

  async reset(key: string): Promise<void> {
    this.buckets.delete(key);
  }
}

// ── Rate limiter ────────────────────────────────────────────

export class RateLimiter {
  constructor(
    private readonly store: RateLimitStore,
    private readonly config: RateLimitConfig,
  ) {}

  async check(tenantId: string, route: string): Promise<RateLimitResult> {
    const key = rateLimitKey(tenantId, route);
    const { count, resetAt } = await this.store.hit(key, this.config.windowMs);
    const remaining = Math.max(0, this.config.maxRequests - count);
    return {
      allowed: count <= this.config.maxRequests,
      remaining,
      resetAt,
    };
  }

  async reset(tenantId: string, route: string): Promise<void> {
    await this.store.reset(rateLimitKey(tenantId, route));
  }
}
