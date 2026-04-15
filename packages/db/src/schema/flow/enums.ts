/**
 * Flow — Drizzle pgEnum definitions
 *
 * Database-level enum types for Flow domain entities.
 * Existing commerce enums (commerceQuoteStatusEnum, commerceOrderStatusEnum, etc.)
 * remain in commerce.ts and are used by their respective tables.
 */
import { pgEnum } from 'drizzle-orm/pg-core'

// ── Production Job Status (Spec §3K) ──────────────────────────────────────

export const flowProductionJobStatusEnum = pgEnum('flow_production_job_status', [
  'pending_proof',
  'proof_sent',
  'proof_approved',
  'in_production',
  'quality_check',
  'ready_to_ship',
  'completed',
  'blocked',
])

// ── Shipment Status (Spec §3L) ────────────────────────────────────────────

export const flowShipmentStatusEnum = pgEnum('flow_shipment_status', [
  'pending',
  'packed',
  'shipped',
  'in_transit',
  'delivered',
  'failed',
  'returned',
])

// ── Payment Status (Spec §3M) ─────────────────────────────────────────────

export const flowPaymentStatusEnum = pgEnum('flow_payment_status', [
  'not_required',
  'pending_deposit',
  'partially_paid',
  'paid',
  'overdue',
  'failed',
  'refunded',
])

// ── Quote Status (Spec §3C) ───────────────────────────────────────────────

export const flowQuoteStatusEnum = pgEnum('flow_quote_status', [
  'draft',
  'internal_review',
  'sent_to_client',
  'revision_requested',
  'accepted',
  'rejected',
  'expired',
])

// ── Order Status (Spec §3E) ──────────────────────────────────────────────

export const flowOrderStatusEnum = pgEnum('flow_order_status', [
  'created',
  'confirmed',
  'deposit_required',
  'payment_partial',
  'payment_complete',
  'ready_for_procurement',
  'in_production',
  'ready_to_ship',
  'shipped',
  'delivered',
  'closed',
  'cancelled',
])

// ── Purchase Order Status (Spec §3I) ─────────────────────────────────────

export const flowPurchaseOrderStatusEnum = pgEnum('flow_purchase_order_status', [
  'draft',
  'sent',
  'confirmed',
  'in_production',
  'shipped',
  'received',
  'cancelled',
])

// ── Invoice Status (Spec §3N) ────────────────────────────────────────────

export const flowInvoiceStatusEnum = pgEnum('flow_invoice_status', [
  'draft',
  'issued',
  'partially_paid',
  'paid',
  'overdue',
  'void',
])

// ── Domain Event Type (Spec §5A) ──────────────────────────────────────────

export const flowEventTypeEnum = pgEnum('flow_event_type', [
  'quote_created',
  'quote_sent',
  'quote_accepted',
  'quote_revision_requested',
  'quote_submitted_for_review',
  'order_created',
  'order_confirmed',
  'order_ready_for_procurement',
  'order_shipped',
  'order_completed',
  'deposit_required',
  'payment_received',
  'po_created',
  'po_sent',
  'po_confirmed',
  'po_line_received',
  'purchase_order_cancelled',
  'production_started',
  'production_completed',
  'production_readiness_achieved',
  'fulfillment_started',
  'shipment_created',
  'order_delivered',
  'invoice_created',
  'invoice_issued',
  'invoice_voided',
  'sales_to_procurement_triggered',
])
