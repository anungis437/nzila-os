import { describe, expect, it, beforeEach } from 'vitest'
import { buildRestrictedAuditEvent } from './audit'
import { activateBreakGlass, evaluateBreakGlassAccess } from './break-glass'
import { classifyRecord, declareRestrictedCapability } from './classification'
import { activateDelegation, proposeDelegation, reviewDelegation } from './continuity'
import { encryptionAssurance } from './encryption'
import { deleteRestrictedRecord, exportPrincipalRecords, placeLegalHold, releaseLegalHold, stateRetention } from './lifecycle'
import { approveRestrictedModelPath, bodiesSafeForPersistence, evaluateRestrictedModelPath, restrictedModelProcessingEnabled } from './model-policy'
import { redactObservabilityRecord } from './observability'
import {
  fleetMemberHasImplicitRestrictedAccess,
  grantRestrictedAccess,
  putRestrictedRecord,
  readRestrictedRecord,
} from './principal'
import { residencyClaims } from './residency'
import { rejectSecretIngestion } from './secrets'
import { getState, resetPlatformState } from './state'
import { CIVITAS_PLATFORM_CONTRACT, CONTROL_EVIDENCE } from './contract'
import { rerunRedTeam } from './redteam'
import { PlaneError } from './types'

const verified = {
  geographicCommitment: 'EXTERNAL_CONTRACT_VERIFIED',
  retention: 'EXTERNAL_CONTRACT_VERIFIED',
  trainingUse: 'EXTERNAL_CONTRACT_VERIFIED',
  subprocessors: 'EXTERNAL_CONTRACT_VERIFIED',
  dpa: 'EXTERNAL_CONTRACT_VERIFIED',
  securityControls: 'EXTERNAL_CONTRACT_VERIFIED',
  dpia: 'EXTERNAL_CONTRACT_VERIFIED',
} as const

function seedPair() {
  const a = putRestrictedRecord({
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
  const b = putRestrictedRecord({
    appId: 'synthetic-app',
    orgId: 'org-synthetic-1',
    principalId: 'principal-synthetic-b',
    category: 'synthetic-envelope',
    explicitTier: 'RESTRICTED',
    jurisdiction: 'CA-synthetic',
    fields: { note: 'synthetic-note-b' },
  })
  return { a, b }
}

describe('restricted data control plane', () => {
  beforeEach(() => {
    resetPlatformState()
  })

  it('keeps unlabelled non-sensitive data Internal and fails closed for Restricted fields', () => {
    expect(classifyRecord({ appId: 'ordinary-app', fields: { title: 'runbook' } })).toEqual({
      tier: 'INTERNAL',
      source: 'unlabelled_default',
    })
    expect(() => classifyRecord({ appId: 'ordinary-app', fields: { sin: 'synthetic-sin' } })).toThrow(PlaneError)
    expect(() => classifyRecord({
      appId: 'ordinary-app',
      explicitTier: 'INTERNAL',
      fields: { bankAccount: 'synthetic-account-a' },
    })).toThrow(/Restricted/)
    declareRestrictedCapability('restricted-app')
    expect(() => classifyRecord({ appId: 'restricted-app', fields: { title: 'doctrine' } })).toThrow(/explicit tier/i)
    expect(classifyRecord({ appId: 'restricted-app', explicitTier: 'PUBLIC', fields: { title: 'doctrine' } }).tier).toBe('PUBLIC')
  })

  it('denies cross-principal reads and unauthorized agents inside one org', () => {
    const { a } = seedPair()
    expect(fleetMemberHasImplicitRestrictedAccess('SCOUT')).toBe(false)
    expect(() => readRestrictedRecord({
      orgId: 'org-synthetic-1',
      principalId: 'principal-synthetic-a',
      recordId: a.id,
      actor: { kind: 'principal', id: 'principal-synthetic-b' },
      purpose: 'synthetic cross read',
      authorizationBasis: 'none',
      serviceOrAgent: 'principal',
    })).toThrow(/another principal/)
    expect(() => readRestrictedRecord({
      orgId: 'org-synthetic-1',
      principalId: 'principal-synthetic-a',
      recordId: a.id,
      actor: { kind: 'agent', id: 'SCOUT', actingForPrincipalId: 'principal-synthetic-a' },
      purpose: 'synthetic scout',
      authorizationBasis: 'fleet',
      serviceOrAgent: 'SCOUT',
    })).toThrow(/explicit grant/)
  })

  it('gives a permitted verifier only the minimum fields and refuses an over-broad request', () => {
    const { a } = seedPair()
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
    const scoped = readRestrictedRecord({
      orgId: 'org-synthetic-1',
      principalId: 'principal-synthetic-a',
      recordId: a.id,
      actor: { kind: 'agent', id: 'agent-verifier-synthetic', actingForPrincipalId: 'principal-synthetic-a' },
      purpose: 'synthetic verification',
      authorizationBasis: 'minimum_necessary_grant',
      serviceOrAgent: 'VERIFIER',
    })
    expect(scoped.fields).toEqual({
      proposition: 'synthetic proposition',
      authorityRefs: ['auth-synthetic-1'],
      predicates: ['predicate-synthetic-1'],
    })
    expect(scoped.fields).not.toHaveProperty('bankAccount')
    expect(() => readRestrictedRecord({
      orgId: 'org-synthetic-1',
      principalId: 'principal-synthetic-a',
      recordId: a.id,
      actor: { kind: 'agent', id: 'agent-verifier-synthetic', actingForPrincipalId: 'principal-synthetic-a' },
      purpose: 'synthetic verification',
      authorizationBasis: 'minimum_necessary_grant',
      serviceOrAgent: 'VERIFIER',
      requestedFields: ['proposition', 'bankAccount'],
    })).toThrow(/minimum necessary/)
  })

  it('redacts Restricted values from the default observability record and keeps stack frames', () => {
    const redacted = redactObservabilityRecord({
      classification: 'RESTRICTED',
      message: 'user synthetic@example.invalid',
      bankAccount: 'synthetic-account-a',
      requestBody: { prompt: 'synthetic-account-a' },
      errorMessage: 'failed sk-abcdefghijklmnopqrstuvwxyz123456',
      errorStack: 'Error: sk-abcdefghijklmnopqrstuvwxyz123456\n    at handler (file.ts:10:1)',
    })
    const serialized = JSON.stringify(redacted)
    expect(serialized).not.toContain('synthetic-account-a')
    expect(serialized).not.toContain('synthetic@example.invalid')
    expect(serialized).not.toContain('sk-abcdefghijklmnopqrstuvwxyz123456')
    expect(serialized).toContain('at handler')
    expect(redacted.bankAccount).toBe('[REDACTED]')
    expect(redacted.requestBody).toBe('[REDACTED]')
  })

  it('denies Restricted model paths and leaves an ordinary tier untouched', () => {
    const denied = evaluateRestrictedModelPath({
      classification: 'RESTRICTED',
      modelPathId: 'azure-openai-eastus2-whisper',
      redactionMode: 'strict',
    })
    expect(denied.allowed).toBe(false)
    expect(denied.decision).toBe('DENY')
    expect(evaluateRestrictedModelPath({ classification: 'CONFIDENTIAL' }).allowed).toBe(true)
    expect(restrictedModelProcessingEnabled()).toBe(false)
    expect(() => approveRestrictedModelPath('azure-openai-eastus', {
      ...verified,
      retention: 'CODE_PROVEN',
    })).toThrow(/does not accept another evidence class/)
    expect(() => approveRestrictedModelPath('azure-openai-eastus', verified)).toThrow(/cross-border|Zero-retention|UNVERIFIED/i)
    const bodies = bodiesSafeForPersistence({
      classification: 'RESTRICTED',
      requestBody: { prompt: 'synthetic-account-a' },
      responseBody: { content: 'synthetic-account-a' },
    })
    expect(JSON.stringify(bodies)).not.toContain('synthetic-account-a')
    expect(bodiesSafeForPersistence({
      classification: 'INTERNAL',
      requestBody: { prompt: 'ordinary' },
      responseBody: { content: 'ordinary' },
    }).persisted).toBe(true)
  })

  it('writes Restricted audit metadata without the payload', () => {
    expect(() => buildRestrictedAuditEvent({
      actorId: 'principal-synthetic-a',
      serviceOrAgent: 'principal',
      action: 'restricted.read',
      resourceId: 'rec-1',
      category: '',
      orgId: 'org-synthetic-1',
      principalId: 'principal-synthetic-a',
      purpose: 'synthetic',
      authorizationBasis: 'principal_self_access',
      outcome: 'allow',
    })).toThrow(/purpose, data category, and authorization basis/)
    const event = buildRestrictedAuditEvent({
      actorId: 'principal-synthetic-a',
      serviceOrAgent: 'principal',
      action: 'restricted.read',
      resourceId: 'rec-1',
      category: 'synthetic-envelope',
      orgId: 'org-synthetic-1',
      principalId: 'principal-synthetic-a',
      purpose: 'synthetic portability',
      authorizationBasis: 'principal_self_access',
      correlationId: 'corr-synthetic-1',
      outcome: 'allow',
      beforeJson: { bankAccount: 'synthetic-account-a' },
      afterJson: { bankAccount: 'synthetic-account-a' },
    })
    expect(event.purpose).toBe('synthetic portability')
    expect(event.authorizationBasis).toBe('principal_self_access')
    expect(event.payloadStored).toBe(false)
    expect(JSON.stringify(event)).not.toContain('synthetic-account-a')
    expect(event).not.toHaveProperty('beforeJson')
  })

  it('scopes break-glass, expires it, and does not create a standing grant', () => {
    expect(() => activateBreakGlass({
      actorId: 'admin-synthetic',
      reason: 'synthetic emergency access',
      durationMinutes: 30,
      scope: 'full',
    })).toThrow(/platform-wide/)
    const activation = activateBreakGlass({
      actorId: 'admin-synthetic',
      reason: 'synthetic emergency access',
      durationMinutes: 15,
      scope: {
        appDomain: 'synthetic-app',
        resource: 'rec-1',
        action: 'read',
        principalId: 'principal-synthetic-a',
      },
      now: new Date('2026-01-01T00:00:00.000Z'),
    })
    expect(activation.standingGrantCreated).toBe(false)
    expect(getState().grants.size).toBe(0)
    const active = evaluateBreakGlassAccess({
      activationId: activation.id,
      orgId: 'org-synthetic-1',
      principalId: 'principal-synthetic-a',
      appDomain: 'synthetic-app',
      resource: 'rec-1',
      action: 'read',
      now: new Date('2026-01-01T00:10:00.000Z'),
    })
    expect(active.allowed).toBe(true)
    expect(active.standingGrantCreated).toBe(false)
    const expired = evaluateBreakGlassAccess({
      activationId: activation.id,
      orgId: 'org-synthetic-1',
      principalId: 'principal-synthetic-a',
      appDomain: 'synthetic-app',
      resource: 'rec-1',
      action: 'read',
      now: new Date('2026-01-01T00:16:00.000Z'),
    })
    expect(expired.allowed).toBe(false)
    expect(getState().grants.size).toBe(0)
  })

  it('rejects high-confidence secrets and accepts ordinary text', () => {
    expect(() => rejectSecretIngestion('sk-abcdefghijklmnopqrstuvwxyz123456')).toThrow(/KeyVaultClient/)
    expect(() => rejectSecretIngestion('a synthetic note about a vault reference')).not.toThrow()
  })

  it('exports one principal and audits the call', () => {
    const { a } = seedPair()
    const bundle = exportPrincipalRecords({
      orgId: 'org-synthetic-1',
      principalId: 'principal-synthetic-a',
      actor: { kind: 'principal', id: 'principal-synthetic-a' },
      purpose: 'synthetic portability',
      authorizationBasis: 'principal_self_access',
      correlationId: 'corr-synthetic-1',
    })
    expect(bundle.records).toHaveLength(1)
    expect(bundle.records[0]?.recordId).toBe(a.id)
    expect(bundle.records[0]?.relationships[0]?.targetId).toBe('ev-synthetic-1')
    expect(bundle.records[0]?.evidenceRefs[0]?.refId).toBe('ev-synthetic-1')
    expect(bundle.records[0]?.jurisdiction).toBe('CA-synthetic')
    expect(bundle.records[0]?.decisions[0]?.id).toBe('dec-synthetic-1')
    expect(bundle.classification).toBe('RESTRICTED')
    expect(getState().audit.some((event) => event.action === 'restricted.export' && event.purpose === 'synthetic portability')).toBe(true)
    expect(() => exportPrincipalRecords({
      orgId: 'org-synthetic-1',
      principalId: 'principal-synthetic-b',
      actor: { kind: 'principal', id: 'principal-synthetic-a' },
      purpose: 'synthetic bulk',
      authorizationBasis: 'none',
      correlationId: 'corr-synthetic-2',
    })).toThrow(/another principal/)
  })

  it('separates active deletion from backup aging and blocks a hold', () => {
    const statement = stateRetention({
      category: 'restricted_personal_envelope',
      policyId: 'unassigned',
      rationale: 'No CIVITAS duration is assigned by the platform.',
      reviewDate: '2027-01-01',
      durationDays: null,
    })
    expect(statement.deletionEligible).toBe(false)
    expect(statement.durationDays).toBeNull()
    expect(() => stateRetention({
      category: 'civitas-personal',
      policyId: 'invented',
      rationale: 'should not stick',
      reviewDate: '2027-01-01',
      durationDays: 30,
    })).toThrow(/invent/)

    const { a } = seedPair()
    const hold = placeLegalHold({
      scope: { orgId: 'org-synthetic-1', resourceId: a.id },
      reason: 'synthetic preservation',
      authorityRef: 'hold-synthetic-1',
      authorityKind: 'platform_privacy',
      reviewer: 'reviewer-synthetic',
      start: '2026-01-01T00:00:00.000Z',
      reviewDue: '2027-04-01T00:00:00.000Z',
      expiresAt: '2027-06-01T00:00:00.000Z',
    })
    expect(() => placeLegalHold({
      scope: { orgId: 'org-synthetic-1' },
      reason: 'synthetic app hold',
      authorityRef: 'hold-synthetic-2',
      authorityKind: 'civitas',
      reviewer: 'reviewer-synthetic',
      start: '2026-01-01T00:00:00.000Z',
      reviewDue: '2027-04-01T00:00:00.000Z',
      expiresAt: '2027-06-01T00:00:00.000Z',
    })).toThrow(/cannot declare/)
    expect(() => deleteRestrictedRecord({
      orgId: 'org-synthetic-1',
      principalId: 'principal-synthetic-a',
      recordId: a.id,
      actor: { kind: 'principal', id: 'principal-synthetic-a' },
      purpose: 'synthetic erasure',
      authorizationBasis: 'principal_self_access',
    })).toThrow(/preserves/)
    releaseLegalHold(hold.id, { releasedBy: 'reviewer-synthetic', releaseEvent: 'synthetic release' })
    const deleted = deleteRestrictedRecord({
      orgId: 'org-synthetic-1',
      principalId: 'principal-synthetic-a',
      recordId: a.id,
      actor: { kind: 'principal', id: 'principal-synthetic-a' },
      purpose: 'synthetic erasure',
      authorizationBasis: 'principal_self_access',
      now: new Date('2026-02-01T00:00:00.000Z'),
    })
    expect(deleted.primary).toBe('ACTIVE_DATA_DELETED')
    expect(deleted.backups).toBe('HISTORICAL_BACKUP_AGING_OUT')
    expect(deleted.retainsFieldValues).toBe(false)
    expect(deleted.propagation.replicas).toBe('PROPAGATION_REQUESTED')
    expect(deleted.backupRuntimeVerified).toBe(false)
    expect(JSON.stringify(deleted)).not.toContain('synthetic-account-a')
    expect(() => readRestrictedRecord({
      orgId: 'org-synthetic-1',
      principalId: 'principal-synthetic-a',
      recordId: a.id,
      actor: { kind: 'principal', id: 'principal-synthetic-a' },
      purpose: 'synthetic read after delete',
      authorizationBasis: 'principal_self_access',
      serviceOrAgent: 'principal',
    })).toThrow(/deleted/)
  })

  it('does not grant continuity delegate access', () => {
    expect(() => proposeDelegation({
      orgId: 'org-synthetic-1',
      principalId: 'principal-synthetic-a',
      delegateId: 'delegate-synthetic',
      scope: 'read',
      activationCondition: 'system_incapacity_determination',
      durationMinutes: 30,
    })).toThrow(/incapacity/)
    const delegation = proposeDelegation({
      orgId: 'org-synthetic-1',
      principalId: 'principal-synthetic-a',
      delegateId: 'delegate-synthetic',
      scope: 'read proposition',
      activationCondition: 'external_order_synthetic',
      durationMinutes: 30,
    })
    reviewDelegation({ delegationId: delegation.id, reviewer: 'reviewer-synthetic', decision: 'APPROVED' })
    const activated = activateDelegation({ delegationId: delegation.id, attestationSource: 'external_authority' })
    expect(activated.accessGranted).toBe(false)
    expect(getState().grants.size).toBe(0)
  })

  it('keeps residency, encryption, and provider evidence from being upgraded', () => {
    expect(residencyClaims().every((claim) => claim.evidence !== 'RUNTIME_VERIFIED')).toBe(true)
    expect(residencyClaims().find((claim) => claim.id === 'azure-openai-eastus2-whisper')?.crossBorder).toBe(true)
    const cmk = encryptionAssurance().find((item) => item.control === 'customer_managed_key')
    expect(cmk?.evidence).toBe('UNVERIFIED')
    expect(cmk?.runtimeVerified).toBe(false)
    expect(CONTROL_EVIDENCE.find((item) => item.id === 'provider_zero_retention')?.evidence).toBe('UNVERIFIED')
    expect(CIVITAS_PLATFORM_CONTRACT.phase3).toBe('CLOSED')
  })

  it('reruns the red team without auto-passing unverified propagation', () => {
    const results = rerunRedTeam()
    const failed = results.filter((result) => result.disposition === 'FAILED')
    expect(failed).toEqual([])
    expect(results.find((result) => result.id === 'R6')?.phase3Blocker).toBe(true)
    expect(results.find((result) => result.id === 'R3')?.phase3Blocker).toBe(false)
    expect(results.find((result) => result.id === 'R7')?.phase3Blocker).toBe(false)
  })
})
