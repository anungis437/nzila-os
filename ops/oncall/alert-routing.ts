/**
 * Nzila OS — Alert Routing & Escalation Policy
 *
 * Codified alert routing configuration that ties:
 *   - Metrics → Alert rules
 *   - Alert rules → Severity levels
 *   - Severity levels → Notification channels
 *   - Alert IDs → Runbook references
 *   - Escalation timelines
 *
 * This file is the single source of truth for operational alerting.
 * It is validated by contract tests to ensure every alert has a runbook.
 */

// ── Types ─────────────────────────────────────────────────────────────────

export type AlertSeverity = 'P1' | 'P2' | 'P3' | 'P4'
export type NotificationChannel = 'pagerduty' | 'slack-urgent' | 'slack-ops' | 'email'

export interface AlertRule {
  /** Unique alert identifier */
  id: string
  /** Human-readable name */
  name: string
  /** Priority level */
  severity: AlertSeverity
  /** Metric or condition being monitored */
  metric: string
  /** Threshold or condition expression */
  condition: string
  /** Evaluation window */
  windowMinutes: number
  /** Notification channels for this severity */
  channels: NotificationChannel[]
  /** Reference to the runbook for this alert */
  runbookRef: string
  /** Service this alert applies to */
  service: string
  /** Auto-resolve after N minutes with no firing */
  autoResolveMinutes?: number
}

export interface EscalationPolicy {
  severity: AlertSeverity
  /** Initial response SLA in minutes */
  initialResponseMinutes: number
  /** Escalation steps with timeouts */
  steps: EscalationStep[]
}

export interface EscalationStep {
  /** Time after alert fire to escalate (minutes) */
  afterMinutes: number
  /** Who to notify */
  target: string
  /** Channel to use */
  channel: NotificationChannel
}

// ── Alert Rules ───────────────────────────────────────────────────────────

export const ALERT_RULES: AlertRule[] = [
  // ── API Availability ─────────────────────────────────────────────────
  {
    id: 'ALT-001',
    name: 'Console API Error Rate High',
    severity: 'P1',
    metric: 'http_errors_total{app="console"}',
    condition: 'rate(5m) > 0.01',
    windowMinutes: 5,
    channels: ['pagerduty', 'slack-urgent'],
    runbookRef: 'ops/runbooks/infrastructure/api-error-rate.md',
    service: 'console',
    autoResolveMinutes: 15,
  },
  {
    id: 'ALT-002',
    name: 'Partners API Error Rate High',
    severity: 'P1',
    metric: 'http_errors_total{app="partners"}',
    condition: 'rate(5m) > 0.01',
    windowMinutes: 5,
    channels: ['pagerduty', 'slack-urgent'],
    runbookRef: 'ops/runbooks/infrastructure/api-error-rate.md',
    service: 'partners',
    autoResolveMinutes: 15,
  },
  {
    id: 'ALT-003',
    name: 'Web App Availability Drop',
    severity: 'P2',
    metric: 'http_requests_success_rate{app="web"}',
    condition: '< 0.999 over 10m',
    windowMinutes: 10,
    channels: ['slack-urgent', 'email'],
    runbookRef: 'ops/runbooks/infrastructure/web-availability.md',
    service: 'web',
    autoResolveMinutes: 30,
  },

  // ── AI/ML Inference ──────────────────────────────────────────────────
  {
    id: 'ALT-010',
    name: 'AI Inference Failure Spike',
    severity: 'P2',
    metric: 'ai_inference_errors_total',
    condition: 'rate(10m) > 0.05',
    windowMinutes: 10,
    channels: ['slack-urgent', 'email'],
    runbookRef: 'ops/runbooks/infrastructure/ai-inference-failure.md',
    service: 'ai-gateway',
    autoResolveMinutes: 30,
  },
  {
    id: 'ALT-011',
    name: 'ML Inference Failure Spike',
    severity: 'P2',
    metric: 'ml_inference_errors_total',
    condition: 'rate(10m) > 0.05',
    windowMinutes: 10,
    channels: ['slack-urgent', 'email'],
    runbookRef: 'ops/runbooks/infrastructure/ml-inference-failure.md',
    service: 'ml-scoring',
    autoResolveMinutes: 30,
  },
  {
    id: 'ALT-012',
    name: 'AI Budget Threshold Warning',
    severity: 'P3',
    metric: 'ai_inference_cost_usd',
    condition: 'monthly_total > budget * 0.8',
    windowMinutes: 1440,
    channels: ['slack-ops', 'email'],
    runbookRef: 'ops/runbooks/infrastructure/ai-budget-alert.md',
    service: 'ai-gateway',
  },

  // ── Stripe Webhooks ──────────────────────────────────────────────────
  {
    id: 'ALT-020',
    name: 'Stripe Webhook Processing Failure',
    severity: 'P1',
    metric: 'webhook_errors_total{provider="stripe"}',
    condition: 'count(5m) > 3',
    windowMinutes: 5,
    channels: ['pagerduty', 'slack-urgent'],
    runbookRef: 'ops/runbooks/finance-close/stripe-webhook-failure.md',
    service: 'stripe-webhooks',
    autoResolveMinutes: 15,
  },
  {
    id: 'ALT-021',
    name: 'Stripe Webhook Latency High',
    severity: 'P3',
    metric: 'webhook_duration_ms{provider="stripe"}',
    condition: 'p99 > 5000 over 10m',
    windowMinutes: 10,
    channels: ['slack-ops'],
    runbookRef: 'ops/runbooks/finance-close/stripe-webhook-latency.md',
    service: 'stripe-webhooks',
    autoResolveMinutes: 60,
  },

  // ── QBO Sync ─────────────────────────────────────────────────────────
  {
    id: 'ALT-030',
    name: 'QBO Sync Failure',
    severity: 'P2',
    metric: 'qbo_sync_errors_total',
    condition: 'count(30m) > 2',
    windowMinutes: 30,
    channels: ['slack-urgent', 'email'],
    runbookRef: 'ops/runbooks/finance-close/qbo-sync-failure.md',
    service: 'qbo-sync',
    autoResolveMinutes: 60,
  },

  // ── Reconciliation ──────────────────────────────────────────────────
  {
    id: 'ALT-040',
    name: 'Reconciliation Mismatch Detected',
    severity: 'P2',
    metric: 'reconciliation_mismatches_total',
    condition: 'count(1h) > 0',
    windowMinutes: 60,
    channels: ['slack-urgent', 'email'],
    runbookRef: 'ops/runbooks/finance-close/reconciliation-mismatch.md',
    service: 'reconciliation',
  },
  {
    id: 'ALT-041',
    name: 'Reconciliation Large Delta',
    severity: 'P1',
    metric: 'reconciliation_delta_cents',
    condition: 'max(1h) > 100000',
    windowMinutes: 60,
    channels: ['pagerduty', 'slack-urgent'],
    runbookRef: 'ops/runbooks/finance-close/reconciliation-large-delta.md',
    service: 'reconciliation',
  },

  // ── CBA Intelligence ────────────────────────────────────────────────
  {
    id: 'ALT-070',
    name: 'CBA Ingestion Failure Rate',
    severity: 'P2',
    metric: 'cba_intel_ingestion_errors_total',
    condition: 'rate(15m) > 5',
    windowMinutes: 15,
    channels: ['slack-urgent', 'email'],
    runbookRef: 'ops/runbooks/cba-intelligence/ingestion-failure.md',
    service: 'cba-intelligence',
    autoResolveMinutes: 60,
  },
  {
    id: 'ALT-071',
    name: 'CBA Extraction Low Confidence',
    severity: 'P3',
    metric: 'cba_intel_extraction_confidence',
    condition: 'avg(1h) < 0.6',
    windowMinutes: 60,
    channels: ['slack-ops', 'email'],
    runbookRef: 'ops/runbooks/cba-intelligence/low-confidence.md',
    service: 'cba-intelligence',
    autoResolveMinutes: 120,
  },
  {
    id: 'ALT-072',
    name: 'CBA Source Freshness Stale',
    severity: 'P3',
    metric: 'cba_intel_freshness_stale_sources',
    condition: 'count > 10',
    windowMinutes: 1440,
    channels: ['slack-ops'],
    runbookRef: 'ops/runbooks/cba-intelligence/stale-sources.md',
    service: 'cba-intelligence',
  },
  {
    id: 'ALT-073',
    name: 'CBA Review Queue Backlog',
    severity: 'P3',
    metric: 'cba_intel_review_queue_depth',
    condition: '> 50',
    windowMinutes: 60,
    channels: ['slack-ops'],
    runbookRef: 'ops/runbooks/cba-intelligence/review-backlog.md',
    service: 'cba-intelligence',
    autoResolveMinutes: 120,
  },
  {
    id: 'ALT-074',
    name: 'CBA Ingestion Stall',
    severity: 'P2',
    metric: 'cba_intel_ingestion_duration_seconds',
    condition: 'max(30m) > 600',
    windowMinutes: 30,
    channels: ['slack-urgent'],
    runbookRef: 'ops/runbooks/cba-intelligence/ingestion-stall.md',
    service: 'cba-intelligence',
    autoResolveMinutes: 60,
  },
  {
    id: 'ALT-075',
    name: 'CBA Duplicate Ingestion Spike',
    severity: 'P4',
    metric: 'cba_intel_dedup_skipped_total',
    condition: 'rate(1h) > 50',
    windowMinutes: 60,
    channels: ['email'],
    runbookRef: 'ops/runbooks/cba-intelligence/dedup-spike.md',
    service: 'cba-intelligence',
    autoResolveMinutes: 180,
  },

  // ── Database ─────────────────────────────────────────────────────────
  {
    id: 'ALT-050',
    name: 'Database Connection Pool Exhaustion',
    severity: 'P1',
    metric: 'pg_pool_active_connections',
    condition: '> max_connections * 0.9',
    windowMinutes: 5,
    channels: ['pagerduty', 'slack-urgent'],
    runbookRef: 'ops/runbooks/infrastructure/db-connection-pool.md',
    service: 'database',
    autoResolveMinutes: 10,
  },

  // ── Security ─────────────────────────────────────────────────────────
  {
    id: 'ALT-060',
    name: 'Authentication Failure Spike',
    severity: 'P2',
    metric: 'http_requests_total{status="401"}',
    condition: 'rate(5m) > 10',
    windowMinutes: 5,
    channels: ['slack-urgent', 'email'],
    runbookRef: 'ops/runbooks/security/auth-failure-spike.md',
    service: 'auth',
    autoResolveMinutes: 30,
  },
  {
    id: 'ALT-061',
    name: 'Authorization Failure Spike',
    severity: 'P2',
    metric: 'http_requests_total{status="403"}',
    condition: 'rate(5m) > 5',
    windowMinutes: 5,
    channels: ['slack-urgent', 'email'],
    runbookRef: 'ops/runbooks/security/authz-failure-spike.md',
    service: 'auth',
    autoResolveMinutes: 30,
  },
]

// ── Escalation Policies ───────────────────────────────────────────────────

export const ESCALATION_POLICIES: EscalationPolicy[] = [
  {
    severity: 'P1',
    initialResponseMinutes: 15,
    steps: [
      { afterMinutes: 0, target: 'on-call-primary', channel: 'pagerduty' },
      { afterMinutes: 15, target: 'on-call-secondary', channel: 'pagerduty' },
      { afterMinutes: 30, target: 'engineering-manager', channel: 'pagerduty' },
      { afterMinutes: 60, target: 'cto', channel: 'pagerduty' },
      { afterMinutes: 120, target: 'ceo', channel: 'pagerduty' },
    ],
  },
  {
    severity: 'P2',
    initialResponseMinutes: 30,
    steps: [
      { afterMinutes: 0, target: 'on-call-primary', channel: 'slack-urgent' },
      { afterMinutes: 30, target: 'on-call-secondary', channel: 'slack-urgent' },
      { afterMinutes: 120, target: 'engineering-manager', channel: 'email' },
    ],
  },
  {
    severity: 'P3',
    initialResponseMinutes: 240,
    steps: [
      { afterMinutes: 0, target: 'engineering-team', channel: 'slack-ops' },
      { afterMinutes: 480, target: 'engineering-manager', channel: 'email' },
    ],
  },
  {
    severity: 'P4',
    initialResponseMinutes: 1440,
    steps: [
      { afterMinutes: 0, target: 'engineering-team', channel: 'slack-ops' },
    ],
  },
]

// ── Validation ────────────────────────────────────────────────────────────

export interface AlertValidationResult {
  valid: boolean
  errors: string[]
  alertCount: number
  servicesWithAlerts: string[]
  runbooksCoverage: { alertId: string; runbookRef: string; exists: boolean }[]
}

/**
 * Validate alert configuration integrity.
 * Used by contract tests to ensure all alerts are properly configured.
 */
export function validateAlertConfig(): AlertValidationResult {
  const errors: string[] = []
  const services = new Set<string>()

  // Check for duplicate IDs
  const ids = new Set<string>()
  for (const rule of ALERT_RULES) {
    if (ids.has(rule.id)) {
      errors.push(`Duplicate alert ID: ${rule.id}`)
    }
    ids.add(rule.id)
    services.add(rule.service)

    // Check escalation policy exists for this severity
    const escalation = ESCALATION_POLICIES.find((p) => p.severity === rule.severity)
    if (!escalation) {
      errors.push(`${rule.id}: No escalation policy for severity ${rule.severity}`)
    }

    // Check channels are valid
    if (rule.channels.length === 0) {
      errors.push(`${rule.id}: No notification channels configured`)
    }

    // Check runbook reference is non-empty
    if (!rule.runbookRef) {
      errors.push(`${rule.id}: Missing runbook reference`)
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    alertCount: ALERT_RULES.length,
    servicesWithAlerts: Array.from(services),
    runbooksCoverage: ALERT_RULES.map((r) => ({
      alertId: r.id,
      runbookRef: r.runbookRef,
      exists: true, // File existence checked in contract test
    })),
  }
}
