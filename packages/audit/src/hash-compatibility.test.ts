import { createHash } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { AuditEngine, computeAuditHash } from './engine.js'
import { GENESIS_HASH, auditEntrySchema, verificationResultSchema, type AuditEntry } from './schema.js'
import { InMemoryAuditStore } from './store.js'
import { verifyChain, verifyOrgChain } from './verify.js'
import { InMemorySnapshotStore, createRootHashSnapshot } from './snapshot.js'
import { exportAuditLog } from './export.js'

const input = { actorId: 'synthetic-actor', orgId: 'synthetic-org', action: 'grant', resource: 'tool', payload: { grant: { allowNetwork: false } } }

// Reproduce the pre-fix writer independently; historical records have no version field.
function legacyEntry(prevHash = GENESIS_HASH): AuditEntry {
  const payload = { id: '00000000-0000-4000-8000-000000000001', timestamp: '2026-01-01T00:00:00.000Z', ...input }
  const hash = createHash('sha256').update(prevHash + JSON.stringify(payload, Object.keys(payload).sort())).digest('hex')
  return { ...payload, hash, prevHash }
}

describe('versioned audit compatibility', () => {
  it('retains historical hashes without pretending their nested data was covered', () => {
    const old = legacyEntry()
    const { hash: _hash, prevHash: _prev, ...payload } = old
    expect(computeAuditHash(old.prevHash, payload, 1)).toBe(old.hash)
    expect(auditEntrySchema.parse(old).hashVersion).toBeUndefined()
    const verification = verifyChain([old])
    expect(verification).toMatchObject({ valid: true, hashCoverage: 'LEGACY_PARTIAL', legacyEntriesChecked: 1 })
    expect(verificationResultSchema.parse(verification)).toEqual(verification)
    expect(verificationResultSchema.parse({ valid: true, entriesChecked: 1 })).toEqual({ valid: true, entriesChecked: 1 })
    const tampered = { ...old, payload: { grant: { allowNetwork: true } } }
    expect(verifyChain([tampered]).hashCoverage).toBe('LEGACY_PARTIAL')
    expect(verifyChain([tampered], { requireFullCoverage: true }).valid).toBe(false)
  })

  it('appends v2 after legacy without rewriting history or changing a historical snapshot', async () => {
    const store = new InMemoryAuditStore()
    const old = legacyEntry()
    await store.append(old)
    const snapshots = new InMemorySnapshotStore()
    const snapshot = await createRootHashSnapshot(store, snapshots, input.orgId)
    const entry = await new AuditEngine(store).record(input)
    expect(entry.hashVersion).toBe(2)
    expect(entry.prevHash).toBe(old.hash)
    expect(old.hashVersion).toBeUndefined()
    expect(snapshot.rootHash).toBe(old.hash)
    expect(await verifyOrgChain(store, input.orgId)).toMatchObject({ valid: true, hashCoverage: 'LEGACY_PARTIAL', legacyEntriesChecked: 1 })
    expect((await verifyOrgChain(store, input.orgId, { requireFullCoverage: true })).valid).toBe(false)
    expect(verifyChain([{ ...old, hashVersion: 1 }, entry]).valid).toBe(true)
  })

  it('binds the version so removing or changing a v2 marker does not downgrade verification', async () => {
    const entry = await new AuditEngine(new InMemoryAuditStore()).record(input)
    const { hashVersion: _version, ...unversioned } = entry
    expect(verifyChain([unversioned]).valid).toBe(false)
    expect(verifyChain([{ ...entry, hashVersion: 1 }]).valid).toBe(false)
    expect(verifyChain([{ ...entry, hashVersion: 3 } as unknown as AuditEntry]).valid).toBe(false)
  })

  it('rejects a legacy hash after a chain has transitioned to v2', async () => {
    const entry = await new AuditEngine(new InMemoryAuditStore()).record(input)
    expect(verifyChain([entry, legacyEntry(entry.hash)])).toMatchObject({ valid: false, error: 'Audit hash version downgrade after v2' })
  })

  it('marks all-new chains as fully covered and preserves the version in JSON and CSV exports', async () => {
    const store = new InMemoryAuditStore()
    await new AuditEngine(store).record(input)
    expect(await verifyOrgChain(store, input.orgId, { requireFullCoverage: true })).toMatchObject({ valid: true, hashCoverage: 'FULL', legacyEntriesChecked: 0 })
    const json = await exportAuditLog(store, { orgId: input.orgId })
    expect(JSON.parse(json.data)[0].hashVersion).toBe(2)
    const csv = await exportAuditLog(store, { orgId: input.orgId, format: 'csv' })
    expect(csv.data.split('\n')[0].endsWith('hashVersion')).toBe(true)
    expect(csv.data.split('\n')[1].endsWith('"2"')).toBe(true)
  })

  it('fails closed for unsupported/cyclic payloads without appending', async () => {
    const store = new InMemoryAuditStore()
    const cycle: Record<string, unknown> = {}
    cycle.self = cycle
    await expect(new AuditEngine(store).record({ ...input, payload: cycle })).rejects.toThrow()
    expect(store.getAll()).toHaveLength(0)
    expect(verifyChain([{ ...legacyEntry(), hashVersion: 2, payload: cycle }]).valid).toBe(false)
    expect(() => computeAuditHash(GENESIS_HASH, input, 3 as 2)).toThrow('Unsupported audit hash version')
  })

  it.each([null, 0, 3, '1', '2', false])('rejects malformed persisted version %s without fallback', async version => {
    const malformed = { ...legacyEntry(), hashVersion: version } as unknown as AuditEntry
    expect(auditEntrySchema.safeParse(malformed).success).toBe(false)
    expect(verifyChain([malformed])).toMatchObject({ valid: false, error: 'Unsupported audit hash version' })
    await expect(new InMemoryAuditStore().append(malformed)).rejects.toThrow()
  })

  it('does not fall back to v1 when a v2 marker carries a valid legacy hash', () => {
    expect(verifyChain([{ ...legacyEntry(), hashVersion: 2 }])).toMatchObject({ valid: false })
  })

  it('never describes a legacy chain as fully covered, including invalid genesis', () => {
    expect(verifyChain([{ ...legacyEntry(), prevHash: 'invalid' }])).toMatchObject({
      valid: false, hashCoverage: 'LEGACY_PARTIAL',
    })
  })

  it.each(['json', 'csv'] as const)('rejects unknown versions in %s exports rather than normalizing them to v1', async format => {
    const store = new InMemoryAuditStore()
    store.getEntries = async () => [{ ...legacyEntry(), hashVersion: null } as unknown as AuditEntry]
    await expect(exportAuditLog(store, { orgId: input.orgId, format })).rejects.toThrow('Unsupported audit hash version')
  })

  it('rejects an explicit v1 downgrade even with a correctly recomputed legacy hash', async () => {
    const entry = await new AuditEngine(new InMemoryAuditStore()).record(input)
    expect(verifyChain([entry, { ...legacyEntry(entry.hash), hashVersion: 1 }])).toMatchObject({
      valid: false, error: 'Audit hash version downgrade after v2',
    })
  })

  it('round-trips a mixed JSON export without rewriting version markers or coverage', async () => {
    const store = new InMemoryAuditStore()
    const old = legacyEntry()
    await store.append(old)
    await new AuditEngine(store).record(input)
    const exported = await exportAuditLog(store, { orgId: input.orgId })
    const restored = new InMemoryAuditStore()
    for (const entry of JSON.parse(exported.data)) await restored.append(auditEntrySchema.parse(entry))
    expect((await restored.getEntry(old.id))?.hashVersion).toBeUndefined()
    expect(await verifyOrgChain(restored, input.orgId)).toMatchObject({
      valid: true, hashCoverage: 'LEGACY_PARTIAL', legacyEntriesChecked: 1,
    })
    expect((await verifyOrgChain(restored, input.orgId, { requireFullCoverage: true })).valid).toBe(false)
    const csv = await exportAuditLog(restored, { orgId: input.orgId, format: 'csv' })
    expect(csv.data.split('\n').slice(1).map(row => row.slice(-3))).toEqual(['"1"', '"2"'])
  })

  it('fails closed if a host loses the v2 version in persistence', async () => {
    const entry = await new AuditEngine(new InMemoryAuditStore()).record(input)
    const { hashVersion: _version, ...lostVersion } = JSON.parse(JSON.stringify(entry))
    expect(verifyChain([lostVersion])).toMatchObject({ valid: false })
  })

  it('refuses to append behind an unknown version returned by a host', async () => {
    const store = new InMemoryAuditStore()
    store.getLastEntry = async () => ({ ...legacyEntry(), hashVersion: 3 } as unknown as AuditEntry)
    await expect(new AuditEngine(store).record(input)).rejects.toThrow('Unsupported audit hash version')
    expect(store.getAll()).toHaveLength(0)
  })

  it('does not certify a truncated or cross-organization host response', async () => {
    const store = new InMemoryAuditStore()
    await new AuditEngine(store).record(input)
    store.getEntryCount = async () => 100_001
    expect(await verifyOrgChain(store, input.orgId)).toMatchObject({
      valid: false, error: 'Audit store did not return the complete organization chain',
    })
    store.getEntryCount = async () => 1
    expect((await verifyOrgChain(store, 'another-org')).valid).toBe(false)
  })

  it('rejects a cryptographically linked chain spanning organizations', async () => {
    const store = new InMemoryAuditStore()
    const first = await new AuditEngine(store).record(input)
    const second = await new AuditEngine(store).record({ ...input, orgId: 'another-org' })
    const { hash: _hash, prevHash: _prev, hashVersion: _version, traceId: _trace, spanId: _span, ...hashable } = second
    const linked = { ...second, prevHash: first.hash, hash: computeAuditHash(first.hash, hashable) }
    expect(verifyChain([first, linked])).toMatchObject({ valid: false, error: 'Audit chain contains multiple organizations' })
  })
})
