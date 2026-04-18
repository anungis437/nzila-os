import { NextResponse } from 'next/server'
import { withOrgScope } from '@/lib/api-guards'
import { withSpan } from '@nzila/os-core/telemetry'
import { getRevenueTelemetryDashboard } from '@/lib/actions/revenue-actions'

export async function GET(request: Request) {
  return withOrgScope(request, () =>
    withSpan('api.revenue.telemetry', { 'http.method': 'GET' }, async () => {
      const url = new URL(request.url)
      const days = Number(url.searchParams.get('days') ?? '30')
      const clampedDays = Number.isFinite(days) ? Math.min(Math.max(days, 7), 365) : 30
      const data = await getRevenueTelemetryDashboard(clampedDays)
      return NextResponse.json({ ok: true, data, days: clampedDays })
    }),
  )
}
