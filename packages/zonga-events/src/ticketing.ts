/**
 * @nzila/zonga-events — Ticketing Engine
 *
 * Ticket ordering, validation, promo code application, and transfer logic.
 */
import type {
  TicketHolder,
  TicketOrder,
  TicketTransfer,
  PromoCode,
  RefundRequest,
  TicketTier,
  PromoCodeType,
  RefundStatus,
  TransferStatus,
} from './types'
import { TicketStatus } from './types'

// ── Promo Code Validation ─────────────────────────────────────────────────

export interface PromoValidation {
  readonly valid: boolean
  readonly discountAmount: number
  readonly error: string | null
}

/**
 * Validate and compute discount for a promo code.
 */
export function validatePromoCode(
  promo: PromoCode,
  orderSubtotal: number,
  requestedTier: TicketTier,
  now?: Date,
): PromoValidation {
  const currentTime = now ?? new Date()

  if (!promo.isActive) {
    return { valid: false, discountAmount: 0, error: 'Promo code is inactive' }
  }

  if (currentTime > promo.expiresAt) {
    return { valid: false, discountAmount: 0, error: 'Promo code has expired' }
  }

  if (promo.usedCount >= promo.maxUses) {
    return { valid: false, discountAmount: 0, error: 'Promo code usage limit reached' }
  }

  if (promo.applicableTiers.length > 0 && !promo.applicableTiers.includes(requestedTier)) {
    return {
      valid: false,
      discountAmount: 0,
      error: `Promo code not valid for ${requestedTier} tier`,
    }
  }

  let discountAmount: number
  switch (promo.type) {
    case 'percentage':
      discountAmount = Math.round((orderSubtotal * promo.value) / 100 * 100) / 100
      break
    case 'fixed_amount':
      discountAmount = Math.min(promo.value, orderSubtotal)
      break
    case 'free_ticket':
      discountAmount = orderSubtotal
      break
    default:
      return { valid: false, discountAmount: 0, error: 'Unknown promo code type' }
  }

  return { valid: true, discountAmount, error: null }
}

// ── Order Computation ─────────────────────────────────────────────────────

export interface OrderTotal {
  readonly subtotal: number
  readonly discount: number
  readonly total: number
  readonly itemCount: number
}

/**
 * Compute order total from items with optional discount.
 */
export function computeOrderTotal(
  items: readonly { price: number; quantity: number }[],
  discount: number = 0,
): OrderTotal {
  const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0)
  const itemCount = items.reduce((sum, item) => sum + item.quantity, 0)
  const effectiveDiscount = Math.min(discount, subtotal)
  const total = Math.round((subtotal - effectiveDiscount) * 100) / 100

  return { subtotal, discount: effectiveDiscount, total, itemCount }
}

// ── Transfer Rules ────────────────────────────────────────────────────────

export interface TransferValidation {
  readonly allowed: boolean
  readonly error: string | null
}

/**
 * Validate if a ticket can be transferred.
 */
export function validateTransfer(
  holder: TicketHolder,
  existingTransfers: readonly TicketTransfer[],
  maxTransfersPerTicket: number = 3,
): TransferValidation {
  if (holder.status !== TicketStatus.CONFIRMED) {
    return { allowed: false, error: `Cannot transfer ticket in ${holder.status} status` }
  }

  const activeTransfers = existingTransfers.filter(
    (t) => t.ticketId === holder.id && (t.status === 'pending' || t.status === 'accepted'),
  )

  if (activeTransfers.length >= maxTransfersPerTicket) {
    return { allowed: false, error: `Maximum ${maxTransfersPerTicket} transfers per ticket reached` }
  }

  // Cannot transfer if already has a pending transfer
  const pendingTransfer = existingTransfers.find(
    (t) => t.ticketId === holder.id && t.status === 'pending',
  )
  if (pendingTransfer) {
    return { allowed: false, error: 'Ticket already has a pending transfer' }
  }

  return { allowed: true, error: null }
}

// ── Refund Eligibility ────────────────────────────────────────────────────

export interface RefundEligibility {
  readonly eligible: boolean
  readonly maxRefundAmount: number
  readonly reason: string | null
}

/**
 * Check refund eligibility based on event status and timing.
 */
export function checkRefundEligibility(
  order: TicketOrder,
  eventStartsAt: Date,
  eventStatus: string,
  now?: Date,
): RefundEligibility {
  const currentTime = now ?? new Date()

  if (order.status === 'refunded') {
    return { eligible: false, maxRefundAmount: 0, reason: 'Order already refunded' }
  }

  if (order.status === 'cancelled') {
    return { eligible: false, maxRefundAmount: 0, reason: 'Order is cancelled' }
  }

  // Event cancelled — full refund always
  if (eventStatus === 'cancelled') {
    return { eligible: true, maxRefundAmount: order.total, reason: null }
  }

  // Event postponed — full refund available
  if (eventStatus === 'postponed') {
    return { eligible: true, maxRefundAmount: order.total, reason: null }
  }

  // Event already happened — no refund
  if (currentTime > eventStartsAt) {
    return { eligible: false, maxRefundAmount: 0, reason: 'Event has already started' }
  }

  // More than 48h before event — full refund
  const hoursUntilEvent = (eventStartsAt.getTime() - currentTime.getTime()) / (1000 * 60 * 60)
  if (hoursUntilEvent > 48) {
    return { eligible: true, maxRefundAmount: order.total, reason: null }
  }

  // 24-48h before event — 50% refund
  if (hoursUntilEvent > 24) {
    return {
      eligible: true,
      maxRefundAmount: Math.round(order.total * 0.5 * 100) / 100,
      reason: 'Partial refund (50%) — less than 48h before event',
    }
  }

  // Less than 24h — no refund
  return { eligible: false, maxRefundAmount: 0, reason: 'No refund within 24h of event' }
}
