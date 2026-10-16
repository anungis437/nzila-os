/**
 * Phase 2.5 privacy boundary and readiness record.
 *
 * Personal-data work stays closed. Phase 3 stays closed.
 * This module does not store personal data and does not open a graph.
 * Synthetic ids below are fixtures for the isolation rule only.
 */
import { FLEET_INTERACTION } from './interaction'
import { PERSONAL_DATA_GATE } from './security'

export const PRIVACY_READINESS_DISPOSITION = 'HOLD' as const

export const PHASE_3_STATUS = 'CLOSED' as const

export const PLATFORM_DATA_TIERS = ['PUBLIC', 'INTERNAL', 'CONFIDENTIAL', 'RESTRICTED'] as const

export type PlatformDataTier = (typeof PLATFORM_DATA_TIERS)[number]

/**
 * Platform tiers reused from the classification policy and evidence packs.
 * There is no separate HIGHLY_SENSITIVE or SECRET_CREDENTIAL tier.
 * Highly sensitive personal data maps to RESTRICTED.
 * Secret values are not a CIVITAS tier: only a vault reference is allowed.
 */
export const CIVITAS_TIER_MAPPING = {
  public: 'PUBLIC',
  internal: 'INTERNAL',
  confidential: 'CONFIDENTIAL',
  highlySensitivePersonal: 'RESTRICTED',
  secretCredential: 'VAULT_REFERENCE_ONLY',
} as const

export const SECRET_MATERIAL_KINDS = [
  'password',
  'private_key',
  'seed',
  'mfa_secret',
  'api_secret',
  'pin',
] as const

export type SecretMaterialKind = (typeof SECRET_MATERIAL_KINDS)[number]

export const CREDENTIAL_REFERENCE_FIELDS = [
  'credentialType',
  'system',
  'ownerRef',
  'recoveryDependency',
  'vaultReference',
  'lastReview',
  'continuityRole',
] as const

const SENSITIVE_LOG_KEYS = new Set([
  'password',
  'privatekey',
  'private_key',
  'seed',
  'pin',
  'apikey',
  'api_key',
  'apisecret',
  'mfa',
  'mfasecret',
  'secret',
  'token',
  'sin',
  'taxid',
  'bankaccount',
  'accountnumber',
])

export function phase3Open(): false {
  return false
}

export function personalDataMayEnterModelContext(): false {
  return false
}

export function acceptCredentialRecord(input: {
  readonly credentialType: string
  readonly system: string
  readonly ownerRef: string
  readonly vaultReference: string
  readonly secretValue?: string | null
}): { readonly accepted: boolean; readonly code: 'CREDENTIAL_REFERENCE' | 'SECRET_VALUE_REJECTED' } {
  if (input.secretValue != null && input.secretValue.trim().length > 0) {
    return { accepted: false, code: 'SECRET_VALUE_REJECTED' }
  }
  if (!input.vaultReference.trim() || !input.system.trim() || !input.ownerRef.trim()) {
    return { accepted: false, code: 'SECRET_VALUE_REJECTED' }
  }
  return { accepted: true, code: 'CREDENTIAL_REFERENCE' }
}

export function acceptEvidencePayload(input: {
  readonly kind: string
  readonly secretValue?: string | null
}): { readonly accepted: boolean; readonly code: 'ORDINARY_EVIDENCE' | 'SECRET_MATERIAL_NOT_EVIDENCE' } {
  if ((SECRET_MATERIAL_KINDS as readonly string[]).includes(input.kind)) {
    return { accepted: false, code: 'SECRET_MATERIAL_NOT_EVIDENCE' }
  }
  if (input.secretValue != null && input.secretValue.trim().length > 0) {
    return { accepted: false, code: 'SECRET_MATERIAL_NOT_EVIDENCE' }
  }
  return { accepted: true, code: 'ORDINARY_EVIDENCE' }
}

export interface AgentAccessDecision {
  readonly allowed: false
  readonly code: 'PHASE_3_CLOSED' | 'NO_BLANKET_ACCESS' | 'SOURCE_TEXT_CANNOT_AUTHORIZE'
  readonly personalDataWorkPermitted: false
}

/** No fleet member receives CIVITAS personal-data access. Source text cannot add it. */
export function authorizeAgentPersonalAccess(input: {
  readonly agent: string
  readonly sourceText?: string
}): AgentAccessDecision {
  if ((input.sourceText?.trim() ?? '').length > 0) {
    return {
      allowed: false,
      code: 'SOURCE_TEXT_CANNOT_AUTHORIZE',
      personalDataWorkPermitted: false,
    }
  }
  const peer = FLEET_INTERACTION.find((item) => item.peer === input.agent)
  if (peer && peer.permissionsGrantedByCivitas.length === 0) {
    return {
      allowed: false,
      code: 'NO_BLANKET_ACCESS',
      personalDataWorkPermitted: false,
    }
  }
  return {
    allowed: false,
    code: 'PHASE_3_CLOSED',
    personalDataWorkPermitted: false,
  }
}

export interface SyntheticReadDecision {
  readonly allowed: boolean
  readonly code: 'SAME_PRINCIPAL' | 'CROSS_PRINCIPAL_DENIED' | 'CAPABILITY_REQUIRED' | 'SOURCE_TEXT_IGNORED'
  readonly productionRead: false
}

/**
 * Isolation rule for synthetic ids. A true result is not a production read.
 * Production personal-data work remains closed.
 */
export function syntheticPrincipalRead(input: {
  readonly readerPrincipalId: string
  readonly recordPrincipalId: string
  readonly capabilities: readonly string[]
  readonly sourceText?: string
}): SyntheticReadDecision {
  if ((input.sourceText?.trim() ?? '').length > 0) {
    return { allowed: false, code: 'SOURCE_TEXT_IGNORED', productionRead: false }
  }
  if (!input.capabilities.includes('civitas.personal.read')) {
    return { allowed: false, code: 'CAPABILITY_REQUIRED', productionRead: false }
  }
  if (input.readerPrincipalId !== input.recordPrincipalId) {
    return { allowed: false, code: 'CROSS_PRINCIPAL_DENIED', productionRead: false }
  }
  return { allowed: true, code: 'SAME_PRINCIPAL', productionRead: false }
}

export function readCivitasPersonalData(): {
  readonly allowed: false
  readonly code: 'PHASE_3_CLOSED'
} {
  return { allowed: false, code: 'PHASE_3_CLOSED' }
}

export function authorizeFamilyRead(): {
  readonly allowed: false
  readonly code: 'FAMILY_SUBJECT_SEPARATE'
  readonly phase3: 'CLOSED'
} {
  return { allowed: false, code: 'FAMILY_SUBJECT_SEPARATE', phase3: 'CLOSED' }
}

export function grantIncapacityAccess(): {
  readonly allowed: false
  readonly code: 'CONTINUITY_ACCESS_NOT_SAFE'
} {
  return { allowed: false, code: 'CONTINUITY_ACCESS_NOT_SAFE' }
}

export function civitasLogMeta(meta: Record<string, unknown>): {
  readonly emitted: Record<string, unknown>
  readonly droppedKeys: readonly string[]
} {
  const emitted: Record<string, unknown> = {}
  const droppedKeys: string[] = []
  for (const [key, value] of Object.entries(meta)) {
    if (SENSITIVE_LOG_KEYS.has(key.toLowerCase().replace(/[^a-z0-9_]/g, ''))) {
      droppedKeys.push(key)
      continue
    }
    if (typeof value === 'string' && value.length > 0 && SENSITIVE_LOG_KEYS.has(key.toLowerCase())) {
      droppedKeys.push(key)
      continue
    }
    emitted[key] = value
  }
  return { emitted, droppedKeys }
}

export const SYNTHETIC_GRAPH_PREVIEW = {
  production: false,
  principals: ['principal-synthetic-a', 'principal-synthetic-b'],
  edges: [
    'person-owns-entity',
    'entity-controls-voting-right',
    'entity-holds-asset',
    'entity-owes-liability',
    'entity-bound-by-contract',
    'person-benefits-from-trust',
    'person-delegates-to-adviser',
    'entity-depends-on-service',
  ],
} as const

export const PHASE_3_ENTRY_CONDITIONS = [
  {
    id: 1,
    name: 'personal-info-isolated-from-code',
    status: 'UNMET',
    evidence: 'packages/civitas and docs/doctrine/civitas use synthetic ids. A whole-repository forensic scan was not performed, so isolation of the monorepo is not demonstrated.',
  },
  {
    id: 2,
    name: 'deny-by-default',
    status: 'MET',
    evidence: 'readCivitasPersonalData and authorizeAgentPersonalAccess deny. personalDataWorkAllowed is false.',
  },
  {
    id: 3,
    name: 'other-agents-do-not-inherit-access',
    status: 'MET',
    evidence: 'FLEET_INTERACTION grants no permissions. authorizeAgentPersonalAccess denies SCOUT, VERIFIER, and REDTEAM.',
  },
  {
    id: 4,
    name: 'sensitive-values-not-logged-by-default',
    status: 'UNMET',
    evidence: 'packages/os-core/src/telemetry/logger.ts createLogger writes meta without calling redactFields. Redaction is opt-in.',
  },
  {
    id: 5,
    name: 'secrets-referenced-not-stored',
    status: 'MET',
    evidence: 'acceptCredentialRecord rejects a secret value. Platform secrets live in packages/secrets Key Vault client, which CIVITAS does not call.',
  },
  {
    id: 6,
    name: 'evidence-keeps-provenance',
    status: 'MET',
    evidence: 'Legal-authority links require an EvidenceRef. decision-evidence refs carry classification and hash.',
  },
  {
    id: 7,
    name: 'access-auditable-without-payloads',
    status: 'UNMET',
    evidence: 'apps/console/lib/audit-db.ts stores beforeJson and afterJson. The row has actor, action, and timestamp. It has no required purpose, data category, authorization basis, or mission id, and it can hold a payload.',
  },
  {
    id: 8,
    name: 'meaningful-personal-graph-export',
    status: 'UNMET',
    evidence: 'packages/decision-evidence/src/export.ts exports a sealed evidence pack as JSON or Markdown. It is not a personal-graph export.',
  },
  {
    id: 9,
    name: 'deletion-and-retention-documented-for-civitas',
    status: 'UNMET',
    evidence: 'governance/privacy/policies/data-retention-schedule.md and packages/os-core/src/retention/policies.ts cover platform classes. They do not name CIVITAS personal categories. No duration is invented here.',
  },
  {
    id: 10,
    name: 'third-party-exposure-explicit',
    status: 'MET',
    evidence: 'Processors are listed in the readiness assessment as REQUIRED, OPTIONAL, AVOIDABLE, or UNKNOWN.',
  },
  {
    id: 11,
    name: 'infra-location-explicit',
    status: 'EXPLICITLY_UNRESOLVED',
    evidence: 'governance/privacy/data-inventory.json documents staging Canada Central and Azure OpenAI East US. Production placement is UNKNOWN.',
  },
  {
    id: 12,
    name: 'model-provider-exposure-known-before-prompts',
    status: 'UNMET',
    evidence: 'packages/ai-core/src/gateway.ts logs request bodies. redactText can run in mode off. CIVITAS sends no prompts. A minimum contract is documented and not enforced in the gateway.',
  },
  {
    id: 13,
    name: 'synthetic-principal-isolation',
    status: 'MET',
    evidence: 'syntheticPrincipalRead denies a different synthetic principal. productionRead is false.',
  },
  {
    id: 14,
    name: 'break-glass-reasoned-and-auditable',
    status: 'MET',
    evidence: 'apps/console/app/api/admin/break-glass/route.ts requires a reason of at least 10 characters and calls recordAuditEvent. It is not wired to CIVITAS data.',
  },
  {
    id: 15,
    name: 'no-deploy-or-execution-authority',
    status: 'MET',
    evidence: 'CIVITAS execution authority remains none. deploymentCapability is false.',
  },
] as const

export const REDTEAM_FINDINGS = [
  {
    id: 'R1',
    title: 'Unauthorized agent reads the full graph',
    existingMitigation: 'No personal graph is stored. Fleet obligations grant an empty permission list.',
    missingMitigation: 'There is no persisted capability ACL because there is no store. A future table would need one before any read exists.',
    residualRisk: 'A later store that reused org-wide database roles could expose every row to a service credential.',
    phase3Blocker: true,
  },
  {
    id: 'R2',
    title: 'Logging leak',
    existingMitigation: 'redactFields and ai-core redactText exist. civitasLogMeta drops known secret keys on the CIVITAS path.',
    missingMitigation: 'createLogger does not redact by default. Error stacks are copied into the log entry.',
    residualRisk: 'A sensitive value in a message string or an unlisted key is logged.',
    phase3Blocker: true,
  },
  {
    id: 'R3',
    title: 'Full asset record in an external prompt',
    existingMitigation: 'CIVITAS does not call a model. personalDataMayEnterModelContext is false.',
    missingMitigation: 'The AI gateway logs message bodies and can redact in mode off. Inventory zero-retention is a stated Azure claim, not a gateway control.',
    residualRisk: 'Any future call that passes a graph into ai-core would leave the platform boundary.',
    phase3Blocker: true,
  },
  {
    id: 'R4',
    title: 'Compromised admin',
    existingMitigation: 'Break-glass requires a reason, a duration up to 240 minutes, and an audit event. Policy can deny or require approval.',
    missingMitigation: 'Scope full is platform-wide. The route sets orgId to the actor user id. It is not limited to a CIVITAS subject.',
    residualRisk: 'A compromised platform admin is outside the CIVITAS principal boundary.',
    phase3Blocker: true,
  },
  {
    id: 'R5',
    title: 'Export theft',
    existingMitigation: 'Union Eyes evidence export records an org isolation flag. Decision-evidence export is of a sealed pack, not a personal graph.',
    missingMitigation: 'No CIVITAS export authorization or minimization exists, because export of a personal graph was not built.',
    residualRisk: 'A future export that copied the graph into JSON would be stealable as a file.',
    phase3Blocker: true,
  },
  {
    id: 'R6',
    title: 'Deletion versus backups',
    existingMitigation: 'Retention policy states backup retention of 90 days and that source purge does not instantly clear backups.',
    missingMitigation: 'No CIVITAS deletion job, replica proof, search-index proof, or cache proof exists.',
    residualRisk: 'Deletion of a future row would not be immediate destruction across backups and logs.',
    phase3Blocker: true,
  },
  {
    id: 'R7',
    title: 'Cross-principal contamination',
    existingMitigation: 'Union Eyes RLS policies are org-scoped. syntheticPrincipalRead denies a different synthetic principal.',
    missingMitigation: 'Org isolation is not principal isolation. CIVITAS has no row store to attach a principal predicate to.',
    residualRisk: 'Two principals in one organization would share an org-scoped read.',
    phase3Blocker: true,
  },
  {
    id: 'R8',
    title: 'Password or key submitted as evidence',
    existingMitigation: 'acceptEvidencePayload and acceptCredentialRecord reject secret values.',
    missingMitigation: 'The platform evidence pack schema can still hold a description string. CIVITAS does not seal packs.',
    residualRisk: 'A caller who puts a secret in a free-text description of an ordinary evidence ref is not pattern-scanned. That would be a classifier. The typed kind is what is rejected.',
    phase3Blocker: true,
  },
  {
    id: 'R9',
    title: 'Over-broad VERIFIER request',
    existingMitigation: 'VERIFIER permissionsGrantedByCivitas is empty. authorizeAgentPersonalAccess returns NO_BLANKET_ACCESS.',
    missingMitigation: 'VERIFIER is not a registered agent, so there is no runtime capability check outside this package.',
    residualRisk: 'A future integration could pass a wide context despite this package refusing.',
    phase3Blocker: true,
  },
  {
    id: 'R10',
    title: 'Incapacity continuity access',
    existingMitigation: 'grantIncapacityAccess refuses. Family reads are a separate subject and are refused.',
    missingMitigation: 'No reviewed continuity grant, no separate subject identity, and no time-bounded delegate model exist.',
    residualRisk: 'Opening a standing delegate path now would give access without a safe authorization basis.',
    phase3Blocker: true,
  },
] as const

export const PRIVACY_READINESS = {
  disposition: PRIVACY_READINESS_DISPOSITION,
  phase3: PHASE_3_STATUS,
  personalDataWorkPermitted: PERSONAL_DATA_GATE.personalDataWorkPermitted,
  minimumNecessaryDisclosure: 'Send the proposition, authority references, and the minimum factual predicates. Do not send the graph.',
} as const
