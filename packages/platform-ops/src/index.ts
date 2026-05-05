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

// Re-export strict health response helper
export {
  buildHealthResponse,
  type DependencyCheck,
  type StrictHealthResponse,
} from './health/strictHealth'

// Re-export runtime score derivation helper
export {
  computeRuntimeScore,
  type RuntimeScore,
} from './runtime/computeRuntimeScore'

// Re-export health digest & alerting modules
export {
  computeDeltas,
  detectAnomalies,
  generateDigestSnapshot,
  buildDigestAuditEvent,
  type MetricDelta,
  type MetricInput,
  type Anomaly,
  type AnomalySeverity,
  type HealthDigestSnapshot,
  type HealthDigestAuditEvent,
} from './health-digest'

export {
  formatAnomalyAlert,
  formatDigestSummary,
  dispatchAlerts,
  type AlertTarget,
  type AlertPayload,
  type AlertResult,
  type ChatOpsAdapter,
} from './health-alerts'

// Re-export trend detection module
export {
  computeLinearRegression,
  analyseTrend,
  analyseTrends,
  buildTrendWarningEvent,
  DEFAULT_TREND_THRESHOLDS,
  type TrendDataPoint,
  type TrendInput,
  type TrendDirection,
  type TrendResult,
  type TrendWarningAuditEvent,
  type TrendThresholds,
} from './trend-detection'

// Re-export ops confidence score module
export {
  computeOpsScore,
  computeOpsScoreDelta,
  type OpsScoreInput,
  type OpsScoreComponent,
  type OpsScoreResult,
  type OpsScoreHistoryEntry,
  type OpsScoreDelta,
} from './ops-score'

// Re-export failure simulation module
export {
  startSimulation,
  stopSimulation,
  getSimulationState,
  isSimulationActive,
  clearAllSimulations,
  canActivateSimulation,
  isSimulationFlagEnabled,
  isSimulationEnvironmentAllowed,
  getSimulatedLatencyMs,
  shouldSimulateIntegrationFailure,
  getErrorRateMultiplier,
  buildSimulationAuditEvent,
  type SimulationType,
  type SimulationConfig,
  type SimulationState,
  type ActiveSimulation,
  type SimulationToggleResult,
  type SimulationAuditEvent,
} from './failure-simulation'

// Re-export pilot export module
export {
  generatePilotSummary,
  computeBundleHash,
  createDefaultPilotPorts,
  type PilotSloSummary,
  type PilotReleaseSummary,
  type PilotLifecycleSummary,
  type PilotIntegritySummary,
  type PilotOpsDigest,
  type PilotIsolationProof,
  type PilotSummaryBundle,
  type PilotExportPorts,
} from './pilot-export'

// Re-export digest trends module
export {
  fetchAndAnalyseTrends,
  generateTrendEnrichedDigest,
  createStubTrendSeriesPort,
  DEFAULT_TRACKED_METRICS,
  DEFAULT_DIGEST_TRENDS_CONFIG,
  type TrendSeriesDataPoint,
  type TrendSeriesPort,
  type TrendEnrichedDigest,
  type DigestTrendsConfig,
} from './digest-trends'

// Re-export trend alerts module
export {
  formatTrendWarningAlert,
  formatTrendWarningSummary,
  dispatchTrendAlerts,
  DEFAULT_TREND_ALERT_CONFIG,
  type TrendAlertSeverity,
  type TrendAlertConfig,
} from './trend-alerts'

// Re-export pilot summary pack module
export {
  generatePilotPack,
  verifyManifest,
  type ManifestEntry,
  type PackManifest,
  type PilotSummaryPack,
} from './pilot-pack'

// Re-export workflow registry
export {
  createWorkflowRegistry,
  DEFAULT_RETRY_CONFIG,
  DEFAULT_SLO_TARGETS,
  type WorkflowRegistry,
  type WorkflowDefinition,
  type WorkflowStatus,
  type DangerLevel,
  type RetryConfig,
  type WorkflowSloTargets,
} from './workflow-registry'

// Re-export failure classification
export {
  classifyFailure,
  isRetryable,
  type ClassifiedFailure,
  type FailureClass,
  type FailureCategory,
} from './failure-classification'

// Re-export retry state machine
export {
  createRetryStateMachine,
  type RetryStateMachine,
  type RetryState,
  type RetryDecision,
} from './retry-state-machine'

// Re-export dead letter queue
export {
  createDeadLetterQueue,
  type DeadLetterQueue,
  type DeadLetterEntry,
} from './dead-letter-queue'

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
