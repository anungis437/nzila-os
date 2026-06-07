/**
 * Tests for ComplianceVerifier — snapshot and chain verification.
 */
import { describe, it, expect } from 'vitest'
import type {
  ChainPorts,
  ComplianceSnapshot,
  SnapshotChainEntry,
  VerifierPorts,
} from '../types'
import { computeSnapshotHash, SnapshotChain } from '../chain'
import { ComplianceVerifier } from '../verifier'

// ── Fixtures ────────────────────────────────────────────────────────────────

const ORG_ID = '00000000-0000-0000-0000-000000000001'

function makeSnapshot(version: number): ComplianceSnapshot {
  return {
    snapshotId: `snap-${String(version)}`,
    orgId: ORG_ID,
    version,
    status: 'chained',
    collectedAt: '2025-01-15T00:00:00.000Z',
    collectedBy: 'system',
    controls: [
      {
        controlId: `AC-0${String(version)}`,
        controlFamily: 'access',
        title: `Control ${String(version)}`,
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

function makeTestSetup(): {
  chain: SnapshotChainEntry[]
  snapshots: Map<string, ComplianceSnapshot>
  chainPorts: ChainPorts
  verifierPorts: VerifierPorts
  snapshotChain: SnapshotChain
  verifier: ComplianceVerifier
} {
  const chain: SnapshotChainEntry[] = []
  const snapshots = new Map<string, ComplianceSnapshot>()

  const chainPorts: ChainPorts = {
    loadChain: async (orgId: string) => chain.filter((e) => e.orgId === orgId),
    appendEntry: async (entry: SnapshotChainEntry) => {
      chain.push(entry)
    },
  }

  const verifierPorts: VerifierPorts = {
    loadSnapshot: async (snapshotId: string) => snapshots.get(snapshotId) ?? null,
    loadChain: async (orgId: string) => chain.filter((e) => e.orgId === orgId),
  }

  return {
    chain,
    snapshots,
    chainPorts,
    verifierPorts,
    snapshotChain: new SnapshotChain(chainPorts),
    verifier: new ComplianceVerifier(verifierPorts),
  }
}

// ── Snapshot Verification ───────────────────────────────────────────────────

describe('ComplianceVerifier — verifySnapshot', () => {
  it('should verify a valid snapshot', async () => {
    const { snapshots, snapshotChain, verifier } = makeTestSetup()
    const snap = makeSnapshot(1)
    snapshots.set(snap.snapshotId, snap)
    await snapshotChain.append(snap)

    const result = await verifier.verifySnapshot(snap.snapshotId)

    expect(result.valid).toBe(true)
    expect(result.hashMatch).toBe(true)
    expect(result.chainEntryFound).toBe(true)
    expect(result.actualHash).toBe(computeSnapshotHash(snap))
    expect(result.errors).toHaveLength(0)
  })

  it('should detect a missing snapshot', async () => {
    const { verifier } = makeTestSetup()

    const result = await verifier.verifySnapshot('nonexistent')

    expect(result.valid).toBe(false)
    expect(result.errors).toHaveLength(1)
    expect(result.errors[0]).toContain('not found')
  })

  it('should detect hash mismatch when snapshot is tampered', async () => {
    const { chain, snapshots, snapshotChain, verifier } = makeTestSetup()
    const snap = makeSnapshot(1)
    snapshots.set(snap.snapshotId, snap)
    await snapshotChain.append(snap)

    // Tamper with the stored snapshot
    const tampered: ComplianceSnapshot = {
      ...snap,
      summary: { ...snap.summary, complianceScore: 0 },
    }
    snapshots.set(snap.snapshotId, tampered)

    const result = await verifier.verifySnapshot(snap.snapshotId)

    expect(result.valid).toBe(false)
    expect(result.hashMatch).toBe(false)
    expect(result.errors.length).toBeGreaterThan(0)
  })

  it('should detect snapshot with no chain entry', async () => {
    const { snapshots, verifier } = makeTestSetup()
    // Add snapshot but do NOT chain it
    const snap = makeSnapshot(1)
    snapshots.set(snap.snapshotId, snap)

    const result = await verifier.verifySnapshot(snap.snapshotId)

    expect(result.valid).toBe(false)
    expect(result.chainEntryFound).toBe(false)
    expect(result.errors[0]).toContain('No chain entry found')
  })
})

// ── Chain Verification ──────────────────────────────────────────────────────

describe('ComplianceVerifier — verifyChain', () => {
  it('should verify a valid 3-entry chain', async () => {
    const { snapshots, snapshotChain, verifier } = makeTestSetup()

    for (let i = 1; i <= 3; i++) {
      const snap = makeSnapshot(i)
      snapshots.set(snap.snapshotId, snap)
      await snapshotChain.append(snap)
    }

    const result = await verifier.verifyChain(ORG_ID)

    expect(result.valid).toBe(true)
    expect(result.totalEntries).toBe(3)
    expect(result.verifiedEntries).toBe(3)
    expect(result.brokenAt).toBeNull()
    expect(result.errors).toHaveLength(0)
  })

  it('should detect a broken chain', async () => {
    const { chain, snapshots, snapshotChain, verifier } = makeTestSetup()

    for (let i = 1; i <= 3; i++) {
      const snap = makeSnapshot(i)
      snapshots.set(snap.snapshotId, snap)
      await snapshotChain.append(snap)
    }

    // Corrupt chain entry 1's hash (breaks link from entry 2)
    chain[1] = { ...chain[1]!, snapshotHash: 'b'.repeat(64) }

    const result = await verifier.verifyChain(ORG_ID)

    expect(result.valid).toBe(false)
    expect(result.brokenAt).toBe(2) // entry 2 references entry 1
    expect(result.errors.length).toBeGreaterThan(0)
  })

  it('should verify an empty chain', async () => {
    const { verifier } = makeTestSetup()

    const result = await verifier.verifyChain(ORG_ID)

    expect(result.valid).toBe(true)
    expect(result.totalEntries).toBe(0)
    expect(result.verifiedEntries).toBe(0)
  })

  it('should detect genesis with non-null previousHash', async () => {
    const { chain, snapshots, snapshotChain, verifier } = makeTestSetup()
    const snap = makeSnapshot(1)
    snapshots.set(snap.snapshotId, snap)
    await snapshotChain.append(snap)

    // Corrupt genesis previousHash
    chain[0] = { ...chain[0]!, previousHash: 'c'.repeat(64) }

    const result = await verifier.verifyChain(ORG_ID)

    expect(result.valid).toBe(false)
    expect(result.brokenAt).toBe(0)
    expect(result.errors[0]).toContain('Genesis entry')
  })

  it('should detect tampered snapshot in chain', async () => {
    const { snapshots, snapshotChain, verifier } = makeTestSetup()

    const snap = makeSnapshot(1)
    snapshots.set(snap.snapshotId, snap)
    await snapshotChain.append(snap)

    // Tamper snapshot after chaining
    snapshots.set(snap.snapshotId, {
      ...snap,
      summary: { ...snap.summary, complianceScore: 0 },
    })

    const result = await verifier.verifyChain(ORG_ID)

    // Chain linkage is valid but snapshot hash mismatch
    expect(result.valid).toBe(false)
    expect(result.errors.length).toBeGreaterThan(0)
  })

  it('should detect chain entry with null previousHash at non-genesis position', async () => {
    const { chain, snapshots, snapshotChain, verifier } = makeTestSetup()

    for (let i = 1; i <= 3; i++) {
      const snap = makeSnapshot(i)
      snapshots.set(snap.snapshotId, snap)
      await snapshotChain.append(snap)
    }

    // Corrupt entry 2 to have null previousHash
    chain[2] = { ...chain[2]!, previousHash: null as unknown }

    const result = await verifier.verifyChain(ORG_ID)

    expect(result.valid).toBe(false)
    expect(result.brokenAt).toBe(2)
    expect(result.errors[0]).toContain("'null...'")
  })

  it('should handle snapshot not found during chain hash recomputation', async () => {
    const { chain, snapshotChain, verifier } = makeTestSetup()
    // Append a snapshot via chain ports but don't store it in snapshots map
    const snap = makeSnapshot(1)
    await snapshotChain.append(snap)
    // snapshots map is empty — loadSnapshot returns null

    const result = await verifier.verifyChain(ORG_ID)

    // Chain linkage is valid (single genesis) but no hash recomputation possible
    expect(result.valid).toBe(true)
    expect(result.totalEntries).toBe(1)
    expect(result.verifiedEntries).toBe(1)
  })
})
