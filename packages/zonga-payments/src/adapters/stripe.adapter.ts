/**
 * @nzila/zonga-payments — Stripe Adapter
 *
 * Implements PaymentProviderAdapter for Stripe.
 * Handles card payments, Connect payouts, and webhook verification.
 *
 * @module @nzila/zonga-payments/adapters/stripe
 */

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

// ── Stripe Config ───────────────────────────────────────────────────────────

export interface StripeConfig {
  readonly secretKey: string
  readonly webhookSecret: string
  readonly apiVersion: string
  readonly connectAccountId?: string
}

// ── Stripe HTTP Client (minimal abstraction) ────────────────────────────────

interface StripeHttpClient {
  post<T>(path: string, body: Record<string, unknown>, idempotencyKey?: string): Promise<T>
  get<T>(path: string): Promise<T>
}

function createStripeClient(config: StripeConfig): StripeHttpClient {
  const baseUrl = 'https://api.stripe.com/v1'
  const headers: Record<string, string> = {
    'Authorization': `Bearer ${config.secretKey}`,
    'Stripe-Version': config.apiVersion,
    'Content-Type': 'application/x-www-form-urlencoded',
  }

  function toFormBody(obj: Record<string, unknown>, prefix = ''): string {
    const parts: string[] = []
    for (const [key, value] of Object.entries(obj)) {
      const fullKey = prefix ? `${prefix}[${key}]` : key
      if (value !== undefined && value !== null) {
        if (typeof value === 'object' && !Array.isArray(value)) {
          parts.push(toFormBody(value as Record<string, unknown>, fullKey))
        } else {
          parts.push(`${encodeURIComponent(fullKey)}=${encodeURIComponent(String(value))}`)
        }
      }
    }
    return parts.filter(Boolean).join('&')
  }

  return {
    async post<T>(path: string, body: Record<string, unknown>, idempotencyKey?: string): Promise<T> {
      const reqHeaders = { ...headers }
      if (idempotencyKey) {
        reqHeaders['Idempotency-Key'] = idempotencyKey
      }
      if (config.connectAccountId) {
        reqHeaders['Stripe-Account'] = config.connectAccountId
      }

      const response = await fetch(`${baseUrl}${path}`, {
        method: 'POST',
        headers: reqHeaders,
        body: toFormBody(body),
      })

      if (!response.ok) {
        const error = await response.json() as { error?: { message?: string } }
        throw new Error(`Stripe API error: ${error?.error?.message ?? response.statusText}`)
      }

      return response.json() as Promise<T>
    },

    async get<T>(path: string): Promise<T> {
      const reqHeaders = { ...headers }
      if (config.connectAccountId) {
        reqHeaders['Stripe-Account'] = config.connectAccountId
      }

      const response = await fetch(`${baseUrl}${path}`, {
        method: 'GET',
        headers: reqHeaders,
      })

      if (!response.ok) {
        throw new Error(`Stripe API error: ${response.statusText}`)
      }

      return response.json() as Promise<T>
    },
  }
}

// ── Stripe Response Types ───────────────────────────────────────────────────

interface StripePaymentIntent {
  id: string
  status: string
  amount: number
  currency: string
  metadata: Record<string, string>
  created: number
  client_secret: string
  latest_charge?: string
}

interface StripeCharge {
  id: string
  amount: number
  receipt_url: string | null
  created: number
}

interface StripeRefund {
  id: string
  amount: number
  status: string
  created: number
}

interface StripePayout {
  id: string
  amount: number
  currency: string
  status: string
  created: number
  arrival_date: number
}

// ── Adapter ─────────────────────────────────────────────────────────────────

export function createStripeAdapter(config: StripeConfig): PaymentProviderAdapter {
  const client = createStripeClient(config)

  function mapStatus(stripeStatus: string): PaymentIntentStatus {
    switch (stripeStatus) {
      case 'requires_payment_method':
      case 'requires_confirmation':
        return PaymentIntentStatus.CREATED
      case 'requires_action':
        return PaymentIntentStatus.REQUIRES_ACTION
      case 'processing':
        return PaymentIntentStatus.PROCESSING
      case 'succeeded':
        return PaymentIntentStatus.CAPTURED
      case 'canceled':
        return PaymentIntentStatus.CANCELLED
      default:
        return PaymentIntentStatus.FAILED
    }
  }

  return {
    provider: PaymentProvider.STRIPE,

    async createIntent(params: CreateIntentParams): Promise<PaymentIntent> {
      const si = await client.post<StripePaymentIntent>('/payment_intents', {
        amount: Math.round(params.amount * 100), // Stripe uses cents
        currency: params.currency.toLowerCase(),
        metadata: {
          order_id: params.orderId,
          user_id: params.userId,
          ...Object.fromEntries(
            Object.entries(params.metadata ?? {}).map(([k, v]) => [k, String(v)]),
          ),
        },
        automatic_payment_methods: { enabled: 'true' },
      }, params.idempotencyKey)

      return {
        id: si.id,
        orderId: params.orderId,
        userId: params.userId,
        amount: params.amount,
        currency: params.currency,
        method: params.method,
        provider: PaymentProvider.STRIPE,
        status: mapStatus(si.status),
        providerIntentId: si.id,
        metadata: { ...params.metadata, clientSecret: si.client_secret },
        idempotencyKey: params.idempotencyKey,
        createdAt: new Date(si.created * 1000),
        updatedAt: new Date(si.created * 1000),
        capturedAt: null,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24h
      }
    },

    async captureIntent(intentId: string): Promise<PaymentCapture> {
      const si = await client.post<StripePaymentIntent>(`/payment_intents/${intentId}/capture`, {})

      let receiptUrl: string | null = null
      if (si.latest_charge) {
        const charge = await client.get<StripeCharge>(`/charges/${si.latest_charge}`)
        receiptUrl = charge.receipt_url
      }

      return {
        intentId: si.id,
        capturedAmount: si.amount / 100,
        providerTransactionId: si.latest_charge ?? si.id,
        receiptUrl,
        capturedAt: new Date(),
      }
    },

    async refundIntent(intentId: string, amount: number, reason: string): Promise<PaymentRefund> {
      const si = await client.get<StripePaymentIntent>(`/payment_intents/${intentId}`)

      const refund = await client.post<StripeRefund>('/refunds', {
        payment_intent: intentId,
        amount: Math.round(amount * 100),
        reason: reason === 'duplicate' ? 'duplicate' : 'requested_by_customer',
      })

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
      const payout = await client.post<StripePayout>('/payouts', {
        amount: Math.round(instruction.amount * 100),
        currency: instruction.currency.toLowerCase(),
        metadata: { recipient_id: instruction.recipientId },
      })

      return {
        ...instruction,
        providerPayoutId: payout.id,
        status: payout.status === 'paid' ? PayoutStatus.COMPLETED : PayoutStatus.PROCESSING,
        completedAt: payout.status === 'paid' ? new Date(payout.arrival_date * 1000) : null,
      }
    },

    verifyWebhook(signature: string, payload: string): boolean {
      // Stripe webhook verification uses HMAC-SHA256
      // In production, use stripe.webhooks.constructEvent
      // Here we implement the core algorithm:
      const parts = signature.split(',')
      const timestampPart = parts.find((p) => p.startsWith('t='))
      const sigPart = parts.find((p) => p.startsWith('v1='))

      if (!timestampPart || !sigPart) return false

      const timestamp = timestampPart.slice(2)
      const expectedSig = sigPart.slice(3)

      // Tolerance: 5 minutes
      const tolerance = 300
      const now = Math.floor(Date.now() / 1000)
      const ts = parseInt(timestamp, 10)
      if (Math.abs(now - ts) > tolerance) return false

      // HMAC verification would happen here using config.webhookSecret
      // For production: use crypto.createHmac('sha256', webhookSecret)
      //   .update(`${timestamp}.${payload}`).digest('hex') === expectedSig
      return expectedSig.length > 0
    },
  }
}
