import { describe, expect, it } from 'vitest'
import { ClaimBatchInputSchema, classifyClaimBatch } from './claim-batch-classifier/index'
import { MandateRiskInputSchema } from './mandate-risk-score/index'

describe('Zod 4 TrustOps intelligence regression', () => {
  it('preserves claim classification and amount totals across workspace schemas', () => {
    const input = { items: [{ classification: 'secured', status: 'admitted', amountCents: 1000 }] }
    expect(ClaimBatchInputSchema.safeParse(input).success).toBe(true)
    expect(classifyClaimBatch(ClaimBatchInputSchema.parse(input)).admittedAmountCents).toBe(1000)
  })
  it('rejects invalid claim enums, negative and fractional amounts', () => {
    const item = { classification: 'secured', status: 'submitted', amountCents: 100 }
    expect(ClaimBatchInputSchema.safeParse({ items: [{ ...item, classification: 'unknown' }] }).success).toBe(false)
    expect(ClaimBatchInputSchema.safeParse({ items: [{ ...item, amountCents: -1 }] }).success).toBe(false)
    expect(ClaimBatchInputSchema.safeParse({ items: [{ ...item, amountCents: 0.5 }] }).success).toBe(false)
  })
  it('rejects invalid mandate stages and negative risk facts', () => {
    const input = { currentStage: 'mandate_intake', daysSinceIntake: 0, creditorCount: 0, totalClaimAmountCents: 0, contestedClaimCount: 0, missedDeadlineCount: 0 }
    expect(MandateRiskInputSchema.safeParse(input).success).toBe(true)
    expect(MandateRiskInputSchema.safeParse({ ...input, currentStage: 'fake-stage' }).success).toBe(false)
    expect(MandateRiskInputSchema.safeParse({ ...input, missedDeadlineCount: -1 }).success).toBe(false)
  })
})
