/**
 * @nzila/os-core — Request Context
 *
 * Provides per-request correlation IDs (requestId, traceId).
 * Must be attached by middleware before any handler executes.
 */
import { randomUUID } from 'node:crypto'
import { AsyncLocalStorage } from 'node:async_hooks'

// ── Types ─────────────────────────────────────────────────────────────────

export interface RequestContext {
  /** Unique ID for this HTTP request (UUID v4) */
  requestId: string
  /** OpenTelemetry trace ID (hex, 32 chars) — from W3C traceparent if present */
  traceId?: string
  /** OpenTelemetry span ID (hex, 16 chars) */
  spanId?: string
  /** The authenticated user ID (Clerk) */
  userId?: string
  /** Start time of the request (for duration tracking) */
  startedAt: number
  /** App name (e.g. 'console', 'partners') */
  appName?: string
}

// ── Storage ───────────────────────────────────────────────────────────────

const contextStore = new AsyncLocalStorage<RequestContext>()

/**
 * Get the current request context.
 * Returns undefined if called outside a request lifecycle.
 */
export function getRequestContext(): RequestContext | undefined {
  return contextStore.getStore()
}

/**
 * Run a function within a request context.
 */
export function runWithContext<T>(ctx: RequestContext, fn: () => T): T {
  return contextStore.run(ctx, fn)
}

// ── Context creation ──────────────────────────────────────────────────────

/**
 * Creates a RequestContext from a Next.js/Fetch Request.
 * Extracts W3C traceparent if present.
 */
export function createRequestContext(
  req: Request | { headers: Headers | { get(k: string): string | null } },
  opts: { appName?: string; userId?: string } = {},
): RequestContext {
  const headers = req.headers
  const getHeader = (k: string) =>
    typeof headers.get === 'function' ? headers.get(k) : null

  const traceparent = getHeader('traceparent')
  let traceId: string | undefined
  let spanId: string | undefined

  if (traceparent) {
    // W3C traceparent: 00-{traceId}-{parentId}-{flags}
    const parts = traceparent.split('-')
    if (parts.length === 4) {
      traceId = parts[1]
      spanId = parts[2]
    }
  }

  const requestId = getHeader('x-request-id') ?? randomUUID()

  return {
    requestId,
    traceId,
    spanId,
    userId: opts.userId,
    startedAt: Date.now(),
    appName: opts.appName,
  }
}

/**
 * Returns headers to forward to downstream services.
 */
export function contextToHeaders(ctx: RequestContext): Record<string, string> {
  const headers: Record<string, string> = {
    'x-request-id': ctx.requestId,
  }
  if (ctx.traceId) {
    headers['x-trace-id'] = ctx.traceId
  }
  if (ctx.userId) {
    headers['x-user-id'] = ctx.userId
  }
  return headers
}
