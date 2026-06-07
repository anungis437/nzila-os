/**
 * Contract Test — Evidence Seal Verification
 *
 * Proves that evidence pack sealing is deterministic and tamper-evident:
 *   1. generateSeal() produces a valid seal that verifySeal() accepts
 *   2. Any mutation to the pack index causes verifySeal() to fail
 *   3. Any mutation to an artifact hash causes verifySeal() to fail
 *   4. Removing the seal is detected
 *   5. HMAC signing and verification round-trips correctly
 *   6. Merkle root is deterministic for the same artifact set
 *   7. Empty artifact list is handled gracefully
 *
 * This closes the "sealing can silently break" gap.
 */
import { describe, it, expect } from 'vitest'
import {
  generateSeal,
  verifySeal,
  computeMerkleRoot,
  type SealablePackIndex,
  type SealEnvelope,
} from '../../packages/os-core/src/evidence/seal'

// ── Test fixtures ───────────────────────────────────────────────────────────

function makePackIndex(overrides?: Partial<SealablePackIndex>): SealablePackIndex {
  return {
    orgId: '00000000-0000-0000-0000-000000000001',
    eventType: 'period-close',
    periodStart: '2026-01-01',
    periodEnd: '2026-01-31',
    generatedAt: '2026-02-01T00:00:00Z',
    artifacts: [
      {
        name: 'trial-balance.pdf',
        sha256: 'a'.repeat(64),
        blobPath: 'evidence/2026-01/trial-balance.pdf',
        category: 'financial',
      },
      {
        name: 'audit-events.json',
        sha256: 'b'.repeat(64),
        blobPath: 'evidence/2026-01/audit-events.json',
        category: 'audit',
      },
      {
        name: 'governance-actions.json',
        sha256: 'c'.repeat(64),
        blobPath: 'evidence/2026-01/governance-actions.json',
        category: 'governance',
      },
    ],
    ...overrides,
  }
}

const FIXED_TIMESTAMP = '2026-02-01T00:00:00.000Z'
const TEST_HMAC_KEY = 'nzila-test-seal-key-do-not-use-in-production'

// ── Tests ───────────────────────────────────────────────────────────────────

describe('Evidence Seal — generateSeal + verifySeal round-trip', () => {
  it('generates a seal that verifySeal accepts', () => {
    const pack = makePackIndex()
    const seal = generateSeal(pack, { sealedAt: FIXED_TIMESTAMP })

    expect(seal.sealVersion).toBe('1.0')
    expect(seal.algorithm).toBe('sha256')
    expect(seal.packDigest).toMatch(/^[a-f0-9]{64}$/)
    expect(seal.artifactsMerkleRoot).toMatch(/^[a-f0-9]{64}$/)
    expect(seal.artifactCount).toBe(3)
    expect(seal.sealedAt).toBe(FIXED_TIMESTAMP)

    const result = verifySeal({ ...pack, seal })
    expect(result.valid).toBe(true)
    expect(result.digestMatch).toBe(true)
    expect(result.merkleMatch).toBe(true)
    expect(result.errors).toEqual([])
  })

  it('is deterministic — same input produces same seal', () => {
    const pack = makePackIndex()
    const seal1 = generateSeal(pack, { sealedAt: FIXED_TIMESTAMP })
    const seal2 = generateSeal(pack, { sealedAt: FIXED_TIMESTAMP })

    expect(seal1.packDigest).toBe(seal2.packDigest)
    expect(seal1.artifactsMerkleRoot).toBe(seal2.artifactsMerkleRoot)
  })
})

describe('Evidence Seal — tamper detection (pack index mutation)', () => {
  it('fails verification when orgId is changed', () => {
    const pack = makePackIndex()
    const seal = generateSeal(pack, { sealedAt: FIXED_TIMESTAMP })

    const tampered = { ...pack, orgId: 'TAMPERED', seal }
    const result = verifySeal(tampered)

    expect(result.valid).toBe(false)
    expect(result.digestMatch).toBe(false)
    expect(result.errors.length).toBeGreaterThan(0)
  })

  it('fails verification when an extra field is added', () => {
    const pack = makePackIndex()
    const seal = generateSeal(pack, { sealedAt: FIXED_TIMESTAMP })

    const tampered = { ...pack, injectedField: 'malicious', seal } as unknown
    const result = verifySeal(tampered)

    expect(result.valid).toBe(false)
    expect(result.digestMatch).toBe(false)
  })

  it('fails verification when periodEnd is changed', () => {
    const pack = makePackIndex()
    const seal = generateSeal(pack, { sealedAt: FIXED_TIMESTAMP })

    const tampered = { ...pack, periodEnd: '2026-12-31', seal }
    const result = verifySeal(tampered)

    expect(result.valid).toBe(false)
    expect(result.digestMatch).toBe(false)
  })
})

describe('Evidence Seal — tamper detection (artifact mutation)', () => {
  it('fails verification when an artifact hash is changed', () => {
    const pack = makePackIndex()
    const seal = generateSeal(pack, { sealedAt: FIXED_TIMESTAMP })

    const tamperedPack = {
      ...pack,
      artifacts: [
        { ...pack.artifacts[0], sha256: 'f'.repeat(64) }, // tampered hash
        pack.artifacts[1],
        pack.artifacts[2],
      ],
      seal,
    }

    const result = verifySeal(tamperedPack)
    expect(result.valid).toBe(false)
    expect(result.merkleMatch).toBe(false)
  })

  it('fails verification when an artifact is removed', () => {
    const pack = makePackIndex()
    const seal = generateSeal(pack, { sealedAt: FIXED_TIMESTAMP })

    const tamperedPack = {
      ...pack,
      artifacts: [pack.artifacts[0], pack.artifacts[1]], // removed one
      seal,
    }

    const result = verifySeal(tamperedPack)
    expect(result.valid).toBe(false)
    // Both digest and merkle will differ
    expect(result.merkleMatch).toBe(false)
  })

  it('fails verification when an artifact is added', () => {
    const pack = makePackIndex()
    const seal = generateSeal(pack, { sealedAt: FIXED_TIMESTAMP })

    const tamperedPack = {
      ...pack,
      artifacts: [
        ...pack.artifacts,
        { name: 'injected.json', sha256: 'd'.repeat(64), blobPath: 'x', category: 'x' },
      ],
      seal,
    }

    const result = verifySeal(tamperedPack)
    expect(result.valid).toBe(false)
  })
})

describe('Evidence Seal — missing seal detection', () => {
  it('returns invalid when seal is absent', () => {
    const pack = makePackIndex()
    const result = verifySeal(pack as unknown)

    expect(result.valid).toBe(false)
    expect(result.signatureVerified).toBe('unsigned')
    expect(result.errors).toContain('No seal found on evidence pack index')
  })
})

describe('Evidence Seal — HMAC signing and verification', () => {
  it('round-trips HMAC signing correctly', () => {
    const pack = makePackIndex()
    const seal = generateSeal(pack, {
      sealedAt: FIXED_TIMESTAMP,
      hmacKey: TEST_HMAC_KEY,
    })

    expect(seal.hmacSignature).toBeDefined()
    expect(seal.hmacSignature).toMatch(/^[a-f0-9]{64}$/)
    expect(seal.hmacKeyId).toBeDefined()

    const result = verifySeal({ ...pack, seal }, { hmacKey: TEST_HMAC_KEY })
    expect(result.valid).toBe(true)
    expect(result.signatureVerified).toBe(true)
  })

  it('fails HMAC verification with wrong key', () => {
    const pack = makePackIndex()
    const seal = generateSeal(pack, {
      sealedAt: FIXED_TIMESTAMP,
      hmacKey: TEST_HMAC_KEY,
    })

    const result = verifySeal({ ...pack, seal }, { hmacKey: 'wrong-key' })
    expect(result.valid).toBe(false)
    expect(result.signatureVerified).toBe(false)
  })

  it('reports no-key when HMAC signature present but no key provided', () => {
    const pack = makePackIndex()
    const seal = generateSeal(pack, {
      sealedAt: FIXED_TIMESTAMP,
      hmacKey: TEST_HMAC_KEY,
    })

    // Clear env to ensure no fallback
    const origKey = process.env.EVIDENCE_SEAL_KEY
    delete process.env.EVIDENCE_SEAL_KEY

    const result = verifySeal({ ...pack, seal })
    expect(result.signatureVerified).toBe('no-key')

    // Restore
    if (origKey) process.env.EVIDENCE_SEAL_KEY = origKey
  })
})

describe('Evidence Seal — Merkle root properties', () => {
  it('produces deterministic Merkle root for same hashes', () => {
    const hashes = ['a'.repeat(64), 'b'.repeat(64), 'c'.repeat(64)]
    const root1 = computeMerkleRoot(hashes)
    const root2 = computeMerkleRoot(hashes)
    expect(root1).toBe(root2)
  })

  it('produces different Merkle root when order changes', () => {
    const hashes = ['a'.repeat(64), 'b'.repeat(64), 'c'.repeat(64)]
    const reversed = [...hashes].reverse()
    const root1 = computeMerkleRoot(hashes)
    const root2 = computeMerkleRoot(reversed)
    expect(root1).not.toBe(root2)
  })

  it('handles empty artifact list gracefully', () => {
    const pack = makePackIndex({ artifacts: [] })
    const seal = generateSeal(pack, { sealedAt: FIXED_TIMESTAMP })

    expect(seal.artifactCount).toBe(0)
    expect(seal.artifactsMerkleRoot).toMatch(/^[a-f0-9]{64}$/)

    const result = verifySeal({ ...pack, seal })
    expect(result.valid).toBe(true)
  })

  it('handles single artifact correctly', () => {
    const pack = makePackIndex({
      artifacts: [{ name: 'only.pdf', sha256: 'a'.repeat(64), blobPath: 'x', category: 'x' }],
    })
    const seal = generateSeal(pack, { sealedAt: FIXED_TIMESTAMP })
    expect(seal.artifactCount).toBe(1)

    const result = verifySeal({ ...pack, seal })
    expect(result.valid).toBe(true)
  })
})
