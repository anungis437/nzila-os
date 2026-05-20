import { describe, it, expect } from 'vitest'
import {
  canonicalSerialize,
  computeContentHash,
  verifyContentHash,
  detectTampering,
  assertIntegrityOrThrow,
  signPolicy,
  verifySignature,
  type PolicyCanonicalPayload,
} from '../policy-integrity'

const SAMPLE_PAYLOAD: PolicyCanonicalPayload = {
  policyFamilyId: 'fam-001',
  semver: '1.0.0',
  name: 'Test Policy',
  domain: 'governance',
  workflowBindings: ['wf-001'],
  operationalScope: { region: 'ca' },
  governanceRationale: 'Required for compliance.',
  riskClassification: 'medium',
  reviewCadenceDays: 180,
  replayCompatibilityVersion: '1',
  effectiveFrom: '2025-01-01T00:00:00.000Z',
  effectiveUntil: null,
}

describe('policy-integrity', () => {
  describe('canonicalSerialize', () => {
    it('produces a stable string regardless of key insertion order', () => {
      const p1: PolicyCanonicalPayload = { ...SAMPLE_PAYLOAD }
      const p2: PolicyCanonicalPayload = {
        // Same fields but different order
        semver: SAMPLE_PAYLOAD.semver,
        policyFamilyId: SAMPLE_PAYLOAD.policyFamilyId,
        name: SAMPLE_PAYLOAD.name,
        domain: SAMPLE_PAYLOAD.domain,
        workflowBindings: SAMPLE_PAYLOAD.workflowBindings,
        operationalScope: SAMPLE_PAYLOAD.operationalScope,
        governanceRationale: SAMPLE_PAYLOAD.governanceRationale,
        riskClassification: SAMPLE_PAYLOAD.riskClassification,
        reviewCadenceDays: SAMPLE_PAYLOAD.reviewCadenceDays,
        replayCompatibilityVersion: SAMPLE_PAYLOAD.replayCompatibilityVersion,
        effectiveFrom: SAMPLE_PAYLOAD.effectiveFrom,
        effectiveUntil: SAMPLE_PAYLOAD.effectiveUntil,
      }
      expect(canonicalSerialize(p1)).toBe(canonicalSerialize(p2))
    })

    it('serializes to valid JSON', () => {
      const json = canonicalSerialize(SAMPLE_PAYLOAD)
      expect(() => JSON.parse(json)).not.toThrow()
    })
  })

  describe('computeContentHash', () => {
    it('returns a 64-char hex string', () => {
      const hash = computeContentHash(SAMPLE_PAYLOAD)
      expect(hash).toMatch(/^[0-9a-f]{64}$/)
    })

    it('is deterministic', () => {
      const h1 = computeContentHash(SAMPLE_PAYLOAD)
      const h2 = computeContentHash({ ...SAMPLE_PAYLOAD })
      expect(h1).toBe(h2)
    })

    it('changes when payload changes', () => {
      const h1 = computeContentHash(SAMPLE_PAYLOAD)
      const h2 = computeContentHash({ ...SAMPLE_PAYLOAD, name: 'Modified Policy' })
      expect(h1).not.toBe(h2)
    })
  })

  describe('verifyContentHash', () => {
    it('returns true for correct hash', () => {
      const hash = computeContentHash(SAMPLE_PAYLOAD)
      expect(verifyContentHash(SAMPLE_PAYLOAD, hash)).toBe(true)
    })

    it('returns false for incorrect hash', () => {
      expect(verifyContentHash(SAMPLE_PAYLOAD, 'a'.repeat(64))).toBe(false)
    })
  })

  describe('detectTampering', () => {
    it('reports no tampering for correct hash', () => {
      const hash = computeContentHash(SAMPLE_PAYLOAD)
      const report = detectTampering(SAMPLE_PAYLOAD, hash)
      expect(report.tampered).toBe(false)
    })

    it('reports tampering when payload was modified', () => {
      const hash = computeContentHash(SAMPLE_PAYLOAD)
      const modified = { ...SAMPLE_PAYLOAD, riskClassification: 'low' }
      const report = detectTampering(modified, hash)
      expect(report.tampered).toBe(true)
      expect(report.reason).toContain('mismatch')
    })
  })

  describe('assertIntegrityOrThrow', () => {
    it('does not throw for valid hash', () => {
      const hash = computeContentHash(SAMPLE_PAYLOAD)
      expect(() => assertIntegrityOrThrow(SAMPLE_PAYLOAD, hash)).not.toThrow()
    })

    it('throws UNSIGNED_POLICY_ACTIVATION_BLOCKED when hash is null', () => {
      expect(() => assertIntegrityOrThrow(SAMPLE_PAYLOAD, null))
        .toThrow('UNSIGNED_POLICY_ACTIVATION_BLOCKED')
    })

    it('throws UNSIGNED_POLICY_ACTIVATION_BLOCKED when hash is undefined', () => {
      expect(() => assertIntegrityOrThrow(SAMPLE_PAYLOAD, undefined))
        .toThrow('UNSIGNED_POLICY_ACTIVATION_BLOCKED')
    })

    it('throws POLICY_INTEGRITY_VIOLATION for tampered payload', () => {
      const hash = computeContentHash(SAMPLE_PAYLOAD)
      const tampered = { ...SAMPLE_PAYLOAD, name: 'Injected' }
      expect(() => assertIntegrityOrThrow(tampered, hash))
        .toThrow('POLICY_INTEGRITY_VIOLATION')
    })
  })

  describe('signPolicy / verifySignature', () => {
    it('sign and verify round-trip succeeds', () => {
      const key = 'test-signing-key-32-chars-long!!'
      const sig = signPolicy(SAMPLE_PAYLOAD, key)
      expect(verifySignature(SAMPLE_PAYLOAD, sig, key)).toBe(true)
    })

    it('verification fails with wrong key', () => {
      const key = 'test-signing-key-32-chars-long!!'
      const sig = signPolicy(SAMPLE_PAYLOAD, key)
      expect(verifySignature(SAMPLE_PAYLOAD, sig, 'wrong-key')).toBe(false)
    })

    it('verification fails for tampered payload', () => {
      const key = 'test-signing-key-32-chars-long!!'
      const sig = signPolicy(SAMPLE_PAYLOAD, key)
      const tampered = { ...SAMPLE_PAYLOAD, name: 'Injected' }
      expect(verifySignature(tampered, sig, key)).toBe(false)
    })
  })
})
