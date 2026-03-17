/**
 * Flow — Purchase Orders & PO Items (Spec §3I, §3J)
 *
 * Uses commerce_purchase_orders + commerce_purchase_order_lines
 * from the shared commerce schema.
 * Flow adds an orderId FK linking POs to orders.
 *
 * Column mapping (spec → actual):
 *   po_number           → ref (varchar)
 *   vendor_id           → supplierId (uuid FK → commerce_suppliers)
 *   order_id            → orderId (uuid FK → commerce_orders)
 *   total_amount        → total (numeric)
 *   expected_delivery_at→ expectedDeliveryDate (timestamptz)
 *   vendor_reference    → zohoPoId (text)
 */
import type { InferSelectModel, InferInsertModel } from 'drizzle-orm'
import { commercePurchaseOrders, commercePurchaseOrderLines } from '../commerce'

export type FlowPurchaseOrder = InferSelectModel<typeof commercePurchaseOrders>
export type FlowPurchaseOrderInsert = InferInsertModel<typeof commercePurchaseOrders>
export type FlowPurchaseOrderItem = InferSelectModel<typeof commercePurchaseOrderLines>
export type FlowPurchaseOrderItemInsert = InferInsertModel<typeof commercePurchaseOrderLines>
