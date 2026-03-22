/**
 * CFO — Financial Proof Engine Tests
 */
import { describe, it, expect } from 'vitest'
import {
  computeProofHash,
  generateFinancialProof,
  verifyFinancialProof,
  requireFinancialProof,
  FinancialProofError,
  type FinancialProof,
} from '@nzila/cfo-core/proof'

describe('Financial Proof Engine', () => {
  const baseParams = {
    reportId: 'rpt-001',
    orgId: 'org-001',
    inputSources: ['ledger:org-001', 'period:2026-01..2026-03'],
    calculationVersion: '1.0.0',
    outputValues: { totalRevenue: 70000, totalExpenses: 35000, netIncome: 35000 },
  }

  describe('computeProofHash', () => {
    it('produces a 64-char hex string', () => {
      const hash = computeProofHash(baseParams)
      expect(hash).toMatch(/^[a-f0-9]{64}$/)
    })

    it('is deterministic — same inputs produce same hash', () => {
      const h1 = computeProofHash(baseParams)
      const h2 = computeProofHash(baseParams)
      expect(h1).toBe(h2)
    })

    it('changes when input sources differ', () => {
      const h1 = computeProofHash(baseParams)
      const h2 = computeProofHash({ ...baseParams, inputSources: ['ledger:org-002'] })
      expect(h1).not.toBe(h2)
    })

    it('changes when calculation version differs', () => {
      const h1 = computeProofHash(baseParams)
      const h2 = computeProofHash({ ...baseParams, calculationVersion: '2.0.0' })
      expect(h1).not.toBe(h2)
    })

    it('changes when output values differ', () => {
      const h1 = computeProofHash(baseParams)
      const h2 = computeProofHash({
        ...baseParams,
        outputValues: { ...baseParams.outputValues, netIncome: 40000 },
      })
      expect(h1).not.toBe(h2)
    })

    it('is stable regardless of output key ordering', () => {
      const h1 = computeProofHash({
        ...baseParams,
        outputValues: { a: 1, b: 2, c: 3 },
      })
      const h2 = computeProofHash({
        ...baseParams,
        outputValues: { c: 3, a: 1, b: 2 },
      })
      expect(h1).toBe(h2)
    })
  })

  describe('generateFinancialProof', () => {
    it('returns a valid proof with hash and timestamp', () => {
      const proof = generateFinancialProof(baseParams)
      expect(proof.reportId).toBe('rpt-001')
      expect(proof.orgId).toBe('org-001')
      expect(proof.hash).toMatch(/^[a-f0-9]{64}$/)
      expect(new Date(proof.generatedAt).getTime()).not.toBeNaN()
    })

    it('hash matches computeProofHash for same inputs', () => {
      const proof = generateFinancialProof(baseParams)
      const expected = computeProofHash(baseParams)
      expect(proof.hash).toBe(expected)
    })
  })

  describe('verifyFinancialProof', () => {
    it('returns true for a valid proof', () => {
      const proof = generateFinancialProof(baseParams)
      expect(verifyFinancialProof(proof)).toBe(true)
    })

    it('returns false if output values are tampered', () => {
      const proof = generateFinancialProof(baseParams)
      const tampered: FinancialProof = {
        ...proof,
        outputValues: { ...proof.outputValues, netIncome: 999999 },
      }
      expect(verifyFinancialProof(tampered)).toBe(false)
    })

    it('returns false if hash is tampered', () => {
      const proof = generateFinancialProof(baseParams)
      const tampered: FinancialProof = {
        ...proof,
        hash: 'a'.repeat(64),
      }
      expect(verifyFinancialProof(tampered)).toBe(false)
    })
  })

  describe('requireFinancialProof', () => {
    it('does not throw for a valid proof', () => {
      const proof = generateFinancialProof(baseParams)
      expect(() => requireFinancialProof(proof)).not.toThrow()
    })

    it('throws FINANCIAL_OUTPUT_BLOCKED_NO_PROOF for null', () => {
      expect(() => requireFinancialProof(null)).toThrow(FinancialProofError)
      try {
        requireFinancialProof(null)
      } catch (e) {
        expect((e as FinancialProofError).code).toBe('FINANCIAL_OUTPUT_BLOCKED_NO_PROOF')
      }
    })

    it('throws FINANCIAL_OUTPUT_BLOCKED_NO_PROOF for undefined', () => {
      expect(() => requireFinancialProof(undefined)).toThrow(FinancialProofError)
    })

    it('throws FINANCIAL_PROOF_HASH_MISMATCH for tampered proof', () => {
      const proof = generateFinancialProof(baseParams)
      const tampered: FinancialProof = {
        ...proof,
        outputValues: { ...proof.outputValues, netIncome: 0 },
      }
      try {
        requireFinancialProof(tampered)
        expect.fail('Should have thrown')
      } catch (e) {
        expect((e as FinancialProofError).code).toBe('FINANCIAL_PROOF_HASH_MISMATCH')
      }
    })
  })
})
