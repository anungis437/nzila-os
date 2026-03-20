/**
 * @nzila/zonga-economics — Barrel Export
 *
 * Unified economic engine for the Zonga platform.
 * Double-entry accounting, fee computation, split distribution, settlement.
 *
 * @module @nzila/zonga-economics
 */

// Types & schemas
export type {
  EconomicAccount,
  EconomicTransaction,
  EconomicEntry,
  RevenueEvent,
  AppliedFee,
  PayoutInstruction,
  SettlementBatch,
  FeeRule,
  SplitRule,
  AccountBalanceSnapshot,
  SplitCalculation,
  SplitDistribution,
  PayoutBatch,
  ReconciliationResult,
} from './types'

export {
  AccountType,
  TransactionStatus,
  EntryDirection,
  RevenueSource,
  PayoutInstructionStatus,
  SettlementBatchStatus,
  FeeType,
  Currency,
  RecordRevenueEventSchema,
  CalculateSplitsSchema,
  GeneratePayoutsSchema,
  ReconcileAccountSchema,
} from './types'
export type {
  RecordRevenueEventInput,
  CalculateSplitsInput,
  GeneratePayoutsInput,
  ReconcileAccountInput,
} from './types'

// Ledger engine
export {
  validateLedgerEntries,
  validateTransaction,
  buildTransferEntries,
  computeBalanceFromEntries,
  reconcileAccount,
  snapshotBalance,
} from './ledger'
export type { LedgerValidationResult } from './ledger'

// Fee engine
export {
  applyFees,
  resolveFeeRules,
  DEFAULT_FEE_RULES,
} from './fees'

// Split engine
export {
  validateSplitRules,
  calculateSplits,
} from './splits'
export type { SplitValidation } from './splits'

// Settlement engine
export {
  validateSettlement,
  generatePayoutBatches,
  computeSettlementSummary,
} from './settlement'
export type { SettlementValidation } from './settlement'
