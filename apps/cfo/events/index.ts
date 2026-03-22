/**
 * Events layer — domain events for CFO.
 *
 * Defines the structured event types emitted by CFO
 * during financial report lifecycle, ledger mutations,
 * and advisory alert processing.
 */

export const CfoEventType = {
  REPORT_CREATED: 'cfo.report.created',
  REPORT_GENERATED: 'cfo.report.generated',
  REPORT_REVIEWED: 'cfo.report.reviewed',
  REPORT_PUBLISHED: 'cfo.report.published',
  LEDGER_ENTRY_CREATED: 'cfo.ledger.entry_created',
  LEDGER_ADJUSTMENT: 'cfo.ledger.adjustment',
  RECONCILIATION_STARTED: 'cfo.reconciliation.started',
  RECONCILIATION_COMPLETED: 'cfo.reconciliation.completed',
  ADVISORY_ALERT_FIRED: 'cfo.advisory.alert_fired',
  ADVISORY_ALERT_DISMISSED: 'cfo.advisory.alert_dismissed',
  WORKFLOW_STARTED: 'cfo.workflow.started',
  WORKFLOW_STEP_COMPLETED: 'cfo.workflow.step_completed',
  WORKFLOW_COMPLETED: 'cfo.workflow.completed',
  POLICY_CHECKED: 'cfo.policy.checked',
  POLICY_BLOCKED: 'cfo.policy.blocked',
  FINANCIAL_EXPORT: 'cfo.financial.export',
  BUDGET_CHANGE: 'cfo.budget.change',
  PAYROLL_RUN_STARTED: 'cfo.payroll.run_started',
  PAYROLL_RUN_COMPLETED: 'cfo.payroll.run_completed',
  PAYROLL_SUBMISSION_FILED: 'cfo.payroll.submission_filed',
} as const

export type CfoEventType = (typeof CfoEventType)[keyof typeof CfoEventType]

export interface CfoEvent {
  id: string
  type: CfoEventType
  orgId: string
  actorId: string
  entityId?: string
  metadata: Record<string, unknown>
  timestamp: string
}
