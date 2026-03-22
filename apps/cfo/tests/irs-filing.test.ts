/**
 * CFO — IRS Filing Tests
 *
 * Tests for Form 1120 computation, MACRS depreciation, XML generation,
 * and filing validation.
 */
import { describe, it, expect } from 'vitest'
import {
  computeMACRS,
  buildDepreciationSchedule,
  computeForm1120,
  generateForm1120XML,
  validateReturn,
  assembleFilingPackage,
  type Form1120Data,
  type MACRSAsset,
  type IRSReturnHeader,
  type IRSFilingConfig,
} from '../lib/irs-filing'

// ── Test fixtures ───────────────────────────────────────────────────────────

const testHeader: IRSReturnHeader = {
  formType: '1120',
  taxYear: 2024,
  ein: '12-3456789',
  businessName: 'Test Corp',
  address: { street: '100 Main St', city: 'Austin', state: 'TX', zip: '78701' },
  fiscalYearEnd: '12/31',
  naicsCode: '541511',
  dateIncorporated: '2015-01-01',
  totalAssets: 500_000,
}

const testConfig: IRSFilingConfig = {
  efin: '123456',
  softwareId: 'NZILA-CFO',
  preparerTin: '987654321',
  preparerName: 'Jane CPA',
}

function makeBaseData(): Omit<Form1120Data, 'totalIncome' | 'totalDeductions' | 'taxableIncome' | 'totalTax'> {
  return {
    grossReceipts: 1_000_000,
    costOfGoodsSold: 400_000,
    grossProfit: 600_000,
    dividends: 5_000,
    interest: 2_000,
    grossRents: 0,
    grossRoyalties: 0,
    capitalGain: 0,
    netGain: 0,
    otherIncome: 3_000,
    compensation: 150_000,
    salariesWages: 200_000,
    repairs: 10_000,
    badDebts: 0,
    rents: 36_000,
    taxes: 15_000,
    interestExpense: 8_000,
    depreciation: 25_000,
    depletion: 0,
    advertising: 5_000,
    pensionPlans: 3_000,
    employeeBenefits: 2_000,
    otherDeductions: 10_000,
    paymentsCredits: 20_000,
    amountOwed: 0,
    overpayment: 0,
  }
}

// ── MACRS Depreciation ──────────────────────────────────────────────────────

describe('MACRS Depreciation', () => {
  it('computes year-1 depreciation for 5-year property', () => {
    const depr = computeMACRS(
      { cost: 10_000, recoveryPeriod: 5, dateInService: '2024-03-15', method: '200DB' },
      2024,
    )
    // 200% DB 5-year half-year: 20% year 1
    expect(depr).toBe(2_000)
  })

  it('computes year-2 depreciation for 5-year property', () => {
    const depr = computeMACRS(
      { cost: 10_000, recoveryPeriod: 5, dateInService: '2024-03-15', method: '200DB' },
      2025,
    )
    // 32% of $10,000 = $3,200
    expect(depr).toBe(3_200)
  })

  it('returns 0 for year before in-service', () => {
    const depr = computeMACRS(
      { cost: 10_000, recoveryPeriod: 5, dateInService: '2025-06-15', method: '200DB' },
      2024,
    )
    expect(depr).toBe(0)
  })

  it('returns 0 for year beyond recovery period', () => {
    const depr = computeMACRS(
      { cost: 10_000, recoveryPeriod: 5, dateInService: '2018-01-01', method: '200DB' },
      2025,
    )
    expect(depr).toBe(0)
  })

  it('builds full depreciation schedule', () => {
    const assets: MACRSAsset[] = [
      {
        description: 'Office Equipment',
        dateInService: '2024-01-15',
        cost: 50_000,
        method: '200DB',
        recoveryPeriod: 7,
        convention: 'HY',
        priorDepreciation: 0,
        currentDepreciation: 0,
      },
    ]
    const schedule = buildDepreciationSchedule(assets, 2024)
    expect(schedule.assets).toHaveLength(1)
    expect(schedule.totalDepreciation).toBeGreaterThan(0)
    // 7-year 200DB half-year year 1 = 14.29%
    expect(schedule.assets[0].currentYearDepreciation).toBeCloseTo(7_145, 0)
  })
})

// ── Form 1120 Computation ───────────────────────────────────────────────────

describe('Form 1120 Computation', () => {
  it('computes total income', () => {
    const result = computeForm1120(makeBaseData())
    // totalIncome = grossProfit + dividends + interest + rents + royalties + capGain + netGain + other
    expect(result.totalIncome).toBe(610_000)
  })

  it('computes total deductions', () => {
    const result = computeForm1120(makeBaseData())
    const expectedDeductions = 150_000 + 200_000 + 10_000 + 0 + 36_000 + 15_000 + 8_000 + 25_000 + 0 + 5_000 + 3_000 + 2_000 + 10_000
    expect(result.totalDeductions).toBe(expectedDeductions)
  })

  it('computes taxable income as income minus deductions', () => {
    const result = computeForm1120(makeBaseData())
    expect(result.taxableIncome).toBe(result.totalIncome - result.totalDeductions)
  })

  it('applies 21% corporate tax rate', () => {
    const result = computeForm1120(makeBaseData())
    const expectedTax = Math.round(result.taxableIncome * 0.21 * 100) / 100
    expect(result.totalTax).toBe(expectedTax)
  })

  it('floors taxable income at zero', () => {
    const data = makeBaseData()
    data.otherDeductions = 900_000 // huge deduction to force negative
    const result = computeForm1120(data)
    expect(result.taxableIncome).toBe(0)
    expect(result.totalTax).toBe(0)
  })
})

// ── XML Generation ──────────────────────────────────────────────────────────

describe('Form 1120 XML', () => {
  it('generates valid XML with MeF envelope', () => {
    const data = computeForm1120(makeBaseData())
    const xml = generateForm1120XML(testHeader, data, testConfig)
    expect(xml).toContain('<?xml')
    expect(xml).toContain('<Return')
    expect(xml).toContain('<IRS1120>')
    expect(xml).toContain('12-3456789')
    expect(xml).toContain('Test Corp')
  })

  it('includes financial amounts in XML', () => {
    const data = computeForm1120(makeBaseData())
    const xml = generateForm1120XML(testHeader, data, testConfig)
    expect(xml).toContain('1000000') // gross receipts
    expect(xml).toContain('400000') // COGS
  })

  it('escapes special characters in XML', () => {
    const header = { ...testHeader, businessName: 'Smith & Jones <Corp>' }
    const data = computeForm1120(makeBaseData())
    const xml = generateForm1120XML(header, data, testConfig)
    expect(xml).toContain('Smith &amp; Jones &lt;Corp&gt;')
  })
})

// ── Filing Validation ───────────────────────────────────────────────────────

describe('Filing Validation', () => {
  it('accepts valid filing data', () => {
    const data = computeForm1120(makeBaseData())
    const result = validateReturn(testHeader, data)
    expect(result.valid).toBe(true)
    expect(result.errors).toHaveLength(0)
  })

  it('rejects invalid EIN format', () => {
    const header = { ...testHeader, ein: 'bad-ein' }
    const data = computeForm1120(makeBaseData())
    const result = validateReturn(header, data)
    expect(result.valid).toBe(false)
    expect(result.errors.some((e) => e.code === 'EIN-001')).toBe(true)
  })

  it('detects gross profit mismatch', () => {
    const data = computeForm1120(makeBaseData())
    data.grossProfit = 999_999 // wrong
    const result = validateReturn(testHeader, data)
    expect(result.valid).toBe(false)
    expect(result.errors.some((e) => e.code === 'FIN-001')).toBe(true)
  })

  it('warns for high total assets', () => {
    const header = { ...testHeader, totalAssets: 15_000_000 }
    const data = computeForm1120(makeBaseData())
    const result = validateReturn(header, data)
    expect(result.warnings.some((w) => w.code === 'SCH-001')).toBe(true)
  })
})

// ── Filing Package Assembly ─────────────────────────────────────────────────

describe('assembleFilingPackage', () => {
  it('assembles complete filing package', () => {
    const data = computeForm1120(makeBaseData())
    const pkg = assembleFilingPackage(testHeader, data, testConfig)
    expect(pkg.formType).toBe('1120')
    expect(pkg.taxYear).toBe(2024)
    expect(pkg.ein).toBe('12-3456789')
    expect(pkg.xml).toContain('<IRS1120>')
    expect(pkg.validationResult.valid).toBe(true)
    expect(pkg.status).toBe('validated')
  })
})
