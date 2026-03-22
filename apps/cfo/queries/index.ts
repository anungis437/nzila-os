/**
 * Queries layer — read models and reporting projections for CFO.
 *
 * DB-backed metrics for financial dashboards.
 * These are read-only — mutations go through services/actions.
 */
import { platformDb } from '@nzila/db/platform'
import { sql } from 'drizzle-orm'

export interface ReportStatusDistribution {
  status: string
  count: number
}

export interface FinancialSummary {
  totalReports: number
  byStatus: ReportStatusDistribution[]
  recentExportCount: number
}

export interface LedgerActivitySummary {
  totalEntries: number
  totalDebits: number
  totalCredits: number
  netBalance: number
}

export async function getReportStatusDistribution(
  _orgId: string,
): Promise<ReportStatusDistribution[]> {
  const rows = await platformDb.execute(
    sql`SELECT
        COALESCE(metadata->>'status', 'unknown') as status,
        COUNT(*)::int as count
      FROM audit_log
      WHERE action IN ('report.generated', 'report.created')
      GROUP BY metadata->>'status'`,
  )
  return (rows as unknown as { status: string; count: number }[]).map((r) => ({
    status: r.status,
    count: r.count,
  }))
}

export async function getLedgerActivitySummary(
  _orgId: string,
  since: Date = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
): Promise<LedgerActivitySummary> {
  const rows = await platformDb.execute(
    sql`SELECT
        COUNT(*)::int as "totalEntries",
        COALESCE(SUM(CASE WHEN metadata->>'type' = 'debit' THEN (metadata->>'amount')::numeric END), 0) as "totalDebits",
        COALESCE(SUM(CASE WHEN metadata->>'type' = 'credit' THEN (metadata->>'amount')::numeric END), 0) as "totalCredits"
      FROM audit_log
      WHERE action LIKE 'ledger.%'
        AND created_at >= ${since.toISOString()}`,
  )
  const row = (rows as unknown as Record<string, unknown>[])[0] ?? {}
  const debits = Number(row.totalDebits ?? 0)
  const credits = Number(row.totalCredits ?? 0)
  return {
    totalEntries: Number(row.totalEntries ?? 0),
    totalDebits: debits,
    totalCredits: credits,
    netBalance: debits - credits,
  }
}

// ── Client queries ──────────────────────────────────────────────────────────────────

export interface ClientCountSummary {
  total: number
  active: number
  inactive: number
}

export async function getClientCountSummary(
  _orgId: string,
): Promise<ClientCountSummary> {
  const rows = await platformDb.execute(
    sql`SELECT
        COUNT(*)::int as total,
        COUNT(*) FILTER (WHERE metadata->>'status' = 'active')::int as active,
        COUNT(*) FILTER (WHERE metadata->>'status' = 'inactive')::int as inactive
      FROM audit_log
      WHERE action = 'client.created'`,
  )
  const row = (rows as unknown as Record<string, unknown>[])[0] ?? {}
  return {
    total: Number(row.total ?? 0),
    active: Number(row.active ?? 0),
    inactive: Number(row.inactive ?? 0),
  }
}

// ── Advisory alert queries ─────────────────────────────────────────────────────────

export interface AlertCountSummary {
  total: number
  bySeverity: Record<string, number>
}

export async function getAlertCountSummary(
  _orgId: string,
): Promise<AlertCountSummary> {
  const rows = await platformDb.execute(
    sql`SELECT
        COALESCE(metadata->>'severity', 'unknown') as severity,
        COUNT(*)::int as count
      FROM audit_log
      WHERE action = 'advisory.alert_fired'
        AND created_at >= NOW() - INTERVAL '30 days'
      GROUP BY metadata->>'severity'`,
  )
  const typed = rows as unknown as { severity: string; count: number }[]
  const bySeverity: Record<string, number> = {}
  let total = 0
  for (const r of typed) {
    bySeverity[r.severity] = r.count
    total += r.count
  }
  return { total, bySeverity }
}

// ── Workflow queries ─────────────────────────────────────────────────────────────

export interface WorkflowCountSummary {
  totalActive: number
  totalCompleted: number
  overdueCount: number
}

export async function getWorkflowCountSummary(
  _orgId: string,
): Promise<WorkflowCountSummary> {
  const rows = await platformDb.execute(
    sql`SELECT
        COUNT(*) FILTER (WHERE metadata->>'status' = 'in-progress')::int as "totalActive",
        COUNT(*) FILTER (WHERE metadata->>'status' = 'completed')::int as "totalCompleted",
        COUNT(*) FILTER (
          WHERE metadata->>'status' = 'in-progress'
          AND (metadata->>'hasOverdueSteps')::boolean = true
        )::int as "overdueCount"
      FROM audit_log
      WHERE action LIKE 'workflow.%'`,
  )
  const row = (rows as unknown as Record<string, unknown>[])[0] ?? {}
  return {
    totalActive: Number(row.totalActive ?? 0),
    totalCompleted: Number(row.totalCompleted ?? 0),
    overdueCount: Number(row.overdueCount ?? 0),
  }
}
