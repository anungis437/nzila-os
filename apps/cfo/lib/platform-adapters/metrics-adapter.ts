/**
 * CFO — Metrics Adapter
 * Implements the platform metrics contract for CFO.
 * Collects report generation, ledger mutation, and advisory alert metrics.
 */
import type {
  MetricsContract,
  MetricsSummary,
  MetricEntry,
} from '@nzila/platform-contracts'
import { platformDb } from '@nzila/db/platform'
import { sql } from 'drizzle-orm'
import { logger } from '@/lib/logger'

export const metricsAdapter: MetricsContract = {
  async collect(orgId: string): Promise<MetricsSummary> {
    const now = new Date()
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
    const entries: MetricEntry[] = []
    const labels = { org_id: orgId }
    const ts = now.toISOString()

    try {
      // Reports by status
      const reportCounts = await platformDb.execute(
        sql`SELECT
            COALESCE(metadata->>'status', 'unknown') as status,
            COUNT(*)::int as cnt
          FROM audit_log
          WHERE action IN ('report.generated', 'report.created')
            AND created_at >= ${thirtyDaysAgo.toISOString()}
          GROUP BY metadata->>'status'`,
      )

      for (const row of reportCounts as unknown as { status: string; cnt: number }[]) {
        entries.push({
          name: 'cfo.reports.by_status',
          type: 'gauge',
          value: row.cnt,
          labels: { ...labels, status: row.status },
          timestamp: ts,
        })
      }

      // Ledger mutation count (30d)
      const [ledgerCount] = (
        await platformDb.execute(
          sql`SELECT COUNT(*)::int as cnt
            FROM audit_log
            WHERE action LIKE 'ledger.%'
              AND created_at >= ${thirtyDaysAgo.toISOString()}`,
        )
      ) as unknown as { cnt: number }[]

      entries.push({
        name: 'cfo.ledger.mutations_30d',
        type: 'gauge',
        value: ledgerCount?.cnt ?? 0,
        labels,
        timestamp: ts,
      })

      // Advisory alerts (30d)
      const [alertCount] = (
        await platformDb.execute(
          sql`SELECT COUNT(*)::int as cnt
            FROM audit_log
            WHERE action LIKE 'advisory.%'
              AND created_at >= ${thirtyDaysAgo.toISOString()}`,
        )
      ) as unknown as { cnt: number }[]

      entries.push({
        name: 'cfo.advisory.alerts_30d',
        type: 'gauge',
        value: alertCount?.cnt ?? 0,
        labels,
        timestamp: ts,
      })

      return {
        app: 'cfo',
        org_id: orgId,
        period_start: thirtyDaysAgo.toISOString(),
        period_end: ts,
        entries,
      }
    } catch (err) {
      logger.error('Metrics collection failed', { error: err })
      return {
        app: 'cfo',
        org_id: orgId,
        period_start: thirtyDaysAgo.toISOString(),
        period_end: ts,
        entries,
      }
    }
  },
}
