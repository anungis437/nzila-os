import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { activateBreakGlass, evaluateBreakGlassAccess } from './break-glass'
import { classifyRecord } from './classification'
import { deleteRestrictedRecord, exportPrincipalRecords, placeLegalHold, stateRetention } from './lifecycle'
import { bodiesSafeForPersistence, evaluateRestrictedModelPath } from './model-policy'
import { redactObservabilityRecord } from './observability'
import { grantRestrictedAccess, putRestrictedRecord, readRestrictedRecord } from './principal'
import { resetPlatformState } from './state'

const scope = { orgId: 'org-synthetic-1', principalId: 'principal-synthetic-a' }
const actor = { kind: 'principal' as const, id: scope.principalId }
const basis = { purpose: 'synthetic review', authorizationBasis: 'principal-grant' }
const service = { kind: 'agent' as const, id: 'agent-synthetic', actingForPrincipalId: scope.principalId }

function record(overrides: Partial<Parameters<typeof putRestrictedRecord>[0]> = {}) {
  return putRestrictedRecord({
    ...scope, appId: 'synthetic-app', category: 'synthetic-envelope',
    explicitTier: 'RESTRICTED', jurisdiction: 'CA-synthetic',
    fields: { proposition: 'synthetic proposition', bankAccount: 'synthetic-account', nested: { note: 'original' } },
    ...overrides,
  })
}

function request(recordId: string) {
  return { ...scope, ...basis, actor, recordId, serviceOrAgent: 'principal' }
}

function grant(overrides: Partial<Parameters<typeof grantRestrictedAccess>[0]> = {}) {
  return grantRestrictedAccess({
    ...scope, ...basis, actorKind: 'agent', actorId: service.id,
    actions: ['read'], grantedBy: scope.principalId, ...overrides,
  })
}

function emergency(recordId: string, overrides: Record<string, unknown> = {}) {
  return activateBreakGlass({
    actorId: 'admin-synthetic', reason: 'synthetic bounded emergency', durationMinutes: 15,
    scope: { ...scope, appDomain: 'synthetic-app', resource: recordId, action: 'read', ...overrides },
  })
}

describe('Restricted access boundaries', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-10-17T12:00:00Z'))
    resetPlatformState()
  })
  afterEach(() => vi.useRealTimers())

  it('binds emergency access to its actor and organization', () => {
    const item = record()
    const activation = emergency(item.id)
    const access = { activationId: activation.id, actorId: 'admin-synthetic', ...scope, appDomain: 'synthetic-app', resource: item.id, action: 'read' as const }
    expect(evaluateBreakGlassAccess(access).allowed).toBe(true)
    expect(evaluateBreakGlassAccess({ ...access, actorId: 'other-synthetic' }).allowed).toBe(false)
    expect(evaluateBreakGlassAccess({ ...access, orgId: 'org-synthetic-2' }).allowed).toBe(false)
    expect(() => readRestrictedRecord({ ...request(item.id), actor: { kind: 'principal', id: 'other-synthetic' }, breakGlassId: activation.id })).toThrow(/actor or organization/)
  })

  it('does not let request hints replace the actual app or record', () => {
    const first = record()
    const second = record()
    const activation = emergency(first.id)
    const emergencyActor = { kind: 'principal' as const, id: 'admin-synthetic' }
    expect(() => readRestrictedRecord({ ...request(first.id), actor: emergencyActor, breakGlassId: activation.id })).not.toThrow()
    expect(() => readRestrictedRecord({ ...request(second.id), actor: emergencyActor, breakGlassId: activation.id, resource: first.id })).toThrow(/actual record/)
    const wrongApp = emergency(first.id, { appDomain: 'different-synthetic-app' })
    expect(() => readRestrictedRecord({ ...request(first.id), actor: emergencyActor, breakGlassId: wrongApp.id, appDomain: 'different-synthetic-app' })).toThrow(/actual record/)
  })

  it('does not revive an expired emergency with a caller clock or returned-object mutation', () => {
    const item = record()
    const activation = emergency(item.id)
    activation.expiresAt = '2099-01-01T00:00:00Z'
    vi.setSystemTime(new Date('2026-10-17T12:16:00Z'))
    const forged = { ...request(item.id), actor: { kind: 'principal' as const, id: 'admin-synthetic' }, breakGlassId: activation.id, now: new Date('2026-10-17T12:01:00Z') }
    expect(() => readRestrictedRecord(forged)).toThrow(/expired/)
  })

  it('rejects unbounded emergency scopes', () => {
    const item = record()
    expect(() => emergency(item.id, { orgId: '*' })).toThrow(/wildcards/)
    expect(() => emergency(item.id, { appDomain: '*' })).toThrow(/wildcards/)
    expect(() => emergency(item.id, { resource: '*' })).toThrow(/wildcards/)
    expect(() => emergency(item.id, { orgId: undefined })).toThrow(/one org/)
  })

  it('requires an export action rather than treating a read grant as an export grant', () => {
    const item = record()
    const readOnly = grant()
    readOnly.actions.push('export')
    expect(readRestrictedRecord({ ...request(item.id), actor: service }).allowed).toBe(true)
    expect(() => exportPrincipalRecords({ ...scope, ...basis, actor: service, correlationId: 'synthetic-export' })).toThrow(/explicit grant/)
  })

  it('allows an explicit export grant and refuses a verifier export bundle', () => {
    record()
    grant({ actions: ['export'] })
    expect(exportPrincipalRecords({ ...scope, ...basis, actor: service, correlationId: 'synthetic-export' }).records).toHaveLength(1)
    resetPlatformState()
    record()
    grant({ actions: ['export'], disclosureProfile: 'VERIFIER' })
    expect(() => exportPrincipalRecords({ ...scope, ...basis, actor: service, correlationId: 'synthetic-export' })).toThrow(/minimum disclosure/)
  })

  it('binds grants to their principal, purpose and authorization basis', () => {
    const item = record()
    grant()
    expect(() => readRestrictedRecord({ ...request(item.id), actor: { kind: 'agent', id: service.id } })).toThrow(/another principal/)
    expect(() => readRestrictedRecord({ ...request(item.id), actor: service, purpose: 'different synthetic purpose' })).toThrow(/explicit grant/)
    expect(() => readRestrictedRecord({ ...request(item.id), actor: service, authorizationBasis: 'different basis' })).toThrow(/explicit grant/)
  })

  it('rejects malformed expiry and cannot backdate access to revive an expired grant', () => {
    const item = record()
    expect(() => grant({ expiresAt: 'not-a-date' })).toThrow(/valid identity/)
    grant({ expiresAt: '2026-10-17T12:01:00Z' })
    vi.setSystemTime(new Date('2026-10-17T12:02:00Z'))
    const forged = { ...request(item.id), actor: service, now: new Date('2026-10-17T12:00:30Z') }
    expect(() => readRestrictedRecord(forged)).toThrow(/explicit grant/)
  })

  it('does not permit another principal or an agent with a read grant to delete a record', () => {
    const item = record()
    grant()
    const deletion = { ...scope, ...basis, recordId: item.id, actor }
    expect(() => deleteRestrictedRecord({ ...deletion, actor: { kind: 'principal', id: 'principal-synthetic-b' } })).toThrow(/owning principal/)
    expect(() => deleteRestrictedRecord({ ...deletion, actor: service })).toThrow(/owning principal/)
    expect(readRestrictedRecord(request(item.id)).fields).toHaveProperty('bankAccount')
  })

  it('does not expose mutable aliases to stored fields', () => {
    const fields = { nested: { note: 'original' } }
    const item = record({ fields })
    fields.nested.note = 'input mutation'
    ;(item.fields.nested as { note: string }).note = 'returned-record mutation'
    const firstRead = readRestrictedRecord(request(item.id))
    ;(firstRead.fields.nested as { note: string }).note = 'read-result mutation'
    expect(readRestrictedRecord(request(item.id)).fields).toEqual({ nested: { note: 'original' } })
  })

  it('cannot remove a legal hold by mutating its input or returned snapshot', () => {
    const item = record()
    const holdScope = { ...scope, resourceId: item.id }
    const hold = placeLegalHold({ scope: holdScope, reason: 'synthetic preservation', authorityRef: 'synthetic-authority', authorityKind: 'platform_legal', reviewer: 'synthetic-reviewer', start: '2026-10-17T11:00:00Z', reviewDue: '2026-10-18T12:00:00Z', expiresAt: '2026-10-19T12:00:00Z' })
    holdScope.resourceId = 'different-resource'
    hold.scope.orgId = 'different-org'
    hold.releasedAt = '2026-10-17T11:30:00Z'
    expect(() => deleteRestrictedRecord({ ...request(item.id) })).toThrow(/preserves/)
  })

  it('cannot disable declared preservation through a returned retention statement', () => {
    const item = record()
    const statement = stateRetention({ category: item.category, policyId: 'synthetic-policy', rationale: 'synthetic preservation', reviewDate: '2026-10-18', durationDays: 30, preservationRequired: true })
    statement.preservationRequired = false
    expect(() => deleteRestrictedRecord({ ...request(item.id) })).toThrow(/requires preservation/)
  })

  it('rejects raw Restricted values copied into audit purpose before allowing access', () => {
    const item = record()
    expect(() => readRestrictedRecord({ ...request(item.id), purpose: 'synthetic-account' })).toThrow(/repeated a raw payload value/)
  })

  it('does not let an untyped caller replace verifier minimum disclosure', () => {
    const item = record()
    grant({ disclosureProfile: 'VERIFIER' })
    const untyped = { ...request(item.id), actor: service, disclosureProfile: 'FULL' } as unknown as Parameters<typeof readRestrictedRecord>[0]
    expect(() => readRestrictedRecord(untyped)).toThrow(/Unknown Restricted/)
    expect(readRestrictedRecord({ ...request(item.id), actor: service }).fields).not.toHaveProperty('bankAccount')
  })

  it('fails closed on nested sensitive fields, marked snapshots and empty classifications', () => {
    for (const fields of [{ nested: [{ bank_account: 'synthetic' }] }, { nested: { classification: 'RESTRICTED', text: 'synthetic' } }]) {
      expect(() => classifyRecord({ appId: 'synthetic-app', explicitTier: 'PUBLIC', fields })).toThrow(/Restricted/)
    }
    expect(() => classifyRecord({ appId: 'synthetic-app', explicitTier: '' as never, sensitiveSchema: true })).toThrow(/Unknown classification/)
  })

  it('drops arbitrary marked Restricted values while retaining diagnostic stack frames', () => {
    const output = redactObservabilityRecord({ classification: 'RESTRICTED', arbitrary: 'private synthetic narrative', message: 'private synthetic narrative', errorStack: 'Error: private synthetic narrative\n    at handler (synthetic.ts:1:1)' })
    expect(JSON.stringify(output)).not.toContain('private synthetic narrative')
    expect(JSON.stringify(output)).toContain('at handler')
    const circular: Record<string, unknown> = { bank_account: 'synthetic-account' }
    circular.self = circular
    expect(() => JSON.stringify(redactObservabilityRecord(circular))).not.toThrow()
    expect(JSON.stringify(redactObservabilityRecord(circular))).not.toContain('synthetic-account')
  })

  it('denies unrecognized model classifications and refuses to persist their bodies', () => {
    const classification = 'restricted' as never
    expect(evaluateRestrictedModelPath({ classification }).allowed).toBe(false)
    const bodies = bodiesSafeForPersistence({ classification, requestBody: { private: 'synthetic' }, responseBody: { private: 'synthetic' } })
    expect(bodies.persisted).toBe(false)
    expect(JSON.stringify(bodies)).not.toContain('"private"')
  })
})
