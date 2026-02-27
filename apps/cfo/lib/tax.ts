/**
 * Tax governance — CFO app.
 *
 * Wires @nzila/tax for deadline tracking, year-end close governance,
 * installment management, tax evidence packs, and publicly-sourced CRA data.
 */
import {
  // Existing governance engine
  buildTaxYearDeadlines,
  buildInstallmentDeadline,
  buildIndirectTaxDeadlines,
  sortDeadlines,
  computeUrgency,
  daysUntil,
  evaluateTaxYearCloseGate,
  evaluateFinanceGovernanceRequirements,
  FINANCE_AUDIT_ACTIONS,
  buildYearEndManifest,
  evaluatePackCompleteness,
  YEAR_END_FINANCIAL_ARTIFACTS,
  YEAR_END_GOVERNANCE_ARTIFACTS,
  YEAR_END_TAX_ARTIFACTS,
  type CloseGateInput,
  type FinancePolicyContext,

  // ── Public CRA data (new) ──

  // Auto-calculated deadlines from fiscal year end
  calculateCorporateDeadlines,
  calculateQuarterlyGstDeadlines,
  calculateMonthlyGstDeadlines,
  type AutoDeadline,

  // Corporate tax rates (CRA T4012, Schedule 510)
  FEDERAL_GENERAL_RATE,
  FEDERAL_SMALL_BUSINESS_RATE,
  SBD_BUSINESS_LIMIT,
  PROVINCIAL_RATES,
  getCombinedCorporateRates,
  calculateSbdBusinessLimit,
  calculateAaiiBusinessLimit,
  estimateCorporateTax,
  type CorporateTaxEstimate,

  // Business Number validation (CRA RC2 guide)
  validateBusinessNumber,
  validateProgramAccount,
  formatBusinessNumber,
  BusinessNumberSchema,
  ProgramAccountSchema,
  validateNeq,
  type BnValidationResult,

  // Installment calculator (ITA s.157)
  INSTALLMENT_THRESHOLD,
  calculateInstallments,
  calculateInstallmentInterest,
  type InstallmentInput,
  type InstallmentResult,

  // Prescribed interest rates (CRA IC07-1)
  PRESCRIBED_RATES,
  getPrescribedRate,
  getCorporateArrearsRate,
  getTaxableBenefitRate,
  getLatestPrescribedRate,
  type PrescribedRateQuarter,

  // GST/HST/QST/PST rates (CRA GI-209)
  GST_RATE,
  PROVINCIAL_SALES_TAX,
  getSalesTax,
  getTotalSalesTaxRate,
  calculateSalesTax,
  getRequiredIndirectTaxTypes,
  GST_REGISTRATION_THRESHOLD,
  type ProvincialSalesTax,

  // Payroll remittance thresholds & CPP/EI (CRA T4001)
  REMITTER_THRESHOLDS,
  determineRemitterType,
  calculateAmwa,
  generateMonthlyRemittanceDueDates,
  CPP_2026,
  EI_2026,
  type RemitterType,

  // Late filing & payment penalties (ITA s.162, ETA s.280)
  calculateT2LateFilingPenalty,
  calculateGstLatePenalty,
  calculateInformationReturnPenalty,
  T2_LATE_BASE_RATE,
  T2_REPEAT_BASE_RATE,
  type LateFilingPenaltyResult,
  type GstLatePenaltyResult,

  // Personal income tax brackets (CRA T1, Schedule 428)
  FEDERAL_BRACKETS_2026,
  FEDERAL_BPA_2026,
  FEDERAL_BRACKETS_2025,
  FEDERAL_BPA_2025,
  PROVINCIAL_PERSONAL_BRACKETS,
  calculateBracketTax,
  getMarginalRate,
  estimatePersonalTax,
  getCombinedMarginalRate,
  type PersonalTaxEstimate,

  // Dividend tax integration (ITA s.82, s.121, s.129)
  ELIGIBLE_DIVIDEND,
  NON_ELIGIBLE_DIVIDEND,
  PROVINCIAL_DTC,
  RDTOH_REFUND_RATE,
  calculateDividendTax,
  compareSalaryVsDividend,
  type DividendTaxResult,

  // Capital gains (ITA s.38)
  CAPITAL_GAINS_INCLUSION_RATE,
  CAPITAL_GAINS_INDIVIDUAL_THRESHOLD,
  calculateTaxableCapitalGain,

  // Data versioning & staleness tracking
  DATA_VERSIONS,
  STALENESS_THRESHOLD_DAYS,
  isModuleStale,
  getStaleModules,
  getModuleVersion,
  getLatestVerificationDate,
} from '@nzila/tax'

// ── Re-export: governance engine ────────────────────────────────────────────

export {
  buildTaxYearDeadlines,
  buildInstallmentDeadline,
  buildIndirectTaxDeadlines,
  sortDeadlines,
  computeUrgency,
  daysUntil,
  evaluateTaxYearCloseGate,
  evaluateFinanceGovernanceRequirements,
  FINANCE_AUDIT_ACTIONS,
  buildYearEndManifest,
  evaluatePackCompleteness,
  YEAR_END_FINANCIAL_ARTIFACTS,
  YEAR_END_GOVERNANCE_ARTIFACTS,
  YEAR_END_TAX_ARTIFACTS,
}
export type { CloseGateInput, FinancePolicyContext }

// ── Re-export: public CRA data ──────────────────────────────────────────────

export {
  // Auto-deadlines
  calculateCorporateDeadlines,
  calculateQuarterlyGstDeadlines,
  calculateMonthlyGstDeadlines,
  // Corporate tax rates
  FEDERAL_GENERAL_RATE,
  FEDERAL_SMALL_BUSINESS_RATE,
  SBD_BUSINESS_LIMIT,
  PROVINCIAL_RATES,
  getCombinedCorporateRates,
  calculateSbdBusinessLimit,
  calculateAaiiBusinessLimit,
  estimateCorporateTax,
  // BN validation
  validateBusinessNumber,
  validateProgramAccount,
  formatBusinessNumber,
  BusinessNumberSchema,
  ProgramAccountSchema,
  validateNeq,
  // Installments
  INSTALLMENT_THRESHOLD,
  calculateInstallments,
  calculateInstallmentInterest,
  // Prescribed interest
  PRESCRIBED_RATES,
  getPrescribedRate,
  getCorporateArrearsRate,
  getTaxableBenefitRate,
  getLatestPrescribedRate,
  // GST/HST
  GST_RATE,
  PROVINCIAL_SALES_TAX,
  getSalesTax,
  getTotalSalesTaxRate,
  calculateSalesTax,
  getRequiredIndirectTaxTypes,
  GST_REGISTRATION_THRESHOLD,
  // Payroll
  REMITTER_THRESHOLDS,
  determineRemitterType,
  calculateAmwa,
  generateMonthlyRemittanceDueDates,
  CPP_2026,
  EI_2026,
  // Penalties
  calculateT2LateFilingPenalty,
  calculateGstLatePenalty,
  calculateInformationReturnPenalty,
  T2_LATE_BASE_RATE,
  T2_REPEAT_BASE_RATE,
  // Personal tax
  FEDERAL_BRACKETS_2026,
  FEDERAL_BPA_2026,
  FEDERAL_BRACKETS_2025,
  FEDERAL_BPA_2025,
  PROVINCIAL_PERSONAL_BRACKETS,
  calculateBracketTax,
  getMarginalRate,
  estimatePersonalTax,
  getCombinedMarginalRate,
  // Dividend tax
  ELIGIBLE_DIVIDEND,
  NON_ELIGIBLE_DIVIDEND,
  PROVINCIAL_DTC,
  RDTOH_REFUND_RATE,
  calculateDividendTax,
  compareSalaryVsDividend,
  // Capital gains
  CAPITAL_GAINS_INCLUSION_RATE,
  CAPITAL_GAINS_INDIVIDUAL_THRESHOLD,
  calculateTaxableCapitalGain,
  // Data versioning
  DATA_VERSIONS,
  STALENESS_THRESHOLD_DAYS,
  isModuleStale,
  getStaleModules,
  getModuleVersion,
  getLatestVerificationDate,
}
export type {
  AutoDeadline,
  CorporateTaxEstimate,
  BnValidationResult,
  InstallmentInput,
  InstallmentResult,
  PrescribedRateQuarter,
  ProvincialSalesTax,
  RemitterType,
  LateFilingPenaltyResult,
  GstLatePenaltyResult,
  PersonalTaxEstimate,
  DividendTaxResult,
}

// ── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Get all upcoming tax deadlines for the current fiscal year,
 * sorted by urgency (most urgent first).
 *
 * Now auto-calculates from fiscal year end using CRA statutory rules
 * instead of requiring manually entered dates.
 */
export function getUpcomingDeadlines(
  taxYear: number,
  options?: {
    fiscalYearEnd?: string   // MM-DD, defaults to "12-31"
    province?: string        // defaults to "ON"
    isCcpc?: boolean         // defaults to true
    gstFrequency?: 'monthly' | 'quarterly' | 'annual'
  },
) {
  const fiscalYearEnd = options?.fiscalYearEnd ?? '12-31'
  const province = (options?.province ?? 'ON') as import('@nzila/tax').Province

  // Auto-calculate all deadlines from FYE + province
  const autoDeadlines = calculateCorporateDeadlines(fiscalYearEnd, taxYear, province, {
    isCcpc: options?.isCcpc ?? true,
    gstFilingFrequency: options?.gstFrequency,
  })

  // Convert AutoDeadline[] to DeadlineInfo[] with urgency
  return autoDeadlines.map((d) => ({
    label: d.label,
    dueDate: d.dueDate,
    daysRemaining: daysUntil(d.dueDate),
    urgency: computeUrgency(d.dueDate),
    entityId: 'default',
    type: d.type as import('@nzila/tax').DeadlineInfo['type'],
    rule: d.rule,
  })).sort((a, b) => {
    // Sort by urgency (red first) then by days remaining
    const urgencyOrder = { red: 0, yellow: 1, green: 2 }
    const diff = urgencyOrder[a.urgency] - urgencyOrder[b.urgency]
    return diff !== 0 ? diff : a.daysRemaining - b.daysRemaining
  })
}
