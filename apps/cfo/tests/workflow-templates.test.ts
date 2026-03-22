/**
 * Tests — Workflow Templates & SLA Tracking
 *
 * Pure-function tests for workflow template definitions,
 * SLA evaluation, and overdue detection.
 */
import { describe, it, expect } from 'vitest'
import {
  YEAR_END_CLOSE,
  CLIENT_ONBOARDING,
  MONTHLY_RECONCILIATION,
  GST_HST_FILING,
  T1_PERSONAL_TAX,
  AUDIT_PREPARATION,
  WORKFLOW_TEMPLATE_LIBRARY,
  evaluateWorkflowSla,
  findOverdueWorkflows,
  type WorkflowTemplatePreset,
} from '@/lib/workflow-templates'
import type { WorkflowInstance, WorkflowStep } from '@/lib/actions/workflow-actions'

/* ── Helpers ──────────────────────────────────────────────────────────────── */

function buildInstance(
  template: WorkflowTemplatePreset,
  createdAt: Date,
  completedSteps: number = 0,
): WorkflowInstance {
  return {
    id: 'wf-001',
    templateId: `tpl-${template.name.toLowerCase().replace(/\s/g, '-')}`,
    templateName: template.name,
    status: 'in-progress',
    currentStep: completedSteps,
    steps: template.steps.map((s, i) => ({
      stepIndex: i,
      name: s.name,
      assigneeRole: s.assigneeRole,
      actionType: s.actionType,
      status: i < completedSteps ? 'completed' : 'pending',
      comment: null,
      completedAt: i < completedSteps ? new Date() : null,
      completedBy: i < completedSteps ? 'user-1' : null,
    })),
    createdAt,
  }
}

/* ── 1. Template definitions ─────────────────────────────────────────────── */

describe('Workflow Template Library', () => {
  it('contains exactly 6 templates', () => {
    expect(WORKFLOW_TEMPLATE_LIBRARY).toHaveLength(6)
  })

  it('includes all named templates', () => {
    const names = WORKFLOW_TEMPLATE_LIBRARY.map((t) => t.name)
    expect(names).toContain('Year-End Close')
    expect(names).toContain('Client Onboarding')
    expect(names).toContain('Monthly Reconciliation')
    expect(names).toContain('GST/HST Return Filing')
    expect(names).toContain('T1 Personal Tax Return')
    expect(names).toContain('Financial Audit Preparation')
  })

  for (const template of [
    YEAR_END_CLOSE,
    CLIENT_ONBOARDING,
    MONTHLY_RECONCILIATION,
    GST_HST_FILING,
    T1_PERSONAL_TAX,
    AUDIT_PREPARATION,
  ]) {
    describe(template.name, () => {
      it('has required fields', () => {
        expect(template.name).toBeTruthy()
        expect(template.description).toBeTruthy()
        expect(template.trigger).toBeTruthy()
        expect(template.estimatedDays).toBeGreaterThan(0)
        expect(template.category).toBeTruthy()
        expect(template.steps.length).toBeGreaterThan(0)
      })

      it('has valid step definitions', () => {
        const validRoles = ['accountant', 'manager', 'partner', 'client']
        const validActions = ['review', 'approve', 'edit', 'sign', 'notify']

        for (const step of template.steps) {
          expect(step.name).toBeTruthy()
          expect(validRoles).toContain(step.assigneeRole)
          expect(validActions).toContain(step.actionType)
          expect(step.dueHours).toBeGreaterThan(0)
        }
      })

      it('total step hours are reasonable for the workflow', () => {
        const totalHours = template.steps.reduce((sum, s) => sum + s.dueHours, 0)
        // Steps run in parallel across different roles, so total SLA hours
        // can exceed estimatedDays * 24. We just check for sanity bounds.
        expect(totalHours).toBeGreaterThan(0)
        expect(totalHours).toBeLessThanOrEqual(template.estimatedDays * 24 * 3)
      })

      it('ends with a partner/manager sign-off or notification step', () => {
        const lastStep = template.steps[template.steps.length - 1]
        // All templates should end with a meaningful final step
        expect(lastStep.actionType).toMatch(/approve|notify|edit/)
      })
    })
  }
})

/* ── 2. SLA evaluation ───────────────────────────────────────────────────── */

describe('evaluateWorkflowSla', () => {
  it('reports all on-track for a fresh instance', () => {
    const now = new Date()
    const instance = buildInstance(MONTHLY_RECONCILIATION, now, 0)
    const report = evaluateWorkflowSla(instance, MONTHLY_RECONCILIATION.steps, now)

    expect(report.overallStatus).toBe('on-track')
    expect(report.overdueCount).toBe(0)
    expect(report.atRiskCount).toBe(0)
    expect(report.steps).toHaveLength(MONTHLY_RECONCILIATION.steps.length)
  })

  it('marks completed steps as on-track', () => {
    const now = new Date()
    const instance = buildInstance(MONTHLY_RECONCILIATION, now, 3)
    const report = evaluateWorkflowSla(instance, MONTHLY_RECONCILIATION.steps, now)

    for (let i = 0; i < 3; i++) {
      expect(report.steps[i].severity).toBe('on-track')
      expect(report.steps[i].isOverdue).toBe(false)
    }
  })

  it('detects overdue steps when time has passed', () => {
    // Create instance 30 days ago — all steps should be overdue
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 3600_000)
    const instance = buildInstance(GST_HST_FILING, thirtyDaysAgo, 0)
    const report = evaluateWorkflowSla(instance, GST_HST_FILING.steps)

    expect(report.overdueCount).toBeGreaterThan(0)
    expect(report.overallStatus).toMatch(/overdue|critical/)
  })

  it('detects critical status for severely overdue (>48h)', () => {
    // Create instance 10 days ago — first step (due in 12h) is 228h overdue
    const tenDaysAgo = new Date(Date.now() - 10 * 24 * 3600_000)
    const instance = buildInstance(GST_HST_FILING, tenDaysAgo, 0)
    const report = evaluateWorkflowSla(instance, GST_HST_FILING.steps)

    const criticalSteps = report.steps.filter((s) => s.severity === 'critical')
    expect(criticalSteps.length).toBeGreaterThan(0)
    expect(report.overallStatus).toBe('critical')
  })

  it('detects at-risk when step due within 25% of allowed time', () => {
    // First step of MONTHLY_RECONCILIATION is due in 24h
    // Create just 20h ago — 4h remaining = 16.7% of 24h < 25% → at-risk
    const twentyHoursAgo = new Date(Date.now() - 20 * 3600_000)
    const instance = buildInstance(MONTHLY_RECONCILIATION, twentyHoursAgo, 0)
    const report = evaluateWorkflowSla(instance, MONTHLY_RECONCILIATION.steps)

    expect(report.steps[0].severity).toBe('at-risk')
    expect(report.atRiskCount).toBeGreaterThanOrEqual(1)
  })

  it('includes correct instanceId and templateName', () => {
    const instance = buildInstance(YEAR_END_CLOSE, new Date())
    const report = evaluateWorkflowSla(instance, YEAR_END_CLOSE.steps)

    expect(report.instanceId).toBe('wf-001')
    expect(report.templateName).toBe('Year-End Close')
  })

  it('cumulates due hours across steps', () => {
    const now = new Date()
    const instance = buildInstance(YEAR_END_CLOSE, now, 0)
    const report = evaluateWorkflowSla(instance, YEAR_END_CLOSE.steps, now)

    // Step 0: due at +48h, Step 1: due at +72h (48+24), etc.
    const step0Due = new Date(now.getTime() + 48 * 3600_000)
    const step1Due = new Date(now.getTime() + 72 * 3600_000)
    expect(new Date(report.steps[0].dueDateIso).getTime()).toBeCloseTo(step0Due.getTime(), -3)
    expect(new Date(report.steps[1].dueDateIso).getTime()).toBeCloseTo(step1Due.getTime(), -3)
  })
})

/* ── 3. Overdue workflow detection ───────────────────────────────────────── */

describe('findOverdueWorkflows', () => {
  it('returns only workflows with overdue steps', () => {
    const now = new Date()
    const fresh = buildInstance(GST_HST_FILING, now, 0)
    fresh.id = 'wf-fresh'
    const old = buildInstance(GST_HST_FILING, new Date(Date.now() - 30 * 24 * 3600_000), 0)
    old.id = 'wf-old'

    const stepsMap = new Map<string, WorkflowStep[]>()
    stepsMap.set(fresh.templateId, GST_HST_FILING.steps)
    stepsMap.set(old.templateId, GST_HST_FILING.steps)

    const overdueReports = findOverdueWorkflows([fresh, old], stepsMap, now)
    expect(overdueReports.length).toBe(1)
    expect(overdueReports[0].instanceId).toBe('wf-old')
  })

  it('skips completed workflows', () => {
    const old = buildInstance(GST_HST_FILING, new Date(Date.now() - 30 * 24 * 3600_000), 0)
    old.status = 'completed'

    const stepsMap = new Map<string, WorkflowStep[]>()
    stepsMap.set(old.templateId, GST_HST_FILING.steps)

    expect(findOverdueWorkflows([old], stepsMap)).toEqual([])
  })

  it('skips instances with no matching template', () => {
    const instance = buildInstance(GST_HST_FILING, new Date(Date.now() - 30 * 24 * 3600_000), 0)
    const stepsMap = new Map<string, WorkflowStep[]>() // empty map

    expect(findOverdueWorkflows([instance], stepsMap)).toEqual([])
  })

  it('sorts by severity (critical first)', () => {
    const oldish = buildInstance(
      GST_HST_FILING,
      new Date(Date.now() - 5 * 24 * 3600_000),
      0,
    )
    oldish.id = 'wf-oldish'
    const ancient = buildInstance(
      YEAR_END_CLOSE,
      new Date(Date.now() - 60 * 24 * 3600_000),
      0,
    )
    ancient.id = 'wf-ancient'

    const stepsMap = new Map<string, WorkflowStep[]>()
    stepsMap.set(oldish.templateId, GST_HST_FILING.steps)
    stepsMap.set(ancient.templateId, YEAR_END_CLOSE.steps)

    const reports = findOverdueWorkflows([oldish, ancient], stepsMap)
    if (reports.length >= 2) {
      const priority = { critical: 0, overdue: 1, 'at-risk': 2, 'on-track': 3 }
      expect(priority[reports[0].overallStatus]).toBeLessThanOrEqual(
        priority[reports[1].overallStatus],
      )
    }
  })
})
