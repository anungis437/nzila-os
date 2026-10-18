import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'

const state = vi.hoisted(() => {
  const chain = {
    select: vi.fn(), from: vi.fn(), where: vi.fn(), orderBy: vi.fn(),
    limit: vi.fn(), insert: vi.fn(), values: vi.fn(), update: vi.fn(), set: vi.fn(),
  }
  return {
    chain, adapter: vi.fn((options: unknown) => options), secret: vi.fn(),
    info: vi.fn(), warn: vi.fn(), error: vi.fn(),
  }
})
vi.mock('server-only', () => ({}))
vi.mock('../../packages/db/src/platform', () => ({ platformDb: state.chain }))
vi.mock('../../packages/db/src/index', () => ({
  db: state.chain,
  orgs: { id: 'org.id', clerkOrgId: 'org.clerkId' },
  orgMembers: { id: 'member.id', orgId: 'member.orgId', userId: 'member.userId' },
  flowDomainEvents: 'events', flowPayments: { status: 'payment.status' },
}))
vi.mock('../../packages/db/src/schema/index', () => ({
  auditRecords: { organizationId: 'audit.org', narHash: 'audit.hash', createdAt: 'audit.created', resourceId: 'audit.resource' },
  aiActions: { id: 'action.id' },
}))
vi.mock('../../packages/nar/src/index', () => ({
  createNarProofAdapter: state.adapter, getNarSigningSecret: state.secret,
}))
vi.mock('../../packages/os-core/src/index', () => ({
  createLogger: () => ({ info: state.info, warn: state.warn, error: state.error }),
}))
vi.mock('drizzle-orm', async (importOriginal) => ({
  ...await importOriginal<typeof import('drizzle-orm')>(),
  eq: (column: unknown, value: unknown) => ({ eq: [column, value] }),
  and: (...args: unknown[]) => ({ and: args }),
  desc: (column: unknown) => ({ desc: column }),
  sql: () => 'count(*)',
}))

import { createExecutionProofAdapter } from '../../apps/orchestrator-api/src/services/nar-proof-service'
import { createIncidentProofAdapter } from '../../apps/abr/modules/incidents/nar-proof-service'
import { createOrgProofAdapter } from '../../apps/platform-admin/lib/nar-proof-service'
import { createPayoutProofAdapter } from '../../apps/zonga/lib/nar-proof-service'
import { findAiAction, updateAiAction } from '../../apps/console/lib/services/ai-action-service'
import { countAuditEvents, countPaymentGateBlocks } from '../../apps/flow/lib/services/governance-metrics-service'
import {
  handleOrganizationCreated, handleOrganizationUpdated, handleMembershipCreated,
  handleMembershipDeleted, handleUserDeleted,
} from '../../apps/agrimo/lib/services/identity-sync-service'
import {
  findPreviousAuditHash, persistAuditRecord, listAuditRecords,
} from '../../apps/control-plane/lib/repositories/audit-record-repository'

beforeEach(() => {
  vi.clearAllMocks()
  for (const key of ['select', 'from', 'where', 'orderBy', 'insert', 'update', 'set'] as const) {
    state.chain[key].mockReturnValue(state.chain)
  }
  state.chain.limit.mockResolvedValue([])
  state.chain.values.mockResolvedValue(undefined)
})
afterEach(() => vi.unstubAllEnvs())

type AdapterOptions = Parameters<typeof import('../../packages/nar/src/adapter').createNarProofAdapter>[0]
const record = {
  id: 'record', decisionRecordId: 'decision', organizationId: 'org',
  decisionType: 'decision.type', actionType: 'action.type',
  actorId: 'actor', actorType: 'user', resourceType: 'resource', resourceId: 'resource-id',
  policyId: 'policy', policyVersion: '1', inputHash: 'input', outcomeHash: 'outcome',
  payload: { unchanged: true }, createdAt: '2026-01-01T00:00:00.000Z',
  seal: { hash: 'hash', signature: 'signature', previousHash: 'previous', keyId: 'key' },
  storage: { type: 'azure_blob', uri: 'https://example.invalid/nar', immutable: true, retentionUntil: '2033-01-01T00:00:00.000Z' },
} as Parameters<AdapterOptions['persistRecord']>[0]
const expectedRecord = {
  id: record.id, decisionRecordId: record.decisionRecordId,
  organizationId: record.organizationId, decisionType: record.decisionType,
  actionType: record.actionType, actorId: record.actorId, actorType: record.actorType,
  resourceType: record.resourceType, resourceId: record.resourceId,
  policyId: record.policyId, policyVersion: record.policyVersion,
  inputHash: record.inputHash, outcomeHash: record.outcomeHash, payload: record.payload,
  narHash: record.seal.hash, narSignature: record.seal.signature,
  previousHash: record.seal.previousHash, keyId: record.seal.keyId,
  storageType: record.storage?.type, storageUri: record.storage?.uri,
  immutable: record.storage?.immutable,
  retentionUntil: new Date('2033-01-01T00:00:00.000Z'), createdAt: new Date(record.createdAt),
}

describe.each([
  ['A01', createExecutionProofAdapter], ['A08', createIncidentProofAdapter],
  ['A09', createOrgProofAdapter], ['A10', createPayoutProofAdapter],
] as const)('%s NAR persistence service', (_id, factory) => {
  function options() {
    factory()
    return state.adapter.mock.calls.at(-1)![0] as AdapterOptions
  }
  it('captures the key at invocation and defers secret resolution', () => {
    expect(state.adapter).not.toHaveBeenCalled()
    vi.stubEnv('NAR_SIGNING_KEY_ID', 'key-at-invocation')
    const adapter = options()
    expect(adapter.keyId).toBe('key-at-invocation')
    expect(adapter.getSigningSecret).toBe(state.secret)
    expect(state.secret).not.toHaveBeenCalled()
  })
  it('reads the last hash in the exact organization and descending order', async () => {
    state.chain.limit.mockResolvedValue([{ hash: 'previous' }])
    expect(await options().getPreviousHash!('organization')).toBe('previous')
    expect(state.chain.select).toHaveBeenCalledWith({ hash: 'audit.hash' })
    expect(state.chain.where).toHaveBeenCalledWith({ eq: ['audit.org', 'organization'] })
    expect(state.chain.orderBy).toHaveBeenCalledWith({ desc: 'audit.created' })
    expect(state.chain.limit).toHaveBeenCalledWith(1)
  })
  it('maps every persisted field and preserves insertion rejection', async () => {
    const adapter = options()
    expect(await adapter.persistRecord(record)).toEqual({ auditRecordId: record.id })
    expect(state.chain.values).toHaveBeenCalledWith(expectedRecord)
    state.chain.values.mockRejectedValueOnce(new Error('unavailable'))
    await expect(adapter.persistRecord(record)).rejects.toThrow('unavailable')
  })
  it('keeps genesis and optional storage absent without manufacturing values', async () => {
    const adapter = options()
    expect(await adapter.getPreviousHash!('organization')).toBeUndefined()
    await adapter.persistRecord({ ...record, storage: undefined })
    expect(state.chain.values.mock.calls.at(-1)![0]).toMatchObject({
      retentionUntil: null, storageType: undefined, immutable: undefined,
    })
  })
})

describe('bounded read/write services', () => {
  it('A02 preserves action-id-only predicates and supplied update timestamps', async () => {
    state.chain.limit.mockResolvedValue([{ id: 'action' }])
    expect(await findAiAction('action')).toEqual({ id: 'action' })
    const values = { status: 'approved' as const, approvedBy: 'actor', approvedAt: new Date(), updatedAt: new Date() }
    await updateAiAction('action', values)
    expect(state.chain.where).toHaveBeenNthCalledWith(1, { eq: ['action.id', 'action'] })
    expect(state.chain.where).toHaveBeenNthCalledWith(2, { eq: ['action.id', 'action'] })
    expect(state.chain.set).toHaveBeenCalledWith(values)
  })
  it('A05 keeps the existing global count and overdue predicate', async () => {
    state.chain.from.mockResolvedValueOnce([{ count: 12 }]).mockReturnValue(state.chain)
    expect(await countAuditEvents()).toBe(12)
    state.chain.where.mockResolvedValueOnce([{ count: 3 }])
    expect(await countPaymentGateBlocks()).toBe(3)
    expect(state.chain.where).toHaveBeenCalledWith({ eq: ['payment.status', 'overdue'] })
  })
  it('A07 preserves record mapping and organization/resource history filtering', async () => {
    await findPreviousAuditHash('org')
    await persistAuditRecord(record)
    expect(state.chain.values).toHaveBeenCalledWith(expectedRecord)
    await listAuditRecords('org', 'resource')
    expect(state.chain.where).toHaveBeenLastCalledWith({
      and: [{ eq: ['audit.org', 'org'] }, { eq: ['audit.resource', 'resource'] }],
    })
    expect(state.chain.limit).toHaveBeenLastCalledWith(100)
    await listAuditRecords('org', null)
    expect(state.chain.where).toHaveBeenLastCalledWith({ eq: ['audit.org', 'org'] })
  })
})

describe('A06 identity synchronization', () => {
  it('does not create an existing organization; preserves new organization defaults', async () => {
    state.chain.limit.mockResolvedValueOnce([{ id: 'existing' }])
    await handleOrganizationCreated({ id: 'clerk-org', name: 'Example' })
    expect(state.chain.insert).not.toHaveBeenCalled()
    await handleOrganizationCreated({ id: 'clerk-org' })
    expect(state.chain.values).toHaveBeenCalledWith({
      clerkOrgId: 'clerk-org', legalName: 'Unnamed Organization', jurisdiction: 'CA-ON', status: 'active',
    })
    expect(state.chain.where).toHaveBeenLastCalledWith({ eq: ['org.clerkId', 'clerk-org'] })
    expect(state.chain.limit).toHaveBeenLastCalledWith(1)
  })
  it('propagates storage-adapter rejection before success diagnostics', async () => {
    const failure = new Error('storage unavailable')
    state.chain.limit.mockRejectedValueOnce(failure)
    await expect(handleOrganizationCreated({ id: 'provider-org' })).rejects.toBe(failure)
    expect(state.chain.insert).not.toHaveBeenCalled()
    expect(state.info).not.toHaveBeenCalled()
    state.chain.values.mockRejectedValueOnce(failure)
    await expect(handleOrganizationCreated({ id: 'provider-org' })).rejects.toBe(failure)
    expect(state.info).not.toHaveBeenCalled()
  })
  it.each([['org:admin', 'org_admin'], ['org:secretary', 'org_secretary'], ['org:member', 'org_viewer']])(
    'preserves %s role mapping and membership predicates', async (role, mapped) => {
      state.chain.limit.mockResolvedValueOnce([{ id: 'resolved-org' }]).mockResolvedValueOnce([])
      await handleMembershipCreated({ organization: { id: 'clerk-org' }, public_user_data: { user_id: 'actor' }, role })
      expect(state.chain.values).toHaveBeenCalledWith({
        orgId: 'resolved-org', userId: 'actor', role: mapped, status: 'active',
      })
      expect(state.chain.where).toHaveBeenLastCalledWith({
        and: [{ eq: ['member.orgId', 'resolved-org'] }, { eq: ['member.userId', 'actor'] }],
      })
    },
  )
  it('updates existing memberships without insertion', async () => {
    state.chain.limit.mockResolvedValueOnce([{ id: 'org' }]).mockResolvedValueOnce([{ id: 'membership' }])
    await handleMembershipCreated({ organization: { id: 'clerk-org' }, public_user_data: { user_id: 'actor' } })
    expect(state.chain.insert).not.toHaveBeenCalled()
    expect(state.chain.set).toHaveBeenCalledWith({ role: 'org_viewer', status: 'active', updatedAt: expect.any(Date) })
    expect(state.chain.where).toHaveBeenLastCalledWith({ eq: ['member.id', 'membership'] })
  })
  it('keeps missing/unknown inputs nonmutating and named removals scoped', async () => {
    await handleOrganizationUpdated({ id: 'org' })
    await handleMembershipCreated({})
    await handleMembershipCreated({ organization: { id: 'org' }, public_user_data: { user_id: 'actor' } })
    await handleMembershipDeleted({})
    await handleUserDeleted({})
    expect(state.chain.update).not.toHaveBeenCalled()
    state.chain.limit.mockResolvedValueOnce([{ id: 'org' }])
    await handleMembershipDeleted({ organization: { id: 'clerk-org' }, public_user_data: { user_id: 'actor' } })
    expect(state.chain.where).toHaveBeenLastCalledWith({
      and: [{ eq: ['member.orgId', 'org'] }, { eq: ['member.userId', 'actor'] }],
    })
    await handleUserDeleted({ id: 'actor' })
    expect(state.chain.where).toHaveBeenLastCalledWith({ eq: ['member.userId', 'actor'] })
    await handleOrganizationUpdated({ id: 'clerk-org', name: 'Updated' })
    expect(state.chain.set).toHaveBeenLastCalledWith({ legalName: 'Updated', updatedAt: expect.any(Date) })
    expect(state.chain.where).toHaveBeenLastCalledWith({ eq: ['org.clerkId', 'clerk-org'] })
  })
})
