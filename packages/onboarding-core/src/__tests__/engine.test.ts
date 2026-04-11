/**
 * @nzila/onboarding-core — Engine Tests
 */
import { describe, it, expect, beforeEach } from 'vitest'
import type { OnboardingFlowDef, OnboardingProgress } from '../types'
import {
  completeStep,
  resetStep,
  evaluateProgress,
  findNextStep,
  getBlockers,
  isFlowComplete,
  validateFlow,
  createProgress,
  deriveStatus,
} from '../engine'

// ── Fixtures ────────────────────────────────────────────────────────────────

const basicFlow: OnboardingFlowDef = {
  id: 'default',
  displayName: 'Default Onboarding',
  steps: [
    { name: 'org_info', displayName: 'Organisation Info', required: true },
    { name: 'people', displayName: 'Add People', required: true, dependsOn: ['org_info'] },
    { name: 'roles', displayName: 'Assign Roles', required: true, dependsOn: ['people'] },
    { name: 'integrations', displayName: 'Integrations', required: false },
  ],
}

const validatedFlow: OnboardingFlowDef = {
  id: 'validated',
  displayName: 'Validated Flow',
  steps: [
    {
      name: 'details',
      displayName: 'Details',
      required: true,
      validate: (data) => typeof data.name === 'string' && data.name !== '',
    },
    {
      name: 'guarded',
      displayName: 'Guarded Step',
      required: true,
      canStart: (data) => data.ready === true,
      dependsOn: ['details'],
    },
  ],
}

let emptyProgress: OnboardingProgress

beforeEach(() => {
  emptyProgress = createProgress('org-1', 'default')
})

// ── createProgress ──────────────────────────────────────────────────────────

describe('createProgress', () => {
  it('creates a not_started progress', () => {
    const p = createProgress('org-1', 'default')
    expect(p.orgId).toBe('org-1')
    expect(p.flowId).toBe('default')
    expect(p.status).toBe('not_started')
    expect(Object.keys(p.completions)).toHaveLength(0)
    expect(p.startedAt).toBeTruthy()
  })
})

// ── deriveStatus ────────────────────────────────────────────────────────────

describe('deriveStatus', () => {
  it('returns not_started for empty progress', () => {
    expect(deriveStatus(basicFlow, emptyProgress)).toBe('not_started')
  })

  it('returns in_progress when some steps done', () => {
    const p: OnboardingProgress = {
      ...emptyProgress,
      completions: {
        org_info: { stepName: 'org_info', completedAt: new Date().toISOString(), completedBy: 'actor-1', data: {} },
      },
    }
    expect(deriveStatus(basicFlow, p)).toBe('in_progress')
  })

  it('returns completed when all required steps done', () => {
    const p: OnboardingProgress = {
      ...emptyProgress,
      completions: {
        org_info: { stepName: 'org_info', completedAt: new Date().toISOString(), completedBy: 'actor-1', data: {} },
        people: { stepName: 'people', completedAt: new Date().toISOString(), completedBy: 'actor-1', data: {} },
        roles: { stepName: 'roles', completedAt: new Date().toISOString(), completedBy: 'actor-1', data: {} },
      },
    }
    expect(deriveStatus(basicFlow, p)).toBe('completed')
  })
})

// ── completeStep ────────────────────────────────────────────────────────────

describe('completeStep', () => {
  it('completes a step successfully', () => {
    const result = completeStep(basicFlow, emptyProgress, 'org_info', 'actor-1')
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.progress.completions['org_info']).toBeDefined()
    expect(result.result.outcome).toBe('completed')
  })

  it('rejects unknown step', () => {
    const result = completeStep(basicFlow, emptyProgress, 'unknown', 'actor-1')
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.code).toBe('step_not_found')
  })

  it('rejects already-completed step', () => {
    const first = completeStep(basicFlow, emptyProgress, 'org_info', 'actor-1')
    expect(first.ok).toBe(true)
    if (!first.ok) return

    const second = completeStep(basicFlow, first.progress, 'org_info', 'actor-1')
    expect(second.ok).toBe(false)
    if (second.ok) return
    expect(second.code).toBe('already_completed')
  })

  it('rejects step with unmet dependencies', () => {
    const result = completeStep(basicFlow, emptyProgress, 'people', 'actor-1')
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.code).toBe('dependencies_not_met')
  })

  it('allows step after dependencies are met', () => {
    const first = completeStep(basicFlow, emptyProgress, 'org_info', 'actor-1')
    expect(first.ok).toBe(true)
    if (!first.ok) return

    const second = completeStep(basicFlow, first.progress, 'people', 'actor-1')
    expect(second.ok).toBe(true)
  })

  it('rejects step when canStart returns false', () => {
    const p = createProgress('org-1', 'validated')
    const first = completeStep(validatedFlow, p, 'details', 'actor-1', { name: 'Acme' })
    expect(first.ok).toBe(true)
    if (!first.ok) return

    const second = completeStep(validatedFlow, first.progress, 'guarded', 'actor-1', { ready: false })
    expect(second.ok).toBe(false)
    if (second.ok) return
    expect(second.code).toBe('cannot_start')
  })

  it('rejects step when validation fails', () => {
    const p = createProgress('org-1', 'validated')
    const result = completeStep(validatedFlow, p, 'details', 'actor-1', { name: '' })
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.code).toBe('validation_failed')
  })

  it('marks flow completed when all required steps done', () => {
    let progress = emptyProgress
    for (const name of ['org_info', 'people', 'roles']) {
      const r = completeStep(basicFlow, progress, name, 'actor-1')
      expect(r.ok).toBe(true)
      if (!r.ok) return
      progress = r.progress
    }
    expect(progress.status).toBe('completed')
  })
})

// ── resetStep ───────────────────────────────────────────────────────────────

describe('resetStep', () => {
  it('resets a completed step', () => {
    const first = completeStep(basicFlow, emptyProgress, 'org_info', 'actor-1')
    expect(first.ok).toBe(true)
    if (!first.ok) return

    const result = resetStep(basicFlow, first.progress, 'org_info')
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.progress.completions['org_info']).toBeUndefined()
  })

  it('rejects reset for unknown step', () => {
    const result = resetStep(basicFlow, emptyProgress, 'unknown')
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.code).toBe('step_not_found')
  })

  it('rejects reset for uncompleted step', () => {
    const result = resetStep(basicFlow, emptyProgress, 'org_info')
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.code).toBe('not_completed')
  })

  it('rejects reset when other steps depend on it', () => {
    const first = completeStep(basicFlow, emptyProgress, 'org_info', 'actor-1')
    expect(first.ok).toBe(true)
    if (!first.ok) return

    const second = completeStep(basicFlow, first.progress, 'people', 'actor-1')
    expect(second.ok).toBe(true)
    if (!second.ok) return

    const result = resetStep(basicFlow, second.progress, 'org_info')
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.code).toBe('has_dependents')
  })
})

// ── evaluateProgress ────────────────────────────────────────────────────────

describe('evaluateProgress', () => {
  it('reports 0% for empty progress', () => {
    const summary = evaluateProgress(basicFlow, emptyProgress)
    expect(summary.percentComplete).toBe(0)
    expect(summary.totalSteps).toBe(4)
    expect(summary.completedSteps).toBe(0)
    expect(summary.requiredRemaining).toBe(3)
    expect(summary.optionalRemaining).toBe(1)
    expect(summary.status).toBe('not_started')
  })

  it('reports correct percentage after steps', () => {
    const r = completeStep(basicFlow, emptyProgress, 'org_info', 'actor-1')
    expect(r.ok).toBe(true)
    if (!r.ok) return

    const summary = evaluateProgress(basicFlow, r.progress)
    expect(summary.percentComplete).toBe(25)
    expect(summary.completedSteps).toBe(1)
    expect(summary.requiredRemaining).toBe(2)
    expect(summary.nextStep).toBe('people')
  })

  it('reports 100% when all steps done (including optional)', () => {
    let progress = emptyProgress
    for (const name of ['org_info', 'people', 'roles', 'integrations']) {
      const r = completeStep(basicFlow, progress, name, 'actor-1')
      if (!r.ok) throw new Error(`Step ${name} failed: ${r.code}`)
      progress = r.progress
    }
    const summary = evaluateProgress(basicFlow, progress)
    expect(summary.percentComplete).toBe(100)
    expect(summary.status).toBe('completed')
  })
})

// ── findNextStep ────────────────────────────────────────────────────────────

describe('findNextStep', () => {
  it('returns first step for empty progress', () => {
    expect(findNextStep(basicFlow, emptyProgress)).toBe('org_info')
  })

  it('returns null when all steps done', () => {
    let progress = emptyProgress
    for (const name of ['org_info', 'people', 'roles', 'integrations']) {
      const r = completeStep(basicFlow, progress, name, 'actor-1')
      if (!r.ok) throw new Error(`Step ${name} failed`)
      progress = r.progress
    }
    expect(findNextStep(basicFlow, progress)).toBeNull()
  })

  it('skips steps with unmet dependencies', () => {
    // Without org_info, people has unmet deps, but integrations has no deps
    expect(findNextStep(basicFlow, emptyProgress)).toBe('org_info')
  })
})

// ── getBlockers ─────────────────────────────────────────────────────────────

describe('getBlockers', () => {
  it('returns blocked required steps', () => {
    // people depends on org_info which is not done → people is blocked
    const blockers = getBlockers(basicFlow, emptyProgress)
    expect(blockers).toContain('people')
    expect(blockers).toContain('roles')
  })

  it('returns empty when no blockers', () => {
    const r = completeStep(basicFlow, emptyProgress, 'org_info', 'actor-1')
    if (!r.ok) throw new Error('unexpected')
    const r2 = completeStep(basicFlow, r.progress, 'people', 'actor-1')
    if (!r2.ok) throw new Error('unexpected')
    const r3 = completeStep(basicFlow, r2.progress, 'roles', 'actor-1')
    if (!r3.ok) throw new Error('unexpected')

    const blockers = getBlockers(basicFlow, r3.progress)
    expect(blockers).toHaveLength(0)
  })
})

// ── isFlowComplete ──────────────────────────────────────────────────────────

describe('isFlowComplete', () => {
  it('returns false for empty progress', () => {
    expect(isFlowComplete(basicFlow, emptyProgress)).toBe(false)
  })

  it('returns true when all required steps done (optional can be skipped)', () => {
    let progress = emptyProgress
    for (const name of ['org_info', 'people', 'roles']) {
      const r = completeStep(basicFlow, progress, name, 'actor-1')
      if (!r.ok) throw new Error(`Step ${name} failed`)
      progress = r.progress
    }
    expect(isFlowComplete(basicFlow, progress)).toBe(true)
  })
})

// ── validateFlow ────────────────────────────────────────────────────────────

describe('validateFlow', () => {
  it('validates a correct flow', () => {
    expect(validateFlow(basicFlow)).toHaveLength(0)
  })

  it('catches missing id', () => {
    const errors = validateFlow({ id: '', displayName: 'X', steps: [{ name: 'a', displayName: 'A', required: true }] })
    expect(errors).toContain('Flow must have an id')
  })

  it('catches empty steps', () => {
    const errors = validateFlow({ id: 'x', displayName: 'X', steps: [] })
    expect(errors).toContain('Flow must have at least one step')
  })

  it('catches duplicate step names', () => {
    const errors = validateFlow({
      id: 'x',
      displayName: 'X',
      steps: [
        { name: 'a', displayName: 'A', required: true },
        { name: 'a', displayName: 'B', required: false },
      ],
    })
    expect(errors.some((e) => e.includes('Duplicate'))).toBe(true)
  })

  it('catches unknown dependency', () => {
    const errors = validateFlow({
      id: 'x',
      displayName: 'X',
      steps: [
        { name: 'a', displayName: 'A', required: true, dependsOn: ['unknown'] },
      ],
    })
    expect(errors.some((e) => e.includes('unknown step'))).toBe(true)
  })

  it('catches missing required steps', () => {
    const errors = validateFlow({
      id: 'x',
      displayName: 'X',
      steps: [
        { name: 'a', displayName: 'A', required: false },
      ],
    })
    expect(errors).toContain('Flow must have at least one required step')
  })
})
