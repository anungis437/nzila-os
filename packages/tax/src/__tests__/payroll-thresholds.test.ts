/**
 * Unit tests — @nzila/tax/payroll-thresholds
 *
 * Covers: remitter type determination, AMWA, due dates, CPP/EI constants
 */
import { describe, it, expect } from 'vitest'
import {
  REMITTER_THRESHOLDS,
  determineRemitterType,
  calculateAmwa,
  generateMonthlyRemittanceDueDates,
  generateQuarterlyRemittanceDueDates,
  CPP_2026,
  EI_2026,
} from '../payroll-thresholds'

describe('REMITTER_THRESHOLDS', () => {
  it('has 4 remitter types', () => {
    expect(REMITTER_THRESHOLDS).toHaveLength(4)
  })

  it('quarterly starts at $0', () => {
    expect(REMITTER_THRESHOLDS[0].type).toBe('quarterly')
    expect(REMITTER_THRESHOLDS[0].amwaMin).toBe(0)
  })

  it('accelerated T2 starts at $100K', () => {
    const t2 = REMITTER_THRESHOLDS.find((t) => t.type === 'accelerated_threshold2')
    expect(t2).toBeDefined()
    expect(t2!.amwaMin).toBe(100_000)
  })
})

describe('determineRemitterType', () => {
  it('quarterly for AMWA < $1,000', () => {
    const result = determineRemitterType(500)
    expect(result.type).toBe('quarterly')
  })

  it('regular for AMWA $1,000–$24,999', () => {
    const result = determineRemitterType(5_000)
    expect(result.type).toBe('regular')
  })

  it('accelerated T1 for AMWA $25,000–$99,999', () => {
    const result = determineRemitterType(50_000)
    expect(result.type).toBe('accelerated_threshold1')
  })

  it('accelerated T2 for AMWA ≥ $100,000', () => {
    const result = determineRemitterType(150_000)
    expect(result.type).toBe('accelerated_threshold2')
  })

  it('boundary: exactly $1,000 is regular', () => {
    expect(determineRemitterType(1_000).type).toBe('regular')
  })

  it('boundary: exactly $25,000 is accelerated T1', () => {
    expect(determineRemitterType(25_000).type).toBe('accelerated_threshold1')
  })

  it('boundary: exactly $100,000 is accelerated T2', () => {
    expect(determineRemitterType(100_000).type).toBe('accelerated_threshold2')
  })
})

describe('calculateAmwa', () => {
  it('divides total by months', () => {
    expect(calculateAmwa(120_000, 12)).toBe(10_000)
  })

  it('handles partial year', () => {
    expect(calculateAmwa(50_000, 5)).toBe(10_000)
  })

  it('returns 0 for zero months', () => {
    expect(calculateAmwa(100_000, 0)).toBe(0)
  })
})

describe('generateMonthlyRemittanceDueDates', () => {
  it('generates 12 entries', () => {
    const dates = generateMonthlyRemittanceDueDates(2025)
    expect(dates).toHaveLength(12)
  })

  it('each due date is the 15th of the following month', () => {
    const dates = generateMonthlyRemittanceDueDates(2025)
    // January deductions due Feb 15
    expect(dates[0].periodStart).toBe('2025-01-01')
    expect(dates[0].dueDate).toBe('2025-02-15')
    // December deductions due Jan 15 next year
    expect(dates[11].periodStart).toBe('2025-12-01')
    expect(dates[11].dueDate).toBe('2026-01-15')
  })
})

describe('generateQuarterlyRemittanceDueDates', () => {
  it('generates 4 entries', () => {
    const dates = generateQuarterlyRemittanceDueDates(2025)
    expect(dates).toHaveLength(4)
  })

  it('Q1 due Apr 15', () => {
    const dates = generateQuarterlyRemittanceDueDates(2025)
    expect(dates[0].dueDate).toBe('2025-04-15')
  })

  it('Q4 due Jan 15 next year', () => {
    const dates = generateQuarterlyRemittanceDueDates(2025)
    expect(dates[3].dueDate).toBe('2026-01-15')
  })
})

describe('CPP_2026', () => {
  it('YMPE is $74,600', () => {
    expect(CPP_2026.ympe).toBe(74_600)
  })

  it('YAMPE (CPP2) is $85,000', () => {
    expect(CPP_2026.yampe).toBe(85_000)
  })

  it('basic exemption is $3,500', () => {
    expect(CPP_2026.basicExemption).toBe(3_500)
  })

  it('employee rate is 5.95%', () => {
    expect(CPP_2026.rate).toBe(0.0595)
  })

  it('CPP2 rate is 4%', () => {
    expect(CPP_2026.cpp2Rate).toBe(0.04)
  })
})

describe('EI_2026', () => {
  it('max insurable earnings is $68,900', () => {
    expect(EI_2026.maxInsurableEarnings).toBe(68_900)
  })

  it('employee rate is 1.63%', () => {
    expect(EI_2026.employeeRate).toBe(0.0163)
  })

  it('employer rate is 1.4x employee', () => {
    expect(EI_2026.employerRate).toBeCloseTo(EI_2026.employeeRate * 1.4, 4)
  })
})
