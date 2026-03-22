/**
 * Services layer — business actions for CFO.
 *
 * Re-exports from lib/ during migration. New services should be
 * created as separate files in this directory.
 */

// Advisory automation — monitors client data and generates proactive alerts
export {
  evaluateClientMetrics,
  DEFAULT_ALERT_THRESHOLDS,
  scanAllClients,
  alertSummary,
  activeAlerts,
  type AdvisoryAlert,
  type AlertThreshold,
  type AlertSeverity,
  type AlertCategory,
  type ClientMetrics,
} from '../lib/advisory-automation'

// Policy enforcement — financial export, ledger adjustment, budget change guards
export {
  checkCfoPolicy,
  type CfoPolicyAction,
  type PolicyCheckResult,
} from '../lib/policy-enforcement'

// Financial integrations — thin façades over workspace packages
export { buildFinancialSummary } from '../lib/qbo'
// eslint-disable-next-line no-restricted-imports -- relative path, not the stripe SDK
export { runMonthEndReconciliation } from '../lib/stripe'

// Chart of Accounts + GIFI mapping (CRA Schedule 100/125)
export {
  getGifiMapping,
  getGifiBySchedule,
  findAccount,
  getAccountsByType,
  getChildAccounts,
  validateChartStructure,
  mapTrialBalanceToGifi,
  GIFI_CODES,
  DEFAULT_CCPC_CHART,
  type GifiMapping,
  type ChartAccount,
  AccountType,
  AccountSubtype,
} from '../lib/chart-of-accounts'

// T2 Corporate Tax Schedule Engine
export {
  calculateSchedule1,
  calculateSchedule7,
  calculateT2Return,
  quickT2Estimate,
  type Schedule1Input,
  type Schedule1Result,
  type Schedule7Input,
  type Schedule7Result,
  type T2ReturnInput,
  type T2ReturnResult,
} from '../lib/t2-schedules'

// CCA Depreciation Schedule (ITA Reg 1100 / T2 Schedule 8)
export {
  calculateCcaPool,
  calculateSchedule8,
  ccaTaxShield,
  getCcaClass,
  getCommonClasses,
  CCA_CLASSES,
  type CcaClass,
  type CcaAsset,
  type CcaPoolInput,
  type CcaPoolResult,
  type Schedule8Input,
  type Schedule8Result,
} from '../lib/cca-schedule'

// Time & Billing — WIP, invoicing, realization
export {
  calculateWip,
  generateInvoice,
  calculateRealization,
  calculateUtilization,
  calculateBudgetVariance,
  generateAgingReport,
  DEFAULT_BILLING_RATES,
  StaffLevel,
  ActivityCode,
  TimeEntryStatus,
  InvoiceStatus,
  type TimeEntry,
  type WipSummary,
  type Invoice,
  type InvoiceLine,
  type RealizationMetrics,
  type UtilizationMetrics,
  type BudgetVariance,
  type AgingBucket,
  type EngagementBudget,
} from '../lib/time-billing'

// Payroll Engine — Gross-to-Net (CRA T4127)
export {
  calculatePayroll,
  buildT4Summary,
  buildPayrollRegister,
  quickPayrollEstimate,
  PayFrequency,
  PAY_PERIODS_PER_YEAR,
  type PayrollEmployeeInput,
  type PayrollResult,
  type T4Summary,
  type PayrollRegisterEntry,
} from '../lib/payroll-engine'

// CRA T2 EFILE XML Generation
export {
  generateT2Xml,
  generateT4SummaryXml,
  buildFilingPackage,
  validateEfileInput,
  FilingStatus,
  CorporationType,
  type CorporationInfo,
  type FiscalPeriod,
  type PreparerInfo,
  type T2EfileInput,
  type T2EfileResult,
  type GifiEntry,
  type T4SummaryEfileInput,
  type T4SlipData,
  type FilingPackage,
  type FilingChecklistItem,
} from '../lib/t2-efile'
