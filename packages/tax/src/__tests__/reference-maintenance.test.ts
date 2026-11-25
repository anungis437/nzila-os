import { describe, expect, it } from 'vitest'
import { calculateCorporateDeadlines, calculateMonthlyGstDeadlines, calculateQuarterlyGstDeadlines } from '../cra-deadlines'
import { calculateInstallments } from '../installments'
import { calculateGstLatePenalty, calculateInformationReturnPenalty, calculateT2LateFilingPenalty } from '../penalties'
import { calculateDividendTax, compareSalaryVsDividend, PROVINCIAL_DTC, RDTOH_REFUND_RATE } from '../dividend-tax'
import { ProgramAccountSchema, validateProgramAccount } from '../bn-validation'

// Expected values are primary-source examples and boundary counterexamples, not
// a second implementation of the production formulas. Sources are in module comments.
describe('corporate calendar reference corrections', () => {
  const find = (fye: string, options = {}, province: 'ON' | 'QC' = 'ON') => calculateCorporateDeadlines(fye, 2026, province, options)
  it('preserves CRA month-end and midmonth filing rules independently of timezone', () => {
    expect(find('02-28').find(x => x.label.includes('T2 Filing'))?.dueDate).toBe('2026-08-31')
    expect(find('09-23').find(x => x.label.includes('T2 Filing'))?.dueDate).toBe('2027-03-23')
  })
  it('does not extend unknown CCPC eligibility, and keeps Quebec balance at two months', () => {
    expect(find('12-31', { isCcpc: true }).find(x => x.type === 'federal_payment')?.dueDate).toBe('2027-02-28')
    const qualified = find('12-31', { isCcpc: true, qualifiesForThreeMonthPayment: true }, 'QC')
    expect(qualified.find(x => x.type === 'federal_payment')?.dueDate).toBe('2027-03-31')
    expect(qualified.find(x => x.type === 'provincial_payment')?.dueDate).toBe('2027-02-28')
  })
  it('gives ordinary annual GST payment three months even for a non-CCPC', () => {
    expect(find('12-31', { isCcpc: false }).find(x => x.type === 'indirect_payment')?.dueDate).toBe('2027-03-31')
  })
  it('never advertises annual QST for a monthly or quarterly GST/QST filer', () => {
    for (const gstFilingFrequency of ['monthly', 'quarterly']) {
      expect(find('12-31', { gstFilingFrequency }, 'QC').some(x => x.label.includes('QST Annual'))).toBe(false)
    }
  })
  it('does not invent partnership filing, and applies known partner composition', () => {
    expect(find('06-30').some(x => x.label.includes('T5013'))).toBe(false)
    expect(find('06-30', { partnershipPartnerTypes: 'corporations' }).find(x => x.label.includes('T5013'))?.dueDate).toBe('2026-11-30')
    expect(find('06-30', { partnershipPartnerTypes: 'individuals' }).find(x => x.label.includes('T5013'))?.dueDate).toBe('2027-03-31')
    expect(find('06-30', { partnershipPartnerTypes: 'mixed' }).find(x => x.label.includes('T5013'))?.dueDate).toBe('2026-11-30')
  })
  it('keeps all quarterly and monthly reporting-period ends valid', () => {
    expect(calculateQuarterlyGstDeadlines('12-31', 2026).map(x => x.dueDate)).toEqual(['2026-04-30', '2026-07-31', '2026-10-31', '2027-01-31'])
    expect(calculateMonthlyGstDeadlines('12-31', 2026).map(x => x.dueDate)).toEqual(['2026-02-28', '2026-03-31', '2026-04-30', '2026-05-31', '2026-06-30', '2026-07-31', '2026-08-31', '2026-09-30', '2026-10-31', '2026-11-30', '2026-12-31', '2027-01-31'])
  })
})

describe('CRA 2026 instalment references', () => {
  it.each([[3000, 10000], [10000, 3000], [1000, 1000]])('exempts either-year threshold: current %i, prior %i', (estimatedCurrentYearTax, priorYearTax) => {
    expect(calculateInstallments({ estimatedCurrentYearTax, priorYearTax }, '12-31', 2026).required).toBe(false)
  })
  it('uses calendar quarter ends and accepts the existing ISO-date caller format', () => {
    expect(calculateInstallments({ estimatedCurrentYearTax: 12000, priorYearTax: 12000, isSmallCcpc: true }, '2026-12-31', 2026).dueDates).toEqual(['2026-03-31', '2026-06-30', '2026-09-30', '2026-12-31'])
  })
  it('uses the fiscal-period day for non-month-end years (CRA October10 start example)', () => {
    const input = { estimatedCurrentYearTax: 12000, priorYearTax: 12000 }
    expect(calculateInstallments(input, '10-09', 2026).dueDates[0]).toBe('2025-11-09')
    expect(calculateInstallments({ ...input, isSmallCcpc: true }, '10-09', 2026).dueDates[0]).toBe('2026-01-09')
  })
  it('refuses unverified short-year schedules', () => {
    expect(() => calculateInstallments({ estimatedCurrentYearTax: 12000, priorYearTax: 12000, monthsInYear: 6 }, '12-31', 2026)).toThrow(/Short-year/)
  })
})

describe('documented late-filing penalty conditions', () => {
  it('applies the base penalty in a late partial first month when explicitly known late', () => {
    expect(calculateT2LateFilingPenalty({ taxOwing: 1000, monthsLate: 0, isLate: true }).penalty).toBe(50)
    expect(calculateGstLatePenalty({ netTaxOwing: 1000, monthsLate: 0, isLate: true }).penalty).toBe(10)
  })
  it('does not impose the heightened T2 penalty without a demand', () => {
    expect(calculateT2LateFilingPenalty({ taxOwing: 1000, monthsLate: 2, isRepeatOffender: true }).penalty).toBe(70)
    expect(calculateT2LateFilingPenalty({ taxOwing: 1000, monthsLate: 2, isRepeatOffender: true, hasFilingDemand: true }).penalty).toBe(140)
  })
  it('caps GST months and does not double ordinary GST late filing', () => {
    expect(calculateGstLatePenalty({ netTaxOwing: 1000, monthsLate: 24, isRepeatOffender: true }).penalty).toBe(40)
  })
  it.each([[5,100],[6,500],[10,500],[11,1000],[50,1000],[51,1500],[500,1500],[501,2500],[2500,2500],[2501,5000],[10000,5000],[10001,7500]])('applies T4 relieving tier at %i slips', (numberOfSlips, penalty) => {
    expect(calculateInformationReturnPenalty({ returnType: 'T4', numberOfSlips, daysLate: 101 }).penalty).toBe(penalty)
  })
  it('keeps legislated T3-slip tier and partnership filing distinct from relief', () => {
    expect(calculateInformationReturnPenalty({ returnType: 'T3', numberOfSlips: 1, daysLate: 10 }).penalty).toBe(100)
    expect(calculateInformationReturnPenalty({ returnType: 'T3', numberOfSlips: 1, daysLate: 20 }).penalty).toBe(200)
    expect(calculateInformationReturnPenalty({ returnType: 'T5013', numberOfSlips: 1000, daysLate: 101 }).penalty).toBe(2500)
    expect(() => calculateInformationReturnPenalty({ returnType: 'UNKNOWN', numberOfSlips: 1, daysLate: 1 })).toThrow(/Unverified/)
  })
})

describe('existing provincial dividend and CPP references', () => {
  it.each([['QC',1000,'eligible',161.46],['NS',1000,'non-eligible',17.25],['YT',1000,'eligible',165.88],['YT',1000,'non-eligible',7.71],['PE',1000,'non-eligible',15],['PE',1000,'eligible',144.89],['SK',1000,'non-eligible',28.97],['SK',1000,'eligible',151.81]] as const)('uses the published %s %s %s credit', (province, amount, type, expected) => {
    expect(calculateDividendTax(amount, type, province, 0.5).provincialCredit).toBe(expected)
  })
  it('keeps 38⅓% exact rather than rounding the rate before calculating', () => {
    expect(RDTOH_REFUND_RATE).toBe(23 / 60)
    expect(calculateDividendTax(100000, 'eligible', 'ON', 0.5).rdtohRefund).toBe(38333.33)
  })
  it('uses 2026 CPP1 ceiling and never reports negative contributions', () => {
    expect(compareSalaryVsDividend(100000, 'ON', 0.5, 0.265).salary.employerCpp).toBe(4230.45)
    expect(compareSalaryVsDividend(1000, 'ON', 0.5, 0.265).salary.employerCpp).toBe(0)
  })
  it('retains the currently corroborated remaining provincial entries', () => {
    expect(PROVINCIAL_DTC.MB).toEqual({ eligibleDtcRate: 0.08, nonEligibleDtcRate: 0.007835 })
    expect(PROVINCIAL_DTC.NL).toEqual({ eligibleDtcRate: 0.063, nonEligibleDtcRate: 0.032 })
  })
})

describe('published program list and explicitly retained local policy', () => {
  it.each(['RG','RN','LT','RU','PT'])('admits published program %s in both APIs', code => {
    const value = `123456782${code}0001`
    expect(validateProgramAccount(value).valid).toBe(true)
    expect(ProgramAccountSchema.safeParse(value).success).toBe(true)
  })
  it('applies the retained nonzero reference policy consistently', () => {
    expect(validateProgramAccount('123456782RC0000').valid).toBe(false)
    expect(ProgramAccountSchema.safeParse('123456782RC0000').success).toBe(false)
  })
})
