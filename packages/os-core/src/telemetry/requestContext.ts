/**
 * @nzila/os-core — Request Context
 *
 * Provides per-request correlation IDs (requestId, traceId).
 * Must be attached by middleware before any handler executes.
 */


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
  /**
   * The Org (entity) ID this request is scoped to.
   * Populated from AuthContext after authorize() resolves.
   * Injected automatically into every log entry for incident tracing.
   */
  orgId?: string
  /** Start time of the request (for duration tracking) */
  startedAt: number
  /** App name (e.g. 'console', 'partners') */
  appName?: string
}

// ── Storage ───────────────────────────────────────────────────────────────

let currentContext: RequestContext | undefined

function hasThen<T>(value: unknown): value is Promise<T> {
  return !!value && typeof (value as { then?: unknown }).then === 'function'
}

function createUuid(): string {
  const cryptoObj = globalThis.crypto as { randomUUID?: () => string } | undefined
  if (cryptoObj?.randomUUID) {
    return cryptoObj.randomUUID()
  }

  // RFC4122-ish fallback for environments where randomUUID is unavailable.
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.floor(Math.random() * 16)
    const v = c === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

/**
 * Get the current request context.
 * Returns undefined if called outside a request lifecycle.
 */
export function getRequestContext(): RequestContext | undefined {
  return currentContext
}

/**
 * Run a function within a request context.
 */
export function runWithContext<T>(ctx: RequestContext, fn: () => T): T {
  const previous = currentContext
  currentContext = ctx

  try {
    const result = fn()
    if (hasThen(result)) {
      return result.finally(() => {
        currentContext = previous
      }) as T
    }
    currentContext = previous
    return result
  } catch (error) {
    currentContext = previous
    throw error
  }
}

// ── Context creation ──────────────────────────────────────────────────────

/**
 * Creates a RequestContext from a Next.js/Fetch Request.
 * Extracts W3C traceparent if present.
 */
export function createRequestContext(
  req: Request | { headers: Headers | { get(k: string): string | null } },
  opts: { appName?: string; userId?: string; orgId?: string } = {},
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

  const requestId = getHeader('x-request-id') ?? createUuid()

  return {
    requestId,
    traceId,
    spanId,
    userId: opts.userId,
    orgId: opts.orgId,
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
  if (ctx.orgId) {
    headers['x-org-id'] = ctx.orgId
  }
  return headers
}
