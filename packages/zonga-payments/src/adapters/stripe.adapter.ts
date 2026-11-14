/**
 * Zonga Stripe adapter — one official SDK/API contract, no alternate HTTP client.
 * Account-specific requests use the shared factory and scoped Stripe-Account option.
 */
import { createStripeClientForKey } from '@nzila/payments-stripe'
import type { Stripe } from '@nzila/payments-stripe'
import {
  PaymentProvider,
  PaymentIntentStatus,
  PayoutStatus,
  RefundStatus,
  type PaymentProviderAdapter,
  type PaymentIntent,
  type PaymentCapture,
  type PaymentRefund,
  type PayoutInstruction,
  type CreateIntentParams,
} from '../types'

export interface StripeConfig {
  readonly secretKey: string
  readonly webhookSecret: string
  readonly connectAccountId?: string
}

export function createStripeAdapter(config: StripeConfig): PaymentProviderAdapter {
  const stripe = createStripeClientForKey(config.secretKey)
  const accountOptions: Stripe.RequestOptions = config.connectAccountId
    ? { stripeAccount: config.connectAccountId }
    : {}

  const mapStatus = (status: string): PaymentIntentStatus => {
    switch (status) {
      case 'requires_payment_method':
      case 'requires_confirmation': return PaymentIntentStatus.CREATED
      case 'requires_action': return PaymentIntentStatus.REQUIRES_ACTION
      case 'processing': return PaymentIntentStatus.PROCESSING
      case 'succeeded': return PaymentIntentStatus.CAPTURED
      case 'canceled': return PaymentIntentStatus.CANCELLED
      default: return PaymentIntentStatus.FAILED
    }
  }

  return {
    provider: PaymentProvider.STRIPE,

    async createIntent(params: CreateIntentParams): Promise<PaymentIntent> {
      const payment = await stripe.paymentIntents.create({
        amount: Math.round(params.amount * 100),
        currency: params.currency.toLowerCase(),
        metadata: {
          order_id: params.orderId,
          user_id: params.userId,
          ...Object.fromEntries(Object.entries(params.metadata ?? {}).map(([key, value]) => [key, String(value)])),
        },
        // Dashboard-managed dynamic payment methods, with no removed Endive parameter.
        automatic_payment_methods: { enabled: true },
      }, { ...accountOptions, idempotencyKey: params.idempotencyKey })

      return {
        id: payment.id,
        orderId: params.orderId,
        userId: params.userId,
        amount: params.amount,
        currency: params.currency,
        method: params.method,
        provider: PaymentProvider.STRIPE,
        status: mapStatus(payment.status),
        providerIntentId: payment.id,
        metadata: { ...params.metadata, clientSecret: payment.client_secret ?? '' },
        idempotencyKey: params.idempotencyKey,
        createdAt: new Date(payment.created * 1000),
        updatedAt: new Date(payment.created * 1000),
        capturedAt: null,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      }
    },

    async captureIntent(intentId: string): Promise<PaymentCapture> {
      const payment = await stripe.paymentIntents.capture(intentId, {}, accountOptions)
      const chargeId = typeof payment.latest_charge === 'string'
        ? payment.latest_charge
        : payment.latest_charge?.id
      const charge = chargeId ? await stripe.charges.retrieve(chargeId, accountOptions) : null

      return {
        intentId: payment.id,
        capturedAmount: payment.amount / 100,
        providerTransactionId: chargeId ?? payment.id,
        receiptUrl: charge?.receipt_url ?? null,
        capturedAt: new Date(),
      }
    },

    async refundIntent(intentId: string, amount: number, reason: string): Promise<PaymentRefund> {
      const refund = await stripe.refunds.create({
        payment_intent: intentId,
        amount: Math.round(amount * 100),
        reason: reason === 'duplicate' ? 'duplicate' : 'requested_by_customer',
      }, accountOptions)

      return {
        id: refund.id,
        intentId,
        amount: refund.amount / 100,
        reason,
        status: refund.status === 'succeeded' ? RefundStatus.COMPLETED : RefundStatus.PROCESSING,
        providerRefundId: refund.id,
        requestedAt: new Date(refund.created * 1000),
        completedAt: refund.status === 'succeeded' ? new Date() : null,
      }
    },

    async createPayout(instruction: PayoutInstruction): Promise<PayoutInstruction> {
      const payout = await stripe.payouts.create({
        amount: Math.round(instruction.amount * 100),
        currency: instruction.currency.toLowerCase(),
        metadata: { recipient_id: instruction.recipientId },
      }, accountOptions)

      return {
        ...instruction,
        providerPayoutId: payout.id,
        status: payout.status === 'paid' ? PayoutStatus.COMPLETED : PayoutStatus.PROCESSING,
        completedAt: payout.status === 'paid' ? new Date(payout.arrival_date * 1000) : null,
      }
    },

    verifyWebhook(signature: string, payload: string): boolean {
      // The SDK verifies timestamp tolerance, every v1 signature and HMAC in constant time.
      // A non-empty v1 value alone is never proof.
      if (!config.webhookSecret) return false
      try {
        stripe.webhooks.constructEvent(payload, signature, config.webhookSecret)
        return true
      } catch {
        return false
      }
    },
  }
}
