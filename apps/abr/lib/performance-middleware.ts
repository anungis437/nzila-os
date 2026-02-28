/**
 * ABR Performance Middleware — Next.js Middleware Instrumentation
 *
 * Wraps Next.js middleware to emit org-scoped performance metrics
 * for every ABR request. Metrics flow to platform_request_metrics table
 * and appear in Console → Performance with app=abr.
 *
 * @module @nzila/abr/performance-middleware
 */
import { NextResponse, type NextRequest } from 'next/server'
import { trackAbrRequestMetrics } from './performance'

/**
 * Wrap an ABR API handler to automatically track performance metrics.
 *
 * Usage in API routes:
 * ```ts
 * export const GET = withAbrMetrics(async (req) => {
 *   // handler logic
 *   return NextResponse.json({ ok: true })
 * })
 * ```
 */
export function withAbrMetrics(
  handler: (req: NextRequest) => Promise<NextResponse>,
): (req: NextRequest) => Promise<NextResponse> {
  return async (req: NextRequest) => {
    const start = performance.now()
    let statusCode = 200

    try {
      const response = await handler(req)
      statusCode = response.status
      return response
    } catch (err) {
      statusCode = 500
      throw err
    } finally {
      const latencyMs = Math.round(performance.now() - start)
      const orgId = req.headers.get('x-org-id') ?? 'unknown'
      const route = new URL(req.url).pathname

      // Fire-and-forget — metrics collection must not block responses
      void trackAbrRequestMetrics({
        route,
        orgId,
        latencyMs,
        statusCode,
      }).catch(() => {
        // Metrics failure is non-critical
      })
    }
  }
}
