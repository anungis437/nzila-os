/**
 * Console — /api/metrics
 *
 * Exposes request_count, error_rate, latency_ms via platform-observability.
 */
import { NextResponse } from 'next/server'
import { authenticateUser, withRequestContext } from '@/lib/api-guards'
import { withSpan } from '@nzila/os-core/telemetry'

let requestCount = 0
let errorCount = 0
let totalLatencyMs = 0

export function recordRequest(latencyMs: number, isError = false) {
  requestCount++
  totalLatencyMs += latencyMs
  if (isError) errorCount++
}

export async function GET(request: Request) {
  return withRequestContext(request, () =>
    withSpan('api.metrics.get', { 'http.method': 'GET' }, async () => {
      const auth = await authenticateUser()
      if (!auth.ok) return auth.response

      return NextResponse.json({
        request_count: requestCount,
        error_rate: requestCount > 0 ? Math.round((errorCount / requestCount) * 10000) / 100 : 0,
        latency_ms: requestCount > 0 ? Math.round(totalLatencyMs / requestCount) : 0,
        service: 'console',
        timestamp: new Date().toISOString(),
      })
    }),
  )
}
