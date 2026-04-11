/**
 * @nzila/onboarding-core — Audited Wrapper
 *
 * Wraps engine operations with os-core's auditedAction
 * for full audit trail of every onboarding step.
 *
 * @module @nzila/onboarding-core/audited
 */
import { auditedAction } from '@nzila/os-core'
import type { OnboardingFlowDef, OnboardingProgress, OnboardingRecord, StepResult } from './types'
import { completeStep, type CompleteStepResult } from './engine'

/**
 * Complete an onboarding step with full audit trail.
 *
 * Wraps the pure engine `completeStep` in an `auditedAction`
 * so every step completion produces an auditable record.
 */
export async function executeOnboardingStep(
  flow: OnboardingFlowDef,
  progress: OnboardingProgress,
  stepName: string,
  actorId: string,
  orgId: string,
  data: Record<string, unknown> = {},
): Promise<{ result: CompleteStepResult; record: OnboardingRecord }> {
  const record = await auditedAction(
    {
      actionType: `onboarding.step.${stepName}`,
      orgId,
      userId: actorId,
      metadata: {
        flowId: flow.id,
        stepName,
        data,
      },
    },
    async (ctx) => {
      const engineResult = completeStep(flow, progress, stepName, actorId, data)

      if (engineResult.ok) {
        ctx.addArtifact(
          'onboarding_step_completion',
          Buffer.from(JSON.stringify(engineResult.result)),
          'application/json',
        )
      }

      return engineResult
    },
  )

  const stepResult: StepResult = record.data.ok
    ? record.data.result
    : { stepName, outcome: 'failed', reason: record.data.code }

  const onboardingRecord: OnboardingRecord = {
    id: crypto.randomUUID(),
    orgId,
    flowId: flow.id,
    stepName,
    outcome: stepResult.outcome,
    actorId,
    timestamp: new Date().toISOString(),
    data,
  }

  return { result: record.data, record: onboardingRecord }
}
