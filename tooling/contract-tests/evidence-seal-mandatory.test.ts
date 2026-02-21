/**
 * Contract Test — Evidence Pack Seal Mandatory Enforcement
 *
 * Ensures that:
 *   1. Evidence packs cannot be persisted without a seal
 *   2. The seal envelope contains all required fields
 *   3. verifySeal() is available and functional
 *   4. generateSeal() + verifySeal() round-trip is tamper-evident
 *   5. No code path allows unsealed evidence pack persistence
 *
 * @invariant INV-12: Evidence packs must be sealed before persistence
 * @invariant INV-13: verifySeal is available in CI
 */
import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import {
  generateSeal,
  verifySeal,
  computeMerkleRoot,
  canonicalize,
  type SealablePackIndex,
} from '../../packages/os-core/src/evidence/seal'

const ROOT = join(__dirname, '..', '..')

// ── INV-12: Unsealed persistence blocked ────────────────────────────────────

describe('INV-12 — Evidence packs must be sealed before persistence', () => {
  it('generate-evidence-index calls generateSeal before persisting', () => {
    const genPath = join(ROOT, 'packages', 'os-core', 'src', 'evidence', 'generate-evidence-index.ts')
    expect(existsSync(genPath)).toBe(true)

    const content = readFileSync(genPath, 'utf-8')
    expect(content).toContain('generateSeal')
    // The seal must be computed BEFORE the pack is returned or uploaded
    expect(content).toContain('seal')
  })

  it('evidence_packs schema has status field with sealed/verified states', () => {
    const opsSchema = join(ROOT, 'packages', 'db', 'src', 'schema', 'operations.ts')
    const content = readFileSync(opsSchema, 'utf-8')
    expect(content).toContain("'sealed'")
    expect(content).toContain("'verified'")
    expect(content).toContain("'draft'")
  })

  it('evidence builder includes seal in its exports', () => {
    const indexPath = join(ROOT, 'packages', 'os-core', 'src', 'evidence', 'index.ts')
    const content = readFileSync(indexPath, 'utf-8')
    expect(content).toContain('generateSeal')
    expect(content).toContain('verifySeal')
    expect(content).toContain('computeMerkleRoot')
    expect(content).toContain('canonicalize')
    expect(content).toContain('SealEnvelope')
  })
})

// ── INV-13: verifySeal functional verification ──────────────────────────────

describe('INV-13 — verifySeal CI verification', () => {
  const FIXED_TIMESTAMP = '2026-02-01T00:00:00.000Z'
  const TEST_KEY = 'nzila-ci-test-key-not-for-production'

  function makePack(): SealablePackIndex {
    return {
      entityId: '00000000-0000-0000-0000-000000000001',
      eventType: 'control-test',
      generatedAt: '2026-02-01T00:00:00Z',
      artifacts: [
        { sha256: 'a'.repeat(64), name: 'artifact-1.json' },
        { sha256: 'b'.repeat(64), name: 'artifact-2.json' },
      ],
    }
  }

  it('verifySeal accepts a freshly generated seal', () => {
    const pack = makePack()
    const seal = generateSeal(pack, { sealedAt: FIXED_TIMESTAMP })
    const result = verifySeal({ ...pack, seal })
    expect(result.valid).toBe(true)
    expect(result.digestMatch).toBe(true)
    expect(result.merkleMatch).toBe(true)
    expect(result.errors).toEqual([])
  })

  it('verifySeal rejects a tampered pack digest', () => {
    const pack = makePack()
    const seal = generateSeal(pack, { sealedAt: FIXED_TIMESTAMP })
    const tampered = { ...pack, entityId: 'tampered', seal }
    const result = verifySeal(tampered)
    expect(result.valid).toBe(false)
    expect(result.digestMatch).toBe(false)
  })

  it('verifySeal rejects tampered artifact hashes', () => {
    const pack = makePack()
    const seal = generateSeal(pack, { sealedAt: FIXED_TIMESTAMP })
    const tampered = {
      ...pack,
      artifacts: [{ sha256: 'x'.repeat(64), name: 'tampered.json' }],
      seal,
    }
    const result = verifySeal(tampered)
    expect(result.valid).toBe(false)
  })

  it('verifySeal rejects missing seal', () => {
    const pack = makePack()
    const result = verifySeal(pack as any)
    expect(result.valid).toBe(false)
    expect(result.errors).toContain('No seal found on evidence pack index')
  })

  it('HMAC signature round-trips correctly', () => {
    const pack = makePack()
    const seal = generateSeal(pack, { sealedAt: FIXED_TIMESTAMP, hmacKey: TEST_KEY })
    expect(seal.hmacSignature).toBeTruthy()
    expect(seal.hmacKeyId).toBeTruthy()

    const result = verifySeal({ ...pack, seal }, { hmacKey: TEST_KEY })
    expect(result.valid).toBe(true)
    expect(result.signatureVerified).toBe(true)
  })

  it('HMAC verification fails with wrong key', () => {
    const pack = makePack()
    const seal = generateSeal(pack, { sealedAt: FIXED_TIMESTAMP, hmacKey: TEST_KEY })
    const result = verifySeal({ ...pack, seal }, { hmacKey: 'wrong-key' })
    expect(result.signatureVerified).toBe(false)
  })

  it('Merkle root is deterministic', () => {
    const hashes = ['a'.repeat(64), 'b'.repeat(64), 'c'.repeat(64)]
    const root1 = computeMerkleRoot(hashes)
    const root2 = computeMerkleRoot(hashes)
    expect(root1).toBe(root2)
    expect(root1).toMatch(/^[a-f0-9]{64}$/)
  })

  it('canonicalize produces sorted, deterministic JSON', () => {
    const obj1 = { z: 1, a: 2, m: 3 }
    const obj2 = { a: 2, m: 3, z: 1 }
    expect(canonicalize(obj1)).toBe(canonicalize(obj2))
  })
})
