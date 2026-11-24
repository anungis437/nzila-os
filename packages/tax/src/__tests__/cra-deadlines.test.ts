/**
 * Unit tests — @nzila/tax/cra-deadlines
 *
 * Covers: calculateCorporateDeadlines(), quarterly & monthly GST deadlines
 */
import { describe, it, expect } from 'vitest'
import {
  calculateCorporateDeadlines,
  calculateQuarterlyGstDeadlines,
  calculateMonthlyGstDeadlines,
} from '../cra-deadlines'

describe('calculateCorporateDeadlines', () => {
  it('generates T2 filing 6 months after Dec 31 FYE', () => {
    const deadlines = calculateCorporateDeadlines('12-31', 2025, 'ON')
    const t2Filing = deadlines.find((d) => d.type === 'federal_filing' && d.label.includes('T2 Filing'))
    expect(t2Filing).toBeDefined()
    expect(t2Filing!.dueDate).toBe('2026-06-30')
    expect(t2Filing!.rule).toContain('ITA s.150(1)(a)')
  })

  it('generates T2 payment 3 months after FYE for qualifying CCPC', () => {
    const deadlines = calculateCorporateDeadlines('12-31', 2025, 'ON', { isCcpc: true, qualifiesForThreeMonthPayment: true })
    const t2Payment = deadlines.find((d) => d.type === 'federal_payment')
    expect(t2Payment).toBeDefined()
    expect(t2Payment!.dueDate).toBe('2026-03-31')
  })

  it('generates T2 payment 2 months after FYE for non-CCPC', () => {
    const deadlines = calculateCorporateDeadlines('12-31', 2025, 'ON', { isCcpc: false })
    const t2Payment = deadlines.find((d) => d.type === 'federal_payment')
    expect(t2Payment!.dueDate).toBe('2026-02-28')
  })

  it('generates CO-17 only for Quebec orgs', () => {
    const onDeadlines = calculateCorporateDeadlines('12-31', 2025, 'ON')
    expect(onDeadlines.find((d) => d.label.includes('CO-17'))).toBeUndefined()

    const qcDeadlines = calculateCorporateDeadlines('12-31', 2025, 'QC')
    expect(qcDeadlines.find((d) => d.label.includes('CO-17'))).toBeDefined()
  })

  it('generates QST return for Quebec', () => {
    const qcDeadlines = calculateCorporateDeadlines('12-31', 2025, 'QC')
    expect(qcDeadlines.find((d) => d.label.includes('QST'))).toBeDefined()
  })

  it('handles non-Dec FYE (e.g. March 31)', () => {
    const deadlines = calculateCorporateDeadlines('03-31', 2025, 'ON')
    const t2Filing = deadlines.find((d) => d.type === 'federal_filing' && d.label.includes('T2 Filing'))
    expect(t2Filing!.dueDate).toBe('2025-09-30') // 6 months after Mar 31
  })

  it('generates T5 info return due Feb 28 following year', () => {
    const deadlines = calculateCorporateDeadlines('12-31', 2025, 'ON')
    const t5 = deadlines.find((d) => d.label.includes('T5 Information'))
    expect(t5).toBeDefined()
    expect(t5!.dueDate).toBe('2026-02-28')
  })

  it('generates T4/T4A info return due Feb 28 following year', () => {
    const deadlines = calculateCorporateDeadlines('12-31', 2025, 'ON')
    const t4 = deadlines.find((d) => d.label.includes('T4'))
    expect(t4).toBeDefined()
  })

  it('generates T5013 partnership return due March 31', () => {
    const deadlines = calculateCorporateDeadlines('12-31', 2025, 'ON', { partnershipPartnerTypes: 'individuals' })
    const t5013 = deadlines.find((d) => d.label.includes('T5013'))
    expect(t5013).toBeDefined()
    expect(t5013!.dueDate).toBe('2026-03-31')
  })

  it('generates GST/HST annual return 3 months after FYE', () => {
    const deadlines = calculateCorporateDeadlines('12-31', 2025, 'ON')
    const gst = deadlines.find((d) => d.label.includes('GST/HST Annual Return'))
    expect(gst).toBeDefined()
    expect(gst!.dueDate).toBe('2026-03-31')
  })

  it('generates RL-3 for Quebec orgs', () => {
    const qcDeadlines = calculateCorporateDeadlines('12-31', 2025, 'QC')
    expect(qcDeadlines.find((d) => d.label.includes('RL-3'))).toBeDefined()
    const onDeadlines = calculateCorporateDeadlines('12-31', 2025, 'ON')
    expect(onDeadlines.find((d) => d.label.includes('RL-3'))).toBeUndefined()
  })
})

describe('calculateQuarterlyGstDeadlines', () => {
  it('generates 4 quarterly deadlines', () => {
    const deadlines = calculateQuarterlyGstDeadlines('12-31', 2025)
    expect(deadlines).toHaveLength(4)
    deadlines.forEach((d) => {
      expect(d.type).toBe('indirect_filing')
      expect(d.label).toContain('Quarterly')
    })
  })
})

describe('calculateMonthlyGstDeadlines', () => {
  it('generates 12 monthly deadlines', () => {
    const deadlines = calculateMonthlyGstDeadlines('12-31', 2025)
    expect(deadlines).toHaveLength(12)
    deadlines.forEach((d) => {
      expect(d.type).toBe('indirect_filing')
      expect(d.label).toContain('Monthly')
    })
  })
})
