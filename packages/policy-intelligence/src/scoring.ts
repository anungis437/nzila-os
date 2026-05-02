import type { DecisionAggregate } from '@nzila/decision-intelligence'
import type { PolicyScore } from './types'

export function scorePolicy(input: {
  decisionType: string
  policyVersion: string
  aggregates: DecisionAggregate[]
}): PolicyScore {
  const matching = input.aggregates.filter(
    (aggregate) => aggregate.decisionType === input.decisionType && aggregate.policy.version === input.policyVersion,
  )

  const total = matching.reduce((sum, aggregate) => sum + aggregate.metrics.total, 0)
  const weighted = matching.reduce(
    (sum, aggregate) => ({
      approvals: sum.approvals + aggregate.metrics.approvalRate * aggregate.metrics.total,
      rejections: sum.rejections + aggregate.metrics.rejectionRate * aggregate.metrics.total,
      escalations: sum.escalations + aggregate.metrics.escalationRate * aggregate.metrics.total,
      overrides: sum.overrides + aggregate.behavior.overrideRate * aggregate.metrics.total,
      interventions: sum.interventions + aggregate.behavior.humanInterventionRate * aggregate.metrics.total,
      effectiveness: sum.effectiveness + aggregate.policy.effectivenessScore * aggregate.metrics.total,
    }),
    { approvals: 0, rejections: 0, escalations: 0, overrides: 0, interventions: 0, effectiveness: 0 },
  )

  if (total === 0) {
    return {
      decisionType: input.decisionType,
      policyVersion: input.policyVersion,
      successRate: 0,
      disputeRate: 0,
      overrideRate: 0,
      escalationRate: 0,
      humanInterventionRate: 0,
      effectivenessScore: 0,
    }
  }

  return {
    decisionType: input.decisionType,
    policyVersion: input.policyVersion,
    successRate: Number((weighted.approvals / total).toFixed(4)),
    disputeRate: Number((weighted.rejections / total).toFixed(4)),
    overrideRate: Number((weighted.overrides / total).toFixed(4)),
    escalationRate: Number((weighted.escalations / total).toFixed(4)),
    humanInterventionRate: Number((weighted.interventions / total).toFixed(4)),
    effectivenessScore: Number((weighted.effectiveness / total).toFixed(4)),
  }
}