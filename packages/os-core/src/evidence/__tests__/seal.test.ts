import { describe, it, expect } from 'vitest'
import { createHash, createHmac } from 'node:crypto'
import {
  computeMerkleRoot,
  canonicalize,
  generateSeal,
  verifySeal,
  type SealablePackIndex,
} from '../seal'

describe('seal', () => {
  const sampleArtifacts = [
    { sha256: createHash('sha256').update('artifact-1').digest('hex'), name: 'a1' },
    { sha256: createHash('sha256').update('artifact-2').digest('hex'), name: 'a2' },
  ]

  const sampleIndex: SealablePackIndex = {
    packId: 'IR-2026-001',
    orgId: 'org-1',
    artifacts: sampleArtifacts,
  }

  describe('computeMerkleRoot', () => {
    it('returns hash of empty string for empty array', () => {
      const root = computeMerkleRoot([])
      expect(root).toBe(createHash('sha256').update('').digest('hex'))
    })

    it('returns consistent result for single hash', () => {
      const hash = createHash('sha256').update('test').digest('hex')
      const root = computeMerkleRoot([hash])
      expect(root).toMatch(/^[0-9a-f]{64}$/)
    })

    it('returns consistent result for two hashes', () => {
      const h1 = createHash('sha256').update('a').digest('hex')
      const h2 = createHash('sha256').update('b').digest('hex')
      const root = computeMerkleRoot([h1, h2])
      expect(root).toMatch(/^[0-9a-f]{64}$/)
      // Should be deterministic
      expect(computeMerkleRoot([h1, h2])).toBe(root)
    })

    it('handles odd number of hashes (duplicates last)', () => {
      const hashes = ['a', 'b', 'c'].map((x) =>
        createHash('sha256').update(x).digest('hex'),
      )
      const root = computeMerkleRoot(hashes)
      expect(root).toMatch(/^[0-9a-f]{64}$/)
    })
  })

  describe('canonicalize', () => {
    it('sorts keys', () => {
      const result = canonicalize({ b: 2, a: 1 })
      expect(result).toBe('{"a":1,"b":2}')
    })
  })

  describe('generateSeal', () => {
    it('produces a valid seal envelope', () => {
      const seal = generateSeal(sampleIndex, { sealedAt: '2026-01-01T00:00:00Z' })
      expect(seal.sealVersion).toBe('1.0')
      expect(seal.algorithm).toBe('sha256')
      expect(seal.packDigest).toMatch(/^[0-9a-f]{64}$/)
      expect(seal.artifactsMerkleRoot).toMatch(/^[0-9a-f]{64}$/)
      expect(seal.artifactCount).toBe(2)
      expect(seal.sealedAt).toBe('2026-01-01T00:00:00Z')
    })

    it('is deterministic for same input', () => {
      const opts = { sealedAt: '2026-01-01T00:00:00Z' }
      const s1 = generateSeal(sampleIndex, opts)
      const s2 = generateSeal(sampleIndex, opts)
      expect(s1.packDigest).toBe(s2.packDigest)
      expect(s1.artifactsMerkleRoot).toBe(s2.artifactsMerkleRoot)
    })

    it('includes HMAC when key provided', () => {
      const seal = generateSeal(sampleIndex, { hmacKey: 'test-key' })
      expect(seal.hmacSignature).toMatch(/^[0-9a-f]{64}$/)
      expect(seal.hmacKeyId).toMatch(/^[0-9a-f]{8}$/)
    })

    it('includes HMAC from EVIDENCE_SEAL_KEY env var', () => {
      const orig = process.env.EVIDENCE_SEAL_KEY
      process.env.EVIDENCE_SEAL_KEY = 'env-key'
      try {
        const seal = generateSeal(sampleIndex)
        expect(seal.hmacSignature).toBeDefined()
      } finally {
        if (orig) process.env.EVIDENCE_SEAL_KEY = orig
        else delete process.env.EVIDENCE_SEAL_KEY
      }
    })

    it('no HMAC when no key available', () => {
      delete process.env.EVIDENCE_SEAL_KEY
      const seal = generateSeal(sampleIndex)
      expect(seal.hmacSignature).toBeUndefined()
    })

    it('strips existing seal from input', () => {
      const indexWithSeal = { ...sampleIndex, seal: { fake: true } } as any
      const seal = generateSeal(indexWithSeal)
      expect(seal.packDigest).toBe(generateSeal(sampleIndex).packDigest)
    })
  })

  describe('verifySeal', () => {
    it('valid seal passes verification', () => {
      const seal = generateSeal(sampleIndex, { sealedAt: '2026-01-01T00:00:00Z' })
      const packed = { ...sampleIndex, seal }
      const result = verifySeal(packed)
      expect(result.valid).toBe(true)
      expect(result.digestMatch).toBe(true)
      expect(result.merkleMatch).toBe(true)
      expect(result.errors).toHaveLength(0)
    })

    it('detects tampered pack digest', () => {
      const seal = generateSeal(sampleIndex)
      const tampered = { ...sampleIndex, packId: 'TAMPERED', seal }
      const result = verifySeal(tampered)
      expect(result.valid).toBe(false)
      expect(result.digestMatch).toBe(false)
    })

    it('detects tampered artifact hashes', () => {
      const seal = generateSeal(sampleIndex)
      const tampered = {
        ...sampleIndex,
        artifacts: [{ sha256: 'bad_hash', name: 'a1' }],
        seal,
      }
      const result = verifySeal(tampered)
      expect(result.merkleMatch).toBe(false)
    })

    it('returns error when no seal present', () => {
      const result = verifySeal(sampleIndex)
      expect(result.valid).toBe(false)
      expect(result.signatureVerified).toBe('unsigned')
      expect(result.errors).toContain('No seal found on evidence pack index')
    })

    it('verifies HMAC signature when key matches', () => {
      const seal = generateSeal(sampleIndex, { hmacKey: 'key1' })
      const packed = { ...sampleIndex, seal }
      const result = verifySeal(packed, { hmacKey: 'key1' })
      expect(result.signatureVerified).toBe(true)
    })

    it('fails HMAC when key differs', () => {
      const seal = generateSeal(sampleIndex, { hmacKey: 'key1' })
      const packed = { ...sampleIndex, seal }
      const result = verifySeal(packed, { hmacKey: 'wrong-key' })
      expect(result.signatureVerified).toBe(false)
    })

    it('reports no-key when HMAC present but no key available', () => {
      delete process.env.EVIDENCE_SEAL_KEY
      const seal = generateSeal(sampleIndex, { hmacKey: 'key1' })
      const packed = { ...sampleIndex, seal }
      const result = verifySeal(packed)
      expect(result.signatureVerified).toBe('no-key')
    })
  })
})
