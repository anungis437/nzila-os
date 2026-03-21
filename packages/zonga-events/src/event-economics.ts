/**
 * @nzila/zonga-events — Event Economics
 *
 * Configurable fee models, ticket class economics, refund modeling,
 * and tiered event pricing. Wraps the settlement engine with
 * commercial-grade fee variants.
 *
 * All monetary amounts are in integer minor units (cents).
 */
import type { FeeRule, SplitRule, Currency, RevenueSource } from '@nzila/zonga-economics'
import { FeeType } from '@nzila/zonga-economics'
import type { TicketTier, TierCapacity } from './types'

// ── Fee Model ─────────────────────────────────────────────────────────────

export interface EventFeeModel {
  readonly id: string
  readonly name: string
  readonly platformFeePercent: number
  readonly processingFlatMinor: number
  readonly processingPercent: number
  readonly currency: string
  readonly isDefault: boolean
}

/**
 * Default event fee model.
 * Platform takes 7.5% of ticket revenue (per commercial spec).
 * Processing: 1.5% + 10¢ for mobile money (Africa-competitive).
 */
export const DEFAULT_EVENT_FEE_MODEL: EventFeeModel = {
  id: 'evtfee_default',
  name: 'Standard Event',
  platformFeePercent: 7.5,
  processingFlatMinor: 10,
  processingPercent: 1.5,
  currency: 'USD',
  isDefault: true,
}

/**
 * Premium event fee model — lower platform cut for high-volume organizers.
 */
export const PREMIUM_EVENT_FEE_MODEL: EventFeeModel = {
  id: 'evtfee_premium',
  name: 'Premium Event',
  platformFeePercent: 5.0,
  processingFlatMinor: 10,
  processingPercent: 1.5,
  currency: 'USD',
  isDefault: false,
}

/**
 * Convert an EventFeeModel to FeeRule[] compatible with the economics engine.
 */
export function feeModelToRules(model: EventFeeModel, orgId: string = '*'): FeeRule[] {
  const effectiveFrom = new Date('2024-01-01')
  return [
    {
      id: `${model.id}_platform`,
      orgId,
      feeType: FeeType.PLATFORM_COMMISSION,
      revenueSource: 'ticket_sale' as RevenueSource,
      ratePercent: model.platformFeePercent,
      flatAmount: 0,
      currency: model.currency as Currency,
      minAmount: 0,
      maxAmount: null,
      isActive: true,
      effectiveFrom,
      effectiveUntil: null,
    },
    {
      id: `${model.id}_processing`,
      orgId,
      feeType: FeeType.PAYMENT_PROCESSING,
      revenueSource: 'ticket_sale' as RevenueSource,
      ratePercent: model.processingPercent,
      flatAmount: model.processingFlatMinor / 100,
      currency: model.currency as Currency,
      minAmount: 0,
      maxAmount: null,
      isActive: true,
      effectiveFrom,
      effectiveUntil: null,
    },
  ]
}

// ── Ticket Class Economics ────────────────────────────────────────────────

export interface TicketClassConfig {
  readonly tier: TicketTier
  readonly basePriceMinor: number
  readonly currency: string
  readonly maxQuantity: number
  readonly salesStartAt: Date
  readonly salesEndAt: Date
  readonly earlyBirdDiscountPercent: number
  readonly earlyBirdEndAt: Date | null
}

export interface TicketClassRevenue {
  readonly tier: TicketTier
  readonly unitsSold: number
  readonly grossRevenueMinor: number
  readonly averagePriceMinor: number
  readonly discountsAppliedMinor: number
}

/**
 * Compute revenue projection per ticket class from capacity data.
 */
export function computeTicketClassRevenue(
  tiers: readonly TierCapacity[],
): readonly TicketClassRevenue[] {
  return tiers.map((t) => {
    const unitsSold = t.soldQuantity
    const grossRevenueMinor = Math.round(t.price * 100 * unitsSold)
    return {
      tier: t.tier,
      unitsSold,
      grossRevenueMinor,
      averagePriceMinor: unitsSold > 0 ? Math.round(grossRevenueMinor / unitsSold) : 0,
      discountsAppliedMinor: 0,
    }
  })
}

// ── Refund Modeling ───────────────────────────────────────────────────────

export interface RefundPolicy {
  readonly eventId: string
  readonly fullRefundBeforeHours: number
  readonly partialRefundPercent: number
  readonly partialRefundBeforeHours: number
  readonly noRefundAfterHours: number
  readonly cancellationFullRefund: boolean
}

export const DEFAULT_REFUND_POLICY: Omit<RefundPolicy, 'eventId'> = {
  fullRefundBeforeHours: 48,
  partialRefundPercent: 50,
  partialRefundBeforeHours: 24,
  noRefundAfterHours: 0,
  cancellationFullRefund: true,
}

export interface RefundCalculation {
  readonly eligible: boolean
  readonly refundAmountMinor: number
  readonly originalAmountMinor: number
  readonly refundPercent: number
  readonly reason: string
}

/**
 * Calculate refund amount based on event timing and policy.
 */
export function calculateRefund(params: {
  originalAmountMinor: number
  eventStartsAt: Date
  requestedAt: Date
  eventCancelled: boolean
  policy: RefundPolicy
}): RefundCalculation {
  const { originalAmountMinor, eventStartsAt, requestedAt, eventCancelled, policy } = params

  if (eventCancelled && policy.cancellationFullRefund) {
    return {
      eligible: true,
      refundAmountMinor: originalAmountMinor,
      originalAmountMinor,
      refundPercent: 100,
      reason: 'Event cancelled — full refund',
    }
  }

  const hoursUntilEvent = (eventStartsAt.getTime() - requestedAt.getTime()) / (1000 * 60 * 60)

  if (hoursUntilEvent >= policy.fullRefundBeforeHours) {
    return {
      eligible: true,
      refundAmountMinor: originalAmountMinor,
      originalAmountMinor,
      refundPercent: 100,
      reason: `Refund requested ${Math.round(hoursUntilEvent)}h before event — full refund`,
    }
  }

  if (hoursUntilEvent >= policy.partialRefundBeforeHours) {
    const refundAmountMinor = Math.floor((originalAmountMinor * policy.partialRefundPercent) / 100)
    return {
      eligible: true,
      refundAmountMinor,
      originalAmountMinor,
      refundPercent: policy.partialRefundPercent,
      reason: `Refund requested ${Math.round(hoursUntilEvent)}h before event — ${policy.partialRefundPercent}% refund`,
    }
  }

  return {
    eligible: false,
    refundAmountMinor: 0,
    originalAmountMinor,
    refundPercent: 0,
    reason: `Refund requested ${Math.round(hoursUntilEvent)}h before event — outside refund window`,
  }
}

// ── Event Revenue Summary ─────────────────────────────────────────────────

export interface EventRevenueSummary {
  readonly eventId: string
  readonly ticketClassRevenue: readonly TicketClassRevenue[]
  readonly grossRevenueMinor: number
  readonly totalRefundsMinor: number
  readonly netRevenueMinor: number
  readonly platformFeesMinor: number
  readonly processingFeesMinor: number
  readonly distributableMinor: number
}

/**
 * Compute a full event revenue summary with fees applied.
 */
export function computeEventRevenueSummary(params: {
  eventId: string
  tiers: readonly TierCapacity[]
  totalRefundsMinor: number
  feeModel?: EventFeeModel
}): EventRevenueSummary {
  const { eventId, tiers, totalRefundsMinor, feeModel = DEFAULT_EVENT_FEE_MODEL } = params

  const ticketClassRevenue = computeTicketClassRevenue(tiers)
  const grossRevenueMinor = ticketClassRevenue.reduce((s, t) => s + t.grossRevenueMinor, 0)
  const netRevenueMinor = grossRevenueMinor - totalRefundsMinor

  const platformFeesMinor = Math.floor((netRevenueMinor * feeModel.platformFeePercent) / 100)
  const processingFeesMinor =
    Math.floor((netRevenueMinor * feeModel.processingPercent) / 100) + feeModel.processingFlatMinor

  const distributableMinor = netRevenueMinor - platformFeesMinor - processingFeesMinor

  return {
    eventId,
    ticketClassRevenue,
    grossRevenueMinor,
    totalRefundsMinor,
    netRevenueMinor,
    platformFeesMinor,
    processingFeesMinor,
    distributableMinor,
  }
}
