import { NextResponse } from 'next/server'
import { authenticateGlobalOperator, withRequestContext } from '@/lib/api-guards'
import { withSpan } from '@nzila/os-core/telemetry'
import { collectOperationalMetrics } from '@/lib/services/operational-metrics-service'

export async function GET(request: Request) {
  return withRequestContext(request, () =>
    withSpan('api.metrics.get', { 'http.method': 'GET' }, async () => {
      const auth = await authenticateGlobalOperator()
      if (!auth.ok) return auth.response
      return NextResponse.json(await collectOperationalMetrics())
    }),
  )
}
