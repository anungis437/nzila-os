/**
 * Tests for SnapshotChain — hash chain integrity.
 */
import { describe, it, expect } from 'vitest'
import type { ChainPorts, ComplianceSnapshot, SnapshotChainEntry } from '../types'
import { SnapshotChain, computeSnapshotHash } from '../chain'

// ── Fixtures ────────────────────────────────────────────────────────────────

const ORG_ID = '00000000-0000-0000-0000-000000000001'

function makeSnapshot(version: number, orgId: string = ORG_ID): ComplianceSnapshot {
  return {
    snapshotId: `snap-${String(version)}`,
    orgId,
    version,
    status: 'collected',
    collectedAt: '2025-01-15T00:00:00.000Z',
    collectedBy: 'system',
    controls: [
      {
        controlId: `AC-0${String(version)}`,
        controlFamily: 'access',
        title: `Access Control ${String(version)}`,
        status: 'compliant',
        evidence: [],
        lastAssessedAt: '2025-01-15T00:00:00.000Z',
        assessedBy: 'auditor@nzila.io',
      },
    ],
    summary: {
      totalControls: 1,
      compliant: 1,
      nonCompliant: 0,
      partial: 0,
      notAssessed: 0,
      complianceScore: 100,
    },
    metadata: {},
  }
}

function makeInMemoryChainPorts(): ChainPorts & { chain: SnapshotChainEntry[] } {
  const chain: SnapshotChainEntry[] = []
  return {
    chain,
    loadChain: async (orgId: string) => chain.filter((e) => e.orgId === orgId),
    appendEntry: async (entry: SnapshotChainEntry) => {
      chain.push(entry)
    },
  }
}

// ── computeSnapshotHash ─────────────────────────────────────────────────────

describe('computeSnapshotHash', () => {
  it('should produce a 64-char hex hash', () => {
    const snapshot = makeSnapshot(1)
    const hash = computeSnapshotHash(snapshot)

    expect(hash).toMatch(/^[a-f0-9]{64}$/)
  })

  it('should produce deterministic hashes', () => {
    const snapshot = makeSnapshot(1)
    const hash1 = computeSnapshotHash(snapshot)
    const hash2 = computeSnapshotHash(snapshot)

    expect(hash1).toBe(hash2)
  })

  it('should produce different hashes for different snapshots', () => {
    const snap1 = makeSnapshot(1)
    const snap2 = makeSnapshot(2)

    expect(computeSnapshotHash(snap1)).not.toBe(computeSnapshotHash(snap2))
  })
})

// ── SnapshotChain ───────────────────────────────────────────────────────────

describe('SnapshotChain', () => {
  it('should append genesis entry with null previousHash', async () => {
    const ports = makeInMemoryChainPorts()
    const chain = new SnapshotChain(ports)
    const snapshot = makeSnapshot(1)

    const entry = await chain.append(snapshot)

    expect(entry.snapshotId).toBe('snap-1')
    expect(entry.previousHash).toBeNull()
    expect(entry.snapshotHash).toMatch(/^[a-f0-9]{64}$/)
    expect(entry.version).toBe(1)
    expect(ports.chain).toHaveLength(1)
  })

  it('should link subsequent entries to previous hash', async () => {
    const ports = makeInMemoryChainPorts()
    const chain = new SnapshotChain(ports)

    const entry1 = await chain.append(makeSnapshot(1))
    const entry2 = await chain.append(makeSnapshot(2))

    expect(entry2.previousHash).toBe(entry1.snapshotHash)
    expect(entry2.snapshotHash).not.toBe(entry1.snapshotHash)
    expect(ports.chain).toHaveLength(2)
  })

  it('should build a chain of 5 entries with correct linkage', async () => {
    const ports = makeInMemoryChainPorts()
    const chain = new SnapshotChain(ports)

    for (let i = 1; i <= 5; i++) {
      await chain.append(makeSnapshot(i))
    }

    expect(ports.chain).toHaveLength(5)
    expect(ports.chain[0]!.previousHash).toBeNull()

    for (let i = 1; i < ports.chain.length; i++) {
      expect(ports.chain[i]!.previousHash).toBe(ports.chain[i - 1]!.snapshotHash)
    }
  })

  it('should verify a valid chain', async () => {
    const ports = makeInMemoryChainPorts()
    const chain = new SnapshotChain(ports)

    await chain.append(makeSnapshot(1))
    await chain.append(makeSnapshot(2))
    await chain.append(makeSnapshot(3))

    const result = await chain.verify(ORG_ID)

    expect(result.valid).toBe(true)
    expect(result.totalEntries).toBe(3)
    expect(result.brokenAt).toBeNull()
    expect(result.errors).toHaveLength(0)
  })

  it('should detect a broken chain', async () => {
    const ports = makeInMemoryChainPorts()
    const chain = new SnapshotChain(ports)

    await chain.append(makeSnapshot(1))
    await chain.append(makeSnapshot(2))
    await chain.append(makeSnapshot(3))

    // Tamper with the chain
    const tampered: SnapshotChainEntry = {
      ...ports.chain[1]!,
      snapshotHash: 'a'.repeat(64), // corrupted hash
    }
    ports.chain[1] = tampered

    const result = await chain.verify(ORG_ID)

    expect(result.valid).toBe(false)
    expect(result.brokenAt).toBe(2) // entry 2 references entry 1's hash, which was corrupted
    expect(result.errors.length).toBeGreaterThan(0)
  })

  it('should verify an empty chain as valid', async () => {
    const ports = makeInMemoryChainPorts()
    const chain = new SnapshotChain(ports)

    const result = await chain.verify(ORG_ID)

    expect(result.valid).toBe(true)
    expect(result.totalEntries).toBe(0)
  })

  it('should detect genesis entry with non-null previousHash', async () => {
    const ports = makeInMemoryChainPorts()
    const chain = new SnapshotChain(ports)

    // Manually insert a genesis entry with non-null previousHash
    const snapshot = makeSnapshot(1)
    const hash = computeSnapshotHash(snapshot)
    ports.chain.push({
      snapshotId: snapshot.snapshotId,
      orgId: ORG_ID,
      version: 1,
      snapshotHash: hash,
      previousHash: 'f'.repeat(64), // should be null for genesis
      createdAt: new Date().toISOString(),
    })

    const result = await chain.verify(ORG_ID)

    expect(result.valid).toBe(false)
    expect(result.brokenAt).toBe(0)
    expect(result.errors[0]).toContain('Genesis entry')
    expect(result.errors[0]).toContain('non-null previousHash')
  })

  it('should load chain entries', async () => {
    const ports = makeInMemoryChainPorts()
    const chain = new SnapshotChain(ports)

    await chain.append(makeSnapshot(1))
    await chain.append(makeSnapshot(2))

    const loaded = await chain.loadChain(ORG_ID)
    expect(loaded).toHaveLength(2)
  })

  it('should detect chain entry with null previousHash at non-genesis position', async () => {
    const ports = makeInMemoryChainPorts()
    const chain = new SnapshotChain(ports)

    // Build a 3-entry chain normally
    await chain.append(makeSnapshot(1))
    await chain.append(makeSnapshot(2))
    await chain.append(makeSnapshot(3))

    // Corrupt entry 2 to have null previousHash
    ports.chain[2] = { ...ports.chain[2]!, previousHash: null as unknown }

    const result = await chain.verify(ORG_ID)

    expect(result.valid).toBe(false)
    expect(result.brokenAt).toBe(2)
    expect(result.errors[0]).toContain('Chain broken')
    expect(result.errors[0]).toContain("'null...'")
  })
})
