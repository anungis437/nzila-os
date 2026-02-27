/**
 * CFO — Workflow Automation Engine.
 *
 * Event-driven workflow triggers that automatically start workflows
 * based on business events (deadlines, client actions, data changes).
 * Integrates with workflow-templates.ts for preset instantiation.
 *
 * @module @nzila/cfo/workflow-automation
 */

/* ── Types ────────────────────────────────────────────────────────────────── */

export type WorkflowTriggerEvent =
  | 'client.onboarded'
  | 'fiscal-year-end.approaching'
  | 'gst-hst.quarter-end'
  | 'tax-return.due-soon'
  | 'invoice.overdue'
  | 'reconciliation.monthly-due'
  | 'document.uploaded'
  | 'audit.requested'

export interface TriggerRule {
  event: WorkflowTriggerEvent
  /** Template name to instantiate (from WORKFLOW_PRESETS) */
  templateName: string
  /** Conditions that must be met (e.g., client.type === 'CCPC') */
  conditions: TriggerCondition[]
  /** Days before event to trigger (for deadline-based events) */
  leadTimeDays: number
  /** Whether this rule is active */
  enabled: boolean
  /** Priority if multiple rules match (lower = higher priority) */
  priority: number
}

export interface TriggerCondition {
  field: string
  operator: 'eq' | 'neq' | 'gt' | 'lt' | 'in' | 'contains'
  value: string | number | string[]
}

export interface TriggerEvaluation {
  ruleMatched: boolean
  rule: TriggerRule
  reason: string
  workflowToStart?: string
}

export interface AutomationSchedule {
  event: WorkflowTriggerEvent
  cronExpression: string
  description: string
  nextRun?: string
}

/* ── Default trigger rules ────────────────────────────────────────────────── */

export const DEFAULT_TRIGGER_RULES: TriggerRule[] = [
  {
    event: 'client.onboarded',
    templateName: 'Client Onboarding',
    conditions: [],
    leadTimeDays: 0,
    enabled: true,
    priority: 1,
  },
  {
    event: 'fiscal-year-end.approaching',
    templateName: 'Year-End Close',
    conditions: [{ field: 'clientType', operator: 'in', value: ['CCPC', 'sole-proprietor'] }],
    leadTimeDays: 45,
    enabled: true,
    priority: 1,
  },
  {
    event: 'gst-hst.quarter-end',
    templateName: 'GST/HST Filing',
    conditions: [{ field: 'registeredForGst', operator: 'eq', value: 'true' }],
    leadTimeDays: 15,
    enabled: true,
    priority: 2,
  },
  {
    event: 'tax-return.due-soon',
    templateName: 'T1 Personal Tax',
    conditions: [{ field: 'clientType', operator: 'eq', value: 'individual' }],
    leadTimeDays: 60,
    enabled: true,
    priority: 2,
  },
  {
    event: 'reconciliation.monthly-due',
    templateName: 'Monthly Reconciliation',
    conditions: [],
    leadTimeDays: 5,
    enabled: true,
    priority: 3,
  },
  {
    event: 'audit.requested',
    templateName: 'Audit Preparation',
    conditions: [],
    leadTimeDays: 0,
    enabled: true,
    priority: 1,
  },
]

/* ── Automation schedules ─────────────────────────────────────────────────── */

export const AUTOMATION_SCHEDULES: AutomationSchedule[] = [
  {
    event: 'reconciliation.monthly-due',
    cronExpression: '0 8 25 * *', // 25th of every month at 8am
    description: 'Monthly reconciliation check — triggers workflow if not already started',
  },
  {
    event: 'gst-hst.quarter-end',
    cronExpression: '0 8 15 3,6,9,12 *', // 15th of quarter-end months
    description: 'GST/HST quarterly filing reminder',
  },
  {
    event: 'fiscal-year-end.approaching',
    cronExpression: '0 8 1 * *', // 1st of every month
    description: 'Scan for clients with fiscal year-end within lead-time window',
  },
  {
    event: 'invoice.overdue',
    cronExpression: '0 9 * * 1', // Every Monday
    description: 'Weekly overdue invoice scan — triggers dunning workflow',
  },
]

/* ── Evaluation engine ────────────────────────────────────────────────────── */

/**
 * Evaluate a single condition against provided context.
 */
export function evaluateCondition(
  condition: TriggerCondition,
  context: Record<string, unknown>,
): boolean {
  const value = context[condition.field]

  switch (condition.operator) {
    case 'eq':
      return String(value) === String(condition.value)
    case 'neq':
      return String(value) !== String(condition.value)
    case 'gt':
      return Number(value) > Number(condition.value)
    case 'lt':
      return Number(value) < Number(condition.value)
    case 'in':
      return Array.isArray(condition.value) && condition.value.includes(String(value))
    case 'contains':
      return typeof value === 'string' && value.includes(String(condition.value))
    default:
      return false
  }
}

/**
 * Evaluate which trigger rules match a given event + context.
 *
 * Returns evaluations sorted by priority (highest first).
 */
export function evaluateTriggers(
  event: WorkflowTriggerEvent,
  context: Record<string, unknown>,
  rules: TriggerRule[] = DEFAULT_TRIGGER_RULES,
): TriggerEvaluation[] {
  return rules
    .filter((rule) => rule.enabled && rule.event === event)
    .sort((a, b) => a.priority - b.priority)
    .map((rule) => {
      const allConditionsMet =
        rule.conditions.length === 0 ||
        rule.conditions.every((c) => evaluateCondition(c, context))

      return {
        ruleMatched: allConditionsMet,
        rule,
        reason: allConditionsMet
          ? `All ${rule.conditions.length} conditions met → start "${rule.templateName}"`
          : `Condition(s) not met for "${rule.templateName}"`,
        workflowToStart: allConditionsMet ? rule.templateName : undefined,
      }
    })
}

/**
 * Get the first matching workflow template for a given event + context.
 */
export function getTriggeredWorkflow(
  event: WorkflowTriggerEvent,
  context: Record<string, unknown>,
  rules?: TriggerRule[],
): string | null {
  const evaluations = evaluateTriggers(event, context, rules)
  const match = evaluations.find((e) => e.ruleMatched)
  return match?.workflowToStart ?? null
}

/**
 * Check if a deadline-based event should fire given the target date and lead time.
 */
export function shouldTriggerForDeadline(
  targetDate: Date,
  leadTimeDays: number,
  now: Date = new Date(),
): boolean {
  const daysUntilTarget = Math.ceil(
    (targetDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
  )
  return daysUntilTarget > 0 && daysUntilTarget <= leadTimeDays
}

/**
 * Scan clients and return events that should be triggered today.
 */
export function scanForUpcomingDeadlines(
  clients: Array<{
    id: string
    fiscalYearEnd?: Date
    gstRegistered?: boolean
    type?: string
  }>,
  rules: TriggerRule[] = DEFAULT_TRIGGER_RULES,
  now: Date = new Date(),
): Array<{ clientId: string; event: WorkflowTriggerEvent; templateName: string }> {
  const triggered: Array<{ clientId: string; event: WorkflowTriggerEvent; templateName: string }> = []

  for (const client of clients) {
    for (const rule of rules) {
      if (!rule.enabled || rule.leadTimeDays === 0) continue

      let targetDate: Date | null = null

      if (rule.event === 'fiscal-year-end.approaching' && client.fiscalYearEnd) {
        targetDate = client.fiscalYearEnd
      }

      if (targetDate && shouldTriggerForDeadline(targetDate, rule.leadTimeDays, now)) {
        const context: Record<string, unknown> = {
          clientType: client.type,
          registeredForGst: String(client.gstRegistered ?? false),
        }

        if (rule.conditions.every((c) => evaluateCondition(c, context))) {
          triggered.push({
            clientId: client.id,
            event: rule.event,
            templateName: rule.templateName,
          })
        }
      }
    }
  }

  return triggered
}
