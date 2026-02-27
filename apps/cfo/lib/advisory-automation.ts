/**
 * CFO — Proactive Advisory Automation.
 *
 * Monitors client data and generates actionable advisory insights
 * when thresholds are crossed. Powers the advisory action cards
 * and notification triggers.
 *
 * @module @nzila/cfo/advisory-automation
 */

/* ── Types ────────────────────────────────────────────────────────────────── */

export type AlertSeverity = 'critical' | 'high' | 'medium' | 'info'
export type AlertCategory =
  | 'tax-deadline'
  | 'cash-flow'
  | 'compliance'
  | 'tax-optimization'
  | 'receivables'
  | 'payroll'

export interface AdvisoryAlert {
  id: string
  clientId: string
  clientName: string
  category: AlertCategory
  severity: AlertSeverity
  title: string
  message: string
  estimatedImpact: number
  suggestedAction: string
  createdAt: string
  expiresAt?: string
  dismissed: boolean
}

export interface AlertThreshold {
  category: AlertCategory
  metric: string
  operator: 'gt' | 'lt' | 'eq'
  value: number
  severity: AlertSeverity
  title: string
  messageTemplate: string
  actionTemplate: string
}

export interface ClientMetrics {
  clientId: string
  clientName: string
  cashRunwayDays: number
  overdueReceivables: number
  overdueReceivablesCount: number
  totalReceivables: number
  daysToNextDeadline: number
  nextDeadlineType: string
  effectiveTaxRate: number
  optimalTaxRate: number
  payrollNextRun?: string
  gstBalance: number
  qboSyncAge: number // hours since last sync
}

/* ── Default thresholds ───────────────────────────────────────────────────── */

export const DEFAULT_ALERT_THRESHOLDS: AlertThreshold[] = [
  {
    category: 'cash-flow',
    metric: 'cashRunwayDays',
    operator: 'lt',
    value: 30,
    severity: 'critical',
    title: 'Cash runway critically low',
    messageTemplate: '{clientName} has only {value} days of cash runway remaining.',
    actionTemplate: 'Review AR collections and accelerate invoicing',
  },
  {
    category: 'cash-flow',
    metric: 'cashRunwayDays',
    operator: 'lt',
    value: 60,
    severity: 'high',
    title: 'Cash runway declining',
    messageTemplate: '{clientName} cash runway at {value} days — below 60-day comfort zone.',
    actionTemplate: 'Prepare cash flow forecast and discuss with client',
  },
  {
    category: 'receivables',
    metric: 'overdueReceivables',
    operator: 'gt',
    value: 10_000,
    severity: 'high',
    title: 'Significant overdue receivables',
    messageTemplate: '{clientName} has ${value} in overdue receivables across {count} invoices.',
    actionTemplate: 'Start dunning workflow for overdue invoices',
  },
  {
    category: 'tax-deadline',
    metric: 'daysToNextDeadline',
    operator: 'lt',
    value: 14,
    severity: 'critical',
    title: 'Tax deadline approaching',
    messageTemplate: '{clientName}: {deadlineType} due in {value} days.',
    actionTemplate: 'Ensure filing preparation is complete',
  },
  {
    category: 'tax-deadline',
    metric: 'daysToNextDeadline',
    operator: 'lt',
    value: 30,
    severity: 'high',
    title: 'Tax deadline in 30 days',
    messageTemplate: '{clientName}: {deadlineType} due in {value} days — begin preparation.',
    actionTemplate: 'Start tax return workflow',
  },
  {
    category: 'tax-optimization',
    metric: 'effectiveTaxRate',
    operator: 'gt',
    value: 0,
    severity: 'medium',
    title: 'Tax optimization opportunity',
    messageTemplate:
      '{clientName} effective rate {effectiveRate}% vs optimal {optimalRate}% — potential savings.',
    actionTemplate: 'Run salary vs dividend analysis',
  },
  {
    category: 'compliance',
    metric: 'qboSyncAge',
    operator: 'gt',
    value: 48,
    severity: 'high',
    title: 'QBO sync stale',
    messageTemplate: '{clientName} QBO sync is {value}h old — data may be outdated.',
    actionTemplate: 'Trigger manual QBO sync',
  },
]

/* ── Alert generation engine ──────────────────────────────────────────────── */

/**
 * Evaluate client metrics against thresholds and generate alerts.
 */
export function evaluateClientMetrics(
  metrics: ClientMetrics,
  thresholds: AlertThreshold[] = DEFAULT_ALERT_THRESHOLDS,
): AdvisoryAlert[] {
  const alerts: AdvisoryAlert[] = []
  let alertIndex = 0

  for (const threshold of thresholds) {
    const metricValue = (metrics as unknown as Record<string, number>)[threshold.metric]
    if (metricValue === undefined) continue

    let triggered = false
    switch (threshold.operator) {
      case 'gt':
        triggered = metricValue > threshold.value
        break
      case 'lt':
        triggered = metricValue < threshold.value
        break
      case 'eq':
        triggered = metricValue === threshold.value
        break
    }

    // Special case: tax optimization only triggers if effective > optimal
    if (threshold.category === 'tax-optimization') {
      triggered = metrics.effectiveTaxRate > metrics.optimalTaxRate + 2 // 2% threshold
    }

    if (triggered) {
      const message = threshold.messageTemplate
        .replace('{clientName}', metrics.clientName)
        .replace('{value}', String(metricValue))
        .replace('{count}', String(metrics.overdueReceivablesCount))
        .replace('{deadlineType}', metrics.nextDeadlineType)
        .replace('{effectiveRate}', (metrics.effectiveTaxRate * 100).toFixed(1))
        .replace('{optimalRate}', (metrics.optimalTaxRate * 100).toFixed(1))

      const estimatedImpact = estimateAlertImpact(threshold, metrics)

      alerts.push({
        id: `alert-${metrics.clientId}-${threshold.category}-${alertIndex++}`,
        clientId: metrics.clientId,
        clientName: metrics.clientName,
        category: threshold.category,
        severity: threshold.severity,
        title: threshold.title,
        message,
        estimatedImpact,
        suggestedAction: threshold.actionTemplate,
        createdAt: new Date().toISOString(),
        dismissed: false,
      })
    }
  }

  return alerts.sort((a, b) => {
    const order: Record<AlertSeverity, number> = { critical: 0, high: 1, medium: 2, info: 3 }
    return order[a.severity] - order[b.severity]
  })
}

/**
 * Estimate dollar impact of an alert for prioritization.
 */
function estimateAlertImpact(threshold: AlertThreshold, metrics: ClientMetrics): number {
  switch (threshold.category) {
    case 'receivables':
      return metrics.overdueReceivables
    case 'tax-optimization': {
      // Rough estimate: savings from rate optimization (assume $200K income)
      const rateDiff = metrics.effectiveTaxRate - metrics.optimalTaxRate
      return Math.round(rateDiff * 200_000)
    }
    case 'cash-flow':
      return 0 // hard to quantify
    case 'tax-deadline':
      return 0 // compliance — not a dollar amount
    default:
      return 0
  }
}

/**
 * Batch-evaluate multiple clients and return all alerts, sorted by severity.
 */
export function scanAllClients(
  allMetrics: ClientMetrics[],
  thresholds?: AlertThreshold[],
): AdvisoryAlert[] {
  return allMetrics
    .flatMap((m) => evaluateClientMetrics(m, thresholds))
    .sort((a, b) => {
      const order: Record<AlertSeverity, number> = { critical: 0, high: 1, medium: 2, info: 3 }
      return order[a.severity] - order[b.severity]
    })
}

/**
 * Get a summary of alerts by severity.
 */
export function alertSummary(alerts: AdvisoryAlert[]): Record<AlertSeverity, number> {
  return {
    critical: alerts.filter((a) => a.severity === 'critical').length,
    high: alerts.filter((a) => a.severity === 'high').length,
    medium: alerts.filter((a) => a.severity === 'medium').length,
    info: alerts.filter((a) => a.severity === 'info').length,
  }
}

/**
 * Filter alerts to only active (non-dismissed, non-expired).
 */
export function activeAlerts(alerts: AdvisoryAlert[], now: Date = new Date()): AdvisoryAlert[] {
  return alerts.filter((a) => {
    if (a.dismissed) return false
    if (a.expiresAt && new Date(a.expiresAt) < now) return false
    return true
  })
}
