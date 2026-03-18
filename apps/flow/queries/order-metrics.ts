/**
 * Flow — Order Lifecycle Metrics (DB-backed)
 *
 * Real-time metrics derived from commerce/flow tables.
 * Replaces in-process counters with verifiable DB queries.
 */
import { db, commerceOrders, flowDomainEvents } from '@nzila/db'
import { eq, and, count, sum, gte } from 'drizzle-orm'

// ── Types ──────────────────────────────────────────────────────────────────

export interface OrderStatusDistribution {
  status: string
  count: number
}

export interface OrderPipelineSummary {
  totalOrders: number
  totalValue: number
  byStatus: OrderStatusDistribution[]
  overduePayments: number
}

export interface EventActivitySummary {
  eventType: string
  count: number
}

// ── Queries ────────────────────────────────────────────────────────────────

export async function getOrderStatusDistribution(orgId: string): Promise<OrderStatusDistribution[]> {
  const rows = await db
    .select({
      status: commerceOrders.status,
      count: count(),
    })
    .from(commerceOrders)
    .where(eq(commerceOrders.orgId, orgId))
    .groupBy(commerceOrders.status)

  return rows.map((r) => ({ status: r.status ?? 'unknown', count: r.count }))
}

export async function getOrderPipelineSummary(orgId: string): Promise<OrderPipelineSummary> {
  const [totals] = await db
    .select({
      totalOrders: count(),
      totalValue: sum(commerceOrders.total),
    })
    .from(commerceOrders)
    .where(eq(commerceOrders.orgId, orgId))

  const byStatus = await getOrderStatusDistribution(orgId)

  const [overdue] = await db
    .select({ count: count() })
    .from(commerceOrders)
    .where(and(eq(commerceOrders.orgId, orgId), eq(commerceOrders.paymentStatus, 'overdue')))

  return {
    totalOrders: totals?.totalOrders ?? 0,
    totalValue: Number(totals?.totalValue ?? 0),
    byStatus,
    overduePayments: overdue?.count ?? 0,
  }
}

export async function getRecentEventActivity(
  orgId: string,
  since: Date = new Date(Date.now() - 24 * 60 * 60 * 1000),
): Promise<EventActivitySummary[]> {
  const rows = await db
    .select({
      eventType: flowDomainEvents.eventType,
      count: count(),
    })
    .from(flowDomainEvents)
    .where(and(eq(flowDomainEvents.orgId, orgId), gte(flowDomainEvents.createdAt, since)))
    .groupBy(flowDomainEvents.eventType)

  return rows.map((r) => ({ eventType: r.eventType, count: r.count }))
}
