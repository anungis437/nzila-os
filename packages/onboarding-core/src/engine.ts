/**
 * @nzila/onboarding-core — Engine
 *
 * Pure-logic onboarding engine. No I/O, no DB, no side effects.
 * Given a flow definition and current progress, computes
 * next state and derived summaries.
 *
 * @module @nzila/onboarding-core/engine
 */
import type {
  OnboardingFlowDef,
  OnboardingProgress,
  OnboardingStatus,
  ProgressSummary,
  StepCompletion,
  StepResult,
} from './types'

// ── Progress Evaluation ─────────────────────────────────────────────────────

/**
 * Derive the overall status from progress against a flow.
 */
export function deriveStatus(
  flow: OnboardingFlowDef,
  progress: OnboardingProgress,
): OnboardingStatus {
  const completed = Object.keys(progress.completions)
  if (completed.length === 0) return 'not_started'

  const allRequiredDone = flow.steps
    .filter((s) => s.required)
    .every((s) => completed.includes(s.name))

  if (allRequiredDone) return 'completed'

  // Check for blockers: any required step whose dependencies are met but has a failing canStart
  const hasBlocker = flow.steps.some((s) => {
    if (!s.required || completed.includes(s.name)) return false
    if (s.canStart) {
      const bag = progress.completions[s.name]?.data ?? {}
      return !s.canStart(bag)
    }
    return false
  })

  return hasBlocker ? 'blocked' : 'in_progress'
}

/**
 * Get a full progress summary.
 */
export function evaluateProgress(
  flow: OnboardingFlowDef,
  progress: OnboardingProgress,
): ProgressSummary {
  const completed = new Set(Object.keys(progress.completions))
  const required = flow.steps.filter((s) => s.required)
  const optional = flow.steps.filter((s) => !s.required)

  const requiredDone = required.filter((s) => completed.has(s.name)).length
  const optionalDone = optional.filter((s) => completed.has(s.name)).length

  const totalSteps = flow.steps.length
  const completedSteps = requiredDone + optionalDone
  const requiredRemaining = required.length - requiredDone
  const optionalRemaining = optional.length - optionalDone

  const percent = totalSteps > 0 ? Math.round((completedSteps / totalSteps) * 100) : 100

  const nextStep = findNextStep(flow, progress)
  const blockers = getBlockers(flow, progress)
  const status = deriveStatus(flow, progress)

  return {
    flowId: flow.id,
    orgId: progress.orgId,
    status,
    totalSteps,
    completedSteps,
    requiredRemaining,
    optionalRemaining,
    percentComplete: percent,
    nextStep,
    blockers,
  }
}

// ── Step Completion ─────────────────────────────────────────────────────────

export type CompleteStepFailure =
  | 'step_not_found'
  | 'already_completed'
  | 'dependencies_not_met'
  | 'validation_failed'
  | 'cannot_start'

export type CompleteStepResult =
  | { ok: true; progress: OnboardingProgress; result: StepResult }
  | { ok: false; code: CompleteStepFailure }

/**
 * Attempt to mark a step as completed.
 * Returns a new progress object (immutable) or an error code.
 */
export function completeStep(
  flow: OnboardingFlowDef,
  progress: OnboardingProgress,
  stepName: string,
  actorId: string,
  data: Record<string, unknown> = {},
): CompleteStepResult {
  const stepDef = flow.steps.find((s) => s.name === stepName)
  if (!stepDef) return { ok: false, code: 'step_not_found' }

  if (progress.completions[stepName]) {
    return { ok: false, code: 'already_completed' }
  }

  // Check dependencies
  const completed = new Set(Object.keys(progress.completions))
  if (stepDef.dependsOn?.some((dep) => !completed.has(dep))) {
    return { ok: false, code: 'dependencies_not_met' }
  }

  // Check canStart predicate
  if (stepDef.canStart && !stepDef.canStart(data)) {
    return { ok: false, code: 'cannot_start' }
  }

  // Validate step data
  if (stepDef.validate && !stepDef.validate(data)) {
    return { ok: false, code: 'validation_failed' }
  }

  const completion: StepCompletion = {
    stepName,
    completedAt: new Date().toISOString(),
    completedBy: actorId,
    data,
  }

  const newCompletions = { ...progress.completions, [stepName]: completion }
  const newProgress: OnboardingProgress = {
    ...progress,
    completions: newCompletions,
    status: 'in_progress', // will be re-derived
  }

  // Re-derive status after mutation
  const status = deriveStatus(flow, newProgress)

  const finalProgress: OnboardingProgress = {
    ...newProgress,
    status,
  }

  return {
    ok: true,
    progress: finalProgress,
    result: { stepName, outcome: 'completed' },
  }
}

// ── Step Reset ──────────────────────────────────────────────────────────────

export type ResetStepResult =
  | { ok: true; progress: OnboardingProgress }
  | { ok: false; code: 'step_not_found' | 'not_completed' | 'has_dependents' }

/**
 * Undo a completed step (e.g., user wants to redo it).
 * Fails if other completed steps depend on this one.
 */
export function resetStep(
  flow: OnboardingFlowDef,
  progress: OnboardingProgress,
  stepName: string,
): ResetStepResult {
  const stepDef = flow.steps.find((s) => s.name === stepName)
  if (!stepDef) return { ok: false, code: 'step_not_found' }

  if (!progress.completions[stepName]) {
    return { ok: false, code: 'not_completed' }
  }

  // Check if any completed step depends on this one
  const completed = new Set(Object.keys(progress.completions))
  const hasDependent = flow.steps.some(
    (s) => completed.has(s.name) && s.dependsOn?.includes(stepName),
  )
  if (hasDependent) return { ok: false, code: 'has_dependents' }

  const { [stepName]: _removed, ...remaining } = progress.completions
  const newProgress: OnboardingProgress = {
    ...progress,
    completions: remaining,
    status: 'in_progress',
  }

  return {
    ok: true,
    progress: { ...newProgress, status: deriveStatus(flow, newProgress) },
  }
}

// ── Query Helpers ───────────────────────────────────────────────────────────

/**
 * Find the next uncompleted step (respecting dependency order).
 */
export function findNextStep(
  flow: OnboardingFlowDef,
  progress: OnboardingProgress,
): string | null {
  const completed = new Set(Object.keys(progress.completions))

  for (const step of flow.steps) {
    if (completed.has(step.name)) continue
    // All dependencies met?
    const depsOk = !step.dependsOn || step.dependsOn.every((d) => completed.has(d))
    if (depsOk) return step.name
  }

  return null
}

/**
 * Get required steps that are blocked (deps not met or canStart fails).
 */
export function getBlockers(
  flow: OnboardingFlowDef,
  progress: OnboardingProgress,
): readonly string[] {
  const completed = new Set(Object.keys(progress.completions))

  return flow.steps
    .filter((s) => s.required && !completed.has(s.name))
    .filter((s) => {
      if (s.dependsOn?.some((d) => !completed.has(d))) return true
      if (s.canStart) {
        const bag = progress.completions[s.name]?.data ?? {}
        return !s.canStart(bag)
      }
      return false
    })
    .map((s) => s.name)
}

/**
 * Check if a flow is fully complete (all required steps done).
 */
export function isFlowComplete(
  flow: OnboardingFlowDef,
  progress: OnboardingProgress,
): boolean {
  return deriveStatus(flow, progress) === 'completed'
}

// ── Flow Validation ─────────────────────────────────────────────────────────

/**
 * Validate a flow definition for structural correctness.
 */
export function validateFlow(flow: OnboardingFlowDef): readonly string[] {
  const errors: string[] = []

  if (!flow.id) errors.push('Flow must have an id')
  if (flow.steps.length === 0) errors.push('Flow must have at least one step')

  const names = new Set<string>()
  for (const step of flow.steps) {
    if (names.has(step.name)) {
      errors.push(`Duplicate step name: ${step.name}`)
    }
    names.add(step.name)

    for (const dep of step.dependsOn ?? []) {
      if (!names.has(dep)) {
        errors.push(`Step "${step.name}" depends on unknown step "${dep}"`)
      }
    }
  }

  // Must have at least one required step
  if (!flow.steps.some((s) => s.required)) {
    errors.push('Flow must have at least one required step')
  }

  return errors
}

// ── Factory ─────────────────────────────────────────────────────────────────

/**
 * Create an empty progress for a new org starting a flow.
 */
export function createProgress(orgId: string, flowId: string): OnboardingProgress {
  return {
    orgId,
    flowId,
    completions: {},
    status: 'not_started',
    startedAt: new Date().toISOString(),
  }
}
