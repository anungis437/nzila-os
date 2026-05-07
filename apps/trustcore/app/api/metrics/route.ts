import { NextResponse } from 'next/server'

let requestCount = 0
let errorCount = 0
let totalLatencyMs = 0

export function recordRequest(latencyMs: number, isError = false) {
  requestCount++
  totalLatencyMs += latencyMs
  if (isError) errorCount++
}

export async function GET() {
  return NextResponse.json({
    request_count: requestCount,
    error_rate:
      requestCount > 0 ? Math.round((errorCount / requestCount) * 10000) / 100 : 0,
    latency_ms:
      requestCount > 0 ? Math.round(totalLatencyMs / requestCount) : 0,
    service: 'trustcore',
    timestamp: new Date().toISOString(),
  })
}
