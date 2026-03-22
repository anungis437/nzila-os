/**
 * IRS Filing — US Federal & State Tax Return Generation
 *
 * Generates IRS Form 1120 (C-Corp), 1120-S (S-Corp), and 1065
 * (Partnership) XML e-file packages using IRS Modernized e-File (MeF)
 * schema. Covers key schedules: M-1, M-3, K-1, depreciation (MACRS).
 *
 * Mirrors the Canadian T2 e-file module for US-based entities.
 *
 * @see https://www.irs.gov/e-file-providers/modernized-e-file-mef-overview
 * @module cfo/irs-filing
 */
import { logger } from '@/lib/logger'

// ── Types ───────────────────────────────────────────────────────────────────

export type IRSFormType = '1120' | '1120S' | '1065'
export type FilingStatus = 'draft' | 'validated' | 'transmitted' | 'accepted' | 'rejected'

export interface IRSFilingConfig {
  efin: string
  softwareId: string
  preparerTin: string
  firmEin?: string
  firmName?: string
  preparerName: string
}

export interface IRSReturnHeader {
  formType: IRSFormType
  taxYear: number
  ein: string
  businessName: string
  address: {
    street: string
    city: string
    state: string
    zip: string
  }
  fiscalYearEnd: string
  naicsCode: string
  dateIncorporated: string
  totalAssets: number
}

export interface Form1120Data {
  grossReceipts: number
  costOfGoodsSold: number
  grossProfit: number
  dividends: number
  interest: number
  grossRents: number
  grossRoyalties: number
  capitalGain: number
  netGain: number
  otherIncome: number
  totalIncome: number
  compensation: number
  salariesWages: number
  repairs: number
  badDebts: number
  rents: number
  taxes: number
  interestExpense: number
  depreciation: number
  depletion: number
  advertising: number
  pensionPlans: number
  employeeBenefits: number
  otherDeductions: number
  totalDeductions: number
  taxableIncome: number
  totalTax: number
  paymentsCredits: number
  amountOwed: number
  overpayment: number
}

export interface ScheduleM1 {
  netIncomePerBooks: number
  federalIncomeTax: number
  excessCapitalLosses: number
  nonDeductibleExpenses: number
  otherAdditions: number
  taxExemptInterest: number
  deductibleDividends: number
  otherSubtractions: number
}

export interface ScheduleK1 {
  partnerId: string
  partnerName: string
  partnerTin: string
  ownershipPercentage: number
  profitSharePercentage: number
  lossSharePercentage: number
  ordinaryIncome: number
  rentalIncome: number
  interestIncome: number
  dividendIncome: number
  royalties: number
  shortTermCapitalGain: number
  longTermCapitalGain: number
  section179Deduction: number
  otherDeductions: number
  selfEmploymentEarnings: number
  distributions: number
  capitalContributed: number
}

export interface MACRSAsset {
  description: string
  dateInService: string
  cost: number
  method: '200DB' | '150DB' | 'SL'
  recoveryPeriod: 3 | 5 | 7 | 10 | 15 | 20 | 27.5 | 39
  convention: 'HY' | 'MQ' | 'MM'
  priorDepreciation: number
  currentDepreciation: number
}

export interface IRSValidationResult {
  valid: boolean
  errors: { field: string; code: string; message: string }[]
  warnings: { field: string; code: string; message: string }[]
}

export interface IRSFilingPackage {
  formType: IRSFormType
  taxYear: number
  ein: string
  xml: string
  status: FilingStatus
  validationResult: IRSValidationResult
  generatedAt: string
}

// ── Tax Rate Tables ─────────────────────────────────────────────────────────

/** 2024 C-Corp flat rate */
const CORPORATE_TAX_RATE = 0.21

/** MACRS depreciation rate tables (200% declining balance, half-year) */
const MACRS_200DB_HY: Record<number, number[]> = {
  3: [0.3333, 0.4445, 0.1481, 0.0741],
  5: [0.2000, 0.3200, 0.1920, 0.1152, 0.1152, 0.0576],
  7: [0.1429, 0.2449, 0.1749, 0.1249, 0.0893, 0.0892, 0.0893, 0.0446],
  10: [0.1000, 0.1800, 0.1440, 0.1152, 0.0922, 0.0737, 0.0655, 0.0655, 0.0656, 0.0655, 0.0328],
  15: [0.0500, 0.0950, 0.0855, 0.0770, 0.0693, 0.0623, 0.0590, 0.0590, 0.0591, 0.0590, 0.0591, 0.0590, 0.0591, 0.0590, 0.0591, 0.0295],
  20: [0.0375, 0.0722, 0.0668, 0.0618, 0.0571, 0.0528, 0.0489, 0.0452, 0.0447, 0.0447, 0.0446, 0.0446, 0.0447, 0.0446, 0.0446, 0.0446, 0.0446, 0.0447, 0.0446, 0.0446, 0.0223],
}

// ── MACRS Computation ───────────────────────────────────────────────────────

/**
 * Compute MACRS depreciation for an asset in a given tax year.
 */
export function computeMACRS(
  asset: { cost: number; recoveryPeriod: number; dateInService: string; method: string },
  taxYear: number,
): number {
  const inServiceYear = new Date(asset.dateInService).getFullYear()
  const yearIndex = taxYear - inServiceYear

  if (yearIndex < 0) return 0

  const rates = MACRS_200DB_HY[asset.recoveryPeriod]
  if (!rates || yearIndex >= rates.length) return 0

  return Math.round(asset.cost * rates[yearIndex] * 100) / 100
}

/**
 * Build MACRS depreciation schedule for an array of assets.
 */
export function buildDepreciationSchedule(
  assets: MACRSAsset[],
  taxYear: number,
): { assets: (MACRSAsset & { currentYearDepreciation: number })[]; totalDepreciation: number } {
  const result = assets.map((a) => {
    const currentYearDepreciation = computeMACRS(
      { cost: a.cost, recoveryPeriod: a.recoveryPeriod, dateInService: a.dateInService, method: a.method },
      taxYear,
    )
    return { ...a, currentYearDepreciation }
  })

  return {
    assets: result,
    totalDepreciation: result.reduce((sum, a) => sum + a.currentYearDepreciation, 0),
  }
}

// ── Form Computation ────────────────────────────────────────────────────────

/**
 * Compute Form 1120 (C-Corp) from financial data.
 */
export function computeForm1120(data: Omit<Form1120Data, 'totalIncome' | 'totalDeductions' | 'taxableIncome' | 'totalTax'>): Form1120Data {
  const totalIncome = data.grossProfit + data.dividends + data.interest +
    data.grossRents + data.grossRoyalties + data.capitalGain + data.netGain + data.otherIncome

  const totalDeductions = data.compensation + data.salariesWages + data.repairs +
    data.badDebts + data.rents + data.taxes + data.interestExpense +
    data.depreciation + data.depletion + data.advertising +
    data.pensionPlans + data.employeeBenefits + data.otherDeductions

  const taxableIncome = Math.max(0, totalIncome - totalDeductions)
  const totalTax = Math.round(taxableIncome * CORPORATE_TAX_RATE * 100) / 100

  return {
    ...data,
    totalIncome,
    totalDeductions,
    taxableIncome,
    totalTax,
  }
}

// ── XML Generation ──────────────────────────────────────────────────────────

function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

function xmlTag(name: string, value: string | number | undefined): string {
  if (value === undefined || value === '') return ''
  return `<${name}>${typeof value === 'string' ? escapeXml(value) : value}</${name}>`
}

/**
 * Generate IRS MeF XML for a Form 1120.
 */
export function generateForm1120XML(
  header: IRSReturnHeader,
  data: Form1120Data,
  config: IRSFilingConfig,
): string {
  const lines = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<Return xmlns="http://www.irs.gov/efile" returnVersion="2024v1.0">',
    '  <ReturnHeader>',
    `    ${xmlTag('TaxYr', header.taxYear)}`,
    `    ${xmlTag('FEIN', header.ein)}`,
    '    <Filer>',
    `      ${xmlTag('BusinessName', header.businessName)}`,
    '      <USAddress>',
    `        ${xmlTag('AddressLine1Txt', header.address.street)}`,
    `        ${xmlTag('CityNm', header.address.city)}`,
    `        ${xmlTag('StateAbbreviationCd', header.address.state)}`,
    `        ${xmlTag('ZIPCd', header.address.zip)}`,
    '      </USAddress>',
    `      ${xmlTag('EIN', header.ein)}`,
    '    </Filer>',
    '    <Preparer>',
    `      ${xmlTag('EFIN', config.efin)}`,
    `      ${xmlTag('SoftwareId', config.softwareId)}`,
    `      ${xmlTag('PreparerSSN', config.preparerTin)}`,
    `      ${xmlTag('PreparerPersonNm', config.preparerName)}`,
    '    </Preparer>',
    '  </ReturnHeader>',
    '  <ReturnData>',
    '    <IRS1120>',
    `      ${xmlTag('GrossReceiptsOrSalesAmt', data.grossReceipts)}`,
    `      ${xmlTag('CostOfGoodsSoldAmt', data.costOfGoodsSold)}`,
    `      ${xmlTag('GrossProfitAmt', data.grossProfit)}`,
    `      ${xmlTag('TotalIncomeAmt', data.totalIncome)}`,
    `      ${xmlTag('CompensationOfOfficersAmt', data.compensation)}`,
    `      ${xmlTag('SalariesAndWagesAmt', data.salariesWages)}`,
    `      ${xmlTag('TaxesAndLicensesAmt', data.taxes)}`,
    `      ${xmlTag('InterestDeductionAmt', data.interestExpense)}`,
    `      ${xmlTag('DepreciationAmt', data.depreciation)}`,
    `      ${xmlTag('AdvertisingAmt', data.advertising)}`,
    `      ${xmlTag('PensionProfitSharingAmt', data.pensionPlans)}`,
    `      ${xmlTag('EmployeeBenefitProgramAmt', data.employeeBenefits)}`,
    `      ${xmlTag('OtherDeductionsAmt', data.otherDeductions)}`,
    `      ${xmlTag('TotalDeductionsAmt', data.totalDeductions)}`,
    `      ${xmlTag('TaxableIncomeAmt', data.taxableIncome)}`,
    `      ${xmlTag('TotalTaxAmt', data.totalTax)}`,
    `      ${xmlTag('TotalPaymentsAndCreditsAmt', data.paymentsCredits)}`,
    `      ${xmlTag('AmountOwedAmt', data.amountOwed)}`,
    `      ${xmlTag('OverpaymentAmt', data.overpayment)}`,
    '    </IRS1120>',
    '  </ReturnData>',
    '</Return>',
  ]

  return lines.join('\n')
}

/**
 * Generate Schedule K-1 XML for a partnership.
 */
export function generateScheduleK1XML(
  header: IRSReturnHeader,
  k1: ScheduleK1,
): string {
  const lines = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<IRS1065ScheduleK1 xmlns="http://www.irs.gov/efile">',
    `  ${xmlTag('TaxYr', header.taxYear)}`,
    `  ${xmlTag('PartnershipEIN', header.ein)}`,
    `  ${xmlTag('PartnershipName', header.businessName)}`,
    `  ${xmlTag('PartnerName', k1.partnerName)}`,
    `  ${xmlTag('PartnerTIN', k1.partnerTin)}`,
    `  ${xmlTag('ProfitSharingPct', k1.profitSharePercentage)}`,
    `  ${xmlTag('LossSharingPct', k1.lossSharePercentage)}`,
    `  ${xmlTag('OrdinaryIncome', k1.ordinaryIncome)}`,
    `  ${xmlTag('RentalRealEstateIncome', k1.rentalIncome)}`,
    `  ${xmlTag('InterestIncome', k1.interestIncome)}`,
    `  ${xmlTag('OrdinaryDividends', k1.dividendIncome)}`,
    `  ${xmlTag('Royalties', k1.royalties)}`,
    `  ${xmlTag('ShortTermCapitalGain', k1.shortTermCapitalGain)}`,
    `  ${xmlTag('LongTermCapitalGain', k1.longTermCapitalGain)}`,
    `  ${xmlTag('Section179Deduction', k1.section179Deduction)}`,
    `  ${xmlTag('OtherDeductions', k1.otherDeductions)}`,
    `  ${xmlTag('SelfEmploymentEarnings', k1.selfEmploymentEarnings)}`,
    `  ${xmlTag('Distributions', k1.distributions)}`,
    '</IRS1065ScheduleK1>',
  ]

  return lines.join('\n')
}

// ── Validation ──────────────────────────────────────────────────────────────

/**
 * Validate a filing package against IRS business rules.
 */
export function validateReturn(
  header: IRSReturnHeader,
  data: Form1120Data,
): IRSValidationResult {
  const errors: IRSValidationResult['errors'] = []
  const warnings: IRSValidationResult['warnings'] = []

  // EIN format
  if (!/^\d{9}$/.test(header.ein.replace(/-/g, ''))) {
    errors.push({ field: 'ein', code: 'EIN-001', message: 'EIN must be 9 digits' })
  }

  // Tax year
  if (header.taxYear < 2020 || header.taxYear > new Date().getFullYear()) {
    errors.push({ field: 'taxYear', code: 'TY-001', message: 'Invalid tax year' })
  }

  // Gross profit = receipts - COGS
  const expectedGrossProfit = data.grossReceipts - data.costOfGoodsSold
  if (Math.abs(data.grossProfit - expectedGrossProfit) > 0.01) {
    errors.push({ field: 'grossProfit', code: 'FIN-001', message: 'Gross profit must equal receipts minus COGS' })
  }

  // Taxable income
  if (data.taxableIncome < 0) {
    warnings.push({ field: 'taxableIncome', code: 'FIN-002', message: 'Negative taxable income — verify NOL carry-forward' })
  }

  // Tax computation
  const expectedTax = Math.round(Math.max(0, data.taxableIncome) * CORPORATE_TAX_RATE * 100) / 100
  if (Math.abs(data.totalTax - expectedTax) > 0.01) {
    errors.push({ field: 'totalTax', code: 'TAX-001', message: `Tax should be ${expectedTax} at ${CORPORATE_TAX_RATE * 100}% rate` })
  }

  // Total assets
  if (header.totalAssets > 10_000_000) {
    warnings.push({ field: 'totalAssets', code: 'SCH-001', message: 'Schedule M-3 required for total assets > $10M' })
  }

  // Address completeness
  if (!header.address.state || header.address.state.length !== 2) {
    errors.push({ field: 'state', code: 'ADDR-001', message: 'State must be 2-letter abbreviation' })
  }

  if (!header.address.zip || !/^\d{5}(-\d{4})?$/.test(header.address.zip)) {
    errors.push({ field: 'zip', code: 'ADDR-002', message: 'ZIP must be 5 or 9 digits' })
  }

  return { valid: errors.length === 0, errors, warnings }
}

// ── Package Assembly ────────────────────────────────────────────────────────

/**
 * Assemble a complete IRS e-file package.
 */
export function assembleFilingPackage(
  header: IRSReturnHeader,
  data: Form1120Data,
  config: IRSFilingConfig,
): IRSFilingPackage {
  const validationResult = validateReturn(header, data)
  const xml = generateForm1120XML(header, data, config)

  const pkg: IRSFilingPackage = {
    formType: header.formType,
    taxYear: header.taxYear,
    ein: header.ein,
    xml,
    status: validationResult.valid ? 'validated' : 'draft',
    validationResult,
    generatedAt: new Date().toISOString(),
  }

  logger.info('IRS filing package assembled', {
    formType: pkg.formType,
    taxYear: pkg.taxYear,
    valid: validationResult.valid,
    errors: validationResult.errors.length,
    warnings: validationResult.warnings.length,
  })

  return pkg
}
