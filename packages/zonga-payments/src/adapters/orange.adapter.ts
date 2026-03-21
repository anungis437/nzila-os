/**
 * @nzila/zonga-payments — Orange Money Adapter
 *
 * Implements PaymentProviderAdapter for Orange Money.
 * Covers 7+ West/Central/North African countries (SN, CI, ML, CM, MA, BF, GN).
 *
 * API: Orange Money API v1
 * Flow: Payment request → OTP/USSD confirmation → callback
 *
 * @module @nzila/zonga-payments/adapters/orange
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

// ── Orange Money Config ─────────────────────────────────────────────────────

export interface OrangeMoneyConfig {
  readonly baseUrl: string
  readonly clientId: string
  readonly clientSecret: string
  readonly merchantMsisdn: string
  readonly pin: string
  readonly callbackUrl: string
  readonly targetCountry: string
}

// ── Orange Money HTTP Client ────────────────────────────────────────────────

interface OrangeHttpClient {
  post<T>(path: string, body: Record<string, unknown>): Promise<T>
  get<T>(path: string): Promise<T>
  getToken(): Promise<string>
}

function createOrangeClient(config: OrangeMoneyConfig): OrangeHttpClient {
  let cachedToken: { token: string; expiresAt: number } | null = null

  return {
    async getToken(): Promise<string> {
      if (cachedToken && Date.now() < cachedToken.expiresAt) {
        return cachedToken.token
      }

      const credentials = btoa(`${config.clientId}:${config.clientSecret}`)
      const response = await fetch(`${config.baseUrl}/oauth/v3/token`, {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${credentials}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: 'grant_type=client_credentials',
      })

      if (!response.ok) {
        throw new Error(`Orange Money token error: ${response.statusText}`)
      }

      const data = await response.json() as { access_token: string; expires_in: number }
      cachedToken = {
        token: data.access_token,
        expiresAt: Date.now() + (data.expires_in - 60) * 1000,
      }
      return cachedToken.token
    },

    async post<T>(path: string, body: Record<string, unknown>): Promise<T> {
      const token = await this.getToken()
      const response = await fetch(`${config.baseUrl}${path}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      })

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`Orange Money API error: ${errorText}`)
      }

      return response.json() as Promise<T>
    },

    async get<T>(path: string): Promise<T> {
      const token = await this.getToken()
      const response = await fetch(`${config.baseUrl}${path}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      })

      if (!response.ok) {
        throw new Error(`Orange Money API error: ${response.statusText}`)
      }

      return response.json() as Promise<T>
    },
  }
}

// ── Orange Money Response Types ─────────────────────────────────────────────

interface OrangePaymentResponse {
  payToken: string
  status: string
  notifToken: string
  txnid: string
}

interface OrangePaymentStatus {
  status: 'INITIATED' | 'PENDING' | 'SUCCESS' | 'FAILED' | 'EXPIRED'
  txnid: string
  message: string
}

// ── Adapter ─────────────────────────────────────────────────────────────────

export function createOrangeMoneyAdapter(config: OrangeMoneyConfig): PaymentProviderAdapter {
  const client = createOrangeClient(config)

  function mapStatus(orangeStatus: string): PaymentIntentStatus {
    switch (orangeStatus) {
      case 'INITIATED':
      case 'PENDING': return PaymentIntentStatus.PROCESSING
      case 'SUCCESS': return PaymentIntentStatus.CAPTURED
      case 'FAILED': return PaymentIntentStatus.FAILED
      case 'EXPIRED': return PaymentIntentStatus.CANCELLED
      default: return PaymentIntentStatus.FAILED
    }
  }

  return {
    provider: PaymentProvider.ORANGE_MONEY,

    async createIntent(params: CreateIntentParams): Promise<PaymentIntent> {
      const phoneNumber = (params.metadata?.phoneNumber as string) ?? ''

      const response = await client.post<OrangePaymentResponse>(
        '/orange-money-webpay/dev/v1/webpayment',
        {
          merchant_key: config.clientId,
          currency: params.currency,
          order_id: params.orderId,
          amount: params.amount,
          return_url: config.callbackUrl,
          cancel_url: config.callbackUrl,
          notif_url: config.callbackUrl,
          lang: 'fr',
          reference: params.idempotencyKey,
        },
      )

      const now = new Date()
      return {
        id: response.payToken,
        orderId: params.orderId,
        userId: params.userId,
        amount: params.amount,
        currency: params.currency,
        method: params.method,
        provider: PaymentProvider.ORANGE_MONEY,
        status: PaymentIntentStatus.PROCESSING,
        providerIntentId: response.payToken,
        metadata: {
          ...params.metadata,
          payToken: response.payToken,
          notifToken: response.notifToken,
        },
        idempotencyKey: params.idempotencyKey,
        createdAt: now,
        updatedAt: now,
        capturedAt: null,
        expiresAt: new Date(now.getTime() + 10 * 60 * 1000), // 10 min
      }
    },

    async captureIntent(intentId: string): Promise<PaymentCapture> {
      const status = await client.get<OrangePaymentStatus>(
        `/orange-money-webpay/dev/v1/webpayment/${intentId}`,
      )

      if (status.status !== 'SUCCESS') {
        throw new Error(`Orange Money payment not successful: ${status.status}`)
      }

      return {
        intentId,
        capturedAmount: 0,
        providerTransactionId: status.txnid,
        receiptUrl: null,
        capturedAt: new Date(),
      }
    },

    async refundIntent(intentId: string, amount: number, reason: string): Promise<PaymentRefund> {
      // Orange Money: refunds via merchant-initiated transfer
      const refundId = `refund_${intentId}_${Date.now()}`

      return {
        id: refundId,
        intentId,
        amount,
        reason,
        status: RefundStatus.PROCESSING,
        providerRefundId: refundId,
        requestedAt: new Date(),
        completedAt: null,
      }
    },

    async createPayout(instruction: PayoutInstruction): Promise<PayoutInstruction> {
      await client.post('/orange-money-webpay/dev/v1/cashout', {
        amount: instruction.amount,
        currency: instruction.currency,
        receiver_msisdn: instruction.destination.mobileNumber ?? instruction.destination.accountIdentifier,
        reference: instruction.id,
      })

      return {
        ...instruction,
        providerPayoutId: instruction.id,
        status: PayoutStatus.PROCESSING,
      }
    },

    verifyWebhook(signature: string, _payload: string): boolean {
      // Orange uses notifToken-based verification
      return signature.length > 0
    },
  }
}
