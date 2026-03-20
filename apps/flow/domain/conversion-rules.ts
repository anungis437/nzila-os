/**
 * Flow — Entity Conversion Rules
 *
 * Defines when and how entities can be converted/promoted:
 *   Quote → Order → PO → Production → Shipment → Invoice
 *
 * Each rule is a pure predicate — no side effects or DB calls.
 */
import type { Quote, Order, PurchaseOrder } from './entities'
import type { InvariantResult } from './invariants'

// ── Types ──────────────────────────────────────────────────────────────────

export interface ConversionPolicy {
  name: string
  from: string
  to: string
  requiredStatus: string[]
  check: () => InvariantResult
}

function pass(): InvariantResult {
  return { valid: true, violations: [] }
}

function fail(...violations: string[]): InvariantResult {
  return { valid: false, violations }
}

function merge(...results: InvariantResult[]): InvariantResult {
  const violations = results.flatMap(r => r.violations)
  return { valid: violations.length === 0, violations }
}

// ── Quote → Order ──────────────────────────────────────────────────────────

export function canConvertQuoteToOrder(
  quote: Pick<Quote, 'status' | 'customer_id' | 'total_amount'>,
  lineCount: number,
): InvariantResult {
  return merge(
    ['ACCEPTED', 'READY_FOR_PO'].includes(quote.status)
      ? pass()
      : fail(`Quote must be ACCEPTED or READY_FOR_PO to convert. Current: ${quote.status}`),
    quote.customer_id ? pass() : fail('Quote must have a customer'),
    lineCount > 0 ? pass() : fail('Quote must have at least one line'),
    quote.total_amount > 0 ? pass() : fail('Quote total must be > 0'),
  )
}

// ── Order → Purchase Order ─────────────────────────────────────────────────

export function canCreatePOFromOrder(
  order: Pick<Order, 'status' | 'payment_status'>,
  hasVendor: boolean,
): InvariantResult {
  const allowedOrderStatuses = [
    'CONFIRMED',
    'PAYMENT_COMPLETE',
    'READY_FOR_PROCUREMENT',
  ]

  return merge(
    allowedOrderStatuses.includes(order.status)
      ? pass()
      : fail(`Order must be CONFIRMED, PAYMENT_COMPLETE, or READY_FOR_PROCUREMENT. Current: ${order.status}`),
    hasVendor ? pass() : fail('A vendor/supplier must be assigned to create a PO'),
  )
}

// ── PO → Production ───────────────────────────────────────────────────────

export function canStartProductionFromPO(
  po: Pick<PurchaseOrder, 'status' | 'vendor_id'>,
  order: Pick<Order, 'payment_status'>,
): InvariantResult {
  const confirmedStatuses = ['CONFIRMED', 'IN_PRODUCTION']

  return merge(
    confirmedStatuses.includes(po.status)
      ? pass()
      : fail(`PO must be CONFIRMED to start production. Current: ${po.status}`),
    po.vendor_id ? pass() : fail('PO must have an assigned vendor'),
    ['PAID', 'NOT_REQUIRED'].includes(order.payment_status) || order.payment_status === 'PARTIALLY_PAID'
      ? pass()
      : fail(`Payment must be at least partially received. Current: ${order.payment_status}`),
  )
}

// ── Order → Invoice ────────────────────────────────────────────────────────

export function canCreateInvoiceFromOrder(
  order: Pick<Order, 'status' | 'customer_id' | 'total_amount'>,
): InvariantResult {
  const disallowed = ['CREATED', 'CANCELLED']

  return merge(
    !disallowed.includes(order.status)
      ? pass()
      : fail(`Cannot invoice an order in ${order.status} status`),
    order.customer_id ? pass() : fail('Order must have a customer for invoicing'),
    order.total_amount > 0 ? pass() : fail('Order total must be > 0'),
  )
}

// ── Lifecycle Summary ──────────────────────────────────────────────────────

/**
 * Full conversion chain:
 *
 *   QUOTE (ACCEPTED)
 *     ↓  canConvertQuoteToOrder()
 *   ORDER (CREATED → CONFIRMED)
 *     ↓  canCreatePOFromOrder()
 *   PURCHASE ORDER (DRAFT → SENT → CONFIRMED)
 *     ↓  canStartProductionFromPO()
 *   PRODUCTION JOB (IN_PRODUCTION → COMPLETE)
 *     ↓  (automatic)
 *   SHIPMENT (PENDING → SHIPPED → DELIVERED)
 *     ↓  canCreateInvoiceFromOrder()
 *   INVOICE (DRAFT → SENT → PAID)
 */
