/**
 * @nzila/os-core — Org-Scoped Rate Limiter
 *
 * Extends the base rate limiter with org-level + route-group bucketing.
 * Separate buckets for auth, mutations, exports, and integrations.
 *
 * In-memory for dev/test. For pilot/prod, swap the store interface
 * with Redis or DB-backed adapter.
 *
 * @module @nzila/os-core/orgRateLimit
 */
import { checkRateLimit, rateLimitHeaders, type RateLimitResult } from './rateLimit'

// ── Route Groups ────────────────────────────────────────────────────────────

export const ROUTE_GROUPS = ['auth', 'mutations', 'exports', 'integrations', 'general'] as const
export type RouteGroup = (typeof ROUTE_GROUPS)[number]

export interface OrgRateLimitConfig {
  /** Limits per route group: { groupName: { max, windowMs } } */
  groups: Record<RouteGroup, { max: number; windowMs: number }>
}

export interface OrgRateLimitResult extends RateLimitResult {
  orgId: string
  routeGroup: RouteGroup
}

export interface ThrottleEvent {
  orgId: string
  routeGroup: RouteGroup
  requestCount: number
  limitMax: number
  windowMs: number
  throttledAt: Date
}

// ── Default Configs ─────────────────────────────────────────────────────────

export const DEFAULT_ORG_RATE_LIMITS: OrgRateLimitConfig = {
  groups: {
    auth: { max: 30, windowMs: 60_000 },
    mutations: { max: 60, windowMs: 60_000 },
    exports: { max: 10, windowMs: 60_000 },
    integrations: { max: 100, windowMs: 60_000 },
    general: { max: 200, windowMs: 60_000 },
  },
}

// ── Throttle Log (in-memory, for dev / export to proof packs) ───────────

const throttleLog: ThrottleEvent[] = []
const MAX_THROTTLE_LOG = 1000

export function getThrottleLog(orgId?: string): ThrottleEvent[] {
  if (orgId) return throttleLog.filter((e) => e.orgId === orgId)
  return [...throttleLog]
}

export function clearThrottleLog(): void {
  throttleLog.length = 0
}

function recordThrottle(event: ThrottleEvent): void {
  throttleLog.push(event)
  if (throttleLog.length > MAX_THROTTLE_LOG) {
    throttleLog.shift()
  }
}

// ── Route Classification ────────────────────────────────────────────────────

/**
 * Classify a request path into a route group for rate limiting.
 */
export function classifyRoute(pathname: string, method: string): RouteGroup {
  if (pathname.startsWith('/api/auth') || pathname.startsWith('/api/webhooks/auth')) {
    return 'auth'
  }
  if (pathname.startsWith('/api/export') || pathname.startsWith('/api/proof')) {
    return 'exports'
  }
  if (pathname.startsWith('/api/integrations')) {
    return 'integrations'
  }
  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
    return 'mutations'
  }
  return 'general'
}

// ── Core Function ───────────────────────────────────────────────────────────

/**
 * Check org-scoped rate limit for a specific route group.
 *
 * @param orgId    Org identifier
 * @param pathname Request path
 * @param method   HTTP method
 * @param config   Optional per-org config override
 */
export function checkOrgRateLimit(
  orgId: string,
  pathname: string,
  method: string,
  config: OrgRateLimitConfig = DEFAULT_ORG_RATE_LIMITS,
): OrgRateLimitResult {
  const routeGroup = classifyRoute(pathname, method)
  const groupConfig = config.groups[routeGroup]

  // Composite key: orgId + routeGroup for isolated rate buckets
  const key = `org:${orgId}:${routeGroup}`

  const result = checkRateLimit(key, {
    max: groupConfig.max,
    windowMs: groupConfig.windowMs,
  })

  if (!result.allowed) {
    recordThrottle({
      orgId,
      routeGroup,
      requestCount: groupConfig.max,
      limitMax: groupConfig.max,
      windowMs: groupConfig.windowMs,
      throttledAt: new Date(),
    })
  }

  return {
    ...result,
    orgId,
    routeGroup,
  }
}

/**
 * Build rate limit headers with org context.
 */
export function orgRateLimitHeaders(
  result: OrgRateLimitResult,
): Record<string, string> {
  const groupConfig = DEFAULT_ORG_RATE_LIMITS.groups[result.routeGroup]
  return {
    ...rateLimitHeaders(result, groupConfig.max),
    'X-RateLimit-Group': result.routeGroup,
  }
}

/**
 * Get throttle stats summary for proof packs / Console.
 */
export function getThrottleStats(orgId?: string): {
  totalThrottles: number
  byGroup: Record<RouteGroup, number>
  recentThrottles: ThrottleEvent[]
} {
  const events = orgId ? throttleLog.filter((e) => e.orgId === orgId) : throttleLog

  const byGroup = {} as Record<RouteGroup, number>
  for (const g of ROUTE_GROUPS) byGroup[g] = 0

  for (const e of events) {
    byGroup[e.routeGroup] = (byGroup[e.routeGroup] ?? 0) + 1
  }

  return {
    totalThrottles: events.length,
    byGroup,
    recentThrottles: events.slice(-20),
  }
}
