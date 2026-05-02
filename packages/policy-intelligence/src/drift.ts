import type { DecisionAggregate } from '@nzila/decision-intelligence'
import type { PolicyDriftResult } from './types'
import { scorePolicy } from './scoring'

function severityFromMagnitude(magnitude: number): PolicyDriftResult['severity'] {
  if (magnitude >= 0.2) return 'high'
  if (magnitude >= 0.08) return 'medium'
  return 'low'
}

export function detectPolicyDrift(input: {
  decisionType: string
  oldVersion: string
  newVersion: string
  aggregates: DecisionAggregate[]
}): PolicyDriftResult {
  const baseline = scorePolicy({
    decisionType: input.decisionType,
    policyVersion: input.oldVersion,
    aggregates: input.aggregates,
  })
  const candidate = scorePolicy({
    decisionType: input.decisionType,
    policyVersion: input.newVersion,
    aggregates: input.aggregates,
  })

  const deltas = {
    effectivenessScore: Number((candidate.effectivenessScore - baseline.effectivenessScore).toFixed(4)),
    approvalRate: Number((candidate.successRate - baseline.successRate).toFixed(4)),
    overrideRate: Number((candidate.overrideRate - baseline.overrideRate).toFixed(4)),
    escalationRate: Number((candidate.escalationRate - baseline.escalationRate).toFixed(4)),
  }
  const magnitude = Math.max(
    Math.abs(deltas.effectivenessScore),
    Math.abs(deltas.approvalRate),
    Math.abs(deltas.overrideRate),
    Math.abs(deltas.escalationRate),
  )

  return {
    decisionType: input.decisionType,
    oldVersion: input.oldVersion,
    newVersion: input.newVersion,
    driftDetected: magnitude >= 0.05,
    deltas,
    severity: severityFromMagnitude(magnitude),
  }
}