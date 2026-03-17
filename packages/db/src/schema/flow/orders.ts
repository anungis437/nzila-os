/**
 * Flow — Orders & Order Items (Spec §3E, §3F)
 *
 * Uses commerce_orders + commerce_order_lines from the shared commerce schema.
 * Flow-specific lifecycle columns (paymentStatus, productionStatus,
 * fulfillmentStatus, marginActual, confirmedAt) are added to commerce_orders.
 *
 * Column mapping (spec → actual):
 *   order_number      → ref (varchar)
 *   subtotal_amount   → subtotal (numeric)
 *   tax_amount        → taxTotal (numeric)
 *   total_amount      → total (numeric)
 *   payment_status    → paymentStatus (varchar)
 *   production_status → productionStatus (varchar)
 *   fulfillment_status→ fulfillmentStatus (varchar)
 *   margin_actual     → marginActual (numeric)
 *   confirmed_at      → confirmedAt (timestamptz)
 */
import type { InferSelectModel, InferInsertModel } from 'drizzle-orm'
import { commerceOrders, commerceOrderLines } from '../commerce'

export type FlowOrder = InferSelectModel<typeof commerceOrders>
export type FlowOrderInsert = InferInsertModel<typeof commerceOrders>
export type FlowOrderItem = InferSelectModel<typeof commerceOrderLines>
export type FlowOrderItemInsert = InferInsertModel<typeof commerceOrderLines>
