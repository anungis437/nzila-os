/**
 * Flow — Metrics Adapter
 *
 * Implements the platform metrics contract for Flow.
 * Collects order pipeline, payment, and production metrics.
 */
import type { MetricsContract, MetricsSummary, MetricEntry } from '@nzila/platform-contracts'
import { db, commerceOrders, commerceQuotes, flowPayments, flowProductionJobs } from '@nzila/db'
import { eq, and, gte, count, sql } from 'drizzle-orm'
import { logger } from '@/lib/logger'

export const metricsAdapter: MetricsContract = {
  async collect(orgId: string): Promise<MetricsSummary> {
    const now = new Date()
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
    const entries: MetricEntry[] = []
    const labels = { org_id: orgId }
    const ts = now.toISOString()

    try {
      // Quote count by status
      const quoteCounts = await db
        .select({ status: commerceQuotes.status, cnt: count() })
        .from(commerceQuotes)
        .where(eq(commerceQuotes.orgId, orgId))
        .groupBy(commerceQuotes.status)

      for (const row of quoteCounts) {
        entries.push({
          name: 'flow.quotes.by_status',
          type: 'gauge',
          value: row.cnt,
          labels: { ...labels, status: row.status ?? 'unknown' },
          timestamp: ts,
        })
      }

      // Order count by status
      const orderCounts = await db
        .select({ status: commerceOrders.status, cnt: count() })
        .from(commerceOrders)
        .where(eq(commerceOrders.orgId, orgId))
        .groupBy(commerceOrders.status)

      for (const row of orderCounts) {
        entries.push({
          name: 'flow.orders.by_status',
          type: 'gauge',
          value: row.cnt,
          labels: { ...labels, status: row.status ?? 'unknown' },
          timestamp: ts,
        })
      }

      // Active production jobs
      const [prodCount] = await db
        .select({ cnt: count() })
        .from(flowProductionJobs)
        .where(
          and(
            eq(flowProductionJobs.orgId, orgId),
            eq(flowProductionJobs.status, 'in_production'),
          ),
        )

      entries.push({
        name: 'flow.production.active_jobs',
        type: 'gauge',
        value: prodCount?.cnt ?? 0,
        labels,
        timestamp: ts,
      })

      // Payment total (last 30 days)
      const [paymentSum] = await db
        .select({ total: sql<number>`COALESCE(SUM(amount), 0)` })
        .from(flowPayments)
        .where(
          and(
            eq(flowPayments.orgId, orgId),
            gte(flowPayments.createdAt, thirtyDaysAgo),
          ),
        )

      entries.push({
        name: 'flow.payments.total_30d',
        type: 'counter',
        value: Number(paymentSum?.total ?? 0),
        labels,
        timestamp: ts,
      })
    } catch (err) {
      logger.error('Metrics collection failed', {
        error: err instanceof Error ? err.message : String(err),
      })
    }

    return {
      app: 'flow',
      org_id: orgId,
      period_start: thirtyDaysAgo.toISOString(),
      period_end: now.toISOString(),
      entries,
    }
  },
}
