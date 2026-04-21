/**
 * @nzila/itsm-core — Automation rule evaluator
 *
 * Evaluates AutomationRule conditions against a ticket context.
 * Pure — no side effects; callers execute the resulting actions.
 */
import type { AutomationRule, AutomationCondition, AutomationAction } from './types'

type TicketContext = Record<string, unknown>

// ── Condition evaluator ───────────────────────────────────────────────────────

function evaluateCondition(
  condition: AutomationCondition,
  ctx: TicketContext,
  now: Date,
): boolean {
  const fieldValue = ctx[condition.field]

  switch (condition.operator) {
    case 'eq':
      return fieldValue === condition.value
    case 'neq':
      return fieldValue !== condition.value
    case 'gte':
      return typeof fieldValue === 'number' &&
        typeof condition.value === 'number' &&
        fieldValue >= condition.value
    case 'lte':
      return typeof fieldValue === 'number' &&
        typeof condition.value === 'number' &&
        fieldValue <= condition.value
    case 'in':
      return Array.isArray(condition.value) && condition.value.includes(fieldValue)
    case 'older_than_minutes': {
      if (typeof fieldValue !== 'string') return false
      if (typeof condition.value !== 'number') return false
      const fieldDate = new Date(fieldValue)
      const minutesOld = (now.getTime() - fieldDate.getTime()) / 60_000
      return minutesOld >= condition.value
    }
    default:
      return false
  }
}

// ── Rule evaluator ────────────────────────────────────────────────────────────

export interface EvaluationResult {
  readonly ruleId: string
  readonly ruleName: string
  readonly triggered: boolean
  readonly actions: readonly AutomationAction[]
}

/**
 * Evaluate a set of automation rules against a ticket context.
 * Returns only the rules that fired.
 */
export function evaluateAutomationRules(
  rules: readonly AutomationRule[],
  ticketCtx: TicketContext,
  now: Date = new Date(),
): readonly EvaluationResult[] {
  const results: EvaluationResult[] = []

  for (const rule of rules) {
    if (!rule.enabled) continue

    const conditionResults = rule.conditions.map((c) =>
      evaluateCondition(c, ticketCtx, now),
    )

    const triggered =
      rule.conditionLogic === 'all'
        ? conditionResults.every(Boolean)
        : conditionResults.some(Boolean)

    if (triggered) {
      results.push({
        ruleId: rule.id,
        ruleName: rule.name,
        triggered: true,
        actions: rule.actions,
      })
    }
  }

  return results
}

// ── Built-in rule templates ───────────────────────────────────────────────────

/**
 * VIP + P1 → page manager immediately.
 */
export const VIP_P1_ESCALATION_TEMPLATE: Omit<AutomationRule, 'id' | 'orgId'> = {
  name: 'VIP P1 — escalate to manager',
  enabled: true,
  conditionLogic: 'all',
  conditions: [
    { field: 'priority', operator: 'eq', value: 'p1_critical' },
    { field: 'tags', operator: 'in', value: ['vip'] },
  ],
  actions: [
    {
      type: 'escalate',
      payload: { reason: 'VIP customer P1 ticket', notifyRole: 'itsm_manager' },
    },
    {
      type: 'send_notification',
      payload: { channel: 'sms', priority: 'urgent', template: 'vip_p1_alert' },
    },
  ],
  cooldownMinutes: 60,
}

/**
 * No user response in 2 hours → escalate.
 */
export const NO_RESPONSE_ESCALATION_TEMPLATE: Omit<AutomationRule, 'id' | 'orgId'> = {
  name: 'Waiting user — 2h no response escalation',
  enabled: true,
  conditionLogic: 'all',
  conditions: [
    { field: 'status', operator: 'eq', value: 'waiting_user' },
    { field: 'updatedAt', operator: 'older_than_minutes', value: 120 },
  ],
  actions: [
    {
      type: 'send_notification',
      payload: { channel: 'email', template: 'follow_up_reminder' },
    },
    {
      type: 'change_priority',
      payload: { newPriority: 'p2_high' },
    },
  ],
  cooldownMinutes: 120,
}

/**
 * Three incidents on same asset → auto-raise problem record.
 * (Evaluated per asset_id cohort, not per single ticket.)
 */
export const RECURRING_INCIDENT_PROBLEM_TEMPLATE: Omit<AutomationRule, 'id' | 'orgId'> = {
  name: 'Recurring incidents — auto-create problem',
  enabled: true,
  conditionLogic: 'all',
  conditions: [
    { field: 'type', operator: 'eq', value: 'incident' },
    { field: 'linkedIncidentCountForAsset', operator: 'gte', value: 3 },
  ],
  actions: [
    {
      type: 'create_problem',
      payload: { linkAssetId: true, title: 'Recurring incidents on asset' },
    },
  ],
  cooldownMinutes: 1440,
}
