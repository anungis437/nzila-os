/**
 * Flow — Command Definitions
 *
 * Canonical command types for all critical business operations.
 * Every command carries org_id, actor_id, and optional correlation context.
 */
import { z } from 'zod'

// ── Shared Command Context Schema ──────────────────────────────────────────

export const CommandContextSchema = z.object({
  org_id: z.string().min(1),
  actor_id: z.string().min(1).optional(),
  correlation_id: z.string().uuid().optional(),
  environment: z.enum(['local', 'dev', 'staging', 'prod']).optional(),
  request_source: z.string().optional(),
})

// ── Base Command Fields ────────────────────────────────────────────────────

const baseFields = {
  org_id: z.string().min(1),
  actor_id: z.string().min(1),
  correlation_id: z.string().uuid().optional(),
  reason: z.string().optional(),
  notes: z.string().optional(),
}

// ── Quote Commands ─────────────────────────────────────────────────────────

export const CreateQuoteCommand = z.object({
  ...baseFields,
  type: z.literal('create_quote'),
  customer_id: z.string().uuid(),
  title: z.string().min(1),
  currency: z.enum(['CAD', 'USD', 'EUR', 'GBP', 'XAF']),
  lines: z.array(z.object({
    description: z.string().min(1),
    sku: z.string().optional(),
    quantity: z.number().int().positive(),
    unit_price: z.number().nonnegative(),
  })).min(1),
  valid_until: z.coerce.date().optional(),
})
export type CreateQuoteCommand = z.infer<typeof CreateQuoteCommand>

export const SendQuoteCommand = z.object({
  ...baseFields,
  type: z.literal('send_quote'),
  quote_id: z.string().uuid(),
})
export type SendQuoteCommand = z.infer<typeof SendQuoteCommand>

export const AcceptQuoteCommand = z.object({
  ...baseFields,
  type: z.literal('accept_quote'),
  quote_id: z.string().uuid(),
  customer_name: z.string().min(1).optional(),
  customer_email: z.string().email().optional(),
  message: z.string().optional(),
})
export type AcceptQuoteCommand = z.infer<typeof AcceptQuoteCommand>

export const RequestQuoteRevisionCommand = z.object({
  ...baseFields,
  type: z.literal('request_quote_revision'),
  quote_id: z.string().uuid(),
  request_message: z.string().min(1),
})
export type RequestQuoteRevisionCommand = z.infer<typeof RequestQuoteRevisionCommand>

export const ConvertQuoteToOrderCommand = z.object({
  ...baseFields,
  type: z.literal('convert_quote_to_order'),
  quote_id: z.string().uuid(),
})
export type ConvertQuoteToOrderCommand = z.infer<typeof ConvertQuoteToOrderCommand>

// ── Order Commands ─────────────────────────────────────────────────────────

export const ConfirmOrderCommand = z.object({
  ...baseFields,
  type: z.literal('confirm_order'),
  order_id: z.string().uuid(),
})
export type ConfirmOrderCommand = z.infer<typeof ConfirmOrderCommand>

export const StartFulfillmentCommand = z.object({
  ...baseFields,
  type: z.literal('start_fulfillment'),
  order_id: z.string().uuid(),
})
export type StartFulfillmentCommand = z.infer<typeof StartFulfillmentCommand>

export const CompleteOrderCommand = z.object({
  ...baseFields,
  type: z.literal('complete_order'),
  order_id: z.string().uuid(),
})
export type CompleteOrderCommand = z.infer<typeof CompleteOrderCommand>

export const CancelOrderCommand = z.object({
  ...baseFields,
  type: z.literal('cancel_order'),
  order_id: z.string().uuid(),
})
export type CancelOrderCommand = z.infer<typeof CancelOrderCommand>

export const RequireDepositCommand = z.object({
  ...baseFields,
  type: z.literal('require_deposit'),
  order_id: z.string().uuid(),
  deposit_required: z.boolean(),
  deposit_percent: z.number().min(0).max(100).optional(),
  deposit_amount: z.number().nonnegative().optional(),
  due_before_production: z.boolean().default(true),
})
export type RequireDepositCommand = z.infer<typeof RequireDepositCommand>

// ── Payment Commands ───────────────────────────────────────────────────────

export const RecordPaymentCommand = z.object({
  ...baseFields,
  type: z.literal('record_payment'),
  order_id: z.string().uuid(),
  amount: z.number().positive(),
  currency: z.enum(['CAD', 'USD', 'EUR', 'GBP', 'XAF']),
  method: z.enum(['BANK_TRANSFER', 'CREDIT_CARD', 'CHECK', 'CASH', 'OTHER']),
  reference: z.string().optional(),
})
export type RecordPaymentCommand = z.infer<typeof RecordPaymentCommand>

export const ConfirmPaymentCommand = z.object({
  ...baseFields,
  type: z.literal('confirm_payment'),
  payment_id: z.string().uuid(),
  order_id: z.string().uuid(),
})
export type ConfirmPaymentCommand = z.infer<typeof ConfirmPaymentCommand>

// ── Purchase Order Commands ────────────────────────────────────────────────

export const CreatePurchaseOrderCommand = z.object({
  ...baseFields,
  type: z.literal('create_purchase_order'),
  order_id: z.string().uuid(),
  vendor_id: z.string().uuid(),
  expected_delivery: z.coerce.date().optional(),
})
export type CreatePurchaseOrderCommand = z.infer<typeof CreatePurchaseOrderCommand>

export const SendPurchaseOrderCommand = z.object({
  ...baseFields,
  type: z.literal('send_purchase_order'),
  purchase_order_id: z.string().uuid(),
})
export type SendPurchaseOrderCommand = z.infer<typeof SendPurchaseOrderCommand>

export const ConfirmPurchaseOrderCommand = z.object({
  ...baseFields,
  type: z.literal('confirm_purchase_order'),
  purchase_order_id: z.string().uuid(),
})
export type ConfirmPurchaseOrderCommand = z.infer<typeof ConfirmPurchaseOrderCommand>

// ── Production Commands ────────────────────────────────────────────────────

export const StartProductionCommand = z.object({
  ...baseFields,
  type: z.literal('start_production'),
  order_id: z.string().uuid(),
  purchase_order_id: z.string().uuid(),
  vendor_id: z.string().uuid(),
})
export type StartProductionCommand = z.infer<typeof StartProductionCommand>

export const CompleteProductionCommand = z.object({
  ...baseFields,
  type: z.literal('complete_production'),
  production_job_id: z.string().uuid(),
  order_id: z.string().uuid(),
})
export type CompleteProductionCommand = z.infer<typeof CompleteProductionCommand>

// ── Shipment Commands ──────────────────────────────────────────────────────

export const CreateShipmentCommand = z.object({
  ...baseFields,
  type: z.literal('create_shipment'),
  order_id: z.string().uuid(),
  carrier: z.string().optional(),
  tracking_number: z.string().optional(),
})
export type CreateShipmentCommand = z.infer<typeof CreateShipmentCommand>

export const MarkShipmentShippedCommand = z.object({
  ...baseFields,
  type: z.literal('mark_shipment_shipped'),
  shipment_id: z.string().uuid(),
  order_id: z.string().uuid(),
  carrier: z.string().min(1),
  tracking_number: z.string().min(1),
  tracking_url: z.string().url().optional(),
})
export type MarkShipmentShippedCommand = z.infer<typeof MarkShipmentShippedCommand>

export const MarkShipmentDeliveredCommand = z.object({
  ...baseFields,
  type: z.literal('mark_shipment_delivered'),
  shipment_id: z.string().uuid(),
  order_id: z.string().uuid(),
})
export type MarkShipmentDeliveredCommand = z.infer<typeof MarkShipmentDeliveredCommand>

// ── Quote: Submit for Review ───────────────────────────────────────────────

export const SubmitForReviewCommand = z.object({
  ...baseFields,
  type: z.literal('submit_for_review'),
  quote_id: z.string().uuid(),
})
export type SubmitForReviewCommand = z.infer<typeof SubmitForReviewCommand>

// ── Invoice Commands ───────────────────────────────────────────────────────

export const CreateInvoiceCommand = z.object({
  ...baseFields,
  type: z.literal('create_invoice'),
  order_id: z.string().uuid(),
  due_date: z.coerce.date(),
})
export type CreateInvoiceCommand = z.infer<typeof CreateInvoiceCommand>

export const IssueInvoiceCommand = z.object({
  ...baseFields,
  type: z.literal('issue_invoice'),
  invoice_id: z.string().uuid(),
})
export type IssueInvoiceCommand = z.infer<typeof IssueInvoiceCommand>

export const VoidInvoiceCommand = z.object({
  ...baseFields,
  type: z.literal('void_invoice'),
  invoice_id: z.string().uuid(),
})
export type VoidInvoiceCommand = z.infer<typeof VoidInvoiceCommand>

// ── Sales → Procurement Trigger ────────────────────────────────────────────

export const TriggerSalesToProcurementCommand = z.object({
  ...baseFields,
  type: z.literal('trigger_sales_to_procurement'),
  quote_id: z.string().uuid(),
})
export type TriggerSalesToProcurementCommand = z.infer<typeof TriggerSalesToProcurementCommand>

// ── Order Shipping / Delivery ──────────────────────────────────────────────

export const ShipOrderCommand = z.object({
  ...baseFields,
  type: z.literal('ship_order'),
  order_id: z.string().uuid(),
})
export type ShipOrderCommand = z.infer<typeof ShipOrderCommand>

export const MarkOrderDeliveredCommand = z.object({
  ...baseFields,
  type: z.literal('mark_order_delivered'),
  order_id: z.string().uuid(),
})
export type MarkOrderDeliveredCommand = z.infer<typeof MarkOrderDeliveredCommand>

// ── Purchase Order Lifecycle ───────────────────────────────────────────────

export const ReceivePOLineCommand = z.object({
  ...baseFields,
  type: z.literal('receive_po_line'),
  line_id: z.string().uuid(),
  purchase_order_id: z.string().uuid(),
  quantity_received: z.number().int().nonnegative(),
})
export type ReceivePOLineCommand = z.infer<typeof ReceivePOLineCommand>

export const CancelPurchaseOrderCommand = z.object({
  ...baseFields,
  type: z.literal('cancel_purchase_order'),
  purchase_order_id: z.string().uuid(),
})
export type CancelPurchaseOrderCommand = z.infer<typeof CancelPurchaseOrderCommand>

// ── Production Readiness Check ─────────────────────────────────────────────

export const CheckProductionReadinessCommand = z.object({
  ...baseFields,
  type: z.literal('check_production_readiness'),
  order_id: z.string().uuid(),
})
export type CheckProductionReadinessCommand = z.infer<typeof CheckProductionReadinessCommand>

// ── Union Type ─────────────────────────────────────────────────────────────

export type FlowCommand =
  | CreateQuoteCommand
  | SendQuoteCommand
  | AcceptQuoteCommand
  | RequestQuoteRevisionCommand
  | ConvertQuoteToOrderCommand
  | SubmitForReviewCommand
  | ConfirmOrderCommand
  | StartFulfillmentCommand
  | CompleteOrderCommand
  | CancelOrderCommand
  | RequireDepositCommand
  | RecordPaymentCommand
  | ConfirmPaymentCommand
  | CreatePurchaseOrderCommand
  | SendPurchaseOrderCommand
  | ConfirmPurchaseOrderCommand
  | StartProductionCommand
  | CompleteProductionCommand
  | CreateShipmentCommand
  | MarkShipmentShippedCommand
  | MarkShipmentDeliveredCommand
  | CreateInvoiceCommand
  | IssueInvoiceCommand
  | VoidInvoiceCommand
  | TriggerSalesToProcurementCommand
  | ShipOrderCommand
  | MarkOrderDeliveredCommand
  | ReceivePOLineCommand
  | CancelPurchaseOrderCommand
  | CheckProductionReadinessCommand

export type FlowCommandType = FlowCommand['type']
