/**
 * @nzila/cfo-core — barrel export
 *
 * ╔══════════════════════════════════════════════════════════════╗
 * ║  SINGLE ENTRY POINT FOR ALL CFO FINANCIAL COMPUTATIONS       ║
 * ║                                                              ║
 * ║  All Nzila apps MUST import CFO financial functions from     ║
 * ║  this package. Ad-hoc financial math in services, routes,    ║
 * ║  or components is PROHIBITED — it bypasses proof, validation ║
 * ║  and audit controls.                                         ║
 * ║                                                              ║
 * ║  Usage:                                                      ║
 * ║    import { financialEngine } from '@nzila/cfo-core'         ║
 * ║    import { runForecast } from '@nzila/cfo-core/forecasting' ║
 * ╚══════════════════════════════════════════════════════════════╝
 */

// Proof engine
export {
  generateFinancialProof,
  verifyFinancialProof,
  requireFinancialProof,
  computeProofHash,
  FinancialProofError,
  FinancialProofSchema,
  type FinancialProof,
} from './financial-proof'

// Computation engine
export {
  financialEngine,
  FINANCIAL_ENGINE_VERSION,
  type FinancialEntry,
  type BudgetLine,
  type ProfitLossInput,
  type ProfitLossResult,
  type BudgetInput,
  type BudgetResult,
  type MarginInput,
  type MarginResult,
  type CashFlowInput,
  type CashFlowResult,
  type AnnualProjection,
  type ProvenResult,
} from './financial-engine'

// Validation gates
export {
  runValidationGates,
  validateRequiredInputs,
  validateEntrySchemas,
  validateTimeRange,
  validateNoDuplicates,
  validateAmounts,
  FinancialValidationError,
  type ValidationResult,
  type ValidationFailure,
} from './validation'

// Forecasting
export {
  runForecast,
  FORECASTING_VERSION,
  type ForecastInput,
  type ForecastDataPoint,
  type ForecastProjection,
  type ForecastResult,
  type ForecastModelType,
} from './forecasting'
