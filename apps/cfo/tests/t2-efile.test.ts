/**
 * Tests for CRA T2 EFILE XML Generator
 *
 * Validates:
 * 1. XML structure and well-formedness
 * 2. BN15 validation
 * 3. Schedule XML generation (1, 7, 8, 100, 125)
 * 4. T2 master return body
 * 5. T4 Summary generation
 * 6. Filing package builder
 * 7. Edge cases and error handling
 */
import { describe, expect, it } from 'vitest'
import {
  generateT2Xml,
  generateT4SummaryXml,
  buildFilingPackage,
  validateEfileInput,
  FilingStatus,
  CorporationType,
  type T2EfileInput,
  type T4SummaryEfileInput,
  type GifiEntry,
} from '../lib/t2-efile'
import { calculateT2Return } from '../lib/t2-schedules'
import type { Schedule8Result } from '../lib/cca-schedule'

// ── Test Fixtures ───────────────────────────────────────────────────────────

function makeCorporation() {
  return {
    businessNumber: '123456789RC0001',
    legalName: 'Acme Corp Ltd.',
    tradeName: 'Acme',
    address: {
      line1: '100 Bay Street',
      line2: 'Suite 500',
      city: 'Toronto',
      province: 'ON' as const,
      postalCode: 'M5J 2S1',
    },
    naicsCode: '541110',
    incorporationDate: '2020-01-15',
    incorporationProvince: 'ON' as const,
    corporationType: CorporationType.CCPC,
    isCcpc: true,
  }
}

function makeT2Result() {
  const input = {
    orgId: 'org-1',
    taxYear: 2025,
    fiscalYearEnd: '12-31',
    province: 'ON' as const,
    isCcpc: true,
    schedule1: {
      netIncomePerStatements: 500_000,
      addBackAmortization: 50_000,
      addBackMeals: 5_000,
      addBackPenalties: 0,
      addBackPolitical: 0,
      addBackReserves: 0,
      addBackDonations: 0,
      addBackLifeInsurance: 2_000,
      deductCca: 60_000,
      deductTerminalLoss: 0,
      deductCapitalGainReserve: 0,
      otherAdjustments: 0,
    },
    schedule7: {
      activeBusinessIncome: 400_000,
      investmentIncome: 20_000,
      taxableCapitalGains: 0,
      taxableCapitalEmployed: 2_000_000,
      associatedCorpSbdShare: 500_000,
    },
    ccaClaimed: 60_000,
    charitableDonations: 10_000,
    dividendsReceived: 0,
    lossCarryforwards: 0,
    installmentsPaid: 40_000,
    taxWithheld: 0,
  }
  return calculateT2Return(input)
}

function makeSchedule8(): Schedule8Result {
  return {
    pools: [
      {
        classNumber: 10,
        rate: 0.30,
        uccOpening: 100_000,
        additionsCost: 20_000,
        dispositionsLesser: 5_000,
        netAdditions: 15_000,
        uccBeforeCca: 115_000,
        ccaOnPool: 30_000,
        ccaOnAdditions: 4_500,
        totalCca: 34_500,
        uccClosing: 80_500,
        recapture: 0,
        terminalLoss: 0,
        prorationFactor: 1,
      },
      {
        classNumber: 50,
        rate: 0.55,
        uccOpening: 50_000,
        additionsCost: 10_000,
        dispositionsLesser: 0,
        netAdditions: 10_000,
        uccBeforeCca: 60_000,
        ccaOnPool: 27_500,
        ccaOnAdditions: 2_750,
        totalCca: 30_250,
        uccClosing: 29_750,
        recapture: 0,
        terminalLoss: 0,
        prorationFactor: 1,
      },
    ],
    totalCca: 64_750,
    totalRecapture: 0,
    totalTerminalLoss: 0,
    netCcaDeduction: 64_750,
  }
}

function makeGifiBalances(): GifiEntry[] {
  return [
    { gifiCode: 1001, description: 'Cash and deposits', amount: 250_000, schedule: 100 },
    { gifiCode: 1060, description: 'Accounts receivable', amount: 180_000, schedule: 100 },
    { gifiCode: 2620, description: 'Accounts payable', amount: 120_000, schedule: 100 },
    { gifiCode: 8020, description: 'Professional fees', amount: 1_200_000, schedule: 125 },
    { gifiCode: 8670, description: 'Office expenses', amount: 45_000, schedule: 125 },
    { gifiCode: 9367, description: 'Salary expense', amount: 400_000, schedule: 125 },
  ]
}

function makePreparer() {
  return {
    efileNumber: 'EF12345',
    name: 'Jane Preparer',
    firmName: 'Tax Pro LLP',
    phone: '416-555-0199',
  }
}

function makeFullInput(): T2EfileInput {
  return {
    corporation: makeCorporation(),
    fiscalPeriod: { start: '2025-01-01', end: '2025-12-31', isShortYear: false },
    taxYear: 2025,
    province: 'ON',
    filingStatus: FilingStatus.ORIGINAL,
    t2Result: makeT2Result(),
    schedule8: makeSchedule8(),
    gifiBalances: makeGifiBalances(),
    preparer: makePreparer(),
    signatureDate: '2026-06-15',
    signingOfficer: 'John Director',
    signingOfficerTitle: 'Director',
  }
}

// ── Tests ───────────────────────────────────────────────────────────────────

describe('validateEfileInput', () => {
  it('returns no warnings for valid input', () => {
    const warnings = validateEfileInput(makeFullInput())
    expect(warnings).toHaveLength(0)
  })

  it('warns on invalid BN15 format', () => {
    const input = makeFullInput()
    input.corporation.businessNumber = '12345'
    const warnings = validateEfileInput(input)
    expect(warnings.some((w) => w.includes('BN15'))).toBe(true)
  })

  it('warns on invalid date formats', () => {
    const input = makeFullInput()
    input.fiscalPeriod.start = '01/01/2025'
    input.signatureDate = 'June 15 2026'
    const warnings = validateEfileInput(input)
    expect(warnings.length).toBeGreaterThanOrEqual(2)
  })

  it('warns on invalid NAICS code', () => {
    const input = makeFullInput()
    input.corporation.naicsCode = '12'
    const warnings = validateEfileInput(input)
    expect(warnings.some((w) => w.includes('NAICS'))).toBe(true)
  })

  it('warns when GIFI balances are empty', () => {
    const input = makeFullInput()
    input.gifiBalances = []
    const warnings = validateEfileInput(input)
    expect(warnings.some((w) => w.includes('GIFI'))).toBe(true)
  })

  it('warns on short EFILE number', () => {
    const input = makeFullInput()
    input.preparer.efileNumber = 'AB'
    const warnings = validateEfileInput(input)
    expect(warnings.some((w) => w.includes('EFILE'))).toBe(true)
  })
})

describe('generateT2Xml', () => {
  it('produces valid XML with correct declaration', () => {
    const result = generateT2Xml(makeFullInput())
    expect(result.xml).toMatch(/^<\?xml version="1\.0" encoding="UTF-8"\?>/)
    expect(result.xml).toContain('<T2Return xmlns="http://www.cra-arc.gc.ca/T2"')
    expect(result.xml).toContain('</T2Return>')
  })

  it('includes the ReturnHeader section', () => {
    const result = generateT2Xml(makeFullInput())
    expect(result.xml).toContain('<ReturnHeader>')
    expect(result.xml).toContain('</ReturnHeader>')
    expect(result.xml).toContain('<BusinessNumber>123456789RC0001</BusinessNumber>')
    expect(result.xml).toContain('<LegalName>Acme Corp Ltd.</LegalName>')
    expect(result.xml).toContain('<FiscalPeriodStart>2025-01-01</FiscalPeriodStart>')
    expect(result.xml).toContain('<FiscalPeriodEnd>2025-12-31</FiscalPeriodEnd>')
    expect(result.xml).toContain('<TaxYear>2025</TaxYear>')
  })

  it('includes corporation address with province code', () => {
    const result = generateT2Xml(makeFullInput())
    expect(result.xml).toContain('<City>Toronto</City>')
    expect(result.xml).toContain('<ProvinceCode>35</ProvinceCode>') // ON = 35
    expect(result.xml).toContain('<PostalCode>M5J2S1</PostalCode>') // whitespace stripped
  })

  it('includes CCPC flag', () => {
    const result = generateT2Xml(makeFullInput())
    expect(result.xml).toContain('<IsCcpc>Y</IsCcpc>')
  })

  it('generates all 5 schedules for full input', () => {
    const result = generateT2Xml(makeFullInput())
    expect(result.schedulesIncluded).toContain('Schedule 1 — Net Income for Tax Purposes')
    expect(result.schedulesIncluded).toContain('Schedule 7 — AAII and SBD')
    expect(result.schedulesIncluded).toContain('Schedule 8 — CCA')
    expect(result.schedulesIncluded).toContain('Schedule 100 — Balance Sheet (GIFI)')
    expect(result.schedulesIncluded).toContain('Schedule 125 — Income Statement (GIFI)')
    expect(result.schedulesIncluded).toHaveLength(5)
  })

  it('includes Schedule 1 net income line', () => {
    const result = generateT2Xml(makeFullInput())
    expect(result.xml).toContain('number="1"')
    expect(result.xml).toContain('number="3680"')
    expect(result.xml).toContain('number="3900"')
  })

  it('includes Schedule 7 SBD lines', () => {
    const result = generateT2Xml(makeFullInput())
    expect(result.xml).toContain('number="7"')
    expect(result.xml).toContain('number="430"') // SBD
    expect(result.xml).toContain('number="420"') // effective SBD limit
  })

  it('includes Schedule 8 CCA classes', () => {
    const result = generateT2Xml(makeFullInput())
    expect(result.xml).toContain('number="8"')
    expect(result.xml).toContain('<CcaClass number="10"')
    expect(result.xml).toContain('<CcaClass number="50"')
    expect(result.xml).toContain('<UccOpening>100000.00</UccOpening>')
    expect(result.xml).toContain('<CcaClaimed>34500.00</CcaClaimed>')
  })

  it('includes GIFI codes in Schedule 100/125', () => {
    const result = generateT2Xml(makeFullInput())
    expect(result.xml).toContain('number="100"')
    expect(result.xml).toContain('number="125"')
    expect(result.xml).toContain('code="1001"')   // Cash
    expect(result.xml).toContain('code="8020"')   // Professional fees
    expect(result.xml).toContain('>250000.00<')    // Cash amount
  })

  it('includes T2 body lines', () => {
    const result = generateT2Xml(makeFullInput())
    expect(result.xml).toContain('<T2Body>')
    expect(result.xml).toContain('</T2Body>')
    expect(result.xml).toContain('number="300"')   // Taxable income
    expect(result.xml).toContain('number="770"')   // Total tax
    expect(result.xml).toContain('number="890"')   // Balance due
  })

  it('includes Certification section', () => {
    const result = generateT2Xml(makeFullInput())
    expect(result.xml).toContain('<Certification>')
    expect(result.xml).toContain('<SigningOfficerName>John Director</SigningOfficerName>')
    expect(result.xml).toContain('<PreparerEfileNumber>EF12345</PreparerEfileNumber>')
    expect(result.xml).toContain('<FirmName>Tax Pro LLP</FirmName>')
    expect(result.xml).toContain('<SignatureDate>2026-06-15</SignatureDate>')
  })

  it('generates a reference ID', () => {
    const result = generateT2Xml(makeFullInput())
    expect(result.referenceId).toMatch(/^T2-2025-123456789RC0001-/)
    expect(result.xml).toContain(`referenceId="${result.referenceId}"`)
  })

  it('reports line count', () => {
    const result = generateT2Xml(makeFullInput())
    expect(result.lineCount).toBeGreaterThan(0)
  })

  it('omits Schedule 8 when not provided', () => {
    const input = makeFullInput()
    input.schedule8 = undefined
    const result = generateT2Xml(input)
    expect(result.schedulesIncluded).not.toContain('Schedule 8 — CCA')
    expect(result.xml).not.toContain('number="8"')
  })

  it('omits Schedule 100 when no balance sheet GIFI', () => {
    const input = makeFullInput()
    input.gifiBalances = input.gifiBalances.filter((g) => g.schedule !== 100)
    const result = generateT2Xml(input)
    expect(result.schedulesIncluded).not.toContain('Schedule 100 — Balance Sheet (GIFI)')
  })

  it('escapes XML special characters in names', () => {
    const input = makeFullInput()
    input.corporation.legalName = 'Smith & Partners <Law>'
    const result = generateT2Xml(input)
    expect(result.xml).toContain('Smith &amp; Partners &lt;Law&gt;')
    expect(result.xml).not.toContain('Smith & Partners <Law>')
  })
})

describe('generateT4SummaryXml', () => {
  function makeT4Input(): T4SummaryEfileInput {
    return {
      businessNumber: '123456789RP0001',
      employerName: 'Acme Corp Ltd.',
      taxYear: 2025,
      province: 'ON',
      preparer: makePreparer(),
      slips: [
        {
          employeeId: 'emp-1',
          employeeName: 'Alice Worker',
          employeeSin: '123456789',
          box14EmploymentIncome: 95_000,
          box16Cpp: 3_867.50,
          box17Cpp2: 396,
          box18Ei: 1_077.48,
          box20Rpp: 0,
          box22IncomeTax: 18_000,
          box24InsurableEarnings: 65_700,
          box26PensionableEarnings: 71_300,
          box40TaxableBenefits: 1_200,
          box44UnionDues: 0,
          box52PensionAdjustment: 0,
          province: 'ON',
        },
        {
          employeeId: 'emp-2',
          employeeName: 'Bob Manager',
          employeeSin: '987654321',
          box14EmploymentIncome: 120_000,
          box16Cpp: 4_034.10,
          box17Cpp2: 396,
          box18Ei: 1_077.48,
          box20Rpp: 5_000,
          box22IncomeTax: 28_000,
          box24InsurableEarnings: 65_700,
          box26PensionableEarnings: 81_200,
          box40TaxableBenefits: 2_400,
          box44UnionDues: 600,
          box52PensionAdjustment: 5_000,
          province: 'ON',
        },
      ],
    }
  }

  it('produces valid T4Return XML', () => {
    const result = generateT4SummaryXml(makeT4Input())
    expect(result.xml).toMatch(/^<\?xml version="1\.0"/)
    expect(result.xml).toContain('<T4Return xmlns="http://www.cra-arc.gc.ca/T4"')
    expect(result.xml).toContain('</T4Return>')
  })

  it('includes T4Summary with totals', () => {
    const result = generateT4SummaryXml(makeT4Input())
    expect(result.xml).toContain('<TotalSlips>2</TotalSlips>')
    expect(result.xml).toContain('<BusinessNumber>123456789RP0001</BusinessNumber>')
    expect(result.xml).toContain('<TotalEmploymentIncome>215000.00</TotalEmploymentIncome>')
  })

  it('generates individual T4 slips', () => {
    const result = generateT4SummaryXml(makeT4Input())
    expect(result.xml).toContain('<T4Slip>')
    expect(result.xml).toContain('<EmployeeName>Alice Worker</EmployeeName>')
    expect(result.xml).toContain('<EmployeeName>Bob Manager</EmployeeName>')
    expect(result.xml).toContain('<Box14>95000.00</Box14>')
    expect(result.xml).toContain('<Box14>120000.00</Box14>')
  })

  it('maps province to CRA code', () => {
    const result = generateT4SummaryXml(makeT4Input())
    expect(result.xml).toContain('<ProvinceOfEmployment>35</ProvinceOfEmployment>') // ON
  })

  it('returns correct slip count and totals', () => {
    const result = generateT4SummaryXml(makeT4Input())
    expect(result.slipCount).toBe(2)
    expect(result.totals.totalEmploymentIncome).toBe(215_000)
    expect(result.totals.totalCpp).toBeCloseTo(8_693.60, 2) // both CPP + CPP2
    expect(result.totals.totalEi).toBeCloseTo(2_154.96, 2)
    expect(result.totals.totalIncomeTax).toBe(46_000)
  })

  it('escapes SIN in XML', () => {
    const result = generateT4SummaryXml(makeT4Input())
    expect(result.xml).toContain('<EmployeeSin>123456789</EmployeeSin>')
    expect(result.xml).toContain('<EmployeeSin>987654321</EmployeeSin>')
  })
})

describe('buildFilingPackage', () => {
  it('builds a T2-only package', () => {
    const input = makeFullInput()
    const pkg = buildFilingPackage(input)
    expect(pkg.t2Xml.xml).toContain('<T2Return')
    expect(pkg.t4Xml).toBeUndefined()
    expect(pkg.totalSchedules).toBe(5)
  })

  it('builds a T2 + T4 package', () => {
    const t2Input = makeFullInput()
    const t4Input: T4SummaryEfileInput = {
      businessNumber: '123456789RP0001',
      employerName: 'Acme Corp Ltd.',
      taxYear: 2025,
      province: 'ON',
      preparer: makePreparer(),
      slips: [
        {
          employeeId: 'emp-1',
          employeeName: 'Alice Worker',
          employeeSin: '123456789',
          box14EmploymentIncome: 90_000,
          box16Cpp: 3_500,
          box17Cpp2: 350,
          box18Ei: 1_000,
          box20Rpp: 0,
          box22IncomeTax: 15_000,
          box24InsurableEarnings: 65_700,
          box26PensionableEarnings: 71_300,
          box40TaxableBenefits: 0,
          box44UnionDues: 0,
          box52PensionAdjustment: 0,
          province: 'ON',
        },
      ],
    }

    const pkg = buildFilingPackage(t2Input, t4Input)
    expect(pkg.t4Xml).toBeDefined()
    expect(pkg.t4Xml!.slipCount).toBe(1)
  })

  it('produces a complete checklist', () => {
    const pkg = buildFilingPackage(makeFullInput())
    expect(pkg.checklist.length).toBeGreaterThanOrEqual(8)

    const t2Check = pkg.checklist.find((c) => c.item.includes('T2 Corporation'))
    expect(t2Check?.completed).toBe(true)

    const signCheck = pkg.checklist.find((c) => c.item.includes('Signed'))
    expect(signCheck?.completed).toBe(true)

    const efileCheck = pkg.checklist.find((c) => c.item.includes('EFILE'))
    expect(efileCheck?.completed).toBe(true)
  })

  it('marks T4 as not completed when absent', () => {
    const pkg = buildFilingPackage(makeFullInput())
    const t4Check = pkg.checklist.find((c) => c.item.includes('T4'))
    expect(t4Check?.completed).toBe(false)
    expect(t4Check?.required).toBe(false) // no t4Input provided
  })

  it('marks Schedule 8 as completed when present', () => {
    const pkg = buildFilingPackage(makeFullInput())
    const s8Check = pkg.checklist.find((c) => c.item.includes('Schedule 8'))
    expect(s8Check?.completed).toBe(true)
    expect(s8Check?.required).toBe(true)
  })
})

describe('XML edge cases', () => {
  it('handles zero-amount lines gracefully (omits them)', () => {
    const input = makeFullInput()
    // Force a T2 result with zero RDTOH
    const result = generateT2Xml(input)
    // Line 784 (RDTOH) should only appear if > 0
    const hasRdtohLine = result.xml.includes('number="784"')
    const rdtoh = input.t2Result.rdtoh
    if (rdtoh === 0) {
      expect(hasRdtohLine).toBe(false)
    } else {
      expect(hasRdtohLine).toBe(true)
    }
  })

  it('handles Schedule 8 with recapture', () => {
    const input = makeFullInput()
    input.schedule8 = {
      pools: [
        {
          classNumber: 10,
          rate: 0.30,
          uccOpening: 10_000,
          additionsCost: 0,
          dispositionsLesser: 15_000,
          netAdditions: -15_000,
          uccBeforeCca: -5_000,
          ccaOnPool: 0,
          ccaOnAdditions: 0,
          totalCca: 0,
          uccClosing: 0,
          recapture: 5_000,
          terminalLoss: 0,
          prorationFactor: 1,
        },
      ],
      totalCca: 0,
      totalRecapture: 5_000,
      totalTerminalLoss: 0,
      netCcaDeduction: -5_000,
    }
    const result = generateT2Xml(input)
    expect(result.xml).toContain('<Recapture>5000.00</Recapture>')
    expect(result.xml).toContain('number="8998"') // total recapture line
  })

  it('handles all provinces', () => {
    const provinces = ['ON', 'QC', 'BC', 'AB', 'SK', 'MB', 'NB', 'NS', 'PE', 'NL', 'YT', 'NT', 'NU'] as const
    for (const prov of provinces) {
      const input = makeFullInput()
      input.province = prov
      input.corporation.address.province = prov
      const result = generateT2Xml(input)
      expect(result.xml).toContain(`<ProvinceName>${prov}</ProvinceName>`)
    }
  })

  it('handles amended filing status', () => {
    const input = makeFullInput()
    input.filingStatus = FilingStatus.AMENDED
    const result = generateT2Xml(input)
    expect(result.xml).toContain(`<FilingStatus>${FilingStatus.AMENDED}</FilingStatus>`)
  })

  it('handles short fiscal year', () => {
    const input = makeFullInput()
    input.fiscalPeriod = {
      start: '2025-06-01',
      end: '2025-12-31',
      isShortYear: true,
    }
    const result = generateT2Xml(input)
    expect(result.xml).toContain('<IsShortYear>Y</IsShortYear>')
  })
})
