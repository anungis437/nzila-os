import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { DecisionProofAdapterRequest, DecisionRecord } from '@nzila/decision-core'
import type { NarProofAdapterOptions, NarRecord } from '@nzila/nar'

const m = vi.hoisted(() => ({
  storage: vi.fn(),
  values: vi.fn(),
  previous: vi.fn(),
  records: [] as NarRecord[],
}))
vi.mock('@nzila/db/platform', () => ({
  platformDb: {
    select: () => ({ from: () => ({ where: () => ({ orderBy: () => ({ limit: m.previous }) }) }) }),
    insert: () => ({ values: m.values }),
  },
}))
vi.mock('@nzila/db/schema', () => ({
  auditRecords: { narHash: 'nar_hash', organizationId: 'organization_id', createdAt: 'created_at' },
}))
vi.mock('@nzila/nar', async (original) => {
  const actual = await original<typeof import('@nzila/nar')>()
  return {
    ...actual,
    getNarSigningSecret: async () => 'test-only-platform-nar-secret',
    createNarProofAdapter: (options: NarProofAdapterOptions) =>
      actual.createNarProofAdapter({
        ...options,
        persistImmutableStorage: m.storage,
        persistRecord: async (record) => {
          m.records.push(record)
          return options.persistRecord(record)
        },
      }),
  }
})

import { verifyNarRecord } from '@nzila/nar'
import { createPlatformNarProofAdapter } from '@/lib/audit/platform-nar-proof'

const decision: DecisionRecord = {
  id: 'decision-1',
  organizationId: '11111111-1111-4111-8111-111111111111',
  domain: 'commerce',
  resourceType: 'quote',
  resourceId: 'quote-1',
  actor: { id: 'canonical-non-uuid-member', type: 'user' },
  input: { memberId: 'canonical-non-uuid-member' },
  policy: { id: 'commerce.quote.approval', version: '1.0.0', domain: 'commerce' },
  outcome: { status: 'approved' },
  createdAt: '2026-11-17T00:00:00Z',
}
const context = {
  decisionType: 'flow.quote.created',
  actionType: 'quote:create',
  entry: {
    type: 'flow.quote.created',
    domain: 'commerce',
    resourceType: 'quote',
    requiredAuthority: ['quote:create'],
    requiredPolicy: 'commerce.quote.approval',
    auditRequired: true,
    replaySupported: true,
    exportSupported: true,
    retentionClass: 'business_7_year',
    proofRequired: true,
    enforcementLevel: 'block',
  },
} satisfies DecisionProofAdapterRequest

beforeEach(() => {
  vi.clearAllMocks()
  m.records = []
  m.previous.mockResolvedValue([{ hash: 'a'.repeat(64) }])
  m.values.mockResolvedValue(undefined)
  // The fixture models a local sandbox honestly; it supplies no immutable-store proof.
  m.storage.mockResolvedValue({
    type: 'local_sandbox',
    uri: 'sandbox://owned-platform-nar-fixture',
    immutable: false,
    retentionUntil: '2033-11-17T00:00:00Z',
  })
})

describe('platform NAR persistence service', () => {
  it('persists the exact real signed record on the separate platform connection before acknowledging its proof', async () => {
    const proof = await createPlatformNarProofAdapter().createProof(decision, context)
    const record = m.records[0]
    expect((await verifyNarRecord(record, 'test-only-platform-nar-secret')).valid).toBe(true)
    expect(m.values).toHaveBeenCalledWith(
      expect.objectContaining({
        id: record.id,
        decisionRecordId: decision.id,
        organizationId: decision.organizationId,
        actorId: decision.actor.id,
        resourceId: decision.resourceId,
        payload: decision,
        inputHash: record.inputHash,
        outcomeHash: record.outcomeHash,
        narHash: proof.hash,
        narSignature: proof.signature,
        previousHash: 'a'.repeat(64),
        keyId: record.seal.keyId,
        storageType: 'local_sandbox',
        storageUri: 'sandbox://owned-platform-nar-fixture',
        immutable: false,
        createdAt: new Date(record.createdAt),
        retentionUntil: new Date('2033-11-17T00:00:00Z'),
      }),
    )
    expect(proof.auditRecordId).toBe(record.id)
    expect(m.storage.mock.invocationCallOrder[0]).toBeLessThan(m.values.mock.invocationCallOrder[0])
  })
  it('returns no proof or database acknowledgement if storage fails', async () => {
    m.storage.mockRejectedValue(new Error('storage unavailable'))
    await expect(createPlatformNarProofAdapter().createProof(decision, context)).rejects.toThrow(
      'storage unavailable',
    )
    expect(m.values).not.toHaveBeenCalled()
  })
  it('propagates platform persistence failure without substituting an application database write', async () => {
    m.values.mockRejectedValue(new Error('platform ledger unavailable'))
    await expect(createPlatformNarProofAdapter().createProof(decision, context)).rejects.toThrow(
      'platform ledger unavailable',
    )
    expect(m.values).toHaveBeenCalledTimes(1)
  })
})
