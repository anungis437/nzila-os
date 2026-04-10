/**
 * @nzila/zonga-payments — Vodacom M-Pesa Types
 *
 * OpenAPI-based M-Pesa integration types for Vodacom markets
 * (Tanzania, Mozambique, Lesotho, DRC).
 *
 * Auth: API Key + RSA Public Key → encrypted Bearer token
 * Scope: C2B collection, transaction query, reversal only (no payouts in v1)
 *
 * @module @nzila/zonga-payments/adapters/vodacom-mpesa.types
 */

import { z } from 'zod'

// ── Config ──────────────────────────────────────────────────────────────────

export interface VodacomMpesaConfig {
  /** Base URL for the OpenAPI gateway (sandbox or production) */
  readonly baseUrl: string
  /** API Key provided by Vodacom OpenAPI portal */
  readonly apiKey: string
  /** RSA public key (PEM) for encrypting the API key into a bearer token */
  readonly publicKey: string
  /** Service provider code (short code assigned by Vodacom) */
  readonly serviceProviderCode: string
  /** Market identifier for multi-country support */
  readonly market: 'TZ' | 'MZ' | 'LS' | 'CD'
  /** Callback URL for async payment notifications */
  readonly callbackUrl?: string
}

export const VodacomMpesaConfigSchema = z.object({
  baseUrl: z.string().url(),
  apiKey: z.string().min(1),
  publicKey: z.string().min(1),
  serviceProviderCode: z.string().min(1),
  market: z.enum(['TZ', 'MZ', 'LS', 'CD']),
  callbackUrl: z.string().url().optional(),
})

// ── OpenAPI Request / Response Types ────────────────────────────────────────

/** C2B Single-Stage Payment Request */
export interface C2BPaymentRequest {
  input_TransactionReference: string
  input_CustomerMSISDN: string
  input_Amount: string
  input_ThirdPartyConversationID: string
  input_ServiceProviderCode: string
  input_PurchaseItemDesc: string
}

/** C2B Payment Response */
export interface C2BPaymentResponse {
  output_ResponseCode: string
  output_ResponseDesc: string
  output_TransactionID: string
  output_ConversationID: string
  output_ThirdPartyConversationID: string
}

/** Transaction Status Query Request */
export interface TransactionStatusRequest {
  input_QueryReference: string
  input_ServiceProviderCode: string
  input_ThirdPartyConversationID: string
}

/** Transaction Status Response */
export interface TransactionStatusResponse {
  output_ResponseCode: string
  output_ResponseDesc: string
  output_ResponseTransactionStatus: string
  output_ConversationID: string
  output_ThirdPartyConversationID: string
}

/** Reversal Request */
export interface ReversalRequest {
  input_ReversalAmount: string
  input_TransactionID: string
  input_ThirdPartyConversationID: string
  input_ServiceProviderCode: string
}

/** Reversal Response */
export interface ReversalResponse {
  output_ResponseCode: string
  output_ResponseDesc: string
  output_TransactionID: string
  output_ConversationID: string
  output_ThirdPartyConversationID: string
}

// ── Response Codes ──────────────────────────────────────────────────────────

/**
 * OpenAPI M-Pesa response codes.
 * INS-0 = success; all others are errors.
 */
export const MpesaResponseCode = {
  SUCCESS: 'INS-0',
  INTERNAL_ERROR: 'INS-1',
  INVALID_API_KEY: 'INS-2',
  INSUFFICIENT_BALANCE: 'INS-5',
  TRANSACTION_FAILED: 'INS-6',
  INVALID_MARKET: 'INS-9',
  DUPLICATE_TRANSACTION: 'INS-10',
  INVALID_MSISDN: 'INS-13',
  TIMEOUT: 'INS-15',
  TRANSACTION_NOT_FOUND: 'INS-17',
  INVALID_AMOUNT: 'INS-20',
  SERVICE_UNAVAILABLE: 'INS-996',
  REQUEST_THROTTLED: 'INS-997',
  GENERAL_ERROR: 'INS-2001',
} as const

export type MpesaResponseCodeValue = typeof MpesaResponseCode[keyof typeof MpesaResponseCode]

// ── Error Types ─────────────────────────────────────────────────────────────

export class VodacomMpesaError extends Error {
  constructor(
    message: string,
    public readonly responseCode: string,
    public readonly responseDesc: string,
    public readonly conversationId?: string,
    public readonly isRetryable: boolean = false,
  ) {
    super(message)
    this.name = 'VodacomMpesaError'
  }
}

/**
 * Determine if a response code indicates a retryable failure.
 */
export function isRetryableCode(code: string): boolean {
  return code === MpesaResponseCode.TIMEOUT
    || code === MpesaResponseCode.SERVICE_UNAVAILABLE
    || code === MpesaResponseCode.REQUEST_THROTTLED
    || code === MpesaResponseCode.INTERNAL_ERROR
}

// ── Currency/Market Mapping ─────────────────────────────────────────────────

export const MARKET_CURRENCY: Record<string, string> = {
  TZ: 'TZS',
  MZ: 'MZN',
  LS: 'LSL',
  CD: 'CDF',
}

export const CURRENCY_MARKET: Record<string, string> = {
  TZS: 'TZ',
  MZN: 'MZ',
  LSL: 'LS',
  CDF: 'CD',
  MWK: 'MW',
}
