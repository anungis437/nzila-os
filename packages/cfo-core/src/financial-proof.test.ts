import { describe, expect, it } from 'vitest'
import {
  computeProofHash,
  FinancialProofError,
  generateFinancialProof,
  requireFinancialProof,
  verifyFinancialProof,
} from './financial-proof'
import { financialEngine } from './financial-engine'

describe('cfo-core proof engine', () => {
  it('computes stable hashes regardless of key/input ordering', () => {
    const a = computeProofHash({
      inputSources: ['ledger:org-1', 'period:2026-01..2026-03'],
      calculationVersion: '1.0.0',
      outputValues: { netIncome: 100, totalRevenue: 300, totalExpenses: 200 },
    })

    const b = computeProofHash({
      inputSources: ['period:2026-01..2026-03', 'ledger:org-1'],
      calculationVersion: '1.0.0',
      outputValues: { totalExpenses: 200, totalRevenue: 300, netIncome: 100 },
    })

    expect(a).toBe(b)
    expect(a).toMatch(/^[a-f0-9]{64}$/)
  })

  it('generates and verifies a valid proof', () => {
    const proof = generateFinancialProof({
      reportId: 'rep-1',
      orgId: 'org-1',
      inputSources: ['ledger:org-1'],
      calculationVersion: '1.0.0',
      outputValues: { totalRevenue: 1000, totalExpenses: 400, netIncome: 600 },
    })

    expect(verifyFinancialProof(proof)).toBe(true)
    expect(() => requireFinancialProof(proof)).not.toThrow()
  })

  it('rejects tampered proof payloads', () => {
    const proof = generateFinancialProof({
      reportId: 'rep-2',
      orgId: 'org-2',
      inputSources: ['ledger:org-2'],
      calculationVersion: '1.0.0',
      outputValues: { totalRevenue: 500, totalExpenses: 300, netIncome: 200 },
    })

    const tampered = {
      ...proof,
      outputValues: { ...proof.outputValues, netIncome: 999 },
    }

    expect(verifyFinancialProof(tampered)).toBe(false)
    expect(() => requireFinancialProof(tampered)).toThrow(FinancialProofError)
  })

  it('returns proven results from computation engine', () => {
    const result = financialEngine.computeProfitLoss({
      orgId: 'org-1',
      reportId: 'pl-1',
      period: { start: '2026-01-01', end: '2026-01-31' },
      entries: [
        { account: 'sales', amount: 1200, type: 'credit', date: '2026-01-12' },
        { account: 'opex', amount: 450, type: 'debit', date: '2026-01-15' },
      ],
    })

    expect(result.data.totalRevenue).toBe(1200)
    expect(result.data.totalExpenses).toBe(450)
    expect(result.data.netIncome).toBe(750)
    expect(verifyFinancialProof(result.proof)).toBe(true)
  })
})
