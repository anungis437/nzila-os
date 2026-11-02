import { describe, expect, it } from 'vitest'
import { FinancialProofSchema } from './financial-proof'
import { validateRequiredInputs } from './validation'
describe('Zod 4 financial proof boundary', () => {
  it('preserves financial proof validation and rejects forged output values', () => {
    const proof = { reportId: 'report-1', orgId: 'org-1', inputSources: ['ledger'], calculationVersion: '1.0.0', outputValues: { revenue: 10, expense: 5 }, hash: 'a'.repeat(64), generatedAt: '2026-11-02T00:00:00Z' }
    expect(FinancialProofSchema.parse(proof).outputValues.revenue).toBe(10)
    expect(FinancialProofSchema.safeParse({ ...proof, outputValues: { revenue: '10' } }).success).toBe(false)
    expect(FinancialProofSchema.safeParse({ ...proof, hash: 'invalid' }).success).toBe(false)
  })
  it('retains mandatory report and organizational input checks', () => {
    expect(validateRequiredInputs({ orgId: '', reportId: '', entries: [] }).valid).toBe(false)
  })
})
