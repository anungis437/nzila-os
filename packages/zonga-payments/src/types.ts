/**
 * @nzila/zonga-payments — Types & Schemas
 *
 * Abstract payment layer: provider-agnostic payment intents,
 * capture, refund, and payout. Designed for Stripe, mobile money
 * (M-Pesa, MTN MoMo), cards, and wallet.
 */
import { z } from 'zod'

// ── Enums ─────────────────────────────────────────────────────────────────

export const PaymentMethod = {
  CARD: 'card',
  MOBILE_MONEY: 'mobile_money',
  BANK_TRANSFER: 'bank_transfer',
  WALLET: 'wallet',
  CRYPTO: 'crypto',
  USSD: 'ussd',
} as const
export type PaymentMethod = (typeof PaymentMethod)[keyof typeof PaymentMethod]

export const PaymentProvider = {
  STRIPE: 'stripe',
  MPESA: 'mpesa',
  MTN_MOMO: 'mtn_momo',
  AIRTEL_MONEY: 'airtel_money',
  FLUTTERWAVE: 'flutterwave',
  PAYSTACK: 'paystack',
  INTERNAL_WALLET: 'internal_wallet',
} as const
export type PaymentProvider = (typeof PaymentProvider)[keyof typeof PaymentProvider]

export const PaymentIntentStatus = {
  CREATED: 'created',
  PROCESSING: 'processing',
  REQUIRES_ACTION: 'requires_action',
  CAPTURED: 'captured',
  FAILED: 'failed',
  CANCELLED: 'cancelled',
  REFUNDED: 'refunded',
  PARTIALLY_REFUNDED: 'partially_refunded',
} as const
export type PaymentIntentStatus = (typeof PaymentIntentStatus)[keyof typeof PaymentIntentStatus]

export const PayoutStatus = {
  PENDING: 'pending',
  PROCESSING: 'processing',
  COMPLETED: 'completed',
  FAILED: 'failed',
  REVERSED: 'reversed',
} as const
export type PayoutStatus = (typeof PayoutStatus)[keyof typeof PayoutStatus]

export const RefundStatus = {
  PENDING: 'pending',
  PROCESSING: 'processing',
  COMPLETED: 'completed',
  FAILED: 'failed',
} as const
export type RefundStatus = (typeof RefundStatus)[keyof typeof RefundStatus]

// ── Interfaces ────────────────────────────────────────────────────────────

export interface PaymentIntent {
  readonly id: string
  readonly orderId: string
  readonly userId: string
  readonly amount: number
  readonly currency: string
  readonly method: PaymentMethod
  readonly provider: PaymentProvider
  readonly status: PaymentIntentStatus
  readonly providerIntentId: string | null
  readonly metadata: Record<string, unknown>
  readonly idempotencyKey: string
  readonly createdAt: Date
  readonly updatedAt: Date
  readonly capturedAt: Date | null
  readonly expiresAt: Date
}

export interface PaymentCapture {
  readonly intentId: string
  readonly capturedAmount: number
  readonly providerTransactionId: string
  readonly receiptUrl: string | null
  readonly capturedAt: Date
}

export interface PaymentRefund {
  readonly id: string
  readonly intentId: string
  readonly amount: number
  readonly reason: string
  readonly status: RefundStatus
  readonly providerRefundId: string | null
  readonly requestedAt: Date
  readonly completedAt: Date | null
}

export interface PayoutInstruction {
  readonly id: string
  readonly recipientId: string
  readonly amount: number
  readonly currency: string
  readonly method: PaymentMethod
  readonly provider: PaymentProvider
  readonly destination: PayoutDestination
  readonly status: PayoutStatus
  readonly providerPayoutId: string | null
  readonly batchId: string | null
  readonly scheduledAt: Date
  readonly completedAt: Date | null
}

export interface PayoutDestination {
  readonly type: 'bank_account' | 'mobile_wallet' | 'crypto_wallet' | 'internal_wallet'
  readonly accountIdentifier: string // masked for security
  readonly accountName: string
  readonly bankCode?: string
  readonly routingNumber?: string
  readonly mobileNumber?: string
}

export interface MobileMoneyRequest {
  readonly phoneNumber: string
  readonly provider: 'mpesa' | 'mtn_momo' | 'airtel_money'
  readonly amount: number
  readonly currency: string
  readonly reference: string
  readonly callbackUrl: string
}

export interface PaymentWebhookEvent {
  readonly id: string
  readonly provider: PaymentProvider
  readonly eventType: string
  readonly payload: Record<string, unknown>
  readonly signature: string
  readonly receivedAt: Date
  readonly processed: boolean
}

// ── Provider Adapter Interface ────────────────────────────────────────────

/**
 * Abstract payment provider adapter.
 * Each payment provider (Stripe, M-Pesa, etc.) implements this interface.
 */
export interface PaymentProviderAdapter {
  readonly provider: PaymentProvider
  createIntent(params: CreateIntentParams): Promise<PaymentIntent>
  captureIntent(intentId: string): Promise<PaymentCapture>
  refundIntent(intentId: string, amount: number, reason: string): Promise<PaymentRefund>
  createPayout(instruction: PayoutInstruction): Promise<PayoutInstruction>
  verifyWebhook(signature: string, payload: string): boolean
}

export interface CreateIntentParams {
  readonly orderId: string
  readonly userId: string
  readonly amount: number
  readonly currency: string
  readonly method: PaymentMethod
  readonly metadata?: Record<string, unknown>
  readonly idempotencyKey: string
}

// ── Zod Schemas ───────────────────────────────────────────────────────────

export const CreatePaymentIntentSchema = z.object({
  orderId: z.string().min(1),
  userId: z.string().min(1),
  amount: z.number().positive(),
  currency: z.string().length(3),
  method: z.enum(['card', 'mobile_money', 'bank_transfer', 'wallet', 'crypto', 'ussd']),
  provider: z.enum(['stripe', 'mpesa', 'mtn_momo', 'airtel_money', 'flutterwave', 'paystack', 'internal_wallet']),
  idempotencyKey: z.string().min(1),
  metadata: z.record(z.unknown()).default({}),
})

export const RequestRefundSchema = z.object({
  intentId: z.string().min(1),
  amount: z.number().positive(),
  reason: z.string().min(1),
})

export const CreatePayoutSchema = z.object({
  recipientId: z.string().min(1),
  amount: z.number().positive(),
  currency: z.string().length(3),
  method: z.enum(['card', 'mobile_money', 'bank_transfer', 'wallet', 'crypto', 'ussd']),
  provider: z.enum(['stripe', 'mpesa', 'mtn_momo', 'airtel_money', 'flutterwave', 'paystack', 'internal_wallet']),
  destination: z.object({
    type: z.enum(['bank_account', 'mobile_wallet', 'crypto_wallet', 'internal_wallet']),
    accountIdentifier: z.string().min(1),
    accountName: z.string().min(1),
    bankCode: z.string().optional(),
    routingNumber: z.string().optional(),
    mobileNumber: z.string().optional(),
  }),
  scheduledAt: z.coerce.date().optional(),
})

export const MobileMoneyRequestSchema = z.object({
  phoneNumber: z.string().min(9).max(15),
  provider: z.enum(['mpesa', 'mtn_momo', 'airtel_money']),
  amount: z.number().positive(),
  currency: z.string().length(3),
  reference: z.string().min(1),
  callbackUrl: z.string().url(),
})
