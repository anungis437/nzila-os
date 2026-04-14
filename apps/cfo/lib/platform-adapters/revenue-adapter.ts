/**
 * CFO — Revenue Adapter
 *
 * Bridges @nzila/platform-revenue into CFO's financial reporting.
 * Provides platform-wide revenue aggregation, per-app breakdowns,
 * and audit-ready revenue event queries for the CFO dashboard.
 */
import {
  type RevenueEvent,
  RevenueEventType,
  RevenueType,
  RevenueStatus,
  computeAppRevenueBreakdown,
  buildRevenueAuditEntry,
} from '@nzila/platform-revenue'
import { platformDb } from '@nzila/db/platform'
import { sql } from 'drizzle-orm'
import { logger } from '@/lib/logger'

/* ─── Types ─── */

export interface PlatformRevenueSnapshot {
  totalRevenue: number
  subscriptionRevenue: number
  transactionRevenue: number
  usageRevenue: number
  byApp: Record<string, { total: number; count: number }>
  eventCount: number
  period: { start: string; end: string }
}

export interface RevenueEventRow {
  id: string
  orgId: string
  eventType: string
  amount: number
  currency: string
  appId: string
  occurredAt: string
}

/* ─── Queries ─── */

/**
 * Fetch platform-wide revenue events from the unified ledger.
 * Scoped to the trailing `days` window.
 */
export async function getRevenueEvents(
  orgId: string,
  days = 30,
): Promise<RevenueEventRow[]> {
  try {
    const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()
    const rows = await platformDb.execute(sql`
      SELECT id, org_id, event_type, amount, currency, app_id, occurred_at
      FROM platform_revenue_events
      WHERE org_id = ${orgId}
        AND occurred_at >= ${cutoff}::timestamptz
      ORDER BY occurred_at DESC
    `)
    return (rows as unknown as Array<Record<string, unknown>>).map((r) => ({
      id: r.id as string,
      orgId: r.org_id as string,
      eventType: r.event_type as string,
      amount: Number(r.amount),
      currency: r.currency as string,
      appId: r.app_id as string,
      occurredAt: r.occurred_at as string,
    }))
  } catch (error) {
    logger.warn('platform_revenue_events table not available, falling back', { error })
    return []
  }
}

/**
 * Compute a revenue snapshot using @nzila/platform-revenue helpers.
 * Aggregates across all apps for the given period.
 */
export async function getPlatformRevenueSnapshot(
  orgId: string,
  days = 30,
): Promise<PlatformRevenueSnapshot> {
  const events = await getRevenueEvents(orgId, days)
  const now = new Date()
  const start = new Date(now.getTime() - days * 24 * 60 * 60 * 1000)

  // Map DB rows to RevenueEvent shape for platform-revenue helpers
  const revenueEvents: RevenueEvent[] = events.map((e) => ({
    id: e.id,
    orgId: e.orgId,
    eventType: e.eventType as RevenueEvent['eventType'],
    amount: e.amount,
    currency: e.currency,
    appId: e.appId,
    metadata: {},
    occurredAt: e.occurredAt,
  }))

  const byApp = computeAppRevenueBreakdown(revenueEvents)
  const totalRevenue = Object.values(byApp).reduce((s, a) => s + a.total, 0)

  const subscriptionRevenue = revenueEvents
    .filter((e) =>
      e.eventType === 'subscription_started' ||
      e.eventType === 'subscription_renewed' ||
      e.eventType === 'subscription_upgraded',
    )
    .reduce((s, e) => s + e.amount, 0)

  const usageRevenue = revenueEvents
    .filter((e) => e.eventType === 'usage_overage_billed')
    .reduce((s, e) => s + e.amount, 0)

  const transactionRevenue = revenueEvents
    .filter((e) =>
      e.eventType === 'one_time_payment' ||
      e.eventType === 'zonga_revenue' ||
      e.eventType === 'commerce_revenue',
    )
    .reduce((s, e) => s + e.amount, 0)

  return {
    totalRevenue,
    subscriptionRevenue,
    transactionRevenue,
    usageRevenue,
    byApp,
    eventCount: events.length,
    period: {
      start: start.toISOString(),
      end: now.toISOString(),
    },
  }
}

/**
 * Build audit-ready revenue entries for evidence export.
 */
export function buildRevenueAuditEntries(events: RevenueEventRow[]) {
  return events.map((e) =>
    buildRevenueAuditEntry({
      id: e.id,
      orgId: e.orgId,
      eventType: e.eventType as RevenueEvent['eventType'],
      amount: e.amount,
      currency: e.currency,
      appId: e.appId,
      occurredAt: e.occurredAt,
    }),
  )
}

export { RevenueEventType, RevenueType, RevenueStatus }
