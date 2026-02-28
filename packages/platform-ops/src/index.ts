/**
 * Nzila OS — Platform Ops: Outbox & Queue Metrics
 *
 * Read-only operational metrics for outbox backlogs, queue depths,
 * and worker saturation indicators. Used by the Console system-health dashboard.
 *
 * No mutations — strictly SELECT-only queries.
 */
import { platformDb } from '@nzila/db/platform'
import { sql } from 'drizzle-orm'

// ── Types ──────────────────────────────────────────────────────────────────

export interface OutboxBacklog {
  /** Domain name (e.g., 'zonga', 'nacp', 'commerce', 'agri') */
  domain: string
  /** Number of pending events in the outbox */
  pendingCount: number
  /** Age of the oldest pending event in seconds */
  oldestAgeSec: number | null
  /** Status indicator */
  status: 'healthy' | 'warning' | 'critical'
}

export interface WorkerMetrics {
  /** Queue name / command type */
  queueName: string
  /** Current depth of pending work items */
  pendingCount: number
  /** Currently running items */
  runningCount: number
  /** Saturation: running / (running + pending) as percentage */
  saturationPct: number
  /** Status based on depth thresholds */
  status: 'idle' | 'active' | 'busy' | 'saturated'
}

export interface OpsSnapshot {
  /** Per-domain outbox backlogs */
  outboxBacklogs: OutboxBacklog[]
  /** Worker queue metrics */
  workerMetrics: WorkerMetrics[]
  /** Timestamp of the snapshot */
  timestamp: string
}

// ── Outbox Metrics ─────────────────────────────────────────────────────────

interface OutboxRow {
  domain: string
  pendingCount: number
  oldestAgeSec: number | null
  [key: string]: unknown
}

/**
 * Query outbox backlogs across all domains.
 *
 * Scans known outbox tables (zonga_outbox, nacp_outbox) and returns
 * per-domain backlog counts and oldest event ages.
 */
export async function getOutboxBacklogs(): Promise<OutboxBacklog[]> {
  const backlogs: OutboxBacklog[] = []

  // We query each known outbox table. If a table doesn't exist, we skip it.
  const outboxQueries: Array<{ domain: string; table: string }> = [
    { domain: 'zonga', table: 'zonga_outbox' },
    { domain: 'nacp', table: 'nacp_outbox' },
  ]

  for (const { domain, table } of outboxQueries) {
    try {
      const result = await platformDb.execute<OutboxRow>(sql`
        SELECT
          ${sql.raw(`'${domain}'`)} AS domain,
          COUNT(*) FILTER (WHERE status = 'pending') AS "pendingCount",
          EXTRACT(EPOCH FROM (NOW() - MIN(created_at) FILTER (WHERE status = 'pending')))::int AS "oldestAgeSec"
        FROM ${sql.raw(table)}
      `)

      const row = result[0]
      if (row) {
        const pendingCount = Number(row.pendingCount) || 0
        const oldestAgeSec = row.oldestAgeSec != null ? Number(row.oldestAgeSec) : null
        backlogs.push({
          domain,
          pendingCount,
          oldestAgeSec,
          status: pendingCount > 100 ? 'critical' : pendingCount > 20 ? 'warning' : 'healthy',
        })
      }
    } catch {
      // Table doesn't exist or query failed — skip
      backlogs.push({
        domain,
        pendingCount: 0,
        oldestAgeSec: null,
        status: 'healthy',
      })
    }
  }

  return backlogs
}

// ── Worker Metrics ─────────────────────────────────────────────────────────

interface WorkerRow {
  queueName: string
  pendingCount: number
  runningCount: number
  [key: string]: unknown
}

/**
 * Query worker queue metrics from the automation_commands table.
 */
export async function getWorkerMetrics(): Promise<WorkerMetrics[]> {
  try {
    const result = await platformDb.execute<WorkerRow>(sql`
      SELECT
        COALESCE(type, 'default') AS "queueName",
        COUNT(*) FILTER (WHERE status = 'pending' OR status = 'dispatched') AS "pendingCount",
        COUNT(*) FILTER (WHERE status = 'running') AS "runningCount"
      FROM automation_commands
      GROUP BY COALESCE(type, 'default')
    `)

    return result.map((row) => {
      const pending = Number(row.pendingCount) || 0
      const running = Number(row.runningCount) || 0
      const total = pending + running
      const saturationPct = total > 0 ? Math.round((running / total) * 100) : 0

      let status: WorkerMetrics['status'] = 'idle'
      if (saturationPct > 90) status = 'saturated'
      else if (saturationPct > 50) status = 'busy'
      else if (total > 0) status = 'active'

      return {
        queueName: row.queueName,
        pendingCount: pending,
        runningCount: running,
        saturationPct,
        status,
      }
    })
  } catch {
    return []
  }
}

// ── Combined Snapshot ──────────────────────────────────────────────────────

/**
 * Gather a complete ops snapshot: outbox + worker metrics.
 */
export async function getOpsSnapshot(): Promise<OpsSnapshot> {
  const [outboxBacklogs, workerMetrics] = await Promise.all([
    getOutboxBacklogs(),
    getWorkerMetrics(),
  ])

  return {
    outboxBacklogs,
    workerMetrics,
    timestamp: new Date().toISOString(),
  }
}
