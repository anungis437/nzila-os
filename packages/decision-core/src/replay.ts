import { enforceDecision } from './enforceDecision'
import { getDecisionType } from './registry'
import type { DecisionDriftResult, ReplayDecisionRequest, ReplayDecisionResult } from './types'

export async function replayDecision(request: ReplayDecisionRequest): Promise<ReplayDecisionResult> {
  const entry = getDecisionType(request.decisionType)
  if (!entry) {
    throw new Error(`Cannot replay unregistered decision type: ${request.decisionType}`)
  }

  const replayed = await enforceDecision({
    decisionType: request.decisionType,
    organizationId: request.organizationId,
    resourceId: request.resourceId,
    actor: request.actor,
    authorityScope: request.authorityScope,
    input: request.input,
    policy: {
      id: entry.requiredPolicy,
      version: request.policyVersion,
      domain: entry.domain,
    },
    now: request.now,
  })

  return {
    replayed,
    matchedPolicyId: entry.requiredPolicy,
  }
}

export function detectDecisionDrift(args: {
  baseline: ReplayDecisionResult
  candidate: ReplayDecisionResult
}): DecisionDriftResult {
  const baselineOutcome = args.baseline.replayed.decision.outcome
  const candidateOutcome = args.candidate.replayed.decision.outcome

  return {
    drifted:
      baselineOutcome.status !== candidateOutcome.status ||
      baselineOutcome.reasonCode !== candidateOutcome.reasonCode,
    baselineStatus: baselineOutcome.status,
    candidateStatus: candidateOutcome.status,
    baselineReasonCode: baselineOutcome.reasonCode,
    candidateReasonCode: candidateOutcome.reasonCode,
  }
}
