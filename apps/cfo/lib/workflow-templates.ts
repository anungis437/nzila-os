/**
 * Pre-built Workflow Templates for Accounting Firms.
 *
 * Industry-standard workflows with configurable steps, SLA tracking,
 * and role-based assignments. Ready to deploy via the workflow engine.
 *
 * @module @nzila/cfo/workflow-templates
 */
import type { WorkflowStep, WorkflowTemplate, WorkflowInstance } from '@/lib/actions/workflow-actions'

// ── Template definitions ────────────────────────────────────────────────────

export interface WorkflowTemplatePreset {
  name: string
  description: string
  trigger: WorkflowTemplate['trigger']
  steps: WorkflowStep[]
  estimatedDays: number
  category: 'tax' | 'audit' | 'onboarding' | 'monthly' | 'advisory' | 'compliance'
}

/**
 * Year-End Close Workflow (CRA T2)
 * Average 8–12 day completion for mid-market CCPC.
 */
export const YEAR_END_CLOSE: WorkflowTemplatePreset = {
  name: 'Year-End Close',
  description: 'Complete year-end financial close with tax return preparation, partner review, and CRA filing.',
  trigger: 'manual',
  category: 'tax',
  estimatedDays: 10,
  steps: [
    { name: 'Collect trial balance & bank recs', assigneeRole: 'accountant', actionType: 'edit', dueHours: 48 },
    { name: 'Post adjusting journal entries',    assigneeRole: 'accountant', actionType: 'edit', dueHours: 24 },
    { name: 'Reconcile intercompany accounts',   assigneeRole: 'accountant', actionType: 'edit', dueHours: 24 },
    { name: 'Prepare draft financial statements', assigneeRole: 'accountant', actionType: 'edit', dueHours: 48 },
    { name: 'Manager review of financials',      assigneeRole: 'manager',    actionType: 'review', dueHours: 24 },
    { name: 'Prepare T2 corporate return',       assigneeRole: 'accountant', actionType: 'edit', dueHours: 48 },
    { name: 'Partner sign-off on T2',            assigneeRole: 'partner',    actionType: 'approve', dueHours: 24 },
    { name: 'E-file with CRA & notify client',   assigneeRole: 'accountant', actionType: 'notify', dueHours: 8 },
  ],
}

/**
 * Client Onboarding Workflow
 * Structured onboarding for new accounting clients.
 */
export const CLIENT_ONBOARDING: WorkflowTemplatePreset = {
  name: 'Client Onboarding',
  description: 'Structured onboarding for new clients: engagement letter, data collection, QBO setup, and kickoff.',
  trigger: 'client_onboarded',
  category: 'onboarding',
  estimatedDays: 5,
  steps: [
    { name: 'Send engagement letter',           assigneeRole: 'manager',    actionType: 'notify', dueHours: 4 },
    { name: 'Client signs engagement letter',    assigneeRole: 'client',    actionType: 'sign', dueHours: 72 },
    { name: 'Collect historical financials',     assigneeRole: 'accountant', actionType: 'edit', dueHours: 48 },
    { name: 'Set up chart of accounts in QBO',   assigneeRole: 'accountant', actionType: 'edit', dueHours: 24 },
    { name: 'Connect bank feeds',               assigneeRole: 'accountant', actionType: 'edit', dueHours: 8 },
    { name: 'Manager review of setup',          assigneeRole: 'manager',    actionType: 'review', dueHours: 12 },
    { name: 'Schedule kickoff call with client', assigneeRole: 'manager',    actionType: 'notify', dueHours: 24 },
  ],
}

/**
 * Monthly Reconciliation Workflow
 * Recurring monthly close procedure.
 */
export const MONTHLY_RECONCILIATION: WorkflowTemplatePreset = {
  name: 'Monthly Reconciliation',
  description: 'Recurring monthly close: bank recs, credit card recs, revenue recognition, and management report.',
  trigger: 'manual',
  category: 'monthly',
  estimatedDays: 5,
  steps: [
    { name: 'Import & categorize bank transactions', assigneeRole: 'accountant', actionType: 'edit', dueHours: 24 },
    { name: 'Reconcile bank accounts',             assigneeRole: 'accountant', actionType: 'edit', dueHours: 12 },
    { name: 'Reconcile credit card accounts',      assigneeRole: 'accountant', actionType: 'edit', dueHours: 12 },
    { name: 'Review revenue recognition',          assigneeRole: 'accountant', actionType: 'review', dueHours: 8 },
    { name: 'Post accruals & deferrals',           assigneeRole: 'accountant', actionType: 'edit', dueHours: 8 },
    { name: 'Generate management reports',         assigneeRole: 'accountant', actionType: 'edit', dueHours: 4 },
    { name: 'Manager review & approval',           assigneeRole: 'manager',    actionType: 'approve', dueHours: 24 },
    { name: 'Send reports to client',              assigneeRole: 'manager',    actionType: 'notify', dueHours: 4 },
  ],
}

/**
 * HST/GST Filing Workflow
 * Quarterly or monthly GST/HST return preparation.
 */
export const GST_HST_FILING: WorkflowTemplatePreset = {
  name: 'GST/HST Return Filing',
  description: 'Prepare and file GST/HST return with CRA. Includes ITC reconciliation and remittance calculation.',
  trigger: 'manual',
  category: 'tax',
  estimatedDays: 3,
  steps: [
    { name: 'Reconcile GST collected',       assigneeRole: 'accountant', actionType: 'edit', dueHours: 12 },
    { name: 'Reconcile ITCs claimed',        assigneeRole: 'accountant', actionType: 'edit', dueHours: 12 },
    { name: 'Calculate net remittance',      assigneeRole: 'accountant', actionType: 'edit', dueHours: 4 },
    { name: 'Manager review of GST return',  assigneeRole: 'manager',    actionType: 'review', dueHours: 12 },
    { name: 'E-file GST/HST return',         assigneeRole: 'accountant', actionType: 'edit', dueHours: 4 },
    { name: 'Notify client of remittance',   assigneeRole: 'accountant', actionType: 'notify', dueHours: 2 },
  ],
}

/**
 * T1 Personal Tax Return Workflow
 */
export const T1_PERSONAL_TAX: WorkflowTemplatePreset = {
  name: 'T1 Personal Tax Return',
  description: 'Personal income tax return preparation with slip collection, review, and e-filing.',
  trigger: 'manual',
  category: 'tax',
  estimatedDays: 7,
  steps: [
    { name: 'Send document checklist to client', assigneeRole: 'accountant', actionType: 'notify', dueHours: 4 },
    { name: 'Client uploads tax documents',      assigneeRole: 'client',     actionType: 'edit', dueHours: 168 },
    { name: 'Prepare T1 return',                 assigneeRole: 'accountant', actionType: 'edit', dueHours: 48 },
    { name: 'Manager review of T1',              assigneeRole: 'manager',    actionType: 'review', dueHours: 24 },
    { name: 'Send draft to client for review',   assigneeRole: 'accountant', actionType: 'notify', dueHours: 4 },
    { name: 'Client approves filing',            assigneeRole: 'client',     actionType: 'approve', dueHours: 72 },
    { name: 'E-file with CRA',                   assigneeRole: 'accountant', actionType: 'edit', dueHours: 4 },
  ],
}

/**
 * Financial Audit Preparation Workflow
 */
export const AUDIT_PREPARATION: WorkflowTemplatePreset = {
  name: 'Financial Audit Preparation',
  description: 'Prepare for external or internal audit: evidence gathering, confirmation letters, and partner review.',
  trigger: 'manual',
  category: 'audit',
  estimatedDays: 15,
  steps: [
    { name: 'Issue bank confirmation letters',      assigneeRole: 'accountant', actionType: 'edit', dueHours: 24 },
    { name: 'Issue AR confirmation letters',         assigneeRole: 'accountant', actionType: 'edit', dueHours: 24 },
    { name: 'Prepare lead sheets',                   assigneeRole: 'accountant', actionType: 'edit', dueHours: 72 },
    { name: 'Test revenue cut-off',                  assigneeRole: 'accountant', actionType: 'review', dueHours: 48 },
    { name: 'Test expense completeness',             assigneeRole: 'accountant', actionType: 'review', dueHours: 48 },
    { name: 'Review related-party transactions',     assigneeRole: 'manager',    actionType: 'review', dueHours: 24 },
    { name: 'Draft audit report',                    assigneeRole: 'manager',    actionType: 'edit', dueHours: 48 },
    { name: 'Partner review & opinion sign-off',     assigneeRole: 'partner',    actionType: 'approve', dueHours: 48 },
  ],
}

/**
 * All pre-built workflow templates indexed by category.
 */
export const WORKFLOW_TEMPLATE_LIBRARY: WorkflowTemplatePreset[] = [
  YEAR_END_CLOSE,
  CLIENT_ONBOARDING,
  MONTHLY_RECONCILIATION,
  GST_HST_FILING,
  T1_PERSONAL_TAX,
  AUDIT_PREPARATION,
]

// ── SLA tracking ────────────────────────────────────────────────────────────

export interface SlaStatus {
  stepIndex: number
  stepName: string
  assigneeRole: string
  dueDateIso: string
  isOverdue: boolean
  hoursRemaining: number
  hoursOverdue: number
  severity: 'on-track' | 'at-risk' | 'overdue' | 'critical'
}

export interface WorkflowSlaReport {
  instanceId: string
  templateName: string
  overallStatus: 'on-track' | 'at-risk' | 'overdue' | 'critical'
  steps: SlaStatus[]
  overdueCount: number
  atRiskCount: number
}

/**
 * Calculate SLA status for each step of a workflow instance.
 *
 * @param instance  The workflow instance to evaluate
 * @param template  The template with dueHours per step
 * @param now       Optional current time (for testing)
 */
export function evaluateWorkflowSla(
  instance: WorkflowInstance,
  templateSteps: WorkflowStep[],
  now: Date = new Date(),
): WorkflowSlaReport {
  const instanceStartMs = new Date(instance.createdAt).getTime()
  const steps: SlaStatus[] = []
  let cumulativeHours = 0

  for (let i = 0; i < templateSteps.length; i++) {
    const step = templateSteps[i]
    const instanceStep = instance.steps[i]
    cumulativeHours += step.dueHours

    const dueDateMs = instanceStartMs + cumulativeHours * 3600_000
    const dueDate = new Date(dueDateMs)
    const hoursUntilDue = (dueDateMs - now.getTime()) / 3600_000

    // Skip completed steps
    if (instanceStep?.status === 'completed' || instanceStep?.status === 'skipped') {
      steps.push({
        stepIndex: i,
        stepName: step.name,
        assigneeRole: step.assigneeRole,
        dueDateIso: dueDate.toISOString(),
        isOverdue: false,
        hoursRemaining: 0,
        hoursOverdue: 0,
        severity: 'on-track',
      })
      continue
    }

    let severity: SlaStatus['severity'] = 'on-track'
    if (hoursUntilDue < 0) {
      severity = Math.abs(hoursUntilDue) > 48 ? 'critical' : 'overdue'
    } else if (hoursUntilDue < step.dueHours * 0.25) {
      severity = 'at-risk'
    }

    steps.push({
      stepIndex: i,
      stepName: step.name,
      assigneeRole: step.assigneeRole,
      dueDateIso: dueDate.toISOString(),
      isOverdue: hoursUntilDue < 0,
      hoursRemaining: Math.max(0, Math.round(hoursUntilDue * 10) / 10),
      hoursOverdue: Math.max(0, Math.round(-hoursUntilDue * 10) / 10),
      severity,
    })
  }

  const overdueCount = steps.filter((s) => s.isOverdue).length
  const atRiskCount = steps.filter((s) => s.severity === 'at-risk').length
  let overallStatus: WorkflowSlaReport['overallStatus'] = 'on-track'
  if (steps.some((s) => s.severity === 'critical')) overallStatus = 'critical'
  else if (overdueCount > 0) overallStatus = 'overdue'
  else if (atRiskCount > 0) overallStatus = 'at-risk'

  return {
    instanceId: instance.id,
    templateName: instance.templateName,
    overallStatus,
    steps,
    overdueCount,
    atRiskCount,
  }
}

/**
 * Check all active workflow instances for overdue steps.
 * Returns instances with at least one overdue step.
 */
export function findOverdueWorkflows(
  instances: WorkflowInstance[],
  templateStepsMap: Map<string, WorkflowStep[]>,
  now: Date = new Date(),
): WorkflowSlaReport[] {
  const reports: WorkflowSlaReport[] = []

  for (const instance of instances) {
    if (instance.status !== 'in-progress') continue
    const steps = templateStepsMap.get(instance.templateId)
    if (!steps) continue
    const report = evaluateWorkflowSla(instance, steps, now)
    if (report.overdueCount > 0) reports.push(report)
  }

  return reports.sort((a, b) => {
    const priority = { critical: 0, overdue: 1, 'at-risk': 2, 'on-track': 3 }
    return priority[a.overallStatus] - priority[b.overallStatus]
  })
}
