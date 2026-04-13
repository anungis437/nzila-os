/**
 * @nzila/zonga-monetization — Types
 *
 * Canonical schema for Zonga monetization: revenue streams, payouts,
 * platform fees, and settlement tracking.
 */
import { z } from 'zod'

// ── Revenue Stream Types ─────────────────────────────────

export const RevenueStreamType = {
  STREAMING: 'streaming',
  EVENT_TICKET: 'event_ticket',
  FAN_PAYMENT: 'fan_payment',
  MERCHANDISE: 'merchandise',
  LICENSING: 'licensing',
  SUBSCRIPTION: 'subscription',
} as const
export type RevenueStreamType = (typeof RevenueStreamType)[keyof typeof RevenueStreamType]

export const PayoutStatus = {
  PENDING: 'pending',
  PROCESSING: 'processing',
  COMPLETED: 'completed',
  FAILED: 'failed',
} as const
export type PayoutStatus = (typeof PayoutStatus)[keyof typeof PayoutStatus]

// ── Core Schemas ─────────────────────────────────────────

export const RevenueRecordSchema = z.object({
  id: z.string().uuid(),
  orgId: z.string().uuid(),
  creatorId: z.string().uuid(),
  revenueStreamType: z.nativeEnum(RevenueStreamType),
  grossAmount: z.number().nonnegative(),
  platformFee: z.number().nonnegative(),
  netAmount: z.number().nonnegative(),
  currency: z.string().length(3),
  eventId: z.string().uuid().optional(),
  metadata: z.record(z.unknown()).optional(),
  recordedAt: z.string().datetime(),
})
export type RevenueRecord = z.infer<typeof RevenueRecordSchema>

export const PayoutRecordSchema = z.object({
  id: z.string().uuid(),
  orgId: z.string().uuid(),
  creatorId: z.string().uuid(),
  amount: z.number().positive(),
  currency: z.string().length(3),
  status: z.nativeEnum(PayoutStatus),
  revenueRecordIds: z.array(z.string().uuid()),
  initiatedAt: z.string().datetime(),
  completedAt: z.string().datetime().optional(),
})
export type PayoutRecord = z.infer<typeof PayoutRecordSchema>

export const PlatformFeeConfigSchema = z.object({
  streamingRate: z.number().min(0).max(1).default(0.30),
  eventTicketRate: z.number().min(0).max(1).default(0.10),
  fanPaymentRate: z.number().min(0).max(1).default(0.05),
  merchandiseRate: z.number().min(0).max(1).default(0.15),
  licensingRate: z.number().min(0).max(1).default(0.20),
  subscriptionRate: z.number().min(0).max(1).default(0.25),
})
export type PlatformFeeConfig = z.infer<typeof PlatformFeeConfigSchema>

// ── Analytics Types ──────────────────────────────────────

export interface CreatorRevenueSnapshot {
  creatorId: string
  totalGross: number
  totalNet: number
  totalFees: number
  byStream: Record<RevenueStreamType, number>
  periodStart: string
  periodEnd: string
}

export interface EventRevenueSnapshot {
  eventId: string
  ticketRevenue: number
  fanPayments: number
  merchandiseRevenue: number
  totalGross: number
  platformTake: number
}

export interface PlatformTakeRate {
  period: string
  totalGross: number
  totalFees: number
  takeRate: number
}
