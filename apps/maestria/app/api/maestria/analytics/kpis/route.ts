import { NextRequest, NextResponse } from 'next/server'
import { authorizeRequest } from '@/lib/api-authorization'
import { getKpiWarehouseSummary } from '@/lib/maestria-analytics'

export async function GET(request: NextRequest) {
  const searchParams = Object.fromEntries(request.nextUrl.searchParams.entries())
  const auth = authorizeRequest(searchParams, 'finance.summary.view', 'analytics.kpis.read', 'analytics:kpi-warehouse')
  if (auth.response) return auth.response

  return NextResponse.json({
    ok: true,
    requestedBy: auth.actor.displayName,
    warehouse: getKpiWarehouseSummary(),
  })
}
