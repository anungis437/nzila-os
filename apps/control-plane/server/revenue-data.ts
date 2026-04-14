/**
 * Control Plane — Revenue Data Layer
 *
 * Strictly reads persisted revenue events from storage.
 * Never synthesizes totals.
 */
import 'server-only'

import { platformDb } from '@nzila/db/platform'
import { sql } from 'drizzle-orm'

export interface RevenueDashboardData {
  state: 'ok' | 'no_data' | 'error'
  totalRevenue: number
  byApp: Record<string, { total: number; count: number }>
  eventCount: number
  breakdown: { subscription: number; usage: number; transaction: number }
  errorMessage?: string
}

export async function getRevenueDashboardData(): Promise<RevenueDashboardData> {
  try {
    const totalRows = (await platformDb.execute(sql`
      SELECT COUNT(*)::int AS event_count,
             COALESCE(SUM(amount), 0)::numeric AS total_revenue
      FROM zonga_revenue_events
    `)) as unknown as Array<{ event_count: number; total_revenue: string | number }>

    const totals = totalRows[0]
    const eventCount = totals?.event_count ?? 0

    if (eventCount === 0) {
      return {
        state: 'no_data',
        totalRevenue: 0,
        byApp: {},
        eventCount: 0,
        breakdown: { subscription: 0, usage: 0, transaction: 0 },
      }
    }

    const byAppRows = (await platformDb.execute(sql`
      SELECT COALESCE(source, 'zonga') AS app,
             COALESCE(SUM(amount), 0)::numeric AS total,
             COUNT(*)::int AS count
      FROM zonga_revenue_events
      GROUP BY COALESCE(source, 'zonga')
      ORDER BY COALESCE(SUM(amount), 0) DESC
    `)) as unknown as Array<{ app: string; total: string | number; count: number }>

    const breakdownRows = (await platformDb.execute(sql`
      SELECT
        COALESCE(SUM(CASE WHEN type = 'subscription_share' THEN amount ELSE 0 END), 0)::numeric AS subscription,
        COALESCE(SUM(CASE WHEN type IN ('stream', 'download') THEN amount ELSE 0 END), 0)::numeric AS usage,
        COALESCE(SUM(CASE WHEN type IN ('tip', 'ticket_sale', 'merchandise', 'sync_license') THEN amount ELSE 0 END), 0)::numeric AS transaction
      FROM zonga_revenue_events
    `)) as unknown as Array<{ subscription: string | number; usage: string | number; transaction: string | number }>

    const byApp: Record<string, { total: number; count: number }> = {}
    for (const row of byAppRows) {
      byApp[row.app] = { total: Number(row.total), count: row.count }
    }

    const breakdown = breakdownRows[0] ?? { subscription: 0, usage: 0, transaction: 0 }

    return {
      state: 'ok',
      totalRevenue: Number(totals.total_revenue),
      byApp,
      eventCount,
      breakdown: {
        subscription: Number(breakdown.subscription),
        usage: Number(breakdown.usage),
        transaction: Number(breakdown.transaction),
      },
    }
  } catch (error) {
    return {
      state: 'error',
      totalRevenue: 0,
      byApp: {},
      eventCount: 0,
      breakdown: { subscription: 0, usage: 0, transaction: 0 },
      errorMessage: error instanceof Error ? error.message : 'Revenue data unavailable',
    }
  }
}
