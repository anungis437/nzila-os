/**
 * @nzila/os-core — Distributed Rate Limiting (async, store-backed)
 *
 * Drop-in async replacements for `checkRateLimit` and `checkOrgRateLimit`
 * that use the pluggable `RateLimitStore` interface (Redis/Upstash/memory).
 *
 * Usage in Next.js Edge middleware:
 *   import { checkRateLimitDistributed } from '@nzila/os-core/rateLimit/distributed'
 *
 *   const rl = await checkRateLimitDistributed(ip, { max: 120, windowMs: 60_000 })
 *   if (!rl.allowed) return new Response('Too Many Requests', { status: 429 })
 *
 * The store is selected via env vars (see `getRateLimitStore`):
 *   RATE_LIMIT_STORE=upstash + UPSTASH_REDIS_REST_URL → Upstash REST (Edge-safe)
 *   RATE_LIMIT_STORE=redis   + REDIS_URL              → ioredis (Node.js only)
 *   Otherwise                                         → in-memory fallback
 *
 * @module @nzila/os-core/rateLimit/distributed
 */

import type { RateLimitOptions, RateLimitResult } from '../rateLimit'
import type { OrgRateLimitConfig, OrgRateLimitResult, RouteGroup } from '../orgRateLimit'
import { DEFAULT_ORG_RATE_LIMITS, classifyRoute } from '../orgRateLimit'
import { getRateLimitStore } from './store'

// ── IP / generic key rate limiting ──────────────────────────────────────────

/**
 * Async distributed rate-limit check.
 * Uses whatever store `getRateLimitStore()` resolves to (Upstash > ioredis > memory).
 */
export async function checkRateLimitDistributed(
  key: string,
  options: RateLimitOptions,
): Promise<RateLimitResult> {
  try {
    const store = await getRateLimitStore()
    const result = await store.hit(key, options.windowMs, options.max)

    return {
      allowed: result.allowed,
      remaining: result.remaining,
      resetAt: result.resetAt,
    }
  } catch {
    // Redis down — fail open but log. Allows traffic rather than blocking all.
    // The /api/health endpoint will flag Redis degradation separately.
    return {
      allowed: true,
      remaining: options.max,
      resetAt: Date.now() + options.windowMs,
    }
  }
}

// ── Org-scoped rate limiting ────────────────────────────────────────────────

/**
 * Async distributed org-scoped rate-limit check.
 * Classifies the route into a group (auth/mutations/exports/etc.) and
 * applies per-org limits via the shared store.
 */
export async function checkOrgRateLimitDistributed(
  orgId: string,
  pathname: string,
  method: string,
  config: OrgRateLimitConfig = DEFAULT_ORG_RATE_LIMITS,
): Promise<OrgRateLimitResult> {
  const routeGroup: RouteGroup = classifyRoute(pathname, method)
  const groupConfig = config.groups[routeGroup]
  const key = `org:${orgId}:${routeGroup}`

  const result = await checkRateLimitDistributed(key, {
    max: groupConfig.max,
    windowMs: groupConfig.windowMs,
  })

  return {
    ...result,
    orgId,
    routeGroup,
  }
}
