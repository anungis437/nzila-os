import type { OverrideSignal, PolicyContext, PolicyDecision } from './types'

export interface OverrideSignalSummary {
  overrideRateByPolicyId: Record<string, number>
  overrideClustersByActorOrg: Record<string, number>
  anomalySignals: OverrideSignal[]
}

function isOverride(decision: PolicyDecision): boolean {
  return decision.level === 'CHALLENGE' || decision.requiresApproval === true
}

export function buildOverrideSignals(
  context: PolicyContext,
  decisions: PolicyDecision[],
): OverrideSignalSummary {
  const total = decisions.length
  const overrideDecisions = decisions.filter(isOverride)
  const overrideRateByPolicyId: Record<string, number> = {}

  for (const decision of decisions) {
    const previousRate = overrideRateByPolicyId[decision.policyId] ?? 0
    if (isOverride(decision)) {
      overrideRateByPolicyId[decision.policyId] = previousRate + 1
    } else {
      overrideRateByPolicyId[decision.policyId] = previousRate
    }
  }

  const divisor = Math.max(total, 1)
  for (const policyId of Object.keys(overrideRateByPolicyId)) {
    overrideRateByPolicyId[policyId] = Number((((overrideRateByPolicyId[policyId] ?? 0) / divisor)).toFixed(4))
  }

  const actorOrgKey = `${context.actor.id}:${context.actor.orgId}`
  const clusterCount = context.metadata.overrideHistory.filter(
    (entry) => entry.actorId === context.actor.id,
  ).length

  const anomalySignals: OverrideSignal[] = []
  for (const [policyId, rate] of Object.entries(overrideRateByPolicyId)) {
    if (rate >= 0.75) {
      anomalySignals.push({
        signal: 'POLICY_TOO_STRICT',
        policyId,
        severity: 'high',
        reason: 'High override rate suggests policy friction.',
        actorId: context.actor.id,
        orgId: context.actor.orgId,
        metadata: { rate },
      })
    }
    if (rate <= 0.05 && total >= 5) {
      anomalySignals.push({
        signal: 'POLICY_TOO_WEAK',
        policyId,
        severity: 'medium',
        reason: 'Near-zero override rate suggests over-permissive policy behavior.',
        actorId: context.actor.id,
        orgId: context.actor.orgId,
        metadata: { rate },
      })
    }
  }

  if (context.metadata.anomalyScore >= 0.8 && overrideDecisions.length >= 1) {
    anomalySignals.push({
      signal: 'SUSPICIOUS_OVERRIDE_PATTERN',
      policyId: overrideDecisions[0]?.policyId ?? 'system.override_cluster',
      severity: 'critical',
      reason: 'High anomaly score combined with override behavior detected.',
      actorId: context.actor.id,
      orgId: context.actor.orgId,
      metadata: {
        anomalyScore: context.metadata.anomalyScore,
        overrideDecisions: overrideDecisions.length,
        overrideHistoryCount: context.metadata.overrideHistory.length,
      },
    })
  }

  return {
    overrideRateByPolicyId,
    overrideClustersByActorOrg: {
      [actorOrgKey]: clusterCount,
    },
    anomalySignals,
  }
}
