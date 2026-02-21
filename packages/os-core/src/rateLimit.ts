/**
 * @nzila/os-core — Lightweight Sliding-Window Rate Limiter
 *
 * In-memory, per-process sliding window. Works in Next.js Edge Runtime
 * (no Node.js-specific imports).
 *
 * ⚠ Per-instance only: each Edge worker / Node.js process has its own window.
 *   For distributed rate limiting, swap the store for an Upstash Redis adapter
 *   or Arcjet — the interface stays the same.
 *
 * Usage in Next.js middleware:
 *   import { checkRateLimit } from '@nzila/os-core/rateLimit'
 *
 *   const ip = req.headers.get('x-forwarded-for')?.split(',')[0] ?? 'unknown'
 *   const rl = checkRateLimit(ip, { max: 120, windowMs: 60_000 })
 *   if (!rl.allowed) return new Response('Too Many Requests', { status: 429 })
 */

// ── Store ─────────────────────────────────────────────────────────────────

/**
 * Module-level store keyed by `${identifier}`.
 * Values are arrays of request timestamps (ms) within the current window.
 */
const store = new Map<string, number[]>()

/** Purge stale entries every 5 minutes to prevent unbounded growth. */
let lastPurge = Date.now()
const PURGE_INTERVAL_MS = 5 * 60 * 1_000

function maybePurge(now: number, windowMs: number): void {
  if (now - lastPurge < PURGE_INTERVAL_MS) return
  lastPurge = now
  const cutoff = now - windowMs
  for (const [key, hits] of store) {
    const active = hits.filter((t) => t > cutoff)
    if (active.length === 0) {
      store.delete(key)
    } else {
      store.set(key, active)
    }
  }
}

// ── Types ─────────────────────────────────────────────────────────────────

export interface RateLimitOptions {
  /** Maximum number of requests allowed within `windowMs`. */
  max: number
  /** Window length in milliseconds. Default: 60 000 (1 minute). */
  windowMs: number
}

export interface RateLimitResult {
  /** Whether the request is within limits. */
  allowed: boolean
  /** Requests remaining in the current window. */
  remaining: number
  /** Unix timestamp (ms) at which the window resets for this key. */
  resetAt: number
}

// ── Core ──────────────────────────────────────────────────────────────────

/**
 * Check whether `key` is within the rate limit.
 *
 * @param key      Unique identifier (e.g. client IP, `${ip}:${path}`)
 * @param options  Rate limit configuration
 */
export function checkRateLimit(
  key: string,
  options: RateLimitOptions,
): RateLimitResult {
  const { max, windowMs } = options
  const now = Date.now()

  maybePurge(now, windowMs)

  const windowStart = now - windowMs
  const raw = store.get(key) ?? []
  const hits = raw.filter((t) => t > windowStart)

  if (hits.length >= max) {
    // Oldest hit determines when the window opens again
    const resetAt = hits[0] + windowMs
    store.set(key, hits)
    return { allowed: false, remaining: 0, resetAt }
  }

  hits.push(now)
  store.set(key, hits)

  return {
    allowed: true,
    remaining: max - hits.length,
    resetAt: now + windowMs,
  }
}

// ── Headers helper ────────────────────────────────────────────────────────

/**
 * Build standard `RateLimit-*` + `Retry-After` HTTP headers from a result.
 */
export function rateLimitHeaders(
  result: RateLimitResult,
  max: number,
): Record<string, string> {
  return {
    'RateLimit-Limit': String(max),
    'RateLimit-Remaining': String(result.remaining),
    'RateLimit-Reset': String(Math.ceil(result.resetAt / 1_000)),
    'Retry-After': String(
      Math.max(1, Math.ceil((result.resetAt - Date.now()) / 1_000)),
    ),
  }
}
