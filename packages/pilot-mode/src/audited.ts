/**
 * @nzila/pilot-mode — Audited Wrapper
 *
 * Wraps pilot flag operations with os-core's auditedAction
 * for full audit trail of flag changes and evaluations.
 *
 * @module @nzila/pilot-mode/audited
 */
import { auditedAction } from '@nzila/os-core'
import type { PilotFlagDef, PilotContext, PilotEvaluation, PilotCohort, PilotRecord } from './types'
import { evaluatePilotFlag } from './engine'

/**
 * Evaluate a pilot flag with audit trail.
 *
 * Useful for gating material actions — the evaluation itself
 * is recorded for audit/compliance purposes.
 */
export async function auditedPilotEvaluation(
  flag: PilotFlagDef,
  context: PilotContext,
  actorId: string,
  orgId: string,
  cohorts?: ReadonlyMap<string, PilotCohort>,
): Promise<{ evaluation: PilotEvaluation; record: PilotRecord }> {
  const auditResult = await auditedAction(
    {
      actionType: `pilot.flag.evaluate.${flag.name}`,
      orgId,
      userId: actorId,
      metadata: {
        flagName: flag.name,
        strategy: flag.strategy,
        context,
      },
    },
    async (ctx) => {
      const evaluation = evaluatePilotFlag(flag, context, cohorts)

      ctx.addArtifact(
        'pilot_flag_evaluation',
        Buffer.from(JSON.stringify(evaluation)),
        'application/json',
      )

      return evaluation
    },
  )

  const evaluation = auditResult.data

  const record: PilotRecord = {
    id: crypto.randomUUID(),
    flagName: flag.name,
    orgId: context.orgId,
    userId: context.userId,
    enabled: evaluation.enabled,
    reason: evaluation.reason,
    timestamp: new Date().toISOString(),
  }

  return { evaluation, record }
}
