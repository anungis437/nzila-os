/**
 * CRA T2 Corporation Income Tax Return — EFILE XML Generator
 *
 * Generates XML documents conforming to CRA's T2 EFILE specification
 * for electronic filing of corporate income tax returns.
 *
 * CRA T2 EFILE spec overview:
 * - Root element: <T2Return>
 * - Header: <ReturnHeader> with BN, tax year, filing info
 * - Schedules: <Schedule1>, <Schedule7>, <Schedule8>, <Schedule100>, <Schedule125>, etc.
 * - Each line maps to a CRA-defined line number (e.g., line 300 = taxable income)
 * - GIFI amounts in Schedule 100/125
 * - All monetary amounts in whole cents (integer) or dollars with 2 decimal places
 *
 * References:
 * - CRA T2 Corporation — Income Tax Guide (T4012)
 * - CRA EFILE for T2 — Technical Specifications (published annually)
 * - CRA GIFI — RC4088
 *
 * @module cfo/t2-efile
 */
import type { Province } from '@nzila/tax'
import type { T2ReturnResult, Schedule1Result, Schedule7Result } from './t2-schedules'
import type { Schedule8Result, CcaPoolResult } from './cca-schedule'

// ── Types ───────────────────────────────────────────────────────────────────

/** CRA filing status values */
export const FilingStatus = {
  ORIGINAL: '1',
  AMENDED: '2',
  ADDITIONAL_INFO: '3',
} as const
export type FilingStatus = (typeof FilingStatus)[keyof typeof FilingStatus]

/** Corporation type for T2 */
export const CorporationType = {
  CCPC: '1',
  OTHER_PRIVATE: '2',
  PUBLIC: '3',
  CORPORATION_CONTROLLED_BY_PUBLIC: '4',
  OTHER: '5',
} as const
export type CorporationType = (typeof CorporationType)[keyof typeof CorporationType]

/** Provinces mapped to CRA's 2-digit province codes */
const PROVINCE_CODES: Record<Province, string> = {
  ON: '35',
  QC: '24',
  BC: '59',
  AB: '48',
  SK: '47',
  MB: '46',
  NB: '13',
  NS: '12',
  PE: '11',
  NL: '10',
  YT: '60',
  NT: '61',
  NU: '62',
}

/** GIFI balance for Schedule 100/125 */
export interface GifiEntry {
  gifiCode: number
  description: string
  amount: number
  schedule: number
}

/** Full corporation identification for EFILE header */
export interface CorporationInfo {
  /** Business Number (BN15 format: 123456789RC0001) */
  businessNumber: string
  /** Legal name of the corporation */
  legalName: string
  /** Operating / trade name (if different) */
  tradeName?: string
  /** Mailing address */
  address: {
    line1: string
    line2?: string
    city: string
    province: Province
    postalCode: string
    country?: string
  }
  /** NAICS industry code (6-digit) */
  naicsCode: string
  /** Date of incorporation (YYYY-MM-DD) */
  incorporationDate: string
  /** Province/territory of incorporation */
  incorporationProvince: Province | 'FED'
  /** Corporation type */
  corporationType: CorporationType
  /** Is a CCPC? */
  isCcpc: boolean
}

/** Fiscal period for the T2 return */
export interface FiscalPeriod {
  /** Start date (YYYY-MM-DD) */
  start: string
  /** End date (YYYY-MM-DD) */
  end: string
  /** Is this a short fiscal year? (< 365 days) */
  isShortYear: boolean
}

/** Preparer / transmitter information */
export interface PreparerInfo {
  /** EFILE number assigned by CRA */
  efileNumber: string
  /** Preparer's name */
  name: string
  /** Firm name */
  firmName?: string
  /** Preparer's phone */
  phone: string
}

/** Top-level input to generate a complete T2 EFILE XML */
export interface T2EfileInput {
  /** Corporation identification */
  corporation: CorporationInfo
  /** Fiscal period */
  fiscalPeriod: FiscalPeriod
  /** Tax year (calendar year the fiscal period ends in) */
  taxYear: number
  /** Province of filing */
  province: Province
  /** Filing status */
  filingStatus: FilingStatus
  /** Computed T2 return result */
  t2Result: T2ReturnResult
  /** Schedule 8 CCA result */
  schedule8?: Schedule8Result
  /** GIFI-coded financial statements (from mapTrialBalanceToGifi) */
  gifiBalances: GifiEntry[]
  /** Preparer information */
  preparer: PreparerInfo
  /** Signature date (YYYY-MM-DD) */
  signatureDate: string
  /** Signing officer's name */
  signingOfficer: string
  /** Signing officer's title */
  signingOfficerTitle: string
}

/** Result of XML generation */
export interface T2EfileResult {
  /** Complete XML document as string */
  xml: string
  /** Summary of what's included */
  schedulesIncluded: string[]
  /** Line count summary */
  lineCount: number
  /** Filing reference ID (generated) */
  referenceId: string
  /** Validation issues (warnings, not blocking) */
  warnings: string[]
}

// ── XML Helpers ─────────────────────────────────────────────────────────────

/** Escape special characters for XML content */
function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

/** Format a monetary amount to 2 decimal places for CRA */
function formatAmount(amount: number): string {
  return amount.toFixed(2)
}

/** Generate a T2 line element */
function line(num: number, amount: number, description?: string): string {
  if (amount === 0) return ''
  const desc = description ? ` description="${escapeXml(description)}"` : ''
  return `      <Line number="${num}"${desc}>${formatAmount(amount)}</Line>`
}

/** Generate a GIFI code element */
function gifiLine(code: number, amount: number): string {
  if (amount === 0) return ''
  return `      <GifiCode code="${code}">${formatAmount(amount)}</GifiCode>`
}

/** Generate a simple element */
function elem(tag: string, value: string | number | boolean): string {
  const v = typeof value === 'boolean' ? (value ? 'Y' : 'N') : String(value)
  return `    <${tag}>${escapeXml(v)}</${tag}>`
}

// ── Validators ──────────────────────────────────────────────────────────────

/** Validate a BN15 format (basic structure check) */
function validateBN15(bn: string): boolean {
  return /^\d{9}[A-Z]{2}\d{4}$/.test(bn)
}

/** Validate YYYY-MM-DD date format */
function validateDate(date: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(date)
}

/** Pre-flight validation of EFILE input */
export function validateEfileInput(input: T2EfileInput): string[] {
  const warnings: string[] = []

  if (!validateBN15(input.corporation.businessNumber)) {
    warnings.push(`Business Number "${input.corporation.businessNumber}" may not be valid BN15 format (expected: 123456789RC0001)`)
  }
  if (!validateDate(input.fiscalPeriod.start)) {
    warnings.push(`Fiscal period start "${input.fiscalPeriod.start}" is not YYYY-MM-DD`)
  }
  if (!validateDate(input.fiscalPeriod.end)) {
    warnings.push(`Fiscal period end "${input.fiscalPeriod.end}" is not YYYY-MM-DD`)
  }
  if (!validateDate(input.signatureDate)) {
    warnings.push(`Signature date "${input.signatureDate}" is not YYYY-MM-DD`)
  }
  if (!input.corporation.naicsCode || !/^\d{6}$/.test(input.corporation.naicsCode)) {
    warnings.push(`NAICS code "${input.corporation.naicsCode}" should be 6 digits`)
  }
  if (!input.preparer.efileNumber || input.preparer.efileNumber.length < 5) {
    warnings.push('EFILE number may be missing or too short')
  }
  if (input.gifiBalances.length === 0) {
    warnings.push('No GIFI balances provided — Schedule 100/125 will be empty')
  }
  if (input.t2Result.taxableIncome < 0) {
    warnings.push('Taxable income is negative — this should not happen after computation')
  }

  return warnings
}

// ── Schedule XML Generators ─────────────────────────────────────────────────

/** Generate Schedule 1 XML — Net Income for Tax Purposes */
function generateSchedule1Xml(s1: Schedule1Result): string {
  const lines: string[] = [
    '    <Schedule number="1" name="Net Income (Loss) for Income Tax Purposes">',
  ]

  // Line 3680: Net income per financial statements
  lines.push(line(3680, s1.netIncomePerStatements, 'Net income per financial statements'))

  // Add-back lines
  for (const item of s1.breakdown) {
    if (item.amount > 0 && item.description !== 'Net income per financial statements') {
      lines.push(`      <Adjustment type="add-back" description="${escapeXml(item.description)}">${formatAmount(item.amount)}</Adjustment>`)
    } else if (item.amount < 0) {
      lines.push(`      <Adjustment type="deduction" description="${escapeXml(item.description)}">${formatAmount(Math.abs(item.amount))}</Adjustment>`)
    }
  }

  lines.push(line(3849, s1.totalAddBacks, 'Total add-backs'))
  lines.push(line(3850, Math.abs(s1.totalDeductions), 'Total deductions'))
  lines.push(line(3900, s1.netIncomeForTax, 'Net income for income tax purposes'))

  lines.push('    </Schedule>')
  return lines.filter(Boolean).join('\n')
}

/** Generate Schedule 7 XML — AAII and Small Business Deduction */
function generateSchedule7Xml(s7: Schedule7Result): string {
  const lines: string[] = [
    '    <Schedule number="7" name="Aggregate Investment Income and Income Eligible for SBD">',
  ]

  lines.push(line(400, s7.aaii, 'Adjusted aggregate investment income'))
  lines.push(line(405, s7.sbdLimitBeforeClawback, 'SBD business limit before clawback'))
  lines.push(line(410, s7.aaiiClawback, 'AAII clawback (5x excess over $50K)'))
  lines.push(line(415, s7.tcecClawback, 'TCEC clawback'))
  lines.push(line(420, s7.effectiveSbdLimit, 'Effective SBD limit'))
  lines.push(line(425, s7.sbdEligibleIncome, 'Income eligible for SBD'))
  lines.push(line(430, s7.sbdAmount, 'Small business deduction'))
  lines.push(line(432, s7.generalRateTax, 'Tax on income at general rate'))
  lines.push(line(434, s7.sbdRateTax, 'Tax on income at SBD rate'))
  lines.push(line(440, s7.additionalRefundableTax, 'Additional refundable tax on investment income'))

  lines.push('    </Schedule>')
  return lines.filter(Boolean).join('\n')
}

/** Generate Schedule 8 XML — Capital Cost Allowance */
function generateSchedule8Xml(s8: Schedule8Result): string {
  const lines: string[] = [
    '    <Schedule number="8" name="Capital Cost Allowance (CCA)">',
  ]

  for (const pool of s8.pools) {
    lines.push(generateCcaClassXml(pool))
  }

  lines.push(line(8999, s8.totalCca, 'Total CCA claimed'))
  if (s8.totalRecapture > 0) {
    lines.push(line(8998, s8.totalRecapture, 'Total recapture'))
  }
  if (s8.totalTerminalLoss > 0) {
    lines.push(line(8997, s8.totalTerminalLoss, 'Total terminal loss'))
  }
  lines.push(line(8996, s8.netCcaDeduction, 'Net CCA deduction'))

  lines.push('    </Schedule>')
  return lines.filter(Boolean).join('\n')
}

/** Generate a single CCA class element for Schedule 8 */
function generateCcaClassXml(pool: CcaPoolResult): string {
  const lines: string[] = [
    `      <CcaClass number="${pool.classNumber}" rate="${(pool.rate * 100).toFixed(1)}">`,
    `        <UccOpening>${formatAmount(pool.uccOpening)}</UccOpening>`,
    `        <AdditionsCost>${formatAmount(pool.additionsCost)}</AdditionsCost>`,
    `        <Dispositions>${formatAmount(pool.dispositionsLesser)}</Dispositions>`,
    `        <NetAdditions>${formatAmount(pool.netAdditions)}</NetAdditions>`,
    `        <UccBeforeCca>${formatAmount(pool.uccBeforeCca)}</UccBeforeCca>`,
    `        <CcaClaimed>${formatAmount(pool.totalCca)}</CcaClaimed>`,
    `        <UccClosing>${formatAmount(pool.uccClosing)}</UccClosing>`,
  ]
  if (pool.recapture > 0) {
    lines.push(`        <Recapture>${formatAmount(pool.recapture)}</Recapture>`)
  }
  if (pool.terminalLoss > 0) {
    lines.push(`        <TerminalLoss>${formatAmount(pool.terminalLoss)}</TerminalLoss>`)
  }
  lines.push('      </CcaClass>')
  return lines.join('\n')
}

/** Generate Schedule 100 XML — Balance Sheet (GIFI) */
function generateSchedule100Xml(gifiBalances: GifiEntry[]): string {
  const s100 = gifiBalances.filter((g) => g.schedule === 100)
  if (s100.length === 0) return ''

  const lines: string[] = [
    '    <Schedule number="100" name="Balance Sheet Information">',
  ]

  for (const entry of s100) {
    lines.push(gifiLine(entry.gifiCode, entry.amount))
  }

  lines.push('    </Schedule>')
  return lines.filter(Boolean).join('\n')
}

/** Generate Schedule 125 XML — Income Statement (GIFI) */
function generateSchedule125Xml(gifiBalances: GifiEntry[]): string {
  const s125 = gifiBalances.filter((g) => g.schedule === 125)
  if (s125.length === 0) return ''

  const lines: string[] = [
    '    <Schedule number="125" name="Income Statement Information">',
  ]

  for (const entry of s125) {
    lines.push(gifiLine(entry.gifiCode, entry.amount))
  }

  lines.push('    </Schedule>')
  return lines.filter(Boolean).join('\n')
}

// ── T2 Master Return Lines ──────────────────────────────────────────────────

/** Generate the T2 master return body (pages 1-8) */
function generateT2BodyXml(
  input: T2EfileInput,
  result: T2ReturnResult,
): string {
  const lines: string[] = ['    <T2Body>']

  // Page 2: Taxable income
  lines.push(line(300, result.taxableIncome, 'Taxable income'))

  // Page 6: Federal tax
  lines.push(line(360, result.federalTaxBeforeCredits, 'Basic federal tax (Part I)'))
  lines.push(line(430, result.sbd, 'Small business deduction'))
  lines.push(line(440, result.federalTaxAfterSbd, 'Federal tax after SBD'))

  // Page 7: Provincial tax
  lines.push(line(600, result.provincialTax, 'Provincial tax'))

  // Additional refundable tax
  if (result.schedule7.additionalRefundableTax > 0) {
    lines.push(line(700, result.schedule7.additionalRefundableTax, 'Additional refundable tax on investment income'))
  }

  // Total tax
  lines.push(line(770, result.totalTax, 'Total Part I tax'))

  // RDTOH
  if (result.rdtoh > 0) {
    lines.push(line(784, result.rdtoh, 'Refundable dividend tax on hand'))
  }

  // Page 8: Payments
  lines.push(line(800, input.t2Result.lines.find((l) => l.line === 800)?.amount ?? 0, 'Instalments paid'))
  lines.push(line(890, result.balanceDue, 'Balance due / (refund)'))

  // Monthly installment
  lines.push(line(896, result.monthlyInstallment, 'Monthly installment for next year'))

  lines.push('    </T2Body>')
  return lines.filter(Boolean).join('\n')
}

// ── Header ──────────────────────────────────────────────────────────────────

/** Generate the return header XML */
function generateHeaderXml(input: T2EfileInput): string {
  const corp = input.corporation
  const addr = corp.address
  const provCode = PROVINCE_CODES[input.province]

  return [
    '  <ReturnHeader>',
    elem('BusinessNumber', corp.businessNumber),
    elem('LegalName', corp.legalName),
    corp.tradeName ? elem('TradeName', corp.tradeName) : '',
    elem('AddressLine1', addr.line1),
    addr.line2 ? elem('AddressLine2', addr.line2) : '',
    elem('City', addr.city),
    elem('ProvinceCode', provCode),
    elem('ProvinceName', input.province),
    elem('PostalCode', addr.postalCode.replace(/\s/g, '').toUpperCase()),
    elem('Country', addr.country ?? 'CAN'),
    elem('NaicsCode', corp.naicsCode),
    elem('IncorporationDate', corp.incorporationDate),
    elem('IncorporationJurisdiction', corp.incorporationProvince),
    elem('CorporationType', corp.corporationType),
    elem('IsCcpc', corp.isCcpc),
    elem('FiscalPeriodStart', input.fiscalPeriod.start),
    elem('FiscalPeriodEnd', input.fiscalPeriod.end),
    elem('TaxYear', input.taxYear),
    elem('FilingStatus', input.filingStatus),
    elem('IsShortYear', input.fiscalPeriod.isShortYear),
    '  </ReturnHeader>',
  ].filter(Boolean).join('\n')
}

/** Generate the certification / signature section */
function generateCertificationXml(input: T2EfileInput): string {
  return [
    '  <Certification>',
    elem('SigningOfficerName', input.signingOfficer),
    elem('SigningOfficerTitle', input.signingOfficerTitle),
    elem('SignatureDate', input.signatureDate),
    elem('PreparerEfileNumber', input.preparer.efileNumber),
    elem('PreparerName', input.preparer.name),
    input.preparer.firmName ? elem('FirmName', input.preparer.firmName) : '',
    elem('PreparerPhone', input.preparer.phone),
    '  </Certification>',
  ].filter(Boolean).join('\n')
}

// ── Main Generator ──────────────────────────────────────────────────────────

/**
 * Generate a complete T2 EFILE XML document.
 *
 * Takes the full suite of computed results (T2 return, Schedule 8 CCA,
 * GIFI financial statements) and produces a CRA-conformant XML document
 * suitable for electronic filing.
 *
 * @example
 * ```ts
 * const xml = generateT2Xml({
 *   corporation: { businessNumber: '123456789RC0001', ... },
 *   fiscalPeriod: { start: '2025-01-01', end: '2025-12-31', isShortYear: false },
 *   taxYear: 2025,
 *   province: 'ON',
 *   filingStatus: FilingStatus.ORIGINAL,
 *   t2Result: calculateT2Return(input),
 *   schedule8: calculateSchedule8(pools),
 *   gifiBalances: mapTrialBalanceToGifi(chart, trialBalance),
 *   preparer: { efileNumber: 'EF12345', name: 'J. Smith', phone: '416-555-0199' },
 *   signatureDate: '2026-06-15',
 *   signingOfficer: 'A. Director',
 *   signingOfficerTitle: 'Director',
 * })
 * ```
 */
export function generateT2Xml(input: T2EfileInput): T2EfileResult {
  const warnings = validateEfileInput(input)
  const schedulesIncluded: string[] = []
  const referenceId = `T2-${input.taxYear}-${input.corporation.businessNumber}-${Date.now().toString(36)}`

  // Build schedule sections
  const scheduleParts: string[] = []

  // Schedule 1 — Net Income
  const s1Xml = generateSchedule1Xml(input.t2Result.schedule1)
  scheduleParts.push(s1Xml)
  schedulesIncluded.push('Schedule 1 — Net Income for Tax Purposes')

  // Schedule 7 — AAII / SBD
  const s7Xml = generateSchedule7Xml(input.t2Result.schedule7)
  scheduleParts.push(s7Xml)
  schedulesIncluded.push('Schedule 7 — AAII and SBD')

  // Schedule 8 — CCA (if provided)
  if (input.schedule8 && input.schedule8.pools.length > 0) {
    const s8Xml = generateSchedule8Xml(input.schedule8)
    scheduleParts.push(s8Xml)
    schedulesIncluded.push('Schedule 8 — CCA')
  }

  // Schedule 100 — Balance Sheet (GIFI)
  const s100 = input.gifiBalances.filter((g) => g.schedule === 100)
  if (s100.length > 0) {
    scheduleParts.push(generateSchedule100Xml(input.gifiBalances))
    schedulesIncluded.push('Schedule 100 — Balance Sheet (GIFI)')
  }

  // Schedule 125 — Income Statement (GIFI)
  const s125 = input.gifiBalances.filter((g) => g.schedule === 125)
  if (s125.length > 0) {
    scheduleParts.push(generateSchedule125Xml(input.gifiBalances))
    schedulesIncluded.push('Schedule 125 — Income Statement (GIFI)')
  }

  // T2 Body (master return lines)
  const bodyXml = generateT2BodyXml(input, input.t2Result)

  // Count lines
  const lineCount = input.t2Result.lines.length +
    (input.schedule8?.pools.length ?? 0) +
    input.gifiBalances.length

  // Assemble full XML
  const xml = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    `<T2Return xmlns="http://www.cra-arc.gc.ca/T2" version="2026.1" referenceId="${escapeXml(referenceId)}">`,
    generateHeaderXml(input),
    '  <Schedules>',
    ...scheduleParts,
    '  </Schedules>',
    bodyXml,
    generateCertificationXml(input),
    '</T2Return>',
  ].join('\n')

  return {
    xml,
    schedulesIncluded,
    lineCount,
    referenceId,
    warnings,
  }
}

// ── T4 Summary XML ──────────────────────────────────────────────────────────

/** T4 Summary input for EFILE */
export interface T4SummaryEfileInput {
  /** Employer BN15 */
  businessNumber: string
  /** Employer legal name */
  employerName: string
  /** Tax year */
  taxYear: number
  /** Province */
  province: Province
  /** Individual T4 slips */
  slips: T4SlipData[]
  /** Preparer info */
  preparer: PreparerInfo
}

/** Individual T4 slip data (from buildT4Summary) */
export interface T4SlipData {
  employeeId: string
  employeeName: string
  employeeSin: string
  box14EmploymentIncome: number
  box16Cpp: number
  box17Cpp2: number
  box18Ei: number
  box20Rpp: number
  box22IncomeTax: number
  box24InsurableEarnings: number
  box26PensionableEarnings: number
  box40TaxableBenefits: number
  box44UnionDues: number
  box52PensionAdjustment: number
  province: Province
}

/**
 * Generate T4 Summary EFILE XML for employer annual filing.
 */
export function generateT4SummaryXml(input: T4SummaryEfileInput): {
  xml: string
  slipCount: number
  totals: {
    totalEmploymentIncome: number
    totalCpp: number
    totalEi: number
    totalIncomeTax: number
  }
} {
  const totals = {
    totalEmploymentIncome: 0,
    totalCpp: 0,
    totalEi: 0,
    totalIncomeTax: 0,
  }

  const slipXmls: string[] = []
  for (const slip of input.slips) {
    totals.totalEmploymentIncome += slip.box14EmploymentIncome
    totals.totalCpp += slip.box16Cpp + slip.box17Cpp2
    totals.totalEi += slip.box18Ei
    totals.totalIncomeTax += slip.box22IncomeTax

    slipXmls.push([
      '    <T4Slip>',
      `      <EmployeeSin>${escapeXml(slip.employeeSin)}</EmployeeSin>`,
      `      <EmployeeName>${escapeXml(slip.employeeName)}</EmployeeName>`,
      `      <ProvinceOfEmployment>${PROVINCE_CODES[slip.province]}</ProvinceOfEmployment>`,
      `      <Box14>${formatAmount(slip.box14EmploymentIncome)}</Box14>`,
      `      <Box16>${formatAmount(slip.box16Cpp)}</Box16>`,
      `      <Box17>${formatAmount(slip.box17Cpp2)}</Box17>`,
      `      <Box18>${formatAmount(slip.box18Ei)}</Box18>`,
      `      <Box20>${formatAmount(slip.box20Rpp)}</Box20>`,
      `      <Box22>${formatAmount(slip.box22IncomeTax)}</Box22>`,
      `      <Box24>${formatAmount(slip.box24InsurableEarnings)}</Box24>`,
      `      <Box26>${formatAmount(slip.box26PensionableEarnings)}</Box26>`,
      `      <Box40>${formatAmount(slip.box40TaxableBenefits)}</Box40>`,
      `      <Box44>${formatAmount(slip.box44UnionDues)}</Box44>`,
      `      <Box52>${formatAmount(slip.box52PensionAdjustment)}</Box52>`,
      '    </T4Slip>',
    ].join('\n'))
  }

  const xml = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    `<T4Return xmlns="http://www.cra-arc.gc.ca/T4" version="2026.1">`,
    '  <T4Summary>',
    `    <BusinessNumber>${escapeXml(input.businessNumber)}</BusinessNumber>`,
    `    <EmployerName>${escapeXml(input.employerName)}</EmployerName>`,
    `    <TaxYear>${input.taxYear}</TaxYear>`,
    `    <TotalSlips>${input.slips.length}</TotalSlips>`,
    `    <TotalEmploymentIncome>${formatAmount(totals.totalEmploymentIncome)}</TotalEmploymentIncome>`,
    `    <TotalCppContributions>${formatAmount(totals.totalCpp)}</TotalCppContributions>`,
    `    <TotalEiPremiums>${formatAmount(totals.totalEi)}</TotalEiPremiums>`,
    `    <TotalIncomeTaxDeducted>${formatAmount(totals.totalIncomeTax)}</TotalIncomeTaxDeducted>`,
    '  </T4Summary>',
    '  <T4Slips>',
    ...slipXmls,
    '  </T4Slips>',
    '</T4Return>',
  ].join('\n')

  return { xml, slipCount: input.slips.length, totals }
}

// ── Filing Package Builder ──────────────────────────────────────────────────

/** Complete filing package for a corporation's annual return */
export interface FilingPackage {
  /** T2 Corporate return XML */
  t2Xml: T2EfileResult
  /** T4 Summary XML (if employer) */
  t4Xml?: ReturnType<typeof generateT4SummaryXml>
  /** Total schedules across all returns */
  totalSchedules: number
  /** Filing checklist */
  checklist: FilingChecklistItem[]
}

export interface FilingChecklistItem {
  item: string
  required: boolean
  completed: boolean
  notes?: string
}

/**
 * Build a complete annual filing package for a corporation.
 *
 * Assembles T2 + optional T4 returns and produces a filing checklist
 * to ensure all required forms are present.
 */
export function buildFilingPackage(
  t2Input: T2EfileInput,
  t4Input?: T4SummaryEfileInput,
): FilingPackage {
  const t2Xml = generateT2Xml(t2Input)

  let t4Xml: ReturnType<typeof generateT4SummaryXml> | undefined
  if (t4Input && t4Input.slips.length > 0) {
    t4Xml = generateT4SummaryXml(t4Input)
  }

  const checklist: FilingChecklistItem[] = [
    {
      item: 'T2 Corporation Income Tax Return',
      required: true,
      completed: true,
      notes: `${t2Xml.schedulesIncluded.length} schedules`,
    },
    {
      item: 'Schedule 1 — Net Income for Tax Purposes',
      required: true,
      completed: t2Xml.schedulesIncluded.includes('Schedule 1 — Net Income for Tax Purposes'),
    },
    {
      item: 'Schedule 7 — AAII and SBD',
      required: t2Input.corporation.isCcpc,
      completed: t2Xml.schedulesIncluded.includes('Schedule 7 — AAII and SBD'),
    },
    {
      item: 'Schedule 8 — Capital Cost Allowance',
      required: !!t2Input.schedule8,
      completed: t2Xml.schedulesIncluded.includes('Schedule 8 — CCA'),
    },
    {
      item: 'Schedule 100 — Balance Sheet (GIFI)',
      required: true,
      completed: t2Xml.schedulesIncluded.includes('Schedule 100 — Balance Sheet (GIFI)'),
    },
    {
      item: 'Schedule 125 — Income Statement (GIFI)',
      required: true,
      completed: t2Xml.schedulesIncluded.includes('Schedule 125 — Income Statement (GIFI)'),
    },
    {
      item: 'T4 Summary and Slips',
      required: !!t4Input,
      completed: !!t4Xml,
      notes: t4Xml ? `${t4Xml.slipCount} slips` : undefined,
    },
    {
      item: 'Signed certification',
      required: true,
      completed: !!t2Input.signingOfficer && !!t2Input.signatureDate,
    },
    {
      item: 'Preparer EFILE number',
      required: true,
      completed: !!t2Input.preparer.efileNumber,
    },
  ]

  return {
    t2Xml,
    t4Xml,
    totalSchedules: t2Xml.schedulesIncluded.length,
    checklist,
  }
}
