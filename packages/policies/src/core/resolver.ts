import type {
  PolicyDecision,
  PolicyDecisionLevel,
  PolicyResolution,
  PolicyTraceEntry,
} from './types'

const LEVEL_ORDER: Record<PolicyDecisionLevel, number> = {
  ALLOW: 0,
  WARN: 1,
  CHALLENGE: 2,
  BLOCK: 3,
}

const SEVERITY_ORDER = {
  low: 0,
  medium: 1,
  high: 2,
  critical: 3,
} as const

function mergeLevelDecisions(decisions: PolicyDecision[]): PolicyDecision {
  const reasons = decisions.map((decision) => decision.reason)
  const versions = [...new Set(decisions.map((decision) => decision.policyVersion))]
  const requiresApproval = decisions.some((decision) => decision.requiresApproval)
  const requiresJustification = decisions.some((decision) => decision.requiresJustification)
  const highestSeverity = decisions.reduce((current, decision) => {
    if (SEVERITY_ORDER[decision.auditSeverity] > SEVERITY_ORDER[current]) {
      return decision.auditSeverity
    }
    return current
  }, decisions[0]?.auditSeverity ?? 'low')

  return {
    level: decisions[0]?.level ?? 'ALLOW',
    reason: reasons.join(' | '),
    policyId: decisions.map((decision) => decision.policyId).join(','),
    policyVersion: versions.join(','),
    auditSeverity: highestSeverity,
    requiresApproval,
    requiresJustification,
  }
}

export function resolvePolicyDecisions(decisions: PolicyDecision[]): PolicyResolution {
  const trace: PolicyTraceEntry[] = decisions.map((decision) => ({
    policyId: decision.policyId,
    policyVersion: decision.policyVersion,
    level: decision.level,
    reason: decision.reason,
    auditSeverity: decision.auditSeverity,
    requiresApproval: Boolean(decision.requiresApproval),
    requiresJustification: Boolean(decision.requiresJustification),
  }))

  if (decisions.length === 0) {
    return {
      finalDecision: {
        level: 'ALLOW',
        reason: 'No matching policies returned a decision.',
        policyId: 'system.default_allow',
        policyVersion: 'v1',
        auditSeverity: 'low',
      },
      explanationTrace: trace,
    }
  }

  const topLevel = decisions.reduce((current, decision) => {
    return LEVEL_ORDER[decision.level] > LEVEL_ORDER[current] ? decision.level : current
  }, 'ALLOW' as PolicyDecisionLevel)

  const atTopLevel = decisions.filter((decision) => decision.level === topLevel)
  const finalDecision = mergeLevelDecisions(atTopLevel)

  return {
    finalDecision,
    explanationTrace: trace,
  }
}
