export type DomainName = 'labour' | 'legal' | 'commerce' | 'media-rights'

export type PolicyDecisionLevel = 'ALLOW' | 'WARN' | 'CHALLENGE' | 'BLOCK'

export type PolicyAuditSeverity = 'low' | 'medium' | 'high' | 'critical'

export type ActionSensitivity = 'low' | 'medium' | 'high' | 'critical'

export interface PolicyActorContext {
  id: string
  role: string
  orgId: string
  jurisdiction?: string
}

export interface PolicyActionContext {
  type: string
  resource: string
  sensitivity: ActionSensitivity
}

export interface PolicyOverrideHistoryEntry {
  policyId: string
  at: string
  reason?: string
  actorId?: string
}

export interface PolicyMetadata {
  previousActions: string[]
  anomalyScore: number
  overrideHistory: PolicyOverrideHistoryEntry[]
  sessionId: string
}

export interface PolicyEnvironment {
  app: string
  timestamp: string
}

export interface PolicyContext {
  actor: PolicyActorContext
  action: PolicyActionContext
  metadata: PolicyMetadata
  environment: PolicyEnvironment
  domain?: DomainName
  payload?: Record<string, unknown>
}

export interface PolicyDecision {
  level: PolicyDecisionLevel
  reason: string
  policyId: string
  policyVersion: string
  auditSeverity: PolicyAuditSeverity
  requiresJustification?: boolean
  requiresApproval?: boolean
}

export interface PolicyTraceEntry {
  policyId: string
  policyVersion: string
  level: PolicyDecisionLevel
  reason: string
  auditSeverity: PolicyAuditSeverity
  requiresJustification: boolean
  requiresApproval: boolean
}

export interface PolicyResolution {
  finalDecision: PolicyDecision
  explanationTrace: PolicyTraceEntry[]
}

export interface OverrideSignal {
  signal: 'POLICY_TOO_STRICT' | 'POLICY_TOO_WEAK' | 'SUSPICIOUS_OVERRIDE_PATTERN'
  policyId: string
  severity: PolicyAuditSeverity
  reason: string
  actorId?: string
  orgId?: string
  metadata?: Record<string, unknown>
}

export interface DomainRule {
  id: string
  domain: DomainName
  evaluate: (context: PolicyContext) => PolicyDecision | null
}
