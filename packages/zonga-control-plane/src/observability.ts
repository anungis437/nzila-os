/**
 * @nzila/zonga-control-plane — Observability
 *
 * Enterprise-grade metrics, correlation IDs, structured logging.
 * All metrics are typed and labeled for dashboard consumption.
 */
import type { ObservabilityMetric } from './types'

// ── Metrics Registry ──────────────────────────────────────────────────────

export const MetricName = {
  // Economic
  LEDGER_INTEGRITY_FAILURES: 'zonga.ledger.integrity_failures',
  PAYOUT_LATENCY_MS: 'zonga.payout.latency_ms',
  PAYOUT_AMOUNT_TOTAL: 'zonga.payout.amount_total',
  RECONCILIATION_DISCREPANCIES: 'zonga.reconciliation.discrepancies',
  REVENUE_RECORDED_TOTAL: 'zonga.revenue.recorded_total',

  // Events/Tickets
  TICKET_SCAN_CONFLICTS: 'zonga.ticket.scan_conflicts',
  TICKET_SCAN_DUPLICATES: 'zonga.ticket.scan_duplicates',
  EVENT_CAPACITY_UTILIZATION: 'zonga.event.capacity_utilization',
  INVENTORY_OVERSELL_BLOCKS: 'zonga.inventory.oversell_blocks',

  // Fraud
  FRAUD_SIGNALS_DETECTED: 'zonga.fraud.signals_detected',
  FRAUD_SCORE_AVG: 'zonga.fraud.score_avg',
  STREAM_FARMING_DETECTIONS: 'zonga.fraud.stream_farming',

  // Workflows
  WORKFLOW_EXECUTIONS_TOTAL: 'zonga.workflow.executions_total',
  WORKFLOW_FAILURES_TOTAL: 'zonga.workflow.failures_total',
  WORKFLOW_COMPENSATIONS_TOTAL: 'zonga.workflow.compensations_total',
  WORKFLOW_DURATION_MS: 'zonga.workflow.duration_ms',

  // Rights
  DISPUTE_FILED_TOTAL: 'zonga.rights.disputes_filed',
  DISPUTE_RESOLUTION_TIME_MS: 'zonga.rights.dispute_resolution_ms',
  PAYOUT_FREEZE_TOTAL: 'zonga.rights.payout_freeze_total',

  // AI
  AI_INFERENCE_LATENCY_MS: 'zonga.ai.inference_latency_ms',
  AI_INFERENCE_TOTAL: 'zonga.ai.inference_total',

  // System
  AUDIT_EVENTS_TOTAL: 'zonga.audit.events_total',
  INVARIANT_CHECKS_TOTAL: 'zonga.invariant.checks_total',
  INVARIANT_FAILURES_TOTAL: 'zonga.invariant.failures_total',
  SYNC_QUEUE_SIZE: 'zonga.sync.queue_size',
  SYNC_CONFLICTS_TOTAL: 'zonga.sync.conflicts_total',
} as const
export type MetricName = (typeof MetricName)[keyof typeof MetricName]

// ── Metric Collection ─────────────────────────────────────────────────────

const metricBuffer: ObservabilityMetric[] = []
type MetricHandler = (metric: ObservabilityMetric) => void
const metricHandlers: MetricHandler[] = []

/**
 * Record a metric value.
 */
export function recordMetric(
  name: MetricName,
  value: number,
  labels: Record<string, string> = {},
): void {
  const metric: ObservabilityMetric = {
    name,
    value,
    labels,
    timestamp: new Date(),
  }
  metricBuffer.push(metric)
  for (const handler of metricHandlers) {
    try {
      handler(metric)
    } catch {
      // Handlers must not crash metric recording
    }
  }
}

/**
 * Register a handler that receives all metrics.
 */
export function onMetric(handler: MetricHandler): () => void {
  metricHandlers.push(handler)
  return () => {
    const idx = metricHandlers.indexOf(handler)
    if (idx >= 0) metricHandlers.splice(idx, 1)
  }
}

/**
 * Get buffered metrics, optionally filtered by name.
 */
export function getMetrics(name?: MetricName): readonly ObservabilityMetric[] {
  if (!name) return [...metricBuffer]
  return metricBuffer.filter((m) => m.name === name)
}

/**
 * Clear the metric buffer (for testing).
 */
export function clearMetrics(): void {
  metricBuffer.length = 0
}

// ── Correlation ID ────────────────────────────────────────────────────────

let correlationCounter = 0

/**
 * Generate a unique correlation ID for request tracing.
 */
export function generateCorrelationId(prefix = 'zonga'): string {
  correlationCounter++
  return `${prefix}_${Date.now()}_${correlationCounter}`
}

// ── Structured Logging ────────────────────────────────────────────────────

export interface StructuredLog {
  readonly level: 'debug' | 'info' | 'warn' | 'error' | 'fatal'
  readonly message: string
  readonly correlationId: string
  readonly orgId?: string
  readonly actorId?: string
  readonly workflowId?: string
  readonly entityType?: string
  readonly entityId?: string
  readonly error?: string
  readonly metadata?: Record<string, unknown>
  readonly timestamp: Date
}

type LogHandler = (log: StructuredLog) => void
const logHandlers: LogHandler[] = []

/**
 * Register a structured log handler (e.g., to send to OTEL collector).
 */
export function onLog(handler: LogHandler): () => void {
  logHandlers.push(handler)
  return () => {
    const idx = logHandlers.indexOf(handler)
    if (idx >= 0) logHandlers.splice(idx, 1)
  }
}

/**
 * Emit a structured log entry.
 */
export function emitLog(log: Omit<StructuredLog, 'timestamp'>): void {
  const entry: StructuredLog = { ...log, timestamp: new Date() }
  for (const handler of logHandlers) {
    try {
      handler(entry)
    } catch {
      // Log handlers must not crash
    }
  }
}
