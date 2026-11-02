import { describe, expect, it } from 'vitest'
import { cppContributionRecordSchema, cppEstimateSchema } from './cpp'
import { PensionProviderSchema } from './types'

describe('Zod 4 pension boundary compatibility', () => {
  it('preserves valid contribution and estimate inputs', () => {
    const contribution = { sin: '123-456-789', employeeName: null, year: 2026, month: 11, employeeContribution: 12, employerContribution: 12, pensionableEarnings: 300, maxPensionableEarnings: 1000, basicExemption: 20 }
    expect(cppContributionRecordSchema.parse(contribution).month).toBe(11)
    expect(cppEstimateSchema.parse({ sin: '123-456-789', estimateDate: '2026-11-02', retirementAge: 65, monthlyAmount: 800, startDate: '2030-01-01' }).monthlyAmount).toBe(800)
  })

  it('rejects malformed contribution amounts and enum values', () => {
    expect(cppContributionRecordSchema.safeParse({ sin: '123', year: '2026', month: 11 }).success).toBe(false)
    expect(cppEstimateSchema.safeParse({ sin: '123', estimateDate: '2026-11-02', retirementAge: '65', monthlyAmount: 800, startDate: '2030-01-01' }).success).toBe(false)
    expect(PensionProviderSchema.safeParse('untrusted-provider').success).toBe(false)
  })
})
