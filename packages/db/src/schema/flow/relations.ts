/**
 * Flow — Drizzle Relations (Spec §Phase 6)
 *
 * Explicit relation definitions for the Drizzle query API.
 * Enables: db.query.commerceOrders.findFirst({ with: { lines: true, payments: true } })
 */
import { relations } from 'drizzle-orm'
import {
  commerceCustomers,
  commerceQuotes,
  commerceQuoteLines,
  commerceOrders,
  commerceOrderLines,
  commerceInvoices,
  commerceInvoiceLines,
  commerceSuppliers,
  commerceProducts,
  commercePurchaseOrders,
  commercePurchaseOrderLines,
} from '../commerce'
import { orgs } from '../orgs'
import { flowProductionJobs } from './production'
import { flowShipments } from './shipments'
import { flowPayments } from './payments'
import { flowVendorProductLinks } from './vendors'
import { flowDomainEvents } from './events'

// ── Customers ↔ Quotes, Orders ────────────────────────────────────────────

export const flowCustomerRelations = relations(commerceCustomers, ({ many }) => ({
  quotes: many(commerceQuotes),
  orders: many(commerceOrders),
  invoices: many(commerceInvoices),
}))

// ── Quotes ↔ Customer, Lines, Orders ──────────────────────────────────────

export const flowQuoteRelations = relations(commerceQuotes, ({ one, many }) => ({
  customer: one(commerceCustomers, {
    fields: [commerceQuotes.customerId],
    references: [commerceCustomers.id],
  }),
  lines: many(commerceQuoteLines),
  orders: many(commerceOrders),
}))

export const flowQuoteLineRelations = relations(commerceQuoteLines, ({ one }) => ({
  quote: one(commerceQuotes, {
    fields: [commerceQuoteLines.quoteId],
    references: [commerceQuotes.id],
  }),
}))

// ── Orders ↔ Customer, Quote, Lines, POs, Production, Shipments, Payments, Invoices

export const flowOrderRelations = relations(commerceOrders, ({ one, many }) => ({
  customer: one(commerceCustomers, {
    fields: [commerceOrders.customerId],
    references: [commerceCustomers.id],
  }),
  quote: one(commerceQuotes, {
    fields: [commerceOrders.quoteId],
    references: [commerceQuotes.id],
  }),
  lines: many(commerceOrderLines),
  purchaseOrders: many(commercePurchaseOrders),
  productionJobs: many(flowProductionJobs),
  shipments: many(flowShipments),
  payments: many(flowPayments),
  invoices: many(commerceInvoices),
}))

export const flowOrderLineRelations = relations(commerceOrderLines, ({ one }) => ({
  order: one(commerceOrders, {
    fields: [commerceOrderLines.orderId],
    references: [commerceOrders.id],
  }),
}))

// ── Purchase Orders ↔ Order, Vendor, Lines, ProductionJobs ────────────────

export const flowPurchaseOrderRelations = relations(commercePurchaseOrders, ({ one, many }) => ({
  vendor: one(commerceSuppliers, {
    fields: [commercePurchaseOrders.supplierId],
    references: [commerceSuppliers.id],
  }),
  lines: many(commercePurchaseOrderLines),
  productionJobs: many(flowProductionJobs),
}))

export const flowPurchaseOrderLineRelations = relations(commercePurchaseOrderLines, ({ one }) => ({
  purchaseOrder: one(commercePurchaseOrders, {
    fields: [commercePurchaseOrderLines.purchaseOrderId],
    references: [commercePurchaseOrders.id],
  }),
}))

// ── Vendors ↔ POs, Product Links ──────────────────────────────────────────

export const flowVendorRelations = relations(commerceSuppliers, ({ many }) => ({
  purchaseOrders: many(commercePurchaseOrders),
  productLinks: many(flowVendorProductLinks),
}))

export const flowVendorProductLinkRelations = relations(flowVendorProductLinks, ({ one }) => ({
  vendor: one(commerceSuppliers, {
    fields: [flowVendorProductLinks.vendorId],
    references: [commerceSuppliers.id],
  }),
  product: one(commerceProducts, {
    fields: [flowVendorProductLinks.productId],
    references: [commerceProducts.id],
  }),
}))

// ── Products ↔ Vendor Links ──────────────────────────────────────────────

export const flowProductRelations = relations(commerceProducts, ({ many }) => ({
  vendorLinks: many(flowVendorProductLinks),
}))

// ── Domain Events ↔ Org ─────────────────────────────────────────────────

export const flowDomainEventRelations = relations(flowDomainEvents, ({ one }) => ({
  org: one(orgs, {
    fields: [flowDomainEvents.orgId],
    references: [orgs.id],
  }),
}))

// ── Production Jobs ↔ Order, PO, Vendor, Shipments ───────────────────────

export const flowProductionJobRelations = relations(flowProductionJobs, ({ one, many }) => ({
  order: one(commerceOrders, {
    fields: [flowProductionJobs.orderId],
    references: [commerceOrders.id],
  }),
  purchaseOrder: one(commercePurchaseOrders, {
    fields: [flowProductionJobs.purchaseOrderId],
    references: [commercePurchaseOrders.id],
  }),
  assignedVendor: one(commerceSuppliers, {
    fields: [flowProductionJobs.assignedVendorId],
    references: [commerceSuppliers.id],
  }),
  shipments: many(flowShipments),
}))

// ── Shipments ↔ Order, Production Job ────────────────────────────────────

export const flowShipmentRelations = relations(flowShipments, ({ one }) => ({
  order: one(commerceOrders, {
    fields: [flowShipments.orderId],
    references: [commerceOrders.id],
  }),
  productionJob: one(flowProductionJobs, {
    fields: [flowShipments.productionJobId],
    references: [flowProductionJobs.id],
  }),
}))

// ── Payments ↔ Order, Customer ───────────────────────────────────────────

export const flowPaymentRelations = relations(flowPayments, ({ one }) => ({
  order: one(commerceOrders, {
    fields: [flowPayments.orderId],
    references: [commerceOrders.id],
  }),
  customer: one(commerceCustomers, {
    fields: [flowPayments.customerId],
    references: [commerceCustomers.id],
  }),
}))

// ── Invoices ↔ Order, Customer, Lines ────────────────────────────────────

export const flowInvoiceRelations = relations(commerceInvoices, ({ one, many }) => ({
  order: one(commerceOrders, {
    fields: [commerceInvoices.orderId],
    references: [commerceOrders.id],
  }),
  customer: one(commerceCustomers, {
    fields: [commerceInvoices.customerId],
    references: [commerceCustomers.id],
  }),
  lines: many(commerceInvoiceLines),
}))

export const flowInvoiceLineRelations = relations(commerceInvoiceLines, ({ one }) => ({
  invoice: one(commerceInvoices, {
    fields: [commerceInvoiceLines.invoiceId],
    references: [commerceInvoices.id],
  }),
}))
