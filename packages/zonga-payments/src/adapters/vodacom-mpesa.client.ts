/**
 * @nzila/zonga-payments — Vodacom M-Pesa HTTP Client
 *
 * Handles RSA public-key encryption for bearer token generation
 * and provides typed HTTP methods for the OpenAPI gateway.
 *
 * Auth flow:
 *   1. RSA-encrypt the API key with the provided public key
 *   2. Base64-encode the ciphertext
 *   3. Send as `Bearer <encoded_ciphertext>` on every request
 *
 * @module @nzila/zonga-payments/adapters/vodacom-mpesa.client
 */

import { publicEncrypt, constants as cryptoConstants } from 'node:crypto'
import type {
  VodacomMpesaConfig,
  C2BPaymentRequest,
  C2BPaymentResponse,
  TransactionStatusRequest,
  TransactionStatusResponse,
  ReversalRequest,
  ReversalResponse,
} from './vodacom-mpesa.types'
import {
  MpesaResponseCode,
  VodacomMpesaError,
  isRetryableCode,
} from './vodacom-mpesa.types'

// ── Bearer Token Generation ─────────────────────────────────────────────────

/**
 * Generate a bearer token by RSA-encrypting the API key with the public key.
 * The OpenAPI gateway expects PKCS1 v1.5 padding (not OAEP).
 */
export function generateBearerToken(apiKey: string, publicKeyPem: string): string {
  const keyBuffer = Buffer.from(apiKey, 'utf-8')

  // Ensure PEM format wrapping
  const pem = publicKeyPem.includes('-----BEGIN')
    ? publicKeyPem
    : `-----BEGIN PUBLIC KEY-----\n${publicKeyPem}\n-----END PUBLIC KEY-----`

  const encrypted = publicEncrypt(
    { key: pem, padding: cryptoConstants.RSA_PKCS1_PADDING },
    keyBuffer,
  )

  return encrypted.toString('base64')
}

// ── HTTP Client ─────────────────────────────────────────────────────────────

export interface VodacomMpesaHttpClient {
  c2bPayment(request: C2BPaymentRequest): Promise<C2BPaymentResponse>
  queryTransactionStatus(request: TransactionStatusRequest): Promise<TransactionStatusResponse>
  reverseTransaction(request: ReversalRequest): Promise<ReversalResponse>
}

export function createVodacomMpesaClient(config: VodacomMpesaConfig): VodacomMpesaHttpClient {
  const bearerToken = generateBearerToken(config.apiKey, config.publicKey)

  async function post<TReq, TRes>(path: string, body: TReq): Promise<TRes> {
    const url = `${config.baseUrl}${path}`

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 30_000)

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${bearerToken}`,
          'Origin': '*',
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      })

      if (!response.ok) {
        const text = await response.text().catch(() => response.statusText)
        throw new VodacomMpesaError(
          `HTTP ${response.status}: ${text}`,
          `HTTP-${response.status}`,
          text,
          undefined,
          response.status >= 500 || response.status === 429,
        )
      }

      const data = await response.json() as TRes & { output_ResponseCode?: string; output_ResponseDesc?: string }

      // Check for application-level errors in the response body
      if (data.output_ResponseCode && data.output_ResponseCode !== MpesaResponseCode.SUCCESS) {
        throw new VodacomMpesaError(
          `M-Pesa error ${data.output_ResponseCode}: ${data.output_ResponseDesc ?? 'Unknown'}`,
          data.output_ResponseCode,
          data.output_ResponseDesc ?? 'Unknown',
          undefined,
          isRetryableCode(data.output_ResponseCode),
        )
      }

      return data
    } finally {
      clearTimeout(timeout)
    }
  }

  async function get<TRes>(path: string, params?: Record<string, string>): Promise<TRes> {
    const url = new URL(`${config.baseUrl}${path}`)
    if (params) {
      for (const [key, value] of Object.entries(params)) {
        url.searchParams.set(key, value)
      }
    }

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 30_000)

    try {
      const response = await fetch(url.toString(), {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${bearerToken}`,
          'Origin': '*',
        },
        signal: controller.signal,
      })

      if (!response.ok) {
        const text = await response.text().catch(() => response.statusText)
        throw new VodacomMpesaError(
          `HTTP ${response.status}: ${text}`,
          `HTTP-${response.status}`,
          text,
          undefined,
          response.status >= 500 || response.status === 429,
        )
      }

      const data = await response.json() as TRes & { output_ResponseCode?: string; output_ResponseDesc?: string }

      if (data.output_ResponseCode && data.output_ResponseCode !== MpesaResponseCode.SUCCESS) {
        throw new VodacomMpesaError(
          `M-Pesa error ${data.output_ResponseCode}: ${data.output_ResponseDesc ?? 'Unknown'}`,
          data.output_ResponseCode,
          data.output_ResponseDesc ?? 'Unknown',
          undefined,
          isRetryableCode(data.output_ResponseCode),
        )
      }

      return data
    } finally {
      clearTimeout(timeout)
    }
  }

  return {
    async c2bPayment(request: C2BPaymentRequest): Promise<C2BPaymentResponse> {
      return post<C2BPaymentRequest, C2BPaymentResponse>(
        '/ipg/v2/vodacomTZN/c2bPayment/singleStage/',
        request,
      )
    },

    async queryTransactionStatus(request: TransactionStatusRequest): Promise<TransactionStatusResponse> {
      return get<TransactionStatusResponse>(
        '/ipg/v2/vodacomTZN/queryTransactionStatus/',
        {
          input_QueryReference: request.input_QueryReference,
          input_ServiceProviderCode: request.input_ServiceProviderCode,
          input_ThirdPartyConversationID: request.input_ThirdPartyConversationID,
        },
      )
    },

    async reverseTransaction(request: ReversalRequest): Promise<ReversalResponse> {
      return post<ReversalRequest, ReversalResponse>(
        '/ipg/v2/vodacomTZN/reversal/',
        request,
      )
    },
  }
}
