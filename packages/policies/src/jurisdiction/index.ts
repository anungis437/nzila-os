import type { PolicyContext, PolicyDecision } from '../core/types'

export interface JurisdictionResolution {
  jurisdiction: string
  modifiers: string[]
}

const ORG_JURISDICTION_MAP: Record<string, string> = {
  ontario: 'Ontario',
  canada: 'Canada',
}

export function resolveJurisdiction(context: PolicyContext): JurisdictionResolution {
  const actorJurisdiction = context.actor.jurisdiction?.trim()
  if (actorJurisdiction) {
    return { jurisdiction: actorJurisdiction, modifiers: [] }
  }

  const orgId = context.actor.orgId.toLowerCase()
  const mapped = Object.entries(ORG_JURISDICTION_MAP).find(([key]) => orgId.includes(key))?.[1]
  return {
    jurisdiction: mapped ?? 'Global',
    modifiers: [],
  }
}

function escalateDecisionLevel(level: PolicyDecision['level']): PolicyDecision['level'] {
  if (level === 'ALLOW') return 'WARN'
  if (level === 'WARN') return 'CHALLENGE'
  return level
}

export function applyJurisdictionModifiers(
  context: PolicyContext,
  decisions: PolicyDecision[],
): PolicyDecision[] {
  const { jurisdiction } = resolveJurisdiction(context)
  const isSensitiveDataAction =
    context.action.sensitivity === 'high' ||
    context.action.sensitivity === 'critical' ||
    context.action.type.includes('export') ||
    context.action.type.includes('share')

  return decisions.map((decision) => {
    if (decision.level === 'BLOCK') {
      return decision
    }

    if (jurisdiction === 'Canada' && isSensitiveDataAction) {
      return {
        ...decision,
        level: escalateDecisionLevel(decision.level),
        reason: `${decision.reason} | PIPEDA safeguard escalation applied.`,
        auditSeverity: decision.auditSeverity === 'low' ? 'medium' : decision.auditSeverity,
      }
    }

    if (jurisdiction === 'Ontario' && context.action.type.includes('foi')) {
      return {
        ...decision,
        level: escalateDecisionLevel(decision.level),
        requiresJustification: true,
        reason: `${decision.reason} | FIPPA disclosure control applied.`,
        auditSeverity: decision.auditSeverity === 'low' ? 'medium' : decision.auditSeverity,
      }
    }

    return decision
  })
}
