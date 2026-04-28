/**
 * Zonga — Operations dashboard KPI route.
 *
 * Returns the cached/provenance-tagged operations payload used by the
 * admin operations page and external monitoring consumers.
 */
import { NextResponse } from 'next/server'
import { withOrgScope } from '@/lib/api-guards'
import { withSpan } from '@nzila/os-core/telemetry'
import { getZongaOperationsDashboard, type DashboardTimeframe } from '@/lib/services/dashboard-kpi-service'

const ALLOWED_TIMEFRAMES: ReadonlyArray<DashboardTimeframe> = ['daily', 'weekly', 'monthly']

function parseTimeframe(raw: string | null): DashboardTimeframe {
  if (raw && (ALLOWED_TIMEFRAMES as ReadonlyArray<string>).includes(raw)) {
    return raw as DashboardTimeframe
  }
  return 'weekly'
}

export async function GET(request: Request) {
  return withOrgScope(request, (ctx) =>
    withSpan('api.dashboard.operations', { 'http.method': 'GET' }, async () => {
      const url = new URL(request.url)
      const timeframe = parseTimeframe(url.searchParams.get('timeframe'))
      const data = await getZongaOperationsDashboard({
        organizationId: ctx.orgId,
        timeframe,
      })
      return NextResponse.json({ ok: true, data })
    }),
  )
}
