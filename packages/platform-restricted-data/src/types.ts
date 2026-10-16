/**
 * Platform Restricted-data control plane types.
 * Governance tiers are Public / Internal / Confidential / Restricted.
 * This is not the national-security scale in @nzila/os-core classification.
 */

export const EVIDENCE_CLASSES = [
  'CODE_PROVEN',
  'CONFIG_PROVEN',
  'RUNTIME_VERIFIED',
  'EXTERNAL_CONTRACT_VERIFIED',
  'UNVERIFIED',
] as const

export type EvidenceClass = (typeof EVIDENCE_CLASSES)[number]

export const PLATFORM_TIERS = ['PUBLIC', 'INTERNAL', 'CONFIDENTIAL', 'RESTRICTED'] as const
export type PlatformTier = (typeof PLATFORM_TIERS)[number]

export const UNLABELLED_DEFAULT_TIER: PlatformTier = 'INTERNAL'

export type ActorKind = 'principal' | 'service' | 'agent'

export interface Actor {
  kind: ActorKind
  id: string
  /** Principal the actor is operating for. Required for service and agent. */
  actingForPrincipalId?: string
}

export interface RestrictedRecord {
  id: string
  orgId: string
  principalId: string
  classification: 'RESTRICTED'
  category: string
  fields: Record<string, unknown>
  relationships: Array<{ type: string; targetId: string }>
  evidenceRefs: Array<{ type: string; refId: string }>
  jurisdiction: string
  decisions: Array<{ id: string; at: string; summary: string }>
  createdAt: string
}

export interface AccessGrant {
  id: string
  orgId: string
  principalId: string
  actorKind: 'service' | 'agent'
  actorId: string
  actions: Array<'read' | 'export'>
  purpose: string
  authorizationBasis: string
  disclosureProfile?: 'VERIFIER'
  expiresAt?: string
  grantedBy: string
  createdAt: string
}

export interface RestrictedAuditEvent {
  id: string
  at: string
  actorId: string
  serviceOrAgent: string
  action: string
  resourceId: string
  category: string
  orgId: string
  principalId: string
  purpose: string
  authorizationBasis: string
  correlationId?: string
  missionId?: string
  breakGlassReason?: string
  outcome: 'allow' | 'deny'
  payloadStored: false
}

export interface BreakGlassScope {
  appDomain: string
  resource: string
  action: 'read' | 'write'
  principalId?: string
}

export interface BreakGlassActivation {
  id: string
  actorId: string
  reason: string
  scope: BreakGlassScope
  activatedAt: string
  expiresAt: string
  standingGrantCreated: false
  revokedAt?: string
}

export interface ModelPath {
  id: string
  provider: string
  region: string
  crossBorder: boolean
  /** Inventory text is not a contract. */
  zeroRetentionClaim: 'UNVERIFIED'
  approvedForRestricted: boolean
  evidence: ProviderEvidenceChecklist
}

export interface ProviderEvidenceChecklist {
  geographicCommitment: EvidenceClass
  retention: EvidenceClass
  trainingUse: EvidenceClass
  subprocessors: EvidenceClass
  dpa: EvidenceClass
  securityControls: EvidenceClass
  dpia: EvidenceClass
}

export interface LegalHold {
  id: string
  scope: { orgId: string; principalId?: string; resourceId?: string; category?: string }
  reason: string
  authorityRef: string
  authorityKind: 'platform_legal' | 'platform_privacy'
  reviewer: string
  start: string
  reviewDue: string
  expiresAt: string
  releasedAt?: string
  releaseEvent?: string
}

export interface DelegationRecord {
  id: string
  principalId: string
  delegateId: string
  orgId: string
  scope: string
  activationCondition: string
  status: 'DRAFT' | 'PENDING_REVIEW' | 'APPROVED' | 'REJECTED' | 'REVOKED'
  durationMinutes: number
  requestedAt: string
  reviewer?: string
  reviewedAt?: string
  revokedAt?: string
  accessGranted: false
}

export interface RetentionStatement {
  category: string
  policyId: string
  rationale: string
  reviewDate: string
  archivalState: 'active' | 'archived' | 'pending_review'
  deletionEligible: boolean
  preservationRequired: boolean
  /** Null means no duration is assigned. The platform does not invent one. */
  durationDays: number | null
}

export interface DeletionRecord {
  recordId: string
  primary: 'ACTIVE_DATA_DELETED'
  backups: 'HISTORICAL_BACKUP_AGING_OUT'
  backupPolicyMaxDays: 90
  backupPolicySource: 'governance/privacy/policies/data-retention-policy.md'
  bicepBackupRetentionDays: 35
  bicepSource: 'infrastructure/bicep/modules/postgres.bicep'
  backupRuntimeVerified: false
  deletedAt: string
  backupEligibleAt: string
  propagation: {
    replicas: 'PROPAGATION_REQUESTED'
    indexes: 'PROPAGATION_REQUESTED'
    caches: 'PROPAGATION_REQUESTED'
    derived: 'PROPAGATION_REQUESTED'
    logs: 'PROPAGATION_REQUESTED'
    exports: 'PROPAGATION_REQUESTED'
  }
  /** Tombstones keep identity only. Restricted field values are not copied. */
  retainsFieldValues: false
}

export class PlaneError extends Error {
  readonly code: string
  constructor(code: string, message: string) {
    super(message)
    this.name = 'PlaneError'
    this.code = code
  }
}
