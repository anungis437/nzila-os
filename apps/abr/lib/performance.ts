/**
 * ABR Performance Metrics — Platform-Performance Bridge
 *
 * Instruments ABR request metrics so they appear in Console performance
 * dashboards with app=abr filtering. All metrics are org-scoped.
 *
 * Uses @nzila/platform-performance trackRequestMetrics — no direct DB access.
 *
 * @module @nzila/abr/performance
 */
import { trackRequestMetrics, type RequestMetric } from '@nzila/platform-performance'

// ── ABR Route Prefix ─────────────────────────────────────────────────────

/**
 * All ABR performance metrics are tagged with this prefix so Console
 * performance page can filter by app=abr.
 */
const ABR_ROUTE_PREFIX = 'abr:'

// ── Types ────────────────────────────────────────────────────────────────

export interface AbrRequestContext {
  /** The ABR route path (e.g. "/api/decisions", "/dashboard") */
  route: string
  /** Org ID from Clerk JWT — required, org-scoped */
  orgId: string
  /** Response latency in milliseconds */
  latencyMs: number
  /** HTTP status code */
  statusCode: number
  /** Optional timestamp override (defaults to now) */
  timestamp?: Date
}

// ── Track ABR Request ────────────────────────────────────────────────────

/**
 * Track a single ABR request metric.
 * Prefixes route with `abr:` for Console app-level filtering.
 *
 * Call this from ABR API routes and middleware after response is sent.
 */
export async function trackAbrRequestMetrics(ctx: AbrRequestContext): Promise<void> {
  const metric: RequestMetric = {
    route: `${ABR_ROUTE_PREFIX}${ctx.route}`,
    orgId: ctx.orgId,
    latencyMs: ctx.latencyMs,
    statusCode: ctx.statusCode,
    timestamp: ctx.timestamp,
  }
  await trackRequestMetrics(metric)
}

/**
 * Check if a route string belongs to the ABR app.
 * Used by Console performance page for app-level filtering.
 */
export function isAbrRoute(route: string): boolean {
  return route.startsWith(ABR_ROUTE_PREFIX)
}
