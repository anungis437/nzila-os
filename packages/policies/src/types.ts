import type { DomainName, PolicyAuditSeverity, PolicyDecisionLevel } from './core/types'

export type {
  ActionSensitivity,
  DomainName,
  DomainRule,
  OverrideSignal,
  PolicyAuditSeverity,
  PolicyContext,
  PolicyDecision,
  PolicyDecisionLevel,
  PolicyEnvironment,
  PolicyMetadata,
  PolicyResolution,
  PolicyTraceEntry,
} from './core/types'

export interface LegacyPolicyContext {
  orgId: string
  actorId: string
  actorRole: string
  domain: DomainName
  action: string
  resource: string
  payload?: Record<string, unknown>
  environment: 'dev' | 'staging' | 'production'
  policyVersion?: string
  overrideReason?: string
  ticketRef?: string
}

export interface PolicyEvaluation {
  domain: DomainName
  action: string
  resource: string
  blocked: boolean
  requiresOverride: boolean
  findings: Array<{
    ruleId: string
    severity: PolicyAuditSeverity
    passed: boolean
    reason: string
    canOverride: boolean
  }>
  auditRecord: {
    at: string
    actorId: string
    actorRole: string
    orgId: string
    domain: DomainName
    action: string
    resource: string
    blocked: boolean
    requiresOverride: boolean
    overrideReason?: string
    ticketRef?: string
    finalDecisionLevel?: PolicyDecisionLevel
  }
}
