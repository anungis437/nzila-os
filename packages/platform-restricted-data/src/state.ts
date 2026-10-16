import type {
  AccessGrant,
  BreakGlassActivation,
  DelegationRecord,
  DeletionRecord,
  LegalHold,
  ModelPath,
  ProviderEvidenceChecklist,
  RestrictedAuditEvent,
  RestrictedRecord,
  RetentionStatement,
} from './types'

export interface PlaneState {
  restrictedApps: Set<string>
  records: Map<string, RestrictedRecord>
  grants: Map<string, AccessGrant>
  audit: RestrictedAuditEvent[]
  breakGlass: BreakGlassActivation[]
  holds: LegalHold[]
  delegations: DelegationRecord[]
  retention: Map<string, RetentionStatement>
  tombstones: Map<string, DeletionRecord>
  modelPaths: Map<string, ModelPath>
  exportEvents: string[]
}

const UNVERIFIED_EVIDENCE: ProviderEvidenceChecklist = {
  geographicCommitment: 'UNVERIFIED',
  retention: 'UNVERIFIED',
  trainingUse: 'UNVERIFIED',
  subprocessors: 'UNVERIFIED',
  dpa: 'UNVERIFIED',
  securityControls: 'UNVERIFIED',
  dpia: 'UNVERIFIED',
}

function seedModelPaths(state: PlaneState): void {
  const paths: ModelPath[] = [
    {
      id: 'azure-openai-eastus',
      provider: 'azure_openai',
      region: 'eastus',
      crossBorder: true,
      zeroRetentionClaim: 'UNVERIFIED',
      approvedForRestricted: false,
      evidence: { ...UNVERIFIED_EVIDENCE },
    },
    {
      id: 'azure-openai-eastus2-whisper',
      provider: 'azure_openai',
      region: 'eastus2',
      crossBorder: true,
      zeroRetentionClaim: 'UNVERIFIED',
      approvedForRestricted: false,
      evidence: { ...UNVERIFIED_EVIDENCE },
    },
  ]
  for (const path of paths) state.modelPaths.set(path.id, path)
}

export function emptyState(): PlaneState {
  const state: PlaneState = {
    restrictedApps: new Set(),
    records: new Map(),
    grants: new Map(),
    audit: [],
    breakGlass: [],
    holds: [],
    delegations: [],
    retention: new Map(),
    tombstones: new Map(),
    modelPaths: new Map(),
    exportEvents: [],
  }
  seedModelPaths(state)
  return state
}

let state: PlaneState = emptyState()

export function getState(): PlaneState {
  return state
}

export function resetPlatformState(): void {
  state = emptyState()
}
