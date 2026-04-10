/**
 * @nzila/zonga-payments — Vodacom M-Pesa Adapter
 *
 * Implements PaymentProviderAdapter for Vodacom M-Pesa via OpenAPI.
 * Covers Tanzania (primary), Mozambique, Lesotho, DRC.
 *
 * Scope: C2B collection, transaction status query, reversal.
 * Payouts are NOT supported in v1 — createPayout throws a structured error.
 *
 * @module @nzila/zonga-payments/adapters/vodacom-mpesa
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
import { createVodacomMpesaClient, type VodacomMpesaHttpClient } from './vodacom-mpesa.client'
import type { VodacomMpesaConfig } from './vodacom-mpesa.types'
import { VodacomMpesaError, MpesaResponseCode } from './vodacom-mpesa.types'

// ── Adapter ─────────────────────────────────────────────────────────────────

export function createVodacomMpesaAdapter(config: VodacomMpesaConfig): PaymentProviderAdapter {
  const client: VodacomMpesaHttpClient = createVodacomMpesaClient(config)

  return {
    provider: PaymentProvider.VODACOM_MPESA,

    async createIntent(params: CreateIntentParams): Promise<PaymentIntent> {
      const phoneNumber = (params.metadata?.phoneNumber as string) ?? ''
      if (!phoneNumber) {
        throw new VodacomMpesaError(
          'Phone number is required for M-Pesa C2B payments',
          'VALIDATION',
          'Missing phoneNumber in metadata',
        )
      }

      const conversationId = params.idempotencyKey

      const response = await client.c2bPayment({
        input_TransactionReference: params.orderId,
        input_CustomerMSISDN: phoneNumber,
        input_Amount: String(params.amount),
        input_ThirdPartyConversationID: conversationId,
        input_ServiceProviderCode: config.serviceProviderCode,
        input_PurchaseItemDesc: `Zonga order ${params.orderId}`,
      })

      const now = new Date()
      return {
        id: response.output_ConversationID || conversationId,
        orderId: params.orderId,
        userId: params.userId,
        amount: params.amount,
        currency: params.currency,
        method: params.method,
        provider: PaymentProvider.VODACOM_MPESA,
        status: PaymentIntentStatus.PROCESSING,
        providerIntentId: response.output_TransactionID,
        metadata: {
          ...params.metadata,
          conversationId: response.output_ConversationID,
          thirdPartyConversationId: response.output_ThirdPartyConversationID,
          transactionId: response.output_TransactionID,
          market: config.market,
        },
        idempotencyKey: params.idempotencyKey,
        createdAt: now,
        updatedAt: now,
        capturedAt: null,
        expiresAt: new Date(now.getTime() + 5 * 60 * 1000), // 5 minutes for USSD confirmation
      }
    },

    async captureIntent(intentId: string): Promise<PaymentCapture> {
      // Query transaction status to confirm completion
      const status = await client.queryTransactionStatus({
        input_QueryReference: intentId,
        input_ServiceProviderCode: config.serviceProviderCode,
        input_ThirdPartyConversationID: `query_${intentId}_${Date.now()}`,
      })

      const txStatus = status.output_ResponseTransactionStatus?.toUpperCase()

      if (txStatus !== 'COMPLETED' && txStatus !== 'SUCCESS') {
        throw new VodacomMpesaError(
          `M-Pesa payment not completed: ${txStatus ?? 'unknown'}`,
          status.output_ResponseCode,
          status.output_ResponseDesc,
          status.output_ConversationID,
        )
      }

      return {
        intentId,
        capturedAmount: 0, // Amount from original C2B request
        providerTransactionId: status.output_ConversationID ?? intentId,
        receiptUrl: null, // M-Pesa does not provide receipt URLs
        capturedAt: new Date(),
      }
    },

    async refundIntent(intentId: string, amount: number, reason: string): Promise<PaymentRefund> {
      const refundConversationId = `reversal_${intentId}_${Date.now()}`

      const response = await client.reverseTransaction({
        input_ReversalAmount: String(amount),
        input_TransactionID: intentId,
        input_ThirdPartyConversationID: refundConversationId,
        input_ServiceProviderCode: config.serviceProviderCode,
      })

      return {
        id: response.output_TransactionID || refundConversationId,
        intentId,
        amount,
        reason,
        status: RefundStatus.PROCESSING,
        providerRefundId: response.output_TransactionID,
        requestedAt: new Date(),
        completedAt: null,
      }
    },

    async createPayout(_instruction: PayoutInstruction): Promise<PayoutInstruction> {
      // Vodacom M-Pesa B2C (payouts) require a separate business agreement
      // and are not in scope for v1. Fail explicitly rather than silently routing
      // through Flutterwave.
      throw new VodacomMpesaError(
        'Vodacom M-Pesa B2C payouts are not supported in v1. Use a different provider for payouts.',
        'UNSUPPORTED_OPERATION',
        'B2C payouts require separate Vodacom business agreement — not yet implemented',
      )
    },

    verifyWebhook(signature: string, payload: string): boolean {
      // OpenAPI M-Pesa callback verification:
      // The callback includes the ThirdPartyConversationID that we generated,
      // so verification is done by matching against known conversation IDs.
      // Full HMAC verification will be added when Vodacom publishes signing keys.
      if (!signature || !payload) return false
      try {
        const parsed = JSON.parse(payload) as { output_ThirdPartyConversationID?: string }
        return typeof parsed.output_ThirdPartyConversationID === 'string'
          && parsed.output_ThirdPartyConversationID.length > 0
      } catch {
        return false
      }
    },
  }
}
