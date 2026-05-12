/**
 * @nzila/os-core — Standardized Next.js API Route Handler
 *
 * Wraps a Next.js App Router route handler with:
 *   - Request-ID extraction (x-request-id header)
 *   - RequestContext propagation via AsyncLocalStorage
 *   - Structured logging on entry/exit
 *   - Uniform error envelope conversion
 *   - Optional auth guard (platform auth → AuthContext)
 *   - Optional audit hook for governed mutations
 *
 * Usage:
 *   export const POST = apiHandler({
 *     appName: 'console',
 *     auth: { requiredRole: ConsoleRole.ADMIN },
 *     audit: { action: 'org.settings.updated' },
 *   }, async (req, { requestId, auth, logger }) => {
 *     const body = await req.json()
 *     return { data: body }
 *   })
 */

// next/server is type-only at module load so this package can be imported by
// non-Next runtimes (e.g. Fastify services like orchestrator-api). The runtime
// value is lazily loaded inside the handler via dynamic import.
import type { NextRequest, NextResponse } from 'next/server'
import { ZodError } from 'zod'
import {
  ApiError,
  apiSuccess,
  apiError,
  ApiErrorCode,
  type ApiSuccessResponse,
} from './api-response'
import {
  createRequestContext,
  runWithContext,
  getRequestContext,
} from './telemetry/requestContext'
import { createLogger, type Logger } from './telemetry/logger'
import type { AuthorizeOptions, AuthContext } from './policy/authorize'

// ── Types ───────────────────────────────────────────────────────────────────

export interface HandlerContext {
  /** Unique request ID (from x-request-id header or generated) */
  requestId: string
  /** Structured logger bound to this request */
  logger: Logger
  /** Auth context — present only when auth options are provided */
  auth?: AuthContext
  /** Route parameters from Next.js dynamic routes */
  params?: Record<string, string | string[]>
}

export interface ApiHandlerOptions {
  /** Application name for logging/telemetry */
  appName: string
  /** If set, authorize the request before calling the handler */
  auth?: AuthorizeOptions
  /** If set, emit an audit event after successful handler execution */
  audit?: {
    action: string
    targetType?: string
  }
}

type HandlerFn<T = unknown> = (
  req: NextRequest,
  ctx: HandlerContext,
) => Promise<T | NextResponse>

// ── Handler Factory ─────────────────────────────────────────────────────────

/**
 * Create a standardized Next.js route handler.
 *
 * - Extracts/propagates x-request-id
 * - Runs handler inside AsyncLocalStorage context
 * - Catches errors and returns standardized envelopes
 * - Optionally runs auth + audit hooks
 */
export function apiHandler<T = unknown>(
  options: ApiHandlerOptions,
  handler: HandlerFn<T>,
) {
  const log = createLogger(options.appName)

  return async (
    req: NextRequest,
    routeCtx?: { params?: Promise<Record<string, string | string[]>> },
  ): Promise<NextResponse> => {
    // Lazily load next/server so this module can be statically imported by
    // non-Next runtimes without forcing `next` to resolve at module load time.
    const { NextResponse } = await import('next/server')
    const requestId =
      req.headers.get('x-request-id') ?? crypto.randomUUID()

    const reqContext = createRequestContext(req, {
      appName: options.appName,
    })

    return runWithContext(reqContext, async () => {
      const startMs = Date.now()
      const method = req.method
      const pathname = new URL(req.url).pathname

      log.info('request.start', {
        method,
        pathname,
        requestId,
      })

      try {
        // ── Auth guard ──────────────────────────────────────────────
        let authCtx: AuthContext | undefined
        if (options.auth) {
          try {
            const { authorize } = await import('./policy/authorize')
            authCtx = await authorize(req, options.auth)
          } catch (err) {
            if (
              err &&
              typeof err === 'object' &&
              'statusCode' in err
            ) {
              const authErr = err as { statusCode: number; message: string }
              const status = authErr.statusCode || 403
              return NextResponse.json(
                apiError(
                  status === 401
                    ? ApiErrorCode.UNAUTHORIZED
                    : ApiErrorCode.FORBIDDEN,
                  authErr.message,
                  requestId,
                ),
                {
                  status,
                  headers: { 'x-request-id': requestId },
                },
              )
            }
            throw err
          }
        }

        // ── Route params ────────────────────────────────────────────
        let params: Record<string, string | string[]> | undefined
        if (routeCtx?.params) {
          params = await routeCtx.params
        }

        // ── Execute handler ─────────────────────────────────────────
        const result = await handler(req, {
          requestId,
          logger: log,
          auth: authCtx,
          params,
        })

        // If handler returned a NextResponse directly, forward it
        if (result instanceof NextResponse) {
          result.headers.set('x-request-id', requestId)
          log.info('request.end', {
            method,
            pathname,
            requestId,
            durationMs: Date.now() - startMs,
            status: result.status,
          })
          return result
        }

        // Otherwise wrap in standard success envelope
        const response = NextResponse.json(
          apiSuccess(result, requestId),
          {
            status: 200,
            headers: { 'x-request-id': requestId },
          },
        )

        log.info('request.end', {
          method,
          pathname,
          requestId,
          durationMs: Date.now() - startMs,
          status: 200,
        })

        return response
      } catch (err) {
        const durationMs = Date.now() - startMs

        // ── ApiError (domain errors) ────────────────────────────────
        if (err instanceof ApiError) {
          log.warn('request.error', {
            method,
            pathname,
            requestId,
            durationMs,
            status: err.statusCode,
            code: err.code,
            message: err.message,
          })
          return NextResponse.json(
            apiError(err.code, err.message, requestId, err.details),
            {
              status: err.statusCode,
              headers: { 'x-request-id': requestId },
            },
          )
        }

        // ── ZodError (validation) ───────────────────────────────────
        if (err instanceof ZodError) {
          const apiErr = ApiError.fromZodError(err)
          log.warn('request.validation_error', {
            method,
            pathname,
            requestId,
            durationMs,
            issues: apiErr.details,
          })
          return NextResponse.json(
            apiError(apiErr.code, apiErr.message, requestId, apiErr.details),
            {
              status: 400,
              headers: { 'x-request-id': requestId },
            },
          )
        }

        // ── Unknown errors ──────────────────────────────────────────
        const message =
          err instanceof Error ? err.message : 'An unexpected error occurred'
        log.error('request.unhandled_error', {
          method,
          pathname,
          requestId,
          durationMs,
          error: err instanceof Error ? err.stack : String(err),
        })
        return NextResponse.json(
          apiError(
            ApiErrorCode.INTERNAL_ERROR,
            process.env.NODE_ENV === 'production'
              ? 'Internal server error'
              : message,
            requestId,
          ),
          {
            status: 500,
            headers: { 'x-request-id': requestId },
          },
        )
      }
    })
  }
}
