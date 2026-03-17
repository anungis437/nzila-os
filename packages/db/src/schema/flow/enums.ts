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

// ── Domain Event Type (Spec §5A) ──────────────────────────────────────────

export const flowEventTypeEnum = pgEnum('flow_event_type', [
  'quote_created',
  'quote_sent',
  'quote_accepted',
  'quote_revision_requested',
  'order_created',
  'deposit_required',
  'payment_received',
  'po_created',
  'po_sent',
  'po_confirmed',
  'production_started',
  'production_completed',
  'shipment_created',
  'order_delivered',
])
