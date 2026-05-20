export const DECISION_DOMAINS = [
  'labour',
  'legal',
  'commerce',
  'media',
  'education',
  'health',
  'platform',
] as const

export type DecisionDomain = (typeof DECISION_DOMAINS)[number]
export type DecisionActorType = 'user' | 'system' | 'api'
export type DecisionOutcomeStatus = 'approved' | 'rejected' | 'pending' | 'escalated'
export type DecisionGapLevel = 'none' | 'minor' | 'major' | 'blocker'

export type DecisionInput = unknown

export type DecisionActor = {
  id: string
  type: DecisionActorType
  role?: string
  authorityScope?: readonly string[]
}

export type DecisionAuthority = {
  required: readonly string[]
  granted: readonly string[]
  missing: readonly string[]
  valid: boolean
}

export type DecisionPolicyRef = {
  id: string
  version: string
  domain: string
}

export type DecisionOutcome = {
  status: DecisionOutcomeStatus
  reasonCode?: string
  explanationTrace?: string[]
}

export type DecisionEnforcementLevel = 'warn' | 'block'

export type DecisionProof = {
  auditRecordId?: string
  hash?: string
  signature?: string
  previousHash?: string
  verified?: boolean
}

export type DecisionRecord = {
  id: string
  organizationId: string
  domain: DecisionDomain
  resourceType: string
  resourceId: string
  actor: DecisionActor
  input: DecisionInput
  policy: DecisionPolicyRef
  outcome: DecisionOutcome
  proof?: DecisionProof
  createdAt: string
}

export type DecisionRegistryEntry = {
  type: string
  domain: DecisionDomain
  resourceType: string
  requiredAuthority: readonly string[]
  requiredPolicy: string
  /**
   * Optional allow-list of accepted `policy.version` values. When present,
   * `enforceDecision` rejects requests whose `policy.version` is not in the
   * list with `POLICY_VERSION_NOT_ALLOWED`. Leave undefined to accept any
   * well-formed (semver or ISO-date) version — useful during early
   * iteration before policy versions are pinned.
   */
  allowedPolicyVersions?: readonly string[]
  auditRequired: boolean
  replaySupported: boolean
  exportSupported: boolean
  retentionClass: string
  requiredInputFields?: readonly string[]
  narCompatible?: boolean
  proofRequired?: boolean
  enforcementLevel?: DecisionEnforcementLevel
}

export type DecisionProofAdapterRequest = {
  decisionType: string
  actionType: string
  entry: DecisionRegistryEntry
}

export type DecisionProofAdapter = {
  createProof: (decision: DecisionRecord, context: DecisionProofAdapterRequest) => Promise<DecisionProof>
}

export type DecisionEvaluationResult = {
  allowed: boolean
  decisionType: string
  decision: DecisionRecord
  authority: DecisionAuthority
  policyValid: boolean
  missingInputFields: readonly string[]
  auditPayload?: {
    narCompatible: boolean
    decisionType: string
    organizationId: string
    resourceType: string
    resourceId: string
    retentionClass: string
    proof?: DecisionProof
    record: DecisionRecord
  }
}

export type EnforceDecisionRequest = {
  decisionType: string
  organizationId: string
  resourceId: string
  actor: DecisionActor
  input: Record<string, unknown>
  policy: DecisionPolicyRef
  authorityScope?: readonly string[]
  auditRecordId?: string
  previousHash?: string
  signature?: string
  emitAuditPayload?: boolean
  actionType?: string
  proofAdapter?: DecisionProofAdapter
  unregisteredEnforcementLevel?: DecisionEnforcementLevel
  now?: string
}

export type ReplayDecisionRequest = {
  decisionType: string
  organizationId: string
  resourceId: string
  actor: DecisionActor
  input: Record<string, unknown>
  authorityScope?: readonly string[]
  policyVersion: string
  now?: string
}

export type ReplayDecisionResult = {
  replayed: DecisionEvaluationResult
  matchedPolicyId: string
}

export type DecisionDriftResult = {
  drifted: boolean
  baselineStatus: DecisionOutcomeStatus
  candidateStatus: DecisionOutcomeStatus
  baselineReasonCode?: string
  candidateReasonCode?: string
}