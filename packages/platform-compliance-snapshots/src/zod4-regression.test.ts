import { describe, expect, it } from 'vitest'
import { complianceSnapshotSchema, snapshotChainEntrySchema } from './types'
describe('Zod 4 compliance snapshot boundary', () => {
  const orgId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
  const snapshot = { snapshotId: 'snapshot-1', orgId, version: 1, status: 'collected', collectedAt: '2026-11-02T00:00:00Z', collectedBy: 'collector', controls: [], summary: { totalControls: 0, compliant: 0, nonCompliant: 0, partial: 0, notAssessed: 0, complianceScore: 0 }, metadata: { source: 'collector' } }
  it('preserves string metadata and rejects incorrect values and org IDs', () => {
    expect(complianceSnapshotSchema.parse(snapshot).metadata).toEqual(snapshot.metadata)
    expect(complianceSnapshotSchema.safeParse({ ...snapshot, metadata: { source: 42 } }).success).toBe(false)
    expect(complianceSnapshotSchema.safeParse({ ...snapshot, orgId: 'wrong' }).success).toBe(false)
  })
  it('validates hash-chain digest shape', () => {
    const chain = { snapshotId: 'snapshot-1', orgId, version: 1, snapshotHash: 'a'.repeat(64), previousHash: null, chainedAt: '2026-11-02T00:00:00Z' }
    expect(snapshotChainEntrySchema.safeParse(chain).success).toBe(true)
    expect(snapshotChainEntrySchema.safeParse({ ...chain, snapshotHash: 'wrong' }).success).toBe(false)
  })
})
