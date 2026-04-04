/**
 * @nzila/zonga-core — Events & Ticketing Service
 *
 * Pure business-logic functions for event ticketing:
 * inventory calculations, promo code validation, scan verification,
 * and settlement computations.
 *
 * Zero I/O — callers supply data, callers persist results.
 *
 * @module @nzila/zonga-core/services/events
 */

import type {
  TicketInventory,
  TicketHolder,
  PromoCode,
} from '../types/index'
import type { ScanResult } from '../enums'

// ── Inventory ───────────────────────────────────────────────────────────────

export interface InventoryCheck {
  readonly available: boolean
  readonly remainingQuantity: number
  readonly totalQuantity: number
  readonly soldQuantity: number
}

/**
 * Checks if sufficient inventory exists to fulfil an order quantity.
 */
export function checkInventory(
  inventory: TicketInventory,
  requestedQuantity: number,
): InventoryCheck {
  return {
    available: inventory.available >= requestedQuantity,
    remainingQuantity: inventory.available,
    totalQuantity: inventory.totalQuantity,
    soldQuantity: inventory.sold,
  }
}

// ── Promo Code Validation ───────────────────────────────────────────────────

export interface PromoValidationResult {
  readonly valid: boolean
  readonly discountAmount: number
  readonly error: string | null
}

/**
 * Validates a promo code and computes the discount.
 * Pure function — caller supplies current timestamp as `now`.
 */
export function validatePromoCode(
  promo: PromoCode,
  orderTotal: number,
  now: Date,
): PromoValidationResult {
  if (promo.currentUses >= promo.maxUses) {
    return { valid: false, discountAmount: 0, error: 'Promo code has reached its usage limit' }
  }

  const validFrom = new Date(promo.validFrom)
  const validUntil = new Date(promo.validUntil)

  if (now < validFrom) {
    return { valid: false, discountAmount: 0, error: 'Promo code is not yet active' }
  }
  if (now > validUntil) {
    return { valid: false, discountAmount: 0, error: 'Promo code has expired' }
  }

  let discountAmount: number

  switch (promo.type) {
    case 'percentage':
      discountAmount = Math.round(orderTotal * (promo.value / 100) * 100) / 100
      break
    case 'fixed_amount':
      discountAmount = Math.min(promo.value, orderTotal)
      break
    case 'free_ticket':
      discountAmount = orderTotal
      break
    default: {
      const _exhaustive: never = promo.type
      return { valid: false, discountAmount: 0, error: `Unknown promo type: ${_exhaustive}` }
    }
  }

  return { valid: true, discountAmount, error: null }
}

// ── Scan Verification ───────────────────────────────────────────────────────

export interface ScanVerificationResult {
  readonly result: ScanResult
  readonly message: string
  readonly holderName: string | null
}

/**
 * Verifies a ticket scan at the door.
 * Pure function — caller supplies ticket holder data.
 */
export function verifyTicketScan(
  holder: TicketHolder,
  eventId: string,
): ScanVerificationResult {
  if (holder.eventId !== eventId) {
    return { result: 'invalid', message: 'Ticket is for a different event', holderName: null }
  }

  if (holder.transferredTo) {
    return { result: 'transferred', message: 'Ticket has been transferred', holderName: holder.holderName }
  }

  if (holder.scanned) {
    return {
      result: 'already_scanned',
      message: `Already scanned at ${holder.scannedAt}`,
      holderName: holder.holderName,
    }
  }

  return { result: 'valid', message: 'Entry permitted', holderName: holder.holderName }
}

// ── Settlement Computation ──────────────────────────────────────────────────

export interface SettlementComputation {
  readonly grossTicketSales: number
  readonly totalRefunds: number
  readonly totalChargebacks: number
  readonly platformFees: number
  readonly netRevenue: number
  readonly currency: string
}

/**
 * Computes settlement figures for an event.
 */
export function computeEventSettlement(params: {
  ticketSalesTotal: number
  refundsTotal: number
  chargebacksTotal: number
  platformFeePercent: number
  currency: string
}): SettlementComputation {
  const { ticketSalesTotal, refundsTotal, chargebacksTotal, platformFeePercent, currency } = params
  const afterDeductions = ticketSalesTotal - refundsTotal - chargebacksTotal
  const platformFees = Math.round(afterDeductions * (platformFeePercent / 100) * 100) / 100
  const netRevenue = Math.round((afterDeductions - platformFees) * 100) / 100

  return {
    grossTicketSales: ticketSalesTotal,
    totalRefunds: refundsTotal,
    totalChargebacks: chargebacksTotal,
    platformFees,
    netRevenue,
    currency,
  }
}

// ── Order Total Computation ─────────────────────────────────────────────────

export interface OrderTotalResult {
  readonly subtotal: number
  readonly discount: number
  readonly total: number
  readonly itemCount: number
}

/**
 * Computes order total from items, optionally applying a promo discount.
 */
export function computeOrderTotal(
  items: readonly { quantity: number; unitPrice: number }[],
  discount: number = 0,
): OrderTotalResult {
  const subtotal = items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0)
  const itemCount = items.reduce((sum, item) => sum + item.quantity, 0)
  const total = Math.max(0, Math.round((subtotal - discount) * 100) / 100)

  return { subtotal, discount, total, itemCount }
}
