/**
 * CFO — CCA Schedule Engine Tests
 *
 * Tests the Capital Cost Allowance calculation engine and chart-of-accounts helpers.
 * All functions are pure — no mocks required.
 */
import { describe, it, expect } from 'vitest'
import {
  CCA_CLASSES,
  getCcaClass,
  calculateCcaPool,
  calculateSchedule8,
  ccaTaxShield,
  getCommonClasses,
} from '../cca-schedule'
import {
  getGifiMapping,
  getGifiBySchedule,
  ChartAccountSchema,
  AccountType,
  AccountSubtype,
} from '../chart-of-accounts'

// ── getCcaClass ─────────────────────────────────────────────────────────────

describe('getCcaClass', () => {
  it('returns class 50 (computers) with 55% rate', () => {
    const c = getCcaClass(50)
    expect(c).toBeDefined()
    expect(c!.rate).toBe(0.55)
    expect(c!.decliningBalance).toBe(true)
    expect(c!.aiipEligible).toBe(true)
  })

  it('returns class 10 (motor vehicles) with 30% rate', () => {
    const c = getCcaClass(10)
    expect(c!.rate).toBe(0.30)
  })

  it('returns undefined for unknown class', () => {
    expect(getCcaClass(99)).toBeUndefined()
  })

  it('contains all expected classes', () => {
    expect(CCA_CLASSES.length).toBeGreaterThan(10)
    expect(CCA_CLASSES.every((c) => c.classNumber > 0)).toBe(true)
    expect(CCA_CLASSES.every((c) => c.rate >= 0 && c.rate <= 1)).toBe(true)
  })
})

// ── calculateCcaPool ────────────────────────────────────────────────────────

describe('calculateCcaPool — basic declining balance', () => {
  it('calculates CCA on opening pool only (no additions)', () => {
    const result = calculateCcaPool({
      classNumber: 50, // 55% rate
      uccOpeningBalance: 10000,
      additions: [],
      dispositions: [],
    })

    expect(result.ccaOnPool).toBeCloseTo(10000 * 0.55)
    expect(result.ccaOnAdditions).toBe(0)
    expect(result.totalCca).toBeCloseTo(5500)
    expect(result.uccClosing).toBeCloseTo(4500)
    expect(result.recapture).toBe(0)
    expect(result.terminalLoss).toBe(0)
    expect(result.prorationFactor).toBe(1)
  })

  it('applies half-year rule to non-AIIP additions', () => {
    const result = calculateCcaPool({
      classNumber: 8, // 20% rate
      uccOpeningBalance: 0,
      additions: [{ id: 'a1', classNumber: 8, description: 'Equipment', capitalCost: 5000, dateAcquired: '2024-01-01', isAiip: false }],
      dispositions: [],
    })

    // Half-year rule: additions × rate × 0.5 = 5000 × 0.20 × 0.5 = 500
    expect(result.ccaOnAdditions).toBeCloseTo(500)
    expect(result.totalCca).toBeCloseTo(500)
    expect(result.uccClosing).toBeCloseTo(4500)
  })

  it('applies AIIP multiplier (1.5×) to AIIP additions', () => {
    const result = calculateCcaPool({
      classNumber: 8, // 20% rate
      uccOpeningBalance: 0,
      additions: [{ id: 'a1', classNumber: 8, description: 'Equipment', capitalCost: 5000, dateAcquired: '2024-01-01', isAiip: true }],
      dispositions: [],
    })

    // AIIP: additions × rate × 1.5 = 5000 × 0.20 × 1.5 = 1500
    expect(result.ccaOnAdditions).toBeCloseTo(1500)
  })

  it('limits total CCA to UCC before CCA', () => {
    const result = calculateCcaPool({
      classNumber: 12, // 100% rate
      uccOpeningBalance: 200,
      additions: [{ id: 'a1', classNumber: 12, description: 'Tool', capitalCost: 100, dateAcquired: '2024-01-01', isAiip: false }],
      dispositions: [],
    })

    // CCA cannot exceed UCC before CCA
    expect(result.totalCca).toBeLessThanOrEqual(result.uccBeforeCca)
    expect(result.uccClosing).toBeGreaterThanOrEqual(0)
  })
})

describe('calculateCcaPool — dispositions', () => {
  it('deducts disposition (lesser of proceeds and capital cost)', () => {
    const result = calculateCcaPool({
      classNumber: 10, // 30% rate
      uccOpeningBalance: 8000,
      additions: [],
      dispositions: [{ id: 'd1', classNumber: 10, description: 'Vehicle', capitalCost: 20000, dateAcquired: '2020-01-01', proceedsOfDisposition: 12000, isAiip: false }],
    })

    // Lesser = min(12000, 20000) = 12000
    expect(result.dispositionsLesser).toBe(12000)
    // UCC before CCA = 8000 - 12000 = -4000 → recapture
    expect(result.recapture).toBe(4000)
    expect(result.totalCca).toBe(0)
    expect(result.uccClosing).toBe(0)
  })

  it('triggers terminal loss when all assets disposed and UCC remains', () => {
    const result = calculateCcaPool({
      classNumber: 8, // 20% rate
      uccOpeningBalance: 3000,
      additions: [],
      dispositions: [{ id: 'd1', classNumber: 8, description: 'Desk', capitalCost: 5000, dateAcquired: '2020-01-01', proceedsOfDisposition: 1000, isAiip: false }],
    })

    // Proceeds = min(1000, 5000) = 1000; UCC before = 3000 - 1000 = 2000 > 0, all disposed
    expect(result.terminalLoss).toBe(2000)
    expect(result.totalCca).toBe(0)
    expect(result.uccClosing).toBe(0)
  })
})

describe('calculateCcaPool — short fiscal year', () => {
  it('prorates CCA for short fiscal year', () => {
    const fullYear = calculateCcaPool({
      classNumber: 50,
      uccOpeningBalance: 10000,
      additions: [],
      dispositions: [],
    })

    const halfYear = calculateCcaPool({
      classNumber: 50,
      uccOpeningBalance: 10000,
      additions: [],
      dispositions: [],
      fiscalYearDays: 182,
    })

    expect(halfYear.prorationFactor).toBeCloseTo(182 / 365, 3)
    expect(halfYear.totalCca).toBeCloseTo(fullYear.totalCca * (182 / 365), 1)
  })
})

// ── calculateSchedule8 ──────────────────────────────────────────────────────

describe('calculateSchedule8', () => {
  it('aggregates totals across multiple pools', () => {
    const result = calculateSchedule8({
      pools: [
        { classNumber: 50, uccOpeningBalance: 10000, additions: [], dispositions: [] },
        { classNumber: 8, uccOpeningBalance: 5000, additions: [], dispositions: [] },
      ],
    })

    // Class 50: 10000 × 0.55 = 5500; Class 8: 5000 × 0.20 = 1000
    expect(result.totalCca).toBeCloseTo(6500)
    expect(result.pools).toHaveLength(2)
    expect(result.totalRecapture).toBe(0)
    expect(result.totalTerminalLoss).toBe(0)
    expect(result.netCcaDeduction).toBeCloseTo(6500)
  })

  it('limits total CCA to maxClaimOverride', () => {
    const result = calculateSchedule8({
      pools: [
        { classNumber: 50, uccOpeningBalance: 10000, additions: [], dispositions: [] },
      ],
      maxClaimOverride: 1000,
    })

    expect(result.totalCca).toBe(1000)
  })

  it('returns zero CCA for empty pools', () => {
    const result = calculateSchedule8({ pools: [] })
    expect(result.totalCca).toBe(0)
    expect(result.netCcaDeduction).toBe(0)
  })

  it('netCcaDeduction = totalCca + terminalLoss - recapture', () => {
    // Create recapture scenario
    const result = calculateSchedule8({
      pools: [
        {
          classNumber: 10,
          uccOpeningBalance: 5000,
          additions: [],
          dispositions: [{ id: 'd1', classNumber: 10, description: 'Car', capitalCost: 10000, dateAcquired: '2020-01-01', proceedsOfDisposition: 8000, isAiip: false }],
        },
      ],
    })

    expect(result.netCcaDeduction).toBe(
      result.totalCca + result.totalTerminalLoss - result.totalRecapture
    )
  })
})

// ── ccaTaxShield ────────────────────────────────────────────────────────────

describe('ccaTaxShield', () => {
  it('returns a positive shield for standard asset', () => {
    const shield = ccaTaxShield({
      capitalCost: 100000,
      ccaRate: 0.30,
      taxRate: 0.265, // Federal CCPC general rate
      discountRate: 0.05,
      isAiip: false,
    })
    expect(shield).toBeGreaterThan(0)
    expect(shield).toBeLessThan(100000) // Shield is fraction of cost
  })

  it('AIIP shield is higher than non-AIIP (better timing)', () => {
    const params = { capitalCost: 100000, ccaRate: 0.20, taxRate: 0.265, discountRate: 0.05 }
    const nonAiip = ccaTaxShield({ ...params, isAiip: false })
    const aiip = ccaTaxShield({ ...params, isAiip: true })
    expect(aiip).toBeGreaterThan(nonAiip)
  })

  it('returns 0 when capitalCost is 0', () => {
    const shield = ccaTaxShield({
      capitalCost: 0,
      ccaRate: 0.30,
      taxRate: 0.265,
      discountRate: 0.05,
      isAiip: false,
    })
    expect(shield).toBe(0)
  })
})

// ── getCommonClasses ────────────────────────────────────────────────────────

describe('getCommonClasses', () => {
  it('returns expected subset of classes', () => {
    const classes = getCommonClasses()
    const numbers = classes.map((c) => c.classNumber)
    expect(numbers).toContain(8)
    expect(numbers).toContain(50)
    expect(numbers).toContain(1)
    expect(classes.length).toBeGreaterThan(5)
  })
})

// ── getGifiMapping & getGifiBySchedule ──────────────────────────────────────

describe('getGifiMapping', () => {
  it('returns mapping for known GIFI code 1000', () => {
    const m = getGifiMapping(1000)
    expect(m).toBeDefined()
    expect(m!.code).toBe(1000)
    expect(m!.description).toContain('Cash')
    expect(m!.normalBalance).toBe('debit')
    expect(m!.schedule).toBe(100)
  })

  it('returns mapping for revenue code 8020 (schedule 125)', () => {
    const m = getGifiMapping(8020)
    expect(m!.schedule).toBe(125)
    expect(m!.normalBalance).toBe('credit')
  })

  it('returns undefined for unknown code', () => {
    expect(getGifiMapping(9998)).toBeUndefined()
  })
})

describe('getGifiBySchedule', () => {
  it('returns only schedule 100 codes', () => {
    const codes = getGifiBySchedule(100)
    expect(codes.length).toBeGreaterThan(0)
    expect(codes.every((c) => c.schedule === 100)).toBe(true)
  })

  it('returns only schedule 125 codes', () => {
    const codes = getGifiBySchedule(125)
    expect(codes.length).toBeGreaterThan(0)
    expect(codes.every((c) => c.schedule === 125)).toBe(true)
  })

  it('schedule 100 includes asset and liability codes', () => {
    const codes = getGifiBySchedule(100)
    const codeNumbers = codes.map((c) => c.code)
    expect(codeNumbers).toContain(1000) // Cash — assets
    expect(codeNumbers).toContain(2600) // Bank overdraft — liabilities
  })
})

describe('ChartAccountSchema', () => {
  it('accepts valid account', () => {
    const result = ChartAccountSchema.parse({
      accountNumber: '1000',
      name: 'Cash',
      type: 'asset',
      gifiCode: 1000,
      isActive: true,
      parentAccountNumber: null,
    })
    expect(result.accountNumber).toBe('1000')
  })

  it('rejects account number that is not 4-6 digits', () => {
    expect(() => ChartAccountSchema.parse({
      accountNumber: 'ABC',
      name: 'Bad',
      type: 'asset',
      gifiCode: 1000,
    })).toThrow()
  })

  it('rejects invalid account type', () => {
    expect(() => ChartAccountSchema.parse({
      accountNumber: '1000',
      name: 'Cash',
      type: 'other',
      gifiCode: 1000,
    })).toThrow()
  })

  it('rejects GIFI code out of range', () => {
    expect(() => ChartAccountSchema.parse({
      accountNumber: '1000',
      name: 'Cash',
      type: 'asset',
      gifiCode: 999,
    })).toThrow()
  })
})

describe('AccountType / AccountSubtype constants', () => {
  it('AccountType has all expected values', () => {
    expect(AccountType.ASSET).toBe('asset')
    expect(AccountType.LIABILITY).toBe('liability')
    expect(AccountType.EQUITY).toBe('equity')
    expect(AccountType.REVENUE).toBe('revenue')
    expect(AccountType.EXPENSE).toBe('expense')
  })

  it('AccountSubtype includes current and long-term variants', () => {
    expect(AccountSubtype.CURRENT_ASSET).toBe('current_asset')
    expect(AccountSubtype.LONG_TERM_LIABILITY).toBe('long_term_liability')
    expect(AccountSubtype.RETAINED_EARNINGS).toBe('retained_earnings')
  })
})
