/**
 * Flow — Domain Entities
 *
 * Flow is ORDER-CENTRIC: Quote → Order → PO → Production → Fulfillment.
 * All entities use strict Zod schemas for runtime validation.
 */
import { z } from 'zod'

// ── Currency ───────────────────────────────────────────────────────────────

export const Currency = z.enum(['CAD', 'USD', 'EUR', 'GBP', 'XAF'])
export type Currency = z.infer<typeof Currency>

// ── Quote ──────────────────────────────────────────────────────────────────

export const QuoteStatus = z.enum([
  'DRAFT',
  'INTERNAL_REVIEW',
  'SENT_TO_CLIENT',
  'REVISION_REQUESTED',
  'ACCEPTED',
  'REJECTED',
  'EXPIRED',
])
export type QuoteStatus = z.infer<typeof QuoteStatus>

export const QuoteSchema = z.object({
  id: z.string().uuid(),
  org_id: z.string().min(1),
  customer_id: z.string().uuid(),
  status: QuoteStatus,
  title: z.string().min(1).max(500),
  total_amount: z.number().min(0),
  currency: Currency,
  margin_estimate: z.number().nullable().default(null),
  valid_until: z.coerce.date().nullable().default(null),
  notes: z.string().max(5000).nullable().default(null),
  created_by: z.string().min(1),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date(),
})
export type Quote = z.infer<typeof QuoteSchema>

// ── Order (PRIMARY ENTITY) ─────────────────────────────────────────────────

export const OrderStatus = z.enum([
  'CREATED',
  'CONFIRMED',
  'DEPOSIT_REQUIRED',
  'PAYMENT_PARTIAL',
  'PAYMENT_COMPLETE',
  'READY_FOR_PROCUREMENT',
  'IN_PRODUCTION',
  'READY_TO_SHIP',
  'SHIPPED',
  'DELIVERED',
  'CLOSED',
  'CANCELLED',
])
export type OrderStatus = z.infer<typeof OrderStatus>

export const PaymentStatus = z.enum([
  'NOT_REQUIRED',
  'PENDING_DEPOSIT',
  'PARTIALLY_PAID',
  'PAID',
  'OVERDUE',
])
export type PaymentStatus = z.infer<typeof PaymentStatus>

export const ProductionStatus = z.enum([
  'NOT_STARTED',
  'PENDING_PROOF',
  'PROOF_SENT',
  'PROOF_APPROVED',
  'IN_PRODUCTION',
  'QUALITY_CHECK',
  'COMPLETE',
])
export type ProductionStatus = z.infer<typeof ProductionStatus>

export const FulfillmentStatus = z.enum([
  'NOT_STARTED',
  'READY_TO_SHIP',
  'SHIPPED',
  'IN_TRANSIT',
  'DELIVERED',
])
export type FulfillmentStatus = z.infer<typeof FulfillmentStatus>

export const OrderSchema = z.object({
  id: z.string().uuid(),
  org_id: z.string().min(1),
  quote_id: z.string().uuid().nullable().default(null),
  customer_id: z.string().uuid(),
  status: OrderStatus,
  total_amount: z.number().min(0),
  currency: Currency,
  margin_estimate: z.number().nullable().default(null),
  payment_status: PaymentStatus,
  production_status: ProductionStatus,
  fulfillment_status: FulfillmentStatus,
  created_by: z.string().min(1),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date(),
})
export type Order = z.infer<typeof OrderSchema>

// ── Customer ───────────────────────────────────────────────────────────────

export const CustomerSchema = z.object({
  id: z.string().uuid(),
  org_id: z.string().min(1),
  name: z.string().min(1).max(300),
  email: z.string().email().max(320),
  phone: z.string().max(50).nullable().default(null),
  company: z.string().max(300).nullable().default(null),
  address: z.string().max(1000).nullable().default(null),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date(),
})
export type Customer = z.infer<typeof CustomerSchema>

// ── Product ────────────────────────────────────────────────────────────────

export const ProductSchema = z.object({
  id: z.string().uuid(),
  org_id: z.string().min(1),
  name: z.string().min(1).max(500),
  sku: z.string().max(100).nullable().default(null),
  description: z.string().max(5000).nullable().default(null),
  unit_price: z.number().min(0),
  currency: Currency,
  category: z.string().max(200).nullable().default(null),
  active: z.boolean().default(true),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date(),
})
export type Product = z.infer<typeof ProductSchema>

// ── Vendor ─────────────────────────────────────────────────────────────────

export const VendorSchema = z.object({
  id: z.string().uuid(),
  org_id: z.string().min(1),
  name: z.string().min(1).max(300),
  contact_email: z.string().email().max(320).nullable().default(null),
  contact_phone: z.string().max(50).nullable().default(null),
  address: z.string().max(1000).nullable().default(null),
  lead_time_days: z.number().int().min(0).nullable().default(null),
  rating: z.number().min(0).max(5).nullable().default(null),
  active: z.boolean().default(true),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date(),
})
export type Vendor = z.infer<typeof VendorSchema>

// ── Purchase Order ─────────────────────────────────────────────────────────

export const PurchaseOrderStatus = z.enum([
  'DRAFT',
  'SENT',
  'CONFIRMED',
  'IN_PRODUCTION',
  'SHIPPED',
  'RECEIVED',
  'CANCELLED',
])
export type PurchaseOrderStatus = z.infer<typeof PurchaseOrderStatus>

export const PurchaseOrderSchema = z.object({
  id: z.string().uuid(),
  org_id: z.string().min(1),
  order_id: z.string().uuid(),
  vendor_id: z.string().uuid(),
  status: PurchaseOrderStatus,
  total_amount: z.number().min(0),
  currency: Currency,
  expected_delivery: z.coerce.date().nullable().default(null),
  notes: z.string().max(5000).nullable().default(null),
  created_by: z.string().min(1),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date(),
})
export type PurchaseOrder = z.infer<typeof PurchaseOrderSchema>

// ── Production Job ─────────────────────────────────────────────────────────

export const ProductionJobStatus = z.enum([
  'PENDING_PROOF',
  'PROOF_SENT',
  'PROOF_APPROVED',
  'IN_PRODUCTION',
  'QUALITY_CHECK',
  'READY_TO_SHIP',
])
export type ProductionJobStatus = z.infer<typeof ProductionJobStatus>

export const ProductionJobSchema = z.object({
  id: z.string().uuid(),
  org_id: z.string().min(1),
  order_id: z.string().uuid(),
  purchase_order_id: z.string().uuid().nullable().default(null),
  vendor_id: z.string().uuid(),
  status: ProductionJobStatus,
  proof_url: z.string().url().nullable().default(null),
  estimated_completion: z.coerce.date().nullable().default(null),
  actual_completion: z.coerce.date().nullable().default(null),
  notes: z.string().max(5000).nullable().default(null),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date(),
})
export type ProductionJob = z.infer<typeof ProductionJobSchema>

// ── Shipment ───────────────────────────────────────────────────────────────

export const ShipmentStatus = z.enum([
  'PENDING',
  'PACKED',
  'SHIPPED',
  'IN_TRANSIT',
  'DELIVERED',
  'FAILED',
  'RETURNED',
])
export type ShipmentStatus = z.infer<typeof ShipmentStatus>

export const ShipmentSchema = z.object({
  id: z.string().uuid(),
  org_id: z.string().min(1),
  order_id: z.string().uuid(),
  carrier: z.string().max(200).nullable().default(null),
  tracking_number: z.string().max(200).nullable().default(null),
  tracking_url: z.string().url().nullable().default(null),
  status: ShipmentStatus,
  shipped_at: z.coerce.date().nullable().default(null),
  delivered_at: z.coerce.date().nullable().default(null),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date(),
})
export type Shipment = z.infer<typeof ShipmentSchema>

// ── Payment ────────────────────────────────────────────────────────────────

export const PaymentMethod = z.enum([
  'BANK_TRANSFER',
  'CREDIT_CARD',
  'CHECK',
  'CASH',
  'OTHER',
])
export type PaymentMethod = z.infer<typeof PaymentMethod>

export const PaymentSchema = z.object({
  id: z.string().uuid(),
  org_id: z.string().min(1),
  order_id: z.string().uuid(),
  amount: z.number().min(0),
  currency: Currency,
  method: PaymentMethod,
  reference: z.string().max(200).nullable().default(null),
  received_at: z.coerce.date(),
  created_at: z.coerce.date(),
})
export type Payment = z.infer<typeof PaymentSchema>

// ── Invoice ────────────────────────────────────────────────────────────────

export const InvoiceStatus = z.enum([
  'DRAFT',
  'SENT',
  'PAID',
  'OVERDUE',
  'VOID',
])
export type InvoiceStatus = z.infer<typeof InvoiceStatus>

export const InvoiceSchema = z.object({
  id: z.string().uuid(),
  org_id: z.string().min(1),
  order_id: z.string().uuid(),
  customer_id: z.string().uuid(),
  status: InvoiceStatus,
  amount: z.number().min(0),
  currency: Currency,
  due_date: z.coerce.date(),
  paid_at: z.coerce.date().nullable().default(null),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date(),
})
export type Invoice = z.infer<typeof InvoiceSchema>

// ── Audit Event ────────────────────────────────────────────────────────────

export const AuditEventSchema = z.object({
  id: z.string().uuid(),
  org_id: z.string().min(1),
  actor_id: z.string().min(1),
  entity_type: z.string().min(1),
  entity_id: z.string().uuid(),
  action: z.string().min(1),
  metadata: z.record(z.unknown()).nullable().default(null),
  timestamp: z.coerce.date(),
})
export type AuditEvent = z.infer<typeof AuditEventSchema>
