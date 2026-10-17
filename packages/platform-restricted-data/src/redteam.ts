import { buildRestrictedAuditEvent } from './audit'
import { activateBreakGlass, evaluateBreakGlassAccess } from './break-glass'
import { classifyRecord } from './classification'
import { activateDelegation, proposeDelegation, reviewDelegation } from './continuity'
import { encryptionAssurance } from './encryption'
import { deleteRestrictedRecord, exportPrincipalRecords } from './lifecycle'
import { approveRestrictedModelPath, evaluateRestrictedModelPath } from './model-policy'
import { redactObservabilityRecord } from './observability'
import {
  fleetMemberHasImplicitRestrictedAccess,
  grantRestrictedAccess,
  putRestrictedRecord,
  readRestrictedRecord,
} from './principal'
import { residencyClaims } from './residency'
import { inspectSecretIngestion } from './secrets'
import { getState, resetPlatformState } from './state'
import { PlaneError, type EvidenceClass } from './types'

export interface RedTeamResult {
  id: string
  previousStatus: 'PHASE_3_BLOCKER'
  remediation: string
  evidence: EvidenceClass
  residualRisk: string
  disposition: string
  phase3Blocker: boolean
}

function caught(fn: () => void): PlaneError | null {
  try {
    fn()
    return null
  } catch (error) {
    return error instanceof PlaneError ? error : new PlaneError('UNEXPECTED', String(error))
  }
}

/** Internal synthetic diagnostic harness, deliberately absent from the public API. */
export function rerunRedTeam(): RedTeamResult[] {
  resetPlatformState()
  const record = putRestrictedRecord({
    appId: 'synthetic-app',
    orgId: 'org-synthetic-1',
    principalId: 'principal-synthetic-a',
    category: 'synthetic-envelope',
    explicitTier: 'RESTRICTED',
    jurisdiction: 'CA-synthetic',
    fields: {
      proposition: 'synthetic proposition',
      authorityRefs: ['auth-synthetic-1'],
      predicates: ['predicate-synthetic-1'],
      bankAccount: 'synthetic-account-a',
    },
    relationships: [{ type: 'evidence', targetId: 'ev-synthetic-1' }],
    evidenceRefs: [{ type: 'EvidenceRef', refId: 'ev-synthetic-1' }],
    decisions: [{ id: 'dec-synthetic-1', at: '2026-01-01T00:00:00.000Z', summary: 'synthetic decision' }],
  })

  const r1 = caught(() => {
    readRestrictedRecord({
      orgId: 'org-synthetic-1',
      principalId: 'principal-synthetic-a',
      recordId: record.id,
      actor: { kind: 'agent', id: 'SCOUT', actingForPrincipalId: 'principal-synthetic-a' },
      purpose: 'synthetic review',
      authorizationBasis: 'none',
      serviceOrAgent: 'SCOUT',
    })
  })

  const logged = JSON.stringify(redactObservabilityRecord({
    classification: 'RESTRICTED',
    message: 'contact synthetic@example.invalid token=sk-abcdefghijklmnopqrstuvwxyz123456',
    bankAccount: 'synthetic-account-a',
    requestBody: { prompt: 'synthetic-account-a' },
    errorStack: 'Error: sk-abcdefghijklmnopqrstuvwxyz123456\n    at readRestricted (plane.ts:1:1)',
  }))
  const r2Leak = logged.includes('synthetic-account-a')
    || logged.includes('sk-abcdefghijklmnopqrstuvwxyz123456')
    || logged.includes('synthetic@example.invalid')
    || !logged.includes('at readRestricted')

  const r3 = evaluateRestrictedModelPath({
    classification: 'RESTRICTED',
    modelPathId: 'azure-openai-eastus2-whisper',
    redactionMode: 'off',
    text: 'synthetic proposition',
  })
  const internalStillAllowed = evaluateRestrictedModelPath({ classification: 'INTERNAL' }).allowed

  const activation = activateBreakGlass({
    actorId: 'admin-synthetic',
    reason: 'synthetic emergency access for one record',
    durationMinutes: 15,
    scope: {
      orgId: 'org-synthetic-1',
      appDomain: 'synthetic-app',
      resource: record.id,
      action: 'read',
      principalId: 'principal-synthetic-a',
    },
  })
  // Fault injection stays inside the test harness; public access requests cannot
  // supply an earlier clock to revive an expired activation.
  getState().breakGlass.find((item) => item.id === activation.id)!.expiresAt = new Date(Date.now() - 1).toISOString()
  const expired = evaluateBreakGlassAccess({
    activationId: activation.id,
    actorId: 'admin-synthetic',
    orgId: 'org-synthetic-1',
    principalId: 'principal-synthetic-a',
    appDomain: 'synthetic-app',
    resource: record.id,
    action: 'read',
  })
  const fullScope = caught(() => {
    activateBreakGlass({
      actorId: 'admin-synthetic',
      reason: 'synthetic emergency access for one record',
      durationMinutes: 15,
      scope: 'full',
    })
  })

  const exported = exportPrincipalRecords({
    orgId: 'org-synthetic-1',
    principalId: 'principal-synthetic-a',
    actor: { kind: 'principal', id: 'principal-synthetic-a' },
    purpose: 'synthetic portability',
    authorizationBasis: 'principal_self_access',
    correlationId: 'corr-synthetic-1',
  })
  const otherExport = caught(() => {
    exportPrincipalRecords({
      orgId: 'org-synthetic-1',
      principalId: 'principal-synthetic-a',
      actor: { kind: 'principal', id: 'principal-synthetic-b' },
      purpose: 'synthetic theft',
      authorizationBasis: 'none',
      correlationId: 'corr-synthetic-2',
    })
  })

  const deletion = deleteRestrictedRecord({
    orgId: 'org-synthetic-1',
    principalId: 'principal-synthetic-a',
    recordId: record.id,
    actor: { kind: 'principal', id: 'principal-synthetic-a' },
    purpose: 'synthetic erasure',
    authorizationBasis: 'principal_self_access',
  })

  const cross = caught(() => {
    const fresh = putRestrictedRecord({
      appId: 'synthetic-app',
      orgId: 'org-synthetic-1',
      principalId: 'principal-synthetic-a',
      category: 'synthetic-envelope',
      explicitTier: 'RESTRICTED',
      jurisdiction: 'CA-synthetic',
      fields: { note: 'synthetic-note-a' },
    })
    readRestrictedRecord({
      orgId: 'org-synthetic-1',
      principalId: 'principal-synthetic-a',
      recordId: fresh.id,
      actor: { kind: 'principal', id: 'principal-synthetic-b' },
      purpose: 'synthetic cross read',
      authorizationBasis: 'none',
      serviceOrAgent: 'principal',
    })
  })

  const secret = inspectSecretIngestion('prefix sk-abcdefghijklmnopqrstuvwxyz123456 suffix')
  const ordinary = inspectSecretIngestion('synthetic description with no credential')

  grantRestrictedAccess({
    orgId: 'org-synthetic-1',
    principalId: 'principal-synthetic-a',
    actorKind: 'agent',
    actorId: 'agent-verifier-synthetic',
    actions: ['read'],
    purpose: 'synthetic verification',
    authorizationBasis: 'minimum_necessary_grant',
    disclosureProfile: 'VERIFIER',
    grantedBy: 'principal-synthetic-a',
  })
  const verifierRecord = putRestrictedRecord({
    appId: 'synthetic-app',
    orgId: 'org-synthetic-1',
    principalId: 'principal-synthetic-a',
    category: 'synthetic-envelope',
    explicitTier: 'RESTRICTED',
    jurisdiction: 'CA-synthetic',
    fields: {
      proposition: 'synthetic proposition',
      authorityRefs: ['auth-synthetic-1'],
      predicates: ['predicate-synthetic-1'],
      bankAccount: 'synthetic-account-b',
    },
  })
  const overBroad = caught(() => {
    readRestrictedRecord({
      orgId: 'org-synthetic-1',
      principalId: 'principal-synthetic-a',
      recordId: verifierRecord.id,
      actor: { kind: 'agent', id: 'agent-verifier-synthetic', actingForPrincipalId: 'principal-synthetic-a' },
      purpose: 'synthetic verification',
      authorizationBasis: 'minimum_necessary_grant',
      serviceOrAgent: 'VERIFIER',
      disclosureProfile: 'VERIFIER',
      requestedFields: ['proposition', 'bankAccount'],
    })
  })

  const incapacity = caught(() => {
    proposeDelegation({
      orgId: 'org-synthetic-1',
      principalId: 'principal-synthetic-a',
      delegateId: 'delegate-synthetic',
      scope: 'read proposition',
      activationCondition: 'system_incapacity_determination',
      durationMinutes: 60,
    })
  })
  const delegation = proposeDelegation({
    orgId: 'org-synthetic-1',
    principalId: 'principal-synthetic-a',
    delegateId: 'delegate-synthetic',
    scope: 'read proposition',
    activationCondition: 'external_order_synthetic',
    durationMinutes: 60,
  })
  reviewDelegation({ delegationId: delegation.id, reviewer: 'reviewer-synthetic', decision: 'APPROVED' })
  const activated = activateDelegation({ delegationId: delegation.id, attestationSource: 'external_authority' })

  const audit = buildRestrictedAuditEvent({
    actorId: 'principal-synthetic-a',
    serviceOrAgent: 'principal',
    action: 'restricted.read',
    resourceId: record.id,
    category: 'synthetic-envelope',
    orgId: 'org-synthetic-1',
    principalId: 'principal-synthetic-a',
    purpose: 'synthetic audit',
    authorizationBasis: 'principal_self_access',
    outcome: 'allow',
    beforeJson: { bankAccount: 'synthetic-account-a' },
    afterJson: { bankAccount: 'synthetic-account-a' },
  })

  const approval = caught(() => {
    approveRestrictedModelPath('azure-openai-eastus', {
      geographicCommitment: 'UNVERIFIED',
      retention: 'CODE_PROVEN',
      trainingUse: 'CONFIG_PROVEN',
      subprocessors: 'UNVERIFIED',
      dpa: 'UNVERIFIED',
      securityControls: 'UNVERIFIED',
      dpia: 'UNVERIFIED',
    })
  })

  const unlabelled = classifyRecord({ appId: 'ordinary-app', fields: { title: 'synthetic title' } })
  const residencyRuntime = residencyClaims().some((claim) => claim.evidence === 'RUNTIME_VERIFIED')
  const cmkRuntime = encryptionAssurance().find((item) => item.control === 'customer_managed_key')

  return [
    {
      id: 'R1',
      previousStatus: 'PHASE_3_BLOCKER',
      remediation: 'Agent reads require an explicit grant. Fleet membership is not access.',
      evidence: 'CODE_PROVEN',
      residualRisk: 'Union Eyes RLS stays organization_id scoped. A database role that bypasses this API is not stopped here.',
      disposition: r1?.code === 'AGENT_DENIED' && fleetMemberHasImplicitRestrictedAccess('SCOUT') === false ? 'DENIED_AT_API' : 'FAILED',
      phase3Blocker: r1?.code !== 'AGENT_DENIED',
    },
    {
      id: 'R2',
      previousStatus: 'PHASE_3_BLOCKER',
      remediation: 'createLogger redacts through redactObservabilityRecord before write. Stack frames remain.',
      evidence: 'CODE_PROVEN',
      residualRisk: 'Prose that matches no key and no high-confidence pattern can still be logged.',
      disposition: r2Leak ? 'FAILED' : 'REDACTED_BY_DEFAULT',
      phase3Blocker: r2Leak,
    },
    {
      id: 'R3',
      previousStatus: 'PHASE_3_BLOCKER',
      remediation: 'Restricted model paths deny before a provider call. Bodies are omitted if a log is attempted.',
      evidence: 'CODE_PROVEN',
      residualRisk: 'A caller that mislabels Restricted data as another tier is not detected. Provider retention is UNVERIFIED.',
      disposition: r3.decision === 'DENY' && internalStillAllowed ? 'FAIL_CLOSED' : 'FAILED',
      phase3Blocker: r3.allowed || !internalStillAllowed,
    },
    {
      id: 'R4',
      previousStatus: 'PHASE_3_BLOCKER',
      remediation: 'Break-glass requires app, resource, and action, expires, and creates no standing grant.',
      evidence: 'CODE_PROVEN',
      residualRisk: 'A compromised admin can still open a short scoped window. That window is the emergency capability.',
      disposition: fullScope?.code === 'UNBOUNDED_SCOPE' && expired.allowed === false && activation.standingGrantCreated === false ? 'SCOPED_AND_EXPIRING' : 'FAILED',
      phase3Blocker: fullScope?.code !== 'UNBOUNDED_SCOPE' || expired.allowed,
    },
    {
      id: 'R5',
      previousStatus: 'PHASE_3_BLOCKER',
      remediation: 'Export is an explicit principal-scoped call and writes a metadata audit.',
      evidence: 'CODE_PROVEN',
      residualRisk: 'An authorized principal still receives their own record. That file can leave the system after a lawful export.',
      disposition: exported.records.length === 1 && otherExport?.code === 'CROSS_PRINCIPAL_DENIED' ? 'PRINCIPAL_SCOPED' : 'FAILED',
      phase3Blocker: otherExport?.code !== 'CROSS_PRINCIPAL_DENIED',
    },
    {
      id: 'R6',
      previousStatus: 'PHASE_3_BLOCKER',
      remediation: 'Primary deletion is ACTIVE_DATA_DELETED. Backups are HISTORICAL_BACKUP_AGING_OUT. Propagation is requested, not attested.',
      evidence: 'CODE_PROVEN',
      residualRisk: 'Replicas, indexes, caches, logs, exports, and Azure backups are not runtime verified.',
      disposition: deletion.primary === 'ACTIVE_DATA_DELETED' && deletion.backups === 'HISTORICAL_BACKUP_AGING_OUT' && deletion.retainsFieldValues === false
        ? 'SEMANTICS_MODELED_PROPAGATION_UNVERIFIED'
        : 'FAILED',
      phase3Blocker: true,
    },
    {
      id: 'R7',
      previousStatus: 'PHASE_3_BLOCKER',
      remediation: 'Reads are principal-scoped inside the org. A second principal is denied.',
      evidence: 'CODE_PROVEN',
      residualRisk: 'Existing Union Eyes policies were not rewritten and remain org-scoped.',
      disposition: cross?.code === 'CROSS_PRINCIPAL_DENIED' ? 'DENIED' : 'FAILED',
      phase3Blocker: cross?.code !== 'CROSS_PRINCIPAL_DENIED',
    },
    {
      id: 'R8',
      previousStatus: 'PHASE_3_BLOCKER',
      remediation: 'High-confidence credential patterns are rejected and pointed at @nzila/secrets.',
      evidence: 'CODE_PROVEN',
      residualRisk: 'Ordinary description text that does not match a high-confidence pattern is not detected.',
      disposition: secret.rejected && !ordinary.rejected ? 'HIGH_CONFIDENCE_ONLY' : 'FAILED',
      phase3Blocker: !secret.rejected || ordinary.rejected,
    },
    {
      id: 'R9',
      previousStatus: 'PHASE_3_BLOCKER',
      remediation: 'VERIFIER grants project proposition, authority refs, and predicates. Extra fields are refused.',
      evidence: 'CODE_PROVEN',
      residualRisk: 'A grant without the VERIFIER profile can still read the fields it was explicitly given.',
      disposition: overBroad?.code === 'OVER_BROAD_DISCLOSURE' ? 'MINIMUM_NECESSARY' : 'FAILED',
      phase3Blocker: overBroad?.code !== 'OVER_BROAD_DISCLOSURE',
    },
    {
      id: 'R10',
      previousStatus: 'PHASE_3_BLOCKER',
      remediation: 'Delegation cannot use system incapacity and activation does not grant access.',
      evidence: 'CODE_PROVEN',
      residualRisk: 'No production continuity workflow exists. The unsafe autonomous grant is closed, not replaced with live delegate access.',
      disposition: incapacity?.code === 'INCAPACITY_NOT_DETERMINED_HERE' && activated.accessGranted === false
        ? 'ACCESS_NOT_ENABLED'
        : 'FAILED',
      phase3Blocker: incapacity?.code !== 'INCAPACITY_NOT_DETERMINED_HERE' || activated.accessGranted !== false,
    },
    {
      id: 'R-AUDIT',
      previousStatus: 'PHASE_3_BLOCKER',
      remediation: 'Restricted audit stores metadata and drops beforeJson and afterJson.',
      evidence: 'CODE_PROVEN',
      residualRisk: 'Non-Restricted audit rows still accept beforeJson and afterJson.',
      disposition: audit.payloadStored === false && audit.purpose === 'synthetic audit' && !JSON.stringify(audit).includes('synthetic-account-a')
        ? 'METADATA_ONLY'
        : 'FAILED',
      phase3Blocker: JSON.stringify(audit).includes('synthetic-account-a'),
    },
    {
      id: 'R-PROVIDER',
      previousStatus: 'PHASE_3_BLOCKER',
      remediation: 'Unverified or config-proven provider evidence cannot approve a Restricted path.',
      evidence: 'UNVERIFIED',
      residualRisk: 'No provider contract was reviewed in this change.',
      disposition: approval?.code === 'UNVERIFIED_PROVIDER_CANNOT_BE_APPROVED' && unlabelled.tier === 'INTERNAL' && !residencyRuntime && cmkRuntime?.evidence === 'UNVERIFIED'
        ? 'STAYS_UNVERIFIED'
        : 'FAILED',
      phase3Blocker: approval?.code !== 'UNVERIFIED_PROVIDER_CANNOT_BE_APPROVED',
    },
  ]
}
