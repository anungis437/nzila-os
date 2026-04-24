/**
 * @nzila/payments-stripe — barrel export
 */
export { getStripeClient } from './client'
export { getStripeEnv, validateStripeEnv } from './env'
export { verifyWebhookSignature, WebhookSignatureError, extractEntityIdFromEvent } from './webhooks'
export { normalizeAndPersist, markEventFailed } from './normalize'
export {
  createCustomer,
  createCheckoutSession,
  executeRefund,
  requiresApproval,
  createSubscription,
  createSubscriptionCheckoutSession,
  createPortalSession,
  createCustomerSession,
} from './primitives'
export { generateStripeReports, buildReportBlobPath } from './reports'
export {
  collectStripeEvidenceArtifacts,
  buildStripeEvidencePackRequest,
} from './evidence'
export {
  matchPayoutsToDeposits,
  generateExceptions,
  computeCloseReadiness,
  DEFAULT_RECON_CONFIG,
} from './reconciliation'
export {
  BILLING_WEBHOOK_EVENTS,
  billingWebhookEventSchema,
  classifyBillingWebhook,
} from './billing-webhooks'
export type {
  ReconciliationConfig,
  ReconciliationException,
  ReconciliationType,
  ExceptionSeverity,
  ExceptionStatus,
  StripePayout,
  QboDeposit,
  MatchResult,
  CloseReadinessReport,
} from './reconciliation'
export type {
  BillingWebhookEventType,
  BillingWebhookEventInput,
} from './billing-webhooks'
export * from './types'
