/**
 * Dashboard summary derivation.
 *
 * Takes a `ComplianceEvaluation` (already produced by `evaluateLaw25Compliance`)
 * and the raw incident/DSR inputs, then produces the structural
 * `DashboardSummary` consumed by the in-app dashboard route. Keeping this
 * derivation in one place ensures the dashboard score and the
 * `/compliance` page score never drift again — the historical inline
 * scoring inside `getTrustcoreDashboardSummary` was diverging from the
 * engine and is now retired.
 */

import type { ComplianceEvaluation, DashboardSummary, DsrRequestInput, IncidentInput } from './types'

/** Inputs already-loaded by the dashboard query layer. */
export interface DashboardSummaryInputs {
  incidents: IncidentInput[]
  dsrRequests: DsrRequestInput[]
}

/**
 * Build the dashboard summary from a fresh `ComplianceEvaluation` and the
 * raw incident / DSR rows. The score, audit-readiness and incident-alert
 * counters are derived from the evaluation; the pendingRequests counter
 * is derived from raw DSR rows (mirrors historical behaviour).
 */
export function dashboardSummaryFromEvaluation(
  evaluation: ComplianceEvaluation,
  inputs: DashboardSummaryInputs,
): DashboardSummary {
  const openIncidents = inputs.incidents.filter(
    (i) => i.resolutionStatus === 'open' || i.resolutionStatus === 'contained',
  )
  const incidentAlerts = openIncidents.filter((i) => i.severity === 'critical').length

  const pendingRequests = inputs.dsrRequests.filter(
    (r) => r.status !== 'completed' && r.status !== 'denied',
  ).length

  const hasCriticalRisks = evaluation.risks.some(
    (r) => r.blocking || r.severity === 'critical',
  )

  const auditReadinessStatus: DashboardSummary['auditReadinessStatus'] =
    evaluation.score >= 85 && !hasCriticalRisks
      ? 'ready'
      : evaluation.score >= 60
        ? 'partial'
        : 'not_ready'

  return {
    orgId: evaluation.orgId,
    complianceScore: evaluation.score,
    openRisks: openIncidents.length,
    pendingRequests,
    incidentAlerts,
    auditReadinessStatus,
    evaluatedAt: evaluation.evaluatedAt,
  }
}
