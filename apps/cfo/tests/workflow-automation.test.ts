/**
 * CFO — Workflow Automation Tests
 *
 * Validates the trigger evaluation engine and workflow template library:
 *   1. Trigger matching against DEFAULT_TRIGGER_RULES
 *   2. Condition evaluation (eq, neq, gt, lt, in, contains)
 *   3. Priority ordering when multiple rules match
 *   4. SLA evaluation for workflow templates
 */
import { describe, it, expect } from 'vitest'
import {
  evaluateCondition,
  evaluateTriggers,
  getTriggeredWorkflow,
  DEFAULT_TRIGGER_RULES,
  AUTOMATION_SCHEDULES,
} from '@/lib/workflow-automation'
import { WORKFLOW_TEMPLATE_LIBRARY } from '@/lib/workflow-templates'

// ═══════════════════════════════════════════════════════════════════════════
// 1. CONDITION EVALUATION
// ═══════════════════════════════════════════════════════════════════════════

describe('evaluateCondition', () => {
  it('eq — matches equal values', () => {
    expect(evaluateCondition({ field: 'status', operator: 'eq', value: 'active' }, { status: 'active' })).toBe(true)
    expect(evaluateCondition({ field: 'status', operator: 'eq', value: 'active' }, { status: 'inactive' })).toBe(false)
  })

  it('neq — matches non-equal values', () => {
    expect(evaluateCondition({ field: 'status', operator: 'neq', value: 'closed' }, { status: 'open' })).toBe(true)
    expect(evaluateCondition({ field: 'status', operator: 'neq', value: 'closed' }, { status: 'closed' })).toBe(false)
  })

  it('gt — numeric greater-than', () => {
    expect(evaluateCondition({ field: 'amount', operator: 'gt', value: 100 }, { amount: 200 })).toBe(true)
    expect(evaluateCondition({ field: 'amount', operator: 'gt', value: 100 }, { amount: 50 })).toBe(false)
  })

  it('lt — numeric less-than', () => {
    expect(evaluateCondition({ field: 'amount', operator: 'lt', value: 100 }, { amount: 50 })).toBe(true)
    expect(evaluateCondition({ field: 'amount', operator: 'lt', value: 100 }, { amount: 200 })).toBe(false)
  })

  it('in — value in array', () => {
    expect(evaluateCondition({ field: 'clientType', operator: 'in', value: ['CCPC', 'sole-proprietor'] }, { clientType: 'CCPC' })).toBe(true)
    expect(evaluateCondition({ field: 'clientType', operator: 'in', value: ['CCPC', 'sole-proprietor'] }, { clientType: 'trust' })).toBe(false)
  })

  it('contains — substring match', () => {
    expect(evaluateCondition({ field: 'name', operator: 'contains', value: 'Corp' }, { name: 'Acme Corp Ltd' })).toBe(true)
    expect(evaluateCondition({ field: 'name', operator: 'contains', value: 'Corp' }, { name: 'Acme Inc' })).toBe(false)
  })

  it('returns false for unknown operator', () => {
    expect(evaluateCondition({ field: 'x', operator: 'unknown' as never, value: 1 }, { x: 1 })).toBe(false)
  })

  it('returns false when field is missing from context', () => {
    expect(evaluateCondition({ field: 'missing', operator: 'eq', value: 'a' }, {})).toBe(false)
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// 2. TRIGGER EVALUATION
// ═══════════════════════════════════════════════════════════════════════════

describe('evaluateTriggers', () => {
  it('matches client.onboarded event (no conditions)', () => {
    const results = evaluateTriggers('client.onboarded', {})
    expect(results.length).toBeGreaterThan(0)
    expect(results[0].ruleMatched).toBe(true)
    expect(results[0].workflowToStart).toBe('Client Onboarding')
  })

  it('matches fiscal-year-end for CCPC clients', () => {
    const results = evaluateTriggers('fiscal-year-end.approaching', { clientType: 'CCPC' })
    const matched = results.find((r) => r.ruleMatched)
    expect(matched).toBeDefined()
    expect(matched?.workflowToStart).toBe('Year-End Close')
  })

  it('rejects fiscal-year-end for non-matching client types', () => {
    const results = evaluateTriggers('fiscal-year-end.approaching', { clientType: 'trust' })
    const matched = results.find((r) => r.ruleMatched)
    expect(matched).toBeUndefined()
  })

  it('matches gst-hst.quarter-end for registered clients', () => {
    const results = evaluateTriggers('gst-hst.quarter-end', { registeredForGst: 'true' })
    const matched = results.find((r) => r.ruleMatched)
    expect(matched).toBeDefined()
    expect(matched?.workflowToStart).toBe('GST/HST Filing')
  })

  it('rejects gst-hst.quarter-end for non-registered clients', () => {
    const results = evaluateTriggers('gst-hst.quarter-end', { registeredForGst: 'false' })
    const matched = results.find((r) => r.ruleMatched)
    expect(matched).toBeUndefined()
  })

  it('returns empty for unknown events', () => {
    const results = evaluateTriggers('unknown.event' as never, {})
    expect(results).toHaveLength(0)
  })

  it('disabled rules are excluded', () => {
    const disabledRules = DEFAULT_TRIGGER_RULES.map((r) => ({ ...r, enabled: false }))
    const results = evaluateTriggers('client.onboarded', {}, disabledRules)
    expect(results).toHaveLength(0)
  })

  it('results are sorted by priority (ascending)', () => {
    // Create rules with different priorities for same event
    const customRules = [
      { ...DEFAULT_TRIGGER_RULES[0], priority: 5 },
      { ...DEFAULT_TRIGGER_RULES[0], priority: 1, templateName: 'High Priority' },
    ]
    const results = evaluateTriggers('client.onboarded', {}, customRules)
    expect(results.length).toBe(2)
    expect(results[0].rule.priority).toBeLessThanOrEqual(results[1].rule.priority)
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// 3. GET TRIGGERED WORKFLOW
// ═══════════════════════════════════════════════════════════════════════════

describe('getTriggeredWorkflow', () => {
  it('returns template name for matching event', () => {
    const result = getTriggeredWorkflow('audit.requested', {})
    expect(result).toBe('Audit Preparation')
  })

  it('returns null for non-matching context', () => {
    const result = getTriggeredWorkflow('fiscal-year-end.approaching', { clientType: 'trust' })
    expect(result).toBeNull()
  })

  it('returns null for unknown events', () => {
    const result = getTriggeredWorkflow('unknown.event' as never, {})
    expect(result).toBeNull()
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// 4. DEFAULTS INTEGRITY
// ═══════════════════════════════════════════════════════════════════════════

describe('Default Rules & Schedules', () => {
  it('DEFAULT_TRIGGER_RULES has 6 rules', () => {
    expect(DEFAULT_TRIGGER_RULES).toHaveLength(6)
  })

  it('all default rules are enabled', () => {
    for (const rule of DEFAULT_TRIGGER_RULES) {
      expect(rule.enabled, `rule for ${rule.event}`).toBe(true)
    }
  })

  it('AUTOMATION_SCHEDULES has valid cron expressions', () => {
    expect(AUTOMATION_SCHEDULES.length).toBeGreaterThan(0)
    for (const schedule of AUTOMATION_SCHEDULES) {
      // Simple validation: cron has 5 parts
      const parts = schedule.cronExpression.split(' ')
      expect(parts.length, `cron for ${schedule.event}`).toBe(5)
    }
  })

  it('most scheduled events have a matching trigger rule', () => {
    const unlinkedSchedules: string[] = []
    for (const schedule of AUTOMATION_SCHEDULES) {
      const hasRule = DEFAULT_TRIGGER_RULES.some((r: { event: string }) => r.event === schedule.event)
      if (!hasRule) unlinkedSchedules.push(schedule.event)
    }
    // invoice.overdue has a schedule but no trigger rule yet (dunning workflow pending)
    expect(unlinkedSchedules).toEqual(['invoice.overdue'])
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// 5. WORKFLOW TEMPLATE LIBRARY
// ═══════════════════════════════════════════════════════════════════════════

describe('Workflow Template Library', () => {
  it('contains all 6 expected presets', () => {
    const names = WORKFLOW_TEMPLATE_LIBRARY.map((t) => t.name)
    expect(names).toContain('Year-End Close')
    expect(names).toContain('Client Onboarding')
    expect(names).toContain('Monthly Reconciliation')
    expect(names).toContain('GST/HST Return Filing')
    expect(names).toContain('T1 Personal Tax Return')
    expect(names).toContain('Financial Audit Preparation')
  })

  it('every template has at least 1 step', () => {
    for (const template of WORKFLOW_TEMPLATE_LIBRARY) {
      expect(template.steps.length, `${template.name} has no steps`).toBeGreaterThan(0)
    }
  })

  it('every template has a positive estimatedDays', () => {
    for (const template of WORKFLOW_TEMPLATE_LIBRARY) {
      expect(template.estimatedDays, `${template.name}`).toBeGreaterThan(0)
    }
  })
})


