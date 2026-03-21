/**
 * @nzila/zonga-payments — Airtel Money Adapter
 *
 * Implements PaymentProviderAdapter for Airtel Money.
 * Covers 5+ East/Southern African countries (KE, TZ, UG, MW, ZM).
 *
 * API: Airtel Money Africa API v2
 * Flow: Send push → user confirms on phone → callback
 *
 * @module @nzila/zonga-payments/adapters/airtel
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

// ── Airtel Config ───────────────────────────────────────────────────────────

export interface AirtelConfig {
  readonly baseUrl: string
  readonly clientId: string
  readonly clientSecret: string
  readonly country: string
  readonly currency: string
  readonly callbackUrl: string
}

// ── Airtel HTTP Client ──────────────────────────────────────────────────────

interface AirtelHttpClient {
  post<T>(path: string, body: Record<string, unknown>): Promise<T>
  get<T>(path: string): Promise<T>
  getToken(): Promise<string>
}

function createAirtelClient(config: AirtelConfig): AirtelHttpClient {
  let cachedToken: { token: string; expiresAt: number } | null = null

  return {
    async getToken(): Promise<string> {
      if (cachedToken && Date.now() < cachedToken.expiresAt) {
        return cachedToken.token
      }

      const response = await fetch(`${config.baseUrl}/auth/oauth2/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_id: config.clientId,
          client_secret: config.clientSecret,
          grant_type: 'client_credentials',
        }),
      })

      if (!response.ok) {
        throw new Error(`Airtel token error: ${response.statusText}`)
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
          'X-Country': config.country,
          'X-Currency': config.currency,
        },
        body: JSON.stringify(body),
      })

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`Airtel API error: ${errorText}`)
      }

      return response.json() as Promise<T>
    },

    async get<T>(path: string): Promise<T> {
      const token = await this.getToken()
      const response = await fetch(`${config.baseUrl}${path}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'X-Country': config.country,
          'X-Currency': config.currency,
        },
      })

      if (!response.ok) {
        throw new Error(`Airtel API error: ${response.statusText}`)
      }

      return response.json() as Promise<T>
    },
  }
}

// ── Airtel Response Types ───────────────────────────────────────────────────

interface AirtelPaymentResponse {
  data: {
    transaction: {
      id: string
      status: string
    }
  }
  status: {
    code: string
    message: string
    result_code: string
    success: boolean
  }
}

interface AirtelTransactionStatus {
  data: {
    transaction: {
      airtel_money_id: string
      id: string
      status: 'TS' | 'TF' | 'TA' | 'TIP'
      message: string
    }
  }
  status: {
    code: string
    message: string
    success: boolean
  }
}

interface AirtelDisbursementResponse {
  data: {
    transaction: {
      reference_id: string
      airtel_money_id: string
      id: string
    }
  }
  status: {
    code: string
    success: boolean
  }
}

// ── Adapter ─────────────────────────────────────────────────────────────────

export function createAirtelAdapter(config: AirtelConfig): PaymentProviderAdapter {
  const client = createAirtelClient(config)

  function mapTransactionStatus(code: string): PaymentIntentStatus {
    switch (code) {
      case 'TS': return PaymentIntentStatus.CAPTURED    // Transaction Successful
      case 'TF': return PaymentIntentStatus.FAILED      // Transaction Failed
      case 'TA': return PaymentIntentStatus.REQUIRES_ACTION // Transaction Ambiguous
      case 'TIP': return PaymentIntentStatus.PROCESSING  // Transaction In Progress
      default: return PaymentIntentStatus.FAILED
    }
  }

  return {
    provider: PaymentProvider.AIRTEL_MONEY,

    async createIntent(params: CreateIntentParams): Promise<PaymentIntent> {
      const phoneNumber = (params.metadata?.phoneNumber as string) ?? ''

      const response = await client.post<AirtelPaymentResponse>(
        '/merchant/v2/payments/',
        {
          reference: params.idempotencyKey,
          subscriber: {
            country: config.country,
            currency: params.currency,
            msisdn: phoneNumber,
          },
          transaction: {
            amount: params.amount,
            country: config.country,
            currency: params.currency,
            id: params.idempotencyKey,
          },
        },
      )

      const now = new Date()
      return {
        id: response.data.transaction.id,
        orderId: params.orderId,
        userId: params.userId,
        amount: params.amount,
        currency: params.currency,
        method: params.method,
        provider: PaymentProvider.AIRTEL_MONEY,
        status: PaymentIntentStatus.PROCESSING,
        providerIntentId: response.data.transaction.id,
        metadata: params.metadata ?? {},
        idempotencyKey: params.idempotencyKey,
        createdAt: now,
        updatedAt: now,
        capturedAt: null,
        expiresAt: new Date(now.getTime() + 5 * 60 * 1000), // 5 min
      }
    },

    async captureIntent(intentId: string): Promise<PaymentCapture> {
      const status = await client.get<AirtelTransactionStatus>(
        `/standard/v1/payments/${intentId}`,
      )

      const txStatus = status.data.transaction.status
      if (txStatus !== 'TS') {
        throw new Error(`Airtel payment not successful: ${txStatus} — ${status.data.transaction.message}`)
      }

      return {
        intentId,
        capturedAmount: 0,
        providerTransactionId: status.data.transaction.airtel_money_id,
        receiptUrl: null,
        capturedAt: new Date(),
      }
    },

    async refundIntent(intentId: string, amount: number, reason: string): Promise<PaymentRefund> {
      const refundId = `refund_${intentId}_${Date.now()}`

      await client.post('/standard/v1/payments/refund', {
        transaction: {
          airtel_money_id: intentId,
        },
      })

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
      const response = await client.post<AirtelDisbursementResponse>(
        '/standard/v2/disbursements/',
        {
          payee: {
            msisdn: instruction.destination.mobileNumber ?? instruction.destination.accountIdentifier,
            name: instruction.destination.accountName,
          },
          reference: instruction.id,
          pin: '', // Set via secure config
          transaction: {
            amount: instruction.amount,
            id: instruction.id,
          },
        },
      )

      return {
        ...instruction,
        providerPayoutId: response.data.transaction.airtel_money_id,
        status: PayoutStatus.PROCESSING,
      }
    },

    verifyWebhook(signature: string, _payload: string): boolean {
      // Airtel sends callback with transaction status
      return signature.length > 0
    },
  }
}
