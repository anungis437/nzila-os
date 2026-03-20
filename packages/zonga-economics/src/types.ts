/**
 * @nzila/zonga-economics — Types
 *
 * Unified economic engine types for the Zonga platform.
 * Double-entry accounting model — every financial action is an immutable record.
 */
import { z } from 'zod'

// ── Enums ─────────────────────────────────────────────────────────────────

export const AccountType = {
  USER: 'user',
  CREATOR: 'creator',
  PROMOTER: 'promoter',
  PLATFORM: 'platform',
  ESCROW: 'escrow',
  TAX: 'tax',
} as const
export type AccountType = (typeof AccountType)[keyof typeof AccountType]

export const TransactionStatus = {
  PENDING: 'pending',
  POSTED: 'posted',
  REVERSED: 'reversed',
  VOIDED: 'voided',
} as const
export type TransactionStatus = (typeof TransactionStatus)[keyof typeof TransactionStatus]

export const EntryDirection = {
  DEBIT: 'debit',
  CREDIT: 'credit',
} as const
export type EntryDirection = (typeof EntryDirection)[keyof typeof EntryDirection]

export const RevenueSource = {
  STREAM: 'stream',
  DOWNLOAD: 'download',
  TICKET_SALE: 'ticket_sale',
  TIP: 'tip',
  SUBSCRIPTION: 'subscription',
  SYNC_LICENSE: 'sync_license',
  MERCHANDISE: 'merchandise',
  SPONSORSHIP: 'sponsorship',
} as const
export type RevenueSource = (typeof RevenueSource)[keyof typeof RevenueSource]

export const PayoutInstructionStatus = {
  PENDING: 'pending',
  APPROVED: 'approved',
  PROCESSING: 'processing',
  COMPLETED: 'completed',
  FAILED: 'failed',
  CANCELLED: 'cancelled',
} as const
export type PayoutInstructionStatus =
  (typeof PayoutInstructionStatus)[keyof typeof PayoutInstructionStatus]

export const SettlementBatchStatus = {
  OPEN: 'open',
  PROCESSING: 'processing',
  SETTLED: 'settled',
  FAILED: 'failed',
  PARTIALLY_SETTLED: 'partially_settled',
} as const
export type SettlementBatchStatus =
  (typeof SettlementBatchStatus)[keyof typeof SettlementBatchStatus]

export const FeeType = {
  PLATFORM_COMMISSION: 'platform_commission',
  PAYMENT_PROCESSING: 'payment_processing',
  PAYOUT_FEE: 'payout_fee',
  CURRENCY_CONVERSION: 'currency_conversion',
  TAX_WITHHOLDING: 'tax_withholding',
} as const
export type FeeType = (typeof FeeType)[keyof typeof FeeType]

export const Currency = {
  USD: 'USD', CAD: 'CAD', EUR: 'EUR', GBP: 'GBP',
  ZAR: 'ZAR', NGN: 'NGN', KES: 'KES', GHS: 'GHS',
  TZS: 'TZS', UGX: 'UGX', ETB: 'ETB', XOF: 'XOF',
  XAF: 'XAF', MAD: 'MAD', EGP: 'EGP', RWF: 'RWF',
} as const
export type Currency = (typeof Currency)[keyof typeof Currency]

// ── Core Entities ─────────────────────────────────────────────────────────

/** Economic account — represents a financial identity in the system. */
export interface EconomicAccount {
  readonly id: string
  readonly orgId: string
  readonly type: AccountType
  readonly ownerId: string
  readonly ownerName: string
  readonly currency: Currency
  readonly balance: number
  readonly holdBalance: number
  readonly isActive: boolean
  readonly createdAt: Date
  readonly updatedAt: Date
}

/** Immutable economic transaction — groups related ledger entries. */
export interface EconomicTransaction {
  readonly id: string
  readonly orgId: string
  readonly status: TransactionStatus
  readonly description: string
  readonly revenueEventId: string | null
  readonly correlationId: string
  readonly entries: readonly EconomicEntry[]
  readonly metadata: Record<string, unknown>
  readonly createdAt: Date
  readonly postedAt: Date | null
}

/** Double-entry ledger line — debit or credit on an account. */
export interface EconomicEntry {
  readonly id: string
  readonly transactionId: string
  readonly accountId: string
  readonly direction: EntryDirection
  readonly amount: number
  readonly currency: Currency
  readonly balanceAfter: number
  readonly description: string
  readonly createdAt: Date
}

/** Revenue event — the source of money entering the system. */
export interface RevenueEvent {
  readonly id: string
  readonly orgId: string
  readonly source: RevenueSource
  readonly grossAmount: number
  readonly netAmount: number
  readonly currency: Currency
  readonly assetId: string | null
  readonly eventId: string | null
  readonly creatorId: string | null
  readonly listenerId: string | null
  readonly externalRef: string | null
  readonly fees: readonly AppliedFee[]
  readonly metadata: Record<string, unknown>
  readonly occurredAt: Date
  readonly createdAt: Date
}

/** Fee applied to a revenue event. */
export interface AppliedFee {
  readonly type: FeeType
  readonly amount: number
  readonly currency: Currency
  readonly ratePercent: number | null
  readonly description: string
}

/** Payout instruction — directive to move money to an external account. */
export interface PayoutInstruction {
  readonly id: string
  readonly orgId: string
  readonly accountId: string
  readonly recipientId: string
  readonly recipientName: string
  readonly amount: number
  readonly currency: Currency
  readonly status: PayoutInstructionStatus
  readonly payoutRail: string
  readonly externalRef: string | null
  readonly settlementBatchId: string | null
  readonly metadata: Record<string, unknown>
  readonly createdAt: Date
  readonly approvedAt: Date | null
  readonly completedAt: Date | null
  readonly failedReason: string | null
}

/** Settlement batch — groups payout instructions for batch processing. */
export interface SettlementBatch {
  readonly id: string
  readonly orgId: string
  readonly status: SettlementBatchStatus
  readonly instructionCount: number
  readonly totalAmount: number
  readonly currency: Currency
  readonly processedCount: number
  readonly failedCount: number
  readonly metadata: Record<string, unknown>
  readonly createdAt: Date
  readonly settledAt: Date | null
}

/** Fee rule — defines how fees are computed for a revenue source. */
export interface FeeRule {
  readonly id: string
  readonly orgId: string
  readonly feeType: FeeType
  readonly revenueSource: RevenueSource
  readonly ratePercent: number
  readonly flatAmount: number
  readonly currency: Currency
  readonly minAmount: number
  readonly maxAmount: number | null
  readonly isActive: boolean
  readonly effectiveFrom: Date
  readonly effectiveUntil: Date | null
}

/** Split rule — defines how revenue is distributed. */
export interface SplitRule {
  readonly id: string
  readonly orgId: string
  readonly revenueSource: RevenueSource
  readonly recipientAccountId: string
  readonly recipientName: string
  readonly sharePercent: number
  readonly priority: number
  readonly isActive: boolean
  readonly effectiveFrom: Date
  readonly effectiveUntil: Date | null
}

/** Account balance snapshot for reconciliation. */
export interface AccountBalanceSnapshot {
  readonly accountId: string
  readonly balance: number
  readonly holdBalance: number
  readonly availableBalance: number
  readonly currency: Currency
  readonly asOf: Date
}

// ── Zod Schemas ───────────────────────────────────────────────────────────

export const RecordRevenueEventSchema = z.object({
  orgId: z.string().min(1),
  source: z.enum([
    'stream', 'download', 'ticket_sale', 'tip',
    'subscription', 'sync_license', 'merchandise', 'sponsorship',
  ]),
  grossAmount: z.number().positive(),
  currency: z.string().min(3).max(3),
  assetId: z.string().nullish(),
  eventId: z.string().nullish(),
  creatorId: z.string().nullish(),
  listenerId: z.string().nullish(),
  externalRef: z.string().nullish(),
  metadata: z.record(z.unknown()).default({}),
})
export type RecordRevenueEventInput = z.infer<typeof RecordRevenueEventSchema>

export const CalculateSplitsSchema = z.object({
  orgId: z.string().min(1),
  revenueEventId: z.string().min(1),
  overrideRules: z.array(z.object({
    recipientAccountId: z.string().min(1),
    recipientName: z.string().min(1),
    sharePercent: z.number().min(0).max(100),
  })).optional(),
})
export type CalculateSplitsInput = z.infer<typeof CalculateSplitsSchema>

export const GeneratePayoutsSchema = z.object({
  orgId: z.string().min(1),
  accountIds: z.array(z.string().min(1)).optional(),
  periodStart: z.coerce.date(),
  periodEnd: z.coerce.date(),
  currency: z.string().min(3).max(3),
  minAmount: z.number().min(0).default(0),
})
export type GeneratePayoutsInput = z.infer<typeof GeneratePayoutsSchema>

export const ReconcileAccountSchema = z.object({
  accountId: z.string().min(1),
  asOf: z.coerce.date().optional(),
})
export type ReconcileAccountInput = z.infer<typeof ReconcileAccountSchema>

// ── Result Types ──────────────────────────────────────────────────────────

export interface SplitCalculation {
  readonly revenueEventId: string
  readonly grossAmount: number
  readonly fees: readonly AppliedFee[]
  readonly netAmount: number
  readonly distributions: readonly SplitDistribution[]
  readonly totalDistributed: number
  readonly remainder: number
}

export interface SplitDistribution {
  readonly recipientAccountId: string
  readonly recipientName: string
  readonly sharePercent: number
  readonly amount: number
}

export interface PayoutBatch {
  readonly batchId: string
  readonly instructions: readonly PayoutInstruction[]
  readonly totalAmount: number
  readonly currency: Currency
  readonly accountCount: number
}

export interface ReconciliationResult {
  readonly accountId: string
  readonly computedBalance: number
  readonly recordedBalance: number
  readonly discrepancy: number
  readonly isBalanced: boolean
  readonly entryCount: number
  readonly asOf: Date
}
