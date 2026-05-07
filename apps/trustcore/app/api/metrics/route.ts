import { NextResponse } from 'next/server'
import { withRequiredRole } from '@/lib/rbac/requireRole'

let requestCount = 0
let errorCount = 0
let totalLatencyMs = 0

export function recordRequest(latencyMs: number, isError = false) {
  requestCount++
  totalLatencyMs += latencyMs
  if (isError) errorCount++
}

export const GET = withRequiredRole(
  ['org_admin', 'platform_admin'],
  async () => {
    return NextResponse.json({
      request_count: requestCount,
      error_rate:
        requestCount > 0 ? Math.round((errorCount / requestCount) * 10000) / 100 : 0,
      latency_ms:
        requestCount > 0 ? Math.round(totalLatencyMs / requestCount) : 0,
      service: 'trustcore',
      timestamp: new Date().toISOString(),
    })
  },
)
