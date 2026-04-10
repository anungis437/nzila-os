import { type NextRequest, NextResponse } from 'next/server'
import {
  extractTraceFromHeaders,
  withTraceContextAsync,
  buildTraceHeaders,
  type TraceContext,
} from './context'
import { createSpan, endSpan, addSpanEvent } from './spans'
import { getObservabilityLogger } from './sdk'

// ─── Middleware for Next.js API Routes ──────────────────────────────────────

export interface TraceMiddlewareOptions {
  readonly defaultTenantId?: string
  readonly defaultActorId?: string
  readonly extractTenantId?: (req: NextRequest) => string
  readonly extractActorId?: (req: NextRequest) => string
}

export function withTraceContext(
  handler: (req: NextRequest, ctx: TraceContext) => Promise<NextResponse>,
  options: TraceMiddlewareOptions = {},
) {
  return async (req: NextRequest): Promise<NextResponse> => {
    const tenantId = options.extractTenantId?.(req) ?? options.defaultTenantId ?? 'system'
    const actorId = options.extractActorId?.(req) ?? options.defaultActorId ?? 'anonymous'

    const traceCtx = extractTraceFromHeaders(req.headers, {
      tenantId,
      actorId,
    })

    const logger = getObservabilityLogger()
    const span = createSpan(`${req.method} ${req.nextUrl.pathname}`, traceCtx, {
      'http.method': req.method,
      'http.url': req.nextUrl.pathname,
    })

    return withTraceContextAsync(traceCtx, async () => {
      logger.info('request.start', {
        method: req.method,
        path: req.nextUrl.pathname,
      })

      try {
        const response = await handler(req, traceCtx)
        const status = response.status

        addSpanEvent(span, 'response', { 'http.status_code': status })
        endSpan(span, status >= 400 ? 'error' : 'ok')

        logger.info('request.end', {
          method: req.method,
          path: req.nextUrl.pathname,
          status,
          durationMs: span.durationMs,
        })

        // Inject trace headers into response
        const headers = buildTraceHeaders(traceCtx)
        for (const [key, value] of Object.entries(headers)) {
          response.headers.set(key, value)
        }

        return response
      } catch (err) {
        addSpanEvent(span, 'exception', {
          'exception.message': err instanceof Error ? err.message : String(err),
        })
        endSpan(span, 'error')

        logger.error('request.error', {
          method: req.method,
          path: req.nextUrl.pathname,
          error: err instanceof Error ? err.message : String(err),
        })

        throw err
      }
    }) as Promise<NextResponse>
  }
}

// ─── Generic Middleware (non-Next.js) ───────────────────────────────────────

export interface GenericRequest {
  readonly method: string
  readonly url: string
  readonly headers: {
    get(name: string): string | null | undefined
  }
}

export function createTraceMiddleware(options: TraceMiddlewareOptions = {}) {
  return async <T>(
    req: GenericRequest,
    handler: (ctx: TraceContext) => Promise<T>,
  ): Promise<T> => {
    const tenantId = options.defaultTenantId ?? 'system'
    const actorId = options.defaultActorId ?? 'anonymous'

    const traceCtx = extractTraceFromHeaders(req.headers, {
      tenantId,
      actorId,
    })

    const span = createSpan(`${req.method} ${req.url}`, traceCtx, {
      'http.method': req.method,
      'http.url': req.url,
    })

    return withTraceContextAsync(traceCtx, async () => {
      try {
        const result = await handler(traceCtx)
        endSpan(span, 'ok')
        return result
      } catch (err) {
        addSpanEvent(span, 'exception', {
          'exception.message': err instanceof Error ? err.message : String(err),
        })
        endSpan(span, 'error')
        throw err
      }
    }) as Promise<T>
  }
}
