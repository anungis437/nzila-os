/**
 * Flow — Domain Invariants
 *
 * Typed invariant predicates for all core entities.
 * These are pure functions — no side effects, no DB access.
 * Guards use these to validate entity state before mutations.
 */
import type { Quote, Order, PurchaseOrder, ProductionJob, Shipment, Invoice } from './entities'

// ── Types ──────────────────────────────────────────────────────────────────

export interface InvariantResult {
  valid: boolean
  violations: string[]
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

// ── Quote Invariants ───────────────────────────────────────────────────────

export function quoteHasLines(lineCount: number): InvariantResult {
  return lineCount > 0 ? pass() : fail('Quote must have at least one line item')
}

export function quoteHasCustomer(quote: Pick<Quote, 'customer_id'>): InvariantResult {
  return quote.customer_id ? pass() : fail('Quote must have a customer')
}

export function quoteNotExpired(quote: Pick<Quote, 'valid_until'>): InvariantResult {
  if (!quote.valid_until) return pass()
  return new Date() <= quote.valid_until
    ? pass()
    : fail('Quote has expired')
}

export function quoteCanBeSent(
  quote: Pick<Quote, 'customer_id' | 'valid_until' | 'total_amount'>,
  lineCount: number,
): InvariantResult {
  return merge(
    quoteHasCustomer(quote),
    quoteHasLines(lineCount),
    quoteNotExpired(quote),
    quote.total_amount > 0 ? pass() : fail('Quote total must be > 0'),
  )
}

// ── Order Invariants ───────────────────────────────────────────────────────

export function orderHasCustomer(order: Pick<Order, 'customer_id'>): InvariantResult {
  return order.customer_id ? pass() : fail('Order must have a customer')
}

export function orderNotCancelled(order: Pick<Order, 'status'>): InvariantResult {
  return order.status !== 'CANCELLED'
    ? pass()
    : fail('Order is cancelled and cannot be modified')
}

export function orderNotClosed(order: Pick<Order, 'status'>): InvariantResult {
  return order.status !== 'CLOSED'
    ? pass()
    : fail('Order is closed and cannot be modified')
}

export function orderCanBeConfirmed(order: Pick<Order, 'status' | 'customer_id' | 'total_amount'>): InvariantResult {
  return merge(
    orderHasCustomer(order),
    orderNotCancelled(order),
    order.total_amount > 0 ? pass() : fail('Order total must be > 0'),
  )
}

// ── Payment Invariants ─────────────────────────────────────────────────────

export type PaymentInfo = {
  depositRequired: boolean
  depositPercent: number
  totalAmount: number
  totalPaid: number
}

export function depositSatisfied(info: PaymentInfo): InvariantResult {
  if (!info.depositRequired) return pass()
  const required = (info.depositPercent / 100) * info.totalAmount
  return info.totalPaid >= required
    ? pass()
    : fail(`Deposit of ${required.toFixed(2)} required, only ${info.totalPaid.toFixed(2)} received`)
}

export function fullPaymentSatisfied(info: PaymentInfo): InvariantResult {
  return info.totalPaid >= info.totalAmount
    ? pass()
    : fail(`Full payment of ${info.totalAmount.toFixed(2)} required, only ${info.totalPaid.toFixed(2)} received`)
}

// ── Purchase Order Invariants ──────────────────────────────────────────────

export function poHasVendor(po: Pick<PurchaseOrder, 'vendor_id'>): InvariantResult {
  return po.vendor_id ? pass() : fail('Purchase order must have a vendor')
}

export function poNotCancelled(po: Pick<PurchaseOrder, 'status'>): InvariantResult {
  return po.status !== 'CANCELLED'
    ? pass()
    : fail('Purchase order is cancelled and cannot be modified')
}

export function poCanBeSent(
  po: Pick<PurchaseOrder, 'vendor_id' | 'status' | 'total_amount'>,
  lineCount: number,
): InvariantResult {
  return merge(
    poHasVendor(po),
    poNotCancelled(po),
    lineCount > 0 ? pass() : fail('PO must have at least one line item'),
    po.total_amount > 0 ? pass() : fail('PO total must be > 0'),
  )
}

// ── Production Job Invariants ──────────────────────────────────────────────

export function productionHasVendor(job: Pick<ProductionJob, 'vendor_id'>): InvariantResult {
  return job.vendor_id ? pass() : fail('Production job must have an assigned vendor')
}

export function productionCanStart(
  job: Pick<ProductionJob, 'vendor_id'>,
  paymentInfo: PaymentInfo,
): InvariantResult {
  return merge(
    productionHasVendor(job),
    depositSatisfied(paymentInfo),
  )
}

// ── Shipment Invariants ────────────────────────────────────────────────────

export function shipmentHasTrackingInfo(shipment: Pick<Shipment, 'carrier' | 'tracking_number'>): InvariantResult {
  return merge(
    shipment.carrier ? pass() : fail('Shipment must have a carrier'),
    shipment.tracking_number ? pass() : fail('Shipment must have a tracking number'),
  )
}

// ── Invoice Invariants ─────────────────────────────────────────────────────

export function invoiceNotVoid(invoice: Pick<Invoice, 'status'>): InvariantResult {
  return invoice.status !== 'VOID'
    ? pass()
    : fail('Invoice is voided and cannot be modified')
}

export function invoiceNotPaid(invoice: Pick<Invoice, 'status'>): InvariantResult {
  return invoice.status !== 'PAID'
    ? pass()
    : fail('Invoice is already paid')
}

export function invoiceCanBeIssued(invoice: Pick<Invoice, 'status' | 'amount'>): InvariantResult {
  return merge(
    invoiceNotVoid(invoice),
    invoice.status === 'DRAFT' ? pass() : fail('Only draft invoices can be issued'),
    invoice.amount > 0 ? pass() : fail('Invoice amount must be > 0'),
  )
}

export function invoiceCanBeVoided(invoice: Pick<Invoice, 'status'>): InvariantResult {
  return invoice.status !== 'PAID'
    ? pass()
    : fail('Cannot void a paid invoice')
}
