import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const state = vi.hoisted(() => ({
  order: [] as string[], find: vi.fn(), persist: vi.fn(), list: vi.fn(),
  create: vi.fn(), secret: vi.fn(), upload: vi.fn(),
}))
vi.mock('server-only', () => ({}))
vi.mock('../../apps/control-plane/lib/repositories/audit-record-repository', () => ({
  findPreviousAuditHash: state.find, persistAuditRecord: state.persist, listAuditRecords: state.list,
}))
vi.mock('../../packages/nar/src/index', () => ({
  createNarRecord: state.create, getNarSigningSecret: state.secret,
  uploadNarToAzureImmutableBlob: state.upload,
}))
import { recordDecisionProof, getAuditRecordHistory } from '../../apps/control-plane/lib/services/audit-proof-service'

const input = {
  decision: { id: 'decision', orgId: 'org' },
  decisionType: 'decision', actionType: 'action',
} as Parameters<typeof recordDecisionProof>[0]

beforeEach(() => {
  vi.resetAllMocks()
  state.order.length = 0
  state.find.mockImplementation(async () => { state.order.push('hash'); return [{ hash: 'previous' }] })
  state.secret.mockImplementation(async () => { state.order.push('secret'); return `secret-${state.order.length}` })
  state.create.mockImplementation(async (options) => {
    state.order.push('create')
    return { ...options, id: 'record', createdAt: '2026-01-01T00:00:00.000Z' }
  })
  state.upload.mockImplementation(async () => { state.order.push('upload'); return { immutable: true } })
  state.persist.mockImplementation(async () => { state.order.push('persist') })
})
afterEach(() => vi.unstubAllEnvs())

describe('A07 proof ordering', () => {
  it('resolves secrets twice at original points and persists only the stored proof', async () => {
    vi.stubEnv('NAR_SIGNING_KEY_ID', 'key')
    const result = await recordDecisionProof(input, 'org')
    expect(state.order).toEqual(['hash', 'secret', 'create', 'upload', 'secret', 'create', 'persist'])
    expect(state.find).toHaveBeenCalledWith('org')
    expect(state.create).toHaveBeenNthCalledWith(1, {
      ...input, previousHash: 'previous', isGenesis: false, keyId: 'key', secret: 'secret-2',
    })
    expect(state.create).toHaveBeenNthCalledWith(2, {
      ...input, recordId: 'record', createdAt: '2026-01-01T00:00:00.000Z',
      previousHash: 'previous', isGenesis: false, keyId: 'key', secret: 'secret-5', storage: { immutable: true },
    })
    expect(state.persist).toHaveBeenCalledExactlyOnceWith(result)
  })
  it('does not persist or resolve the second secret when immutable upload rejects', async () => {
    state.upload.mockRejectedValueOnce(new Error('storage rejected'))
    await expect(recordDecisionProof(input, 'org')).rejects.toThrow('storage rejected')
    expect(state.secret).toHaveBeenCalledTimes(1)
    expect(state.persist).not.toHaveBeenCalled()
  })
  it('preserves genesis and history arguments and propagates persistence rejection', async () => {
    state.find.mockResolvedValueOnce([])
    state.persist.mockRejectedValueOnce(new Error('db rejected'))
    await expect(recordDecisionProof(input, 'org')).rejects.toThrow('db rejected')
    expect(state.create.mock.calls[0][0]).toMatchObject({ isGenesis: true, previousHash: undefined })
    await getAuditRecordHistory('org', 'resource')
    expect(state.list).toHaveBeenCalledExactlyOnceWith('org', 'resource')
  })
})
