import {
  evaluatePolicies,
  evaluatePoliciesWithResolution,
  type EvaluatePoliciesResult,
} from './core/engine'
import type {
  LegacyPolicyContext,
  PolicyContext,
  PolicyDecisionLevel,
  PolicyEvaluation,
} from './types'

export * from './types'
export * from './stress'
export * from './core/engine'
export * from './core/resolver'
export * from './core/signals'
export * from './jurisdiction'

export { labourRules } from './labour/rules'
export { legalRules } from './legal/rules'
export { commerceRules } from './commerce/rules'
export { mediaRightsRules } from './media-rights/rules'
export * from './ai-safety-policy'
export * from './enforce-ai-safety'

function mapEnvironment(value: LegacyPolicyContext['environment']): string {
  if (value === 'dev') return 'development'
  if (value === 'staging') return 'staging'
  return 'production'
}

export function toPolicyContext(context: Partial<LegacyPolicyContext>): PolicyContext {
  const payload = context.payload ?? {}
  const sensitivity = String(payload['sensitivity'] ?? 'medium')
  return {
    actor: {
      id: context.actorId ?? 'unknown-actor',
      role: context.actorRole ?? 'viewer',
      orgId: context.orgId ?? 'unknown-org',
      jurisdiction: undefined,
    },
    action: {
      type: context.action ?? 'unknown.action',
      resource: context.resource ?? 'unknown.resource',
      sensitivity: (['low', 'medium', 'high', 'critical'].includes(sensitivity)
        ? sensitivity
        : 'medium') as PolicyContext['action']['sensitivity'],
    },
    metadata: {
      previousActions: Array.isArray(payload['previousActions'])
        ? (payload['previousActions'] as string[])
        : [],
      anomalyScore: Number(payload['anomalyScore'] ?? 0),
      overrideHistory: Array.isArray(payload['overrideHistory'])
        ? (payload['overrideHistory'] as PolicyContext['metadata']['overrideHistory'])
        : [],
      sessionId: String(payload['sessionId'] ?? 'session-unknown'),
    },
    environment: {
      app: String(payload['app'] ?? 'unknown-app'),
      timestamp: new Date().toISOString(),
    },
    domain: context.domain,
    payload: {
      ...payload,
      policyVersion: context.policyVersion,
      overrideReason: context.overrideReason,
      ticketRef: context.ticketRef,
      environment: mapEnvironment(context.environment ?? 'production'),
    },
  }
}

function decisionToLegacyFindings(result: EvaluatePoliciesResult): PolicyEvaluation['findings'] {
  return result.decisions.map((decision) => {
    const isBlocking = decision.level === 'BLOCK'
    return {
      ruleId: decision.policyId,
      severity: decision.auditSeverity,
      passed: !isBlocking,
      reason: decision.reason,
      canOverride: decision.level !== 'BLOCK',
    }
  })
}

function isBlockedLevel(level: PolicyDecisionLevel): boolean {
  return level === 'BLOCK'
}

function isChallengeLevel(level: PolicyDecisionLevel): boolean {
  return level === 'CHALLENGE'
}

export function evaluateDomainPolicies(context: Partial<LegacyPolicyContext>): PolicyEvaluation {
  const normalizedDomain = (context.domain ?? 'commerce') as PolicyEvaluation['domain']
  const normalizedAction = context.action ?? 'unknown.action'
  const normalizedResource = context.resource ?? 'unknown.resource'
  const normalizedActorId = context.actorId ?? 'unknown-actor'
  const normalizedActorRole = context.actorRole ?? 'viewer'
  const normalizedOrgId = context.orgId ?? 'unknown-org'
  const result = evaluatePoliciesWithResolution(toPolicyContext(context))
  const blocked = isBlockedLevel(result.resolution.finalDecision.level)
  const requiresOverride = isChallengeLevel(result.resolution.finalDecision.level)

  return {
    domain: normalizedDomain,
    action: normalizedAction,
    resource: normalizedResource,
    blocked,
    requiresOverride,
    findings: decisionToLegacyFindings(result),
    auditRecord: {
      at: new Date().toISOString(),
      actorId: normalizedActorId,
      actorRole: normalizedActorRole,
      orgId: normalizedOrgId,
      domain: normalizedDomain,
      action: normalizedAction,
      resource: normalizedResource,
      blocked,
      requiresOverride,
      overrideReason: context.overrideReason,
      ticketRef: context.ticketRef,
      finalDecisionLevel: result.resolution.finalDecision.level,
    },
  }
}

export { evaluatePolicies }
