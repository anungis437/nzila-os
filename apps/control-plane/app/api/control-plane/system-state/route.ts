/**
 * Unified System State API — /api/control-plane/system-state
 *
 * Returns the authoritative system state: health of every domain,
 * revenue overview, governance gate results, and app registry status.
 *
 * This is the single endpoint that answers "is Nzila OS healthy?"
 * Consumed by dashboards, alerting, and external status pages.
 */
import { NextResponse } from 'next/server'
import { getSystemState } from '../../../../services/system-state'
import { getRevenueOverview } from '../../../../services/revenue-aggregator'

export async function GET() {
  const systemState = getSystemState()
  const revenueOverview = getRevenueOverview()

  return NextResponse.json({
    ...systemState,
    revenue: {
      totalRevenue: revenueOverview.totalRevenue,
      byApp: revenueOverview.byApp,
      eventCount: revenueOverview.eventCount,
    },
    _meta: {
      endpoint: '/api/control-plane/system-state',
      version: '1.0.0',
      generatedAt: new Date().toISOString(),
    },
  })
}
