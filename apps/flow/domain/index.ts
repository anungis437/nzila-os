/**
 * Domain layer — canonical entity types for Flow.
 *
 * Flow is ORDER-CENTRIC: Quote → Order → PO → Production → Fulfillment.
 */
export {
  // Enums / Status types
  Currency,
  QuoteStatus,
  OrderStatus,
  PaymentStatus,
  ProductionStatus,
  FulfillmentStatus,
  PurchaseOrderStatus,
  ProductionJobStatus,
  ShipmentStatus,
  PaymentMethod,
  InvoiceStatus,

  // Schemas (Zod)
  QuoteSchema,
  OrderSchema,
  CustomerSchema,
  ProductSchema,
  VendorSchema,
  PurchaseOrderSchema,
  ProductionJobSchema,
  ShipmentSchema,
  PaymentSchema,
  InvoiceSchema,
  AuditEventSchema,

  // Types
  type Quote,
  type Order,
  type Customer,
  type Product,
  type Vendor,
  type PurchaseOrder,
  type ProductionJob,
  type Shipment,
  type Payment,
  type Invoice,
  type AuditEvent,
} from './entities'

// Domain invariants — pure predicate functions
export {
  type InvariantResult,
  type PaymentInfo,
  quoteHasLines,
  quoteHasCustomer,
  quoteNotExpired,
  quoteCanBeSent,
  orderHasCustomer,
  orderNotCancelled,
  orderNotClosed,
  orderCanBeConfirmed,
  depositSatisfied,
  fullPaymentSatisfied,
  poHasVendor,
  poNotCancelled,
  poCanBeSent,
  productionHasVendor,
  productionCanStart,
  shipmentHasTrackingInfo,
  invoiceNotVoid,
  invoiceNotPaid,
  invoiceCanBeIssued,
  invoiceCanBeVoided,
} from './invariants'

// Conversion rules — entity promotion predicates
export {
  canConvertQuoteToOrder,
  canCreatePOFromOrder,
  canStartProductionFromPO,
  canCreateInvoiceFromOrder,
} from './conversion-rules'
