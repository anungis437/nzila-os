/**
 * @nzila/commerce-core — Zod Schemas (API DTO Boundary)
 *
 * Input/output validation schemas for commerce API endpoints.
 * These schemas are the boundary between external inputs and domain types.
 *
 * @module @nzila/commerce-core/schemas
 */
import { z } from 'zod'
import {
  QuoteStatus,
  OrderStatus,
  PricingTier,
  ApprovalDecision,
  CancellationReason,
  DisputeReason,
} from '../enums'

// ── Shared ──────────────────────────────────────────────────────────────────

export const uuidSchema = z.guid()

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
})

export const idempotencyKeySchema = z.string().min(1).max(128)

// ── Customer ────────────────────────────────────────────────────────────────

export const customerAddressSchema = z.object({
  line1: z.string().min(1),
  line2: z.string().optional(),
  city: z.string().min(1),
  province: z.string().min(1),
  postalCode: z.string().min(1),
  country: z.string().length(2),
})

export const createCustomerSchema = z.object({
  name: z.string().min(1).max(300),
  email: z.string().email().nullable().default(null),
  phone: z.string().max(30).nullable().default(null),
  address: customerAddressSchema.nullable().default(null),
  externalIds: z.record(z.string(), z.string()).prefault({}),
})

// ── Opportunity ─────────────────────────────────────────────────────────────

export const createOpportunitySchema = z.object({
  customerId: uuidSchema,
  title: z.string().min(1).max(300),
  estimatedValue: z.number().nonnegative().nullable().default(null),
  notes: z.string().max(2000).nullable().default(null),
})

// ── Quote ───────────────────────────────────────────────────────────────────

export const quoteLineInputSchema = z.object({
  itemName: z.string().min(1).max(300),
  itemSku: z.string().max(100).nullable().default(null),
  quantity: z.number().int().min(1),
  unitCost: z.number().nonnegative(),
  discountPercent: z.number().min(0).max(100).default(0),
  sortOrder: z.number().int().min(0).default(0),
})

export const createQuoteSchema = z.object({
  customerId: uuidSchema,
  opportunityId: uuidSchema.nullable().default(null),
  lines: z.array(quoteLineInputSchema).min(1),
  idempotencyKey: idempotencyKeySchema.optional(),
})

const pricingTierValues = [PricingTier.BUDGET, PricingTier.STANDARD, PricingTier.PREMIUM] as const
export const priceQuoteSchema = z.object({
  tier: z.enum(pricingTierValues as unknown as [string, ...string[]]),
  boxCount: z.number().int().min(1).optional(),
})

const quoteTransitionValues = [
  QuoteStatus.SENT,
  QuoteStatus.ACCEPTED,
  QuoteStatus.DECLINED,
  QuoteStatus.CANCELLED,
  QuoteStatus.REVISED,
] as const
export const transitionQuoteSchema = z.object({
  targetStatus: z.enum(quoteTransitionValues as unknown as [string, ...string[]]),
  reason: z.string().max(1000).optional(),
  idempotencyKey: idempotencyKeySchema.optional(),
})

// ── Approval ────────────────────────────────────────────────────────────────

const approvalValues = [ApprovalDecision.APPROVED, ApprovalDecision.REJECTED] as const
export const approvalDecisionSchema = z.object({
  decision: z.enum(approvalValues as unknown as [string, ...string[]]),
  reason: z.string().min(1).max(1000),
})

// ── Order ───────────────────────────────────────────────────────────────────

const orderTransitionValues = [
  OrderStatus.CONFIRMED,
  OrderStatus.FULFILLMENT,
  OrderStatus.SHIPPED,
  OrderStatus.DELIVERED,
  OrderStatus.COMPLETED,
  OrderStatus.CANCELLED,
  OrderStatus.RETURN_REQUESTED,
] as const
export const transitionOrderSchema = z.object({
  targetStatus: z.enum(orderTransitionValues as unknown as [string, ...string[]]),
  reason: z.string().max(1000).optional(),
  idempotencyKey: idempotencyKeySchema.optional(),
})

// ── Invoice ─────────────────────────────────────────────────────────────────

export const recordPaymentSchema = z.object({
  amount: z.number().positive(),
  method: z.string().min(1).max(50),
  reference: z.string().max(200).nullable().default(null),
  paidAt: z.string().datetime(),
  idempotencyKey: idempotencyKeySchema.optional(),
})

const disputeReasonValues = [
  DisputeReason.INCORRECT_AMOUNT,
  DisputeReason.GOODS_NOT_RECEIVED,
  DisputeReason.DAMAGED_GOODS,
  DisputeReason.SERVICE_ISSUE,
  DisputeReason.OTHER,
] as const
export const createDisputeSchema = z.object({
  invoiceId: uuidSchema,
  reason: z.enum(disputeReasonValues as unknown as [string, ...string[]]),
  description: z.string().min(1).max(2000),
})

export const createRefundSchema = z.object({
  paymentId: uuidSchema,
  invoiceId: uuidSchema,
  amount: z.number().positive(),
  reason: z.string().min(1).max(1000),
})

export const createCreditNoteSchema = z.object({
  invoiceId: uuidSchema,
  amount: z.number().positive(),
  reason: z.string().min(1).max(1000),
})

// ── Cancellation ────────────────────────────────────────────────────────────

const cancellationReasonValues = [
  CancellationReason.CUSTOMER_REQUEST,
  CancellationReason.PRICING_ERROR,
  CancellationReason.OUT_OF_STOCK,
  CancellationReason.DUPLICATE,
  CancellationReason.INTERNAL,
  CancellationReason.OTHER,
] as const
export const cancellationSchema = z.object({
  reason: z.enum(cancellationReasonValues as unknown as [string, ...string[]]),
  notes: z.string().max(1000).optional(),
})

// ── Inferred types (for convenience) ────────────────────────────────────────

export type CreateCustomerInput = z.infer<typeof createCustomerSchema>
export type CreateOpportunityInput = z.infer<typeof createOpportunitySchema>
export type CreateQuoteInput = z.infer<typeof createQuoteSchema>
export type PriceQuoteInput = z.infer<typeof priceQuoteSchema>
export type TransitionQuoteInput = z.infer<typeof transitionQuoteSchema>
export type ApprovalDecisionInput = z.infer<typeof approvalDecisionSchema>
export type TransitionOrderInput = z.infer<typeof transitionOrderSchema>
export type RecordPaymentInput = z.infer<typeof recordPaymentSchema>
export type CreateDisputeInput = z.infer<typeof createDisputeSchema>
export type CreateRefundInput = z.infer<typeof createRefundSchema>
export type CreateCreditNoteInput = z.infer<typeof createCreditNoteSchema>
export type CancellationInput = z.infer<typeof cancellationSchema>
