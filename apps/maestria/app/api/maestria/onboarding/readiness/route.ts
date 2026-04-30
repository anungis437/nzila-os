import { NextRequest, NextResponse } from 'next/server'
import { authorize } from '@/lib/api-authorization'

const requireOrgAccess = authorize
import { getConnectorAccount, listNotifications, listOperationalRecords } from '@/lib/maestria-persistence'
import { getKpiWarehouseSummary } from '@/lib/maestria-analytics'

export async function GET(request: NextRequest) {
  const searchParams = Object.fromEntries(request.nextUrl.searchParams.entries())
  const auth = requireOrgAccess(searchParams, 'module.internal.view', 'onboarding.readiness.read', 'onboarding:readiness')
  if (auth.response) return auth.response

  const systems = ['shopify', 'google-ads', 'zoho'] as const
  const connectors = systems.map((system) => ({
    system,
    account: getConnectorAccount(system),
    ready: getConnectorAccount(system)?.status === 'connected',
  }))

  const proposals = listOperationalRecords('proposal', 100)
  const quotes = listOperationalRecords('quote', 100)
  const tasks = listOperationalRecords('task', 100)
  const notifications = listNotifications(100)
  const analytics = getKpiWarehouseSummary()

  const checks = [
    { key: 'records_persistence', ok: quotes.length > 0 && tasks.length > 0 && proposals.length > 0, note: 'Quotes, tasks, and proposals are persisted.' },
    { key: 'connectors_ready', ok: connectors.every((item) => item.ready), note: 'Shopify, Google Ads, Zoho are connected.' },
    { key: 'notification_delivery', ok: notifications.length > 0, note: 'Notification delivery events exist.' },
    { key: 'analytics_warehouse', ok: analytics.totalEvents > 0, note: 'KPI warehouse has ingest events.' },
  ]

  const readinessScore = Math.round((checks.filter((item) => item.ok).length / checks.length) * 100)

  return NextResponse.json({
    ok: true,
    checkedBy: auth.actor.displayName,
    readinessScore,
    checks,
    operational: {
      quoteCount: quotes.length,
      taskCount: tasks.length,
      proposalCount: proposals.length,
      notificationCount: notifications.length,
      analyticsEventCount: analytics.totalEvents,
    },
    connectors,
  })
}
