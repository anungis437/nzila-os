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
