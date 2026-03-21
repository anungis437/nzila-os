/**
 * @nzila/zonga-payments — Abstract payment layer
 *
 * Provider-agnostic payment intents, capture, refund,
 * payout, and mobile money support.
 */

// ── Types & Schemas ───────────────────────────────────────────────────────
export {
  // Enums
  PaymentMethod,
  PaymentProvider,
  PaymentIntentStatus,
  PayoutStatus,
  RefundStatus,

  // Interfaces
  type PaymentIntent,
  type PaymentCapture,
  type PaymentRefund,
  type PayoutInstruction,
  type PayoutDestination,
  type MobileMoneyRequest,
  type PaymentWebhookEvent,
  type PaymentProviderAdapter,
  type CreateIntentParams,

  // Schemas
  CreatePaymentIntentSchema,
  RequestRefundSchema,
  CreatePayoutSchema,
  MobileMoneyRequestSchema,
} from './types'

// ── Intent Engine ─────────────────────────────────────────────────────────
export {
  canTransitionIntent,
  getAvailableIntentTransitions,
  isIntentExpired,
  computeRefundSummary,
  validateRefundRequest,
  findByIdempotencyKey,
  type TransitionResult,
  type RefundSummary,
} from './intents'

// ── Payout Engine ─────────────────────────────────────────────────────────
export {
  DEFAULT_PROVIDER_ROUTES,
  resolvePayoutRoute,
  planPayoutBatches,
  reconcilePayouts,
  type ProviderRoute,
  type RouteResult,
  type PayoutBatchPlan,
  type PayoutReconciliation,
} from './payouts'

// ── Provider Adapters ─────────────────────────────────────────────────────
export {
  createStripeAdapter,
  createMoMoAdapter,
  createOrangeMoneyAdapter,
  createAirtelAdapter,
  type StripeConfig,
  type MoMoConfig,
  type OrangeMoneyConfig,
  type AirtelConfig,
} from './adapters/index'

// ── Wallet Service ────────────────────────────────────────────────────────
export {
  WalletStatus,
  WalletTxType,
  createWalletService,
  validateDebit,
  validateHold,
  validateCredit,
  buildCreditEntries,
  buildDebitEntries,
  buildTransferEntries,
  CreditWalletSchema,
  DebitWalletSchema,
  TransferSchema,
  type Wallet,
  type WalletTransaction,
  type WalletOperationResult,
  type CreditParams,
  type DebitParams,
  type TransferParams,
  type HoldParams,
  type WalletRepository,
  type LedgerPort,
  type WalletLedgerEntry,
  type WalletValidation,
} from './wallet'

// ── Payment Flow Orchestration ────────────────────────────────────────────
export {
  createPaymentFlowService,
  type FlowOrchestrator,
  type PaymentIntentRepository,
  type WebhookEventRepository,
  type AuditLogger,
  type PaymentFlowDeps,
} from './payment-flow'
