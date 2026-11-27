/**
 * @nzila/tax — barrel export
 *
 * Governance engine + publicly-sourced CRA data:
 * - Federal & provincial corporate tax rates (CRA T4012, Schedule 510)
 * - Auto-calculated deadlines from fiscal year end (ITA s.150, s.157)
 * - Business Number validation with Luhn check (CRA RC2 guide)
 * - Installment calculator & thresholds (ITA s.157)
 * - CRA prescribed interest rates (IC07-1)
 * - GST/HST/QST/PST rate tables by province (GI-209)
 * - Payroll remittance thresholds & CPP/EI constants (T4001)
 */

// Types
export * from './types'

// Deadline calculator
export {
  computeUrgency,
  daysUntil,
  buildTaxYearDeadlines,
  buildInstallmentDeadline,
  buildIndirectTaxDeadlines,
  sortDeadlines,
} from './deadlines'

// Auto-calculated CRA deadlines from fiscal year end
export {
  calculateCorporateDeadlines,
  calculateQuarterlyGstDeadlines,
  calculateMonthlyGstDeadlines,
} from './cra-deadlines'
export type { AutoDeadline } from './cra-deadlines'

// Validation & close gating
export {
  evaluateTaxYearCloseGate,
  enforceSoD,
  validateDividendGovernanceLink,
  validateBorrowingGovernanceLink,
} from './validation'
export type { CloseGateInput } from './validation'

// Governance integration
export {
  evaluateFinanceGovernanceRequirements,
  FINANCE_AUDIT_ACTIONS,
} from './governance'
export type { FinancePolicyContext, FinanceAuditAction } from './governance'

// Year-end evidence pack
export {
  YEAR_END_FINANCIAL_ARTIFACTS,
  YEAR_END_GOVERNANCE_ARTIFACTS,
  YEAR_END_TAX_ARTIFACTS,
  yearEndPackBasePath,
  yearEndArtifactPath,
  buildYearEndManifest,
  evaluatePackCompleteness,
  serializeManifest,
} from './evidence'
export type {
  FinancialArtifactType,
  GovernanceArtifactType,
  TaxArtifactType,
  YearEndArtifactType,
  YearEndPackInput,
} from './evidence'

// ── Public CRA data ─────────────────────────────────────────────────────────

// Corporate tax rates (CRA T4012, Schedule 510)
export {
  FEDERAL_GENERAL_RATE,
  FEDERAL_SMALL_BUSINESS_RATE,
  FEDERAL_MP_RATE,
  SBD_BUSINESS_LIMIT,
  SBD_CAPITAL_GRIND_START,
  SBD_CAPITAL_GRIND_END,
  AAII_GRIND_START,
  AAII_GRIND_END,
  CAPITAL_GAINS_INCLUSION_RATE,
  CAPITAL_GAINS_HIGHER_INCLUSION_RATE,
  CAPITAL_GAINS_INDIVIDUAL_THRESHOLD,
  PROVINCIAL_RATES,
  getCombinedCorporateRates,
  calculateSbdBusinessLimit,
  calculateAaiiBusinessLimit,
  estimateCorporateTax,
  calculateTaxableCapitalGain,
} from './rates'
export type { ProvincialTaxRate, CorporateTaxEstimate } from './rates'

// Business Number validation (CRA RC2)
export {
  CRA_PROGRAM_IDS,
  validateBusinessNumber,
  validateProgramAccount,
  formatBusinessNumber,
  BusinessNumberSchema,
  ProgramAccountSchema,
  validateNeq,
} from './bn-validation'
export type { CraProgramId, BnValidationResult } from './bn-validation'

// Installment calculator (ITA s.157)
export {
  INSTALLMENT_THRESHOLD,
  calculateInstallments,
  calculateInstallmentInterest,
} from './installments'
export type { InstallmentInput, InstallmentResult } from './installments'

// Prescribed interest rates (CRA IC07-1)
export {
  PRESCRIBED_RATES,
  getPrescribedRate,
  getPrescribedRateByQuarter,
  getCorporateArrearsRate,
  getTaxableBenefitRate,
  getLatestPrescribedRate,
  getPrescribedRatesForYear,
} from './prescribed-interest'
export type { PrescribedRateQuarter } from './prescribed-interest'

// GST/HST/QST/PST rates by province (CRA GI-209)
export {
  GST_RATE,
  PROVINCIAL_SALES_TAX,
  getSalesTax,
  getTotalSalesTaxRate,
  calculateSalesTax,
  getRequiredIndirectTaxTypes,
  requiresProvincialSalesTaxReturn,
  GST_REGISTRATION_THRESHOLD,
  GST_QUICK_METHOD_THRESHOLD,
} from './gst-hst'
export type { SalesTaxRegime, ProvincialSalesTax } from './gst-hst'

// Payroll remittance thresholds & CPP/EI (CRA T4001)
export {
  REMITTER_THRESHOLDS,
  determineRemitterType,
  calculateAmwa,
  generateMonthlyRemittanceDueDates,
  generateQuarterlyRemittanceDueDates,
  CPP_2026,
  EI_2026,
} from './payroll-thresholds'
export type { RemitterType, RemitterThreshold, PayrollRemittanceDueDate } from './payroll-thresholds'

// Late filing & payment penalties (ITA s.162, ETA s.280)
export {
  T2_LATE_BASE_RATE,
  T2_LATE_MONTHLY_RATE,
  T2_LATE_MAX_MONTHS,
  T2_REPEAT_BASE_RATE,
  T2_REPEAT_MONTHLY_RATE,
  T2_REPEAT_MAX_MONTHS,
  GST_LATE_BASE_RATE,
  GST_LATE_MONTHLY_RATE,
  GST_LATE_MAX_MONTHS,
  INFO_RETURN_PER_SLIP,
  INFO_RETURN_MINIMUM,
  INFO_RETURN_MAXIMUM,
  calculateT2LateFilingPenalty,
  calculateGstLatePenalty,
  calculateInformationReturnPenalty,
} from './penalties'
export type {
  LateFilingPenaltyInput,
  LateFilingPenaltyResult,
  GstLatePenaltyInput,
  GstLatePenaltyResult,
  InformationReturnPenaltyInput,
  InformationReturnPenaltyResult,
} from './penalties'

// Personal income tax brackets (CRA T1 General, Schedule 428)
export {
  FEDERAL_BRACKETS_2026,
  FEDERAL_BPA_2026,
  FEDERAL_BRACKETS_2025,
  FEDERAL_BPA_2025,
  PROVINCIAL_PERSONAL_BRACKETS,
  calculateBracketTax,
  getMarginalRate,
  getFederalPersonalSchedule,
  getProvincialPersonalSchedule,
  estimatePersonalTax,
  getCombinedMarginalRate,
} from './personal-rates'
export type {
  TaxBracket,
  PersonalTaxSchedule,
  PersonalTaxEstimate,
} from './personal-rates'

// Dividend tax integration (ITA s.82, s.121, s.129)
export {
  ELIGIBLE_DIVIDEND,
  NON_ELIGIBLE_DIVIDEND,
  PROVINCIAL_DTC,
  RDTOH_REFUND_RATE,
  PART_IV_TAX_RATE,
  calculateDividendTax,
  compareSalaryVsDividend,
} from './dividend-tax'
export type {
  ProvincialDividendCredit,
  DividendTaxResult,
} from './dividend-tax'

// Advanced salary vs dividend (CPP2, EI, RRSP, multi-year, provincial ranking)
export {
  calculatePayrollDeductions,
  calculateRrspRoom,
  calculateTfsaImpact,
  compareSalaryVsDividendAdvanced,
  projectMultiYear,
  rankProvincesByAfterTax,
  RRSP_MAX_2026,
  RRSP_RATE,
  TFSA_ANNUAL_LIMITS,
  TFSA_CUMULATIVE_2026,
  TFSA_LIMIT_2026,
} from './salary-vs-dividend-advanced'
export type {
  PayrollDeductions,
  RrspImpact,
  TfsaImpact,
  EnhancedSalaryVsDividendResult,
  MultiYearProjection,
  ProvincialRanking,
} from './salary-vs-dividend-advanced'

// Bulk BN validation & audit trail
export {
  validateBusinessNumbers,
  validateProgramAccounts,
  validateNeqs,
  buildValidationAuditEntry,
  generatePossibleProgramAccounts,
} from './bn-validation-bulk'
export type {
  BulkValidationItem,
  BulkValidationResult,
  BnValidationAuditEntry,
  ProgramAccountSuggestion,
} from './bn-validation-bulk'

// Data versioning & staleness tracking
export {
  DATA_VERSIONS,
  STALENESS_THRESHOLD_DAYS,
  parseVerificationDate,
  verificationAgeDays,
  isModuleStale,
  selectStaleModules,
  getStaleModules,
  getModuleVersion,
  getLatestVerificationDate,
} from './data-versions'
export type { DataModuleVersion } from './data-versions'
export { auditTaxReferenceData } from './freshness-audit'
export type {
  TaxFreshnessClassification,
  TaxFreshnessModuleFinding,
  TaxReferenceCurrentness,
  TaxReferenceFreshnessAudit,
  TaxReleaseDisposition,
  TaxReleaseEligibility,
} from './freshness-audit'
