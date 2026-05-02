import type { PolicyInsight, PolicySuggestionRequest } from './types'
import { scorePolicy } from './scoring'

export function suggestPolicyImprovements(input: PolicySuggestionRequest): PolicyInsight {
  const latest = [...input.aggregates]
    .filter((aggregate) => aggregate.decisionType === input.decisionType)
    .sort((left, right) => right.timeWindow.end.localeCompare(left.timeWindow.end))[0]

  const version = latest?.policy.version ?? 'unknown'
  const score = scorePolicy({
    decisionType: input.decisionType,
    policyVersion: version,
    aggregates: input.aggregates,
  })

  const issues: string[] = []
  const recommendations: string[] = []

  if (score.overrideRate >= 0.15) {
    issues.push('Override rate is elevated relative to expected automated stability.')
    recommendations.push('Tighten thresholds that trigger manual reversals and add pre-escalation review checks.')
  }
  if (score.escalationRate >= 0.1) {
    issues.push('Escalation volume suggests the policy is under-specifying safe automatic outcomes.')
    recommendations.push('Add escalation triggers earlier in the workflow and split ambiguous cases into narrower rule bands.')
  }
  if (score.humanInterventionRate >= 0.25) {
    issues.push('Human intervention dependency is too high for a compounding decision system.')
    recommendations.push('Shift repeat operator actions into explicit policy rules and approval templates.')
  }
  if (score.successRate <= 0.55) {
    issues.push('Approval success rate is low enough to indicate overly restrictive policy logic.')
    recommendations.push('Relax threshold bands or add context-sensitive exception rules for high-confidence inputs.')
  }
  if (recommendations.length === 0) {
    recommendations.push('Current policy is stable; prioritize throughput improvements and benchmark expansion instead of threshold changes.')
  }

  return {
    policyId: input.decisionType,
    version,
    issues,
    recommendations,
    confidenceScore: Number((Math.min(0.98, Math.max(0.4, score.effectivenessScore + 0.2))).toFixed(2)),
  }
}