import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { auditRecords } from '@nzila/db/schema'
import type { AuditReadAccessContext } from '@/lib/api-auth'

const m = vi.hoisted(() => ({
  find: vi.fn(),
  list: vi.fn(),
  verify: vi.fn(),
  chain: vi.fn(),
  pack: vi.fn(),
}))
vi.mock('@/lib/repositories/audit-record-repository', () => ({
  findAuditRecordById: m.find,
  listAuditExportRecords: m.list,
}))
vi.mock('@nzila/nar', () => ({
  verifyNarRecord: m.verify,
  verifyFullChain: m.chain,
  buildNarExportPack: m.pack,
}))

const org = '11111111-1111-4111-8111-111111111111'
const row: typeof auditRecords.$inferSelect = {
  id: 'record',
  decisionRecordId: 'decision',
  organizationId: org,
  decisionType: 'workflow',
  actionType: 'authorize',
  actorId: 'canonical-actor',
  actorType: 'user',
  resourceType: 'workflow',
  resourceId: 'resource',
  policyId: 'policy',
  policyVersion: '1',
  inputHash: 'input',
  outcomeHash: 'outcome',
  payload: {},
  narHash: 'sealed',
  narSignature: 'signature',
  previousHash: null,
  keyId: 'key',
  storageType: 'local_sandbox',
  storageUri: 'sandbox://fixture',
  immutable: false,
  retentionUntil: new Date('2033-11-17T00:00:00Z'),
  createdAt: new Date('2026-11-17T00:00:00Z'),
}
const admin: AuditReadAccessContext = { authenticated: true, role: 'admin' }
const auditor: AuditReadAccessContext = {
  authenticated: true,
  role: 'auditor',
  organizationId: org,
  tokenId: 'synthetic-token',
  expiresAt: '2026-11-18T00:00:00Z',
}
beforeEach(() => {
  vi.resetAllMocks()
  m.find.mockResolvedValue(row)
  m.verify.mockResolvedValue({ valid: true })
  m.list.mockResolvedValue([row])
  m.chain.mockResolvedValue({ rootHash: 'root', totalRecords: 1, valid: true })
  m.pack.mockResolvedValue({ records: [], verification: { checksum: 'checksum' } })
})
describe('audit read service scope and truthful immutable-storage projection', () => {
  it('rejects foreign organization requests and scoped auditors before cryptographic verification', async () => {
    const { verifyAuditProof } = await import('./audit-read-service')
    expect(
      (await verifyAuditProof({ auditRecordId: row.id, organizationId: 'foreign' }, admin)).status,
    ).toBe(403)
    m.find.mockResolvedValueOnce({ ...row, organizationId: 'foreign' })
    expect((await verifyAuditProof({ auditRecordId: row.id }, auditor)).status).toBe(403)
    expect(m.verify).not.toHaveBeenCalled()
  })
  it('returns the original missing-record statuses without verifying another record', async () => {
    const { verifyAuditProof } = await import('./audit-read-service')
    m.find.mockResolvedValueOnce(undefined)
    expect((await verifyAuditProof({ auditRecordId: 'absent' }, admin)).status).toBe(404)
    expect((await verifyAuditProof({}, admin)).status).toBe(400)
    expect(m.verify).not.toHaveBeenCalled()
  })
  it('maps the persisted seal faithfully without converting sandbox storage into immutable proof', async () => {
    const { verifyAuditProof } = await import('./audit-read-service')
    expect((await verifyAuditProof({ auditRecordId: row.id }, auditor)).status).toBe(200)
    expect(m.verify).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: org,
        actorId: 'canonical-actor',
        storage: undefined,
        createdAt: row.createdAt.toISOString(),
        seal: expect.objectContaining({
          hash: 'sealed',
          signature: 'signature',
          previousHash: undefined,
        }),
      }),
    )
  })
  it('exports the source-scoped ordered records, verifies their chain, and propagates failure', async () => {
    const { exportAuditRecords } = await import('./audit-read-service')
    const input = { orgId: org, from: null, to: null, limit: 20, generatedBy: 'control-plane' }
    expect(await exportAuditRecords(input)).toMatchObject({
      chainProof: { rootHash: 'root', totalRecords: 1, verified: true },
    })
    expect(m.list).toHaveBeenCalledExactlyOnceWith(input)
    expect(m.chain).toHaveBeenCalledWith({
      organizationId: org,
      records: [expect.objectContaining({ id: row.id })],
    })
    expect(m.chain.mock.invocationCallOrder[0]).toBeLessThan(m.pack.mock.invocationCallOrder[0])
    m.list.mockRejectedValueOnce(new Error('platform ledger unavailable'))
    await expect(exportAuditRecords(input)).rejects.toThrow('platform ledger unavailable')
    expect(m.pack).toHaveBeenCalledTimes(1)
  })
})
