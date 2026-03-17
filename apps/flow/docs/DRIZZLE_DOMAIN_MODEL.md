# Flow — Drizzle Domain Model

> Maps every Flow domain entity to its Drizzle schema table, enum, and source file.
> See also: [DOMAIN_MODEL.md](DOMAIN_MODEL.md), [WORKFLOWS.md](WORKFLOWS.md)

## Schema Location

All Flow schema files live under `packages/db/src/schema/flow/` and are re-exported
via the barrel at `packages/db/src/schema/flow/index.ts`.

Import pattern:
```ts
import { db, flowProductionJobs, flowPayments, commerceOrders } from '@nzila/db'
```

## Entity → Table Mapping

| Entity | Drizzle Table | Schema File | Storage |
|--------|---------------|-------------|---------|
| Customer | `commerceCustomers` | `flow/customers.ts` (type alias) | Shared commerce table |
| Product | `commerceProducts` | `flow/products.ts` (type alias) | Shared commerce table |
| Quote | `commerceQuotes` | `flow/quotes.ts` (type alias) | Shared commerce table |
| Quote Line | `commerceQuoteLines` | `flow/quotes.ts` (type alias) | Shared commerce table |
| Order | `commerceOrders` | `flow/orders.ts` (type alias) | Shared commerce table |
| Order Line | `commerceOrderLines` | `flow/orders.ts` (type alias) | Shared commerce table |
| Vendor | `commerceSuppliers` | `flow/vendors.ts` (type alias) | Shared commerce table |
| Vendor-Product Link | `flowVendorProductLinks` | `flow/vendors.ts` | Dedicated `flow_vendor_product_links` |
| Purchase Order | `commercePurchaseOrders` | `flow/purchase-orders.ts` (type alias) | Shared commerce table |
| Purchase Order Line | `commercePurchaseOrderLines` | `flow/purchase-orders.ts` (type alias) | Shared commerce table |
| Invoice | `commerceInvoices` | `flow/invoices.ts` (type alias) | Shared commerce table |
| Invoice Line | `commerceInvoiceLines` | `flow/invoices.ts` (type alias) | Shared commerce table |
| Production Job | `flowProductionJobs` | `flow/production.ts` | Dedicated `flow_production_jobs` |
| Shipment | `flowShipments` | `flow/shipments.ts` | Dedicated `flow_shipments` |
| Payment | `flowPayments` | `flow/payments.ts` | Dedicated `flow_payments` |
| Domain Event | `flowDomainEvents` | `flow/events.ts` | Dedicated `flow_domain_events` |

## Architecture: Shared vs Dedicated Tables

Flow reuses shared commerce tables for entities that already exist platform-wide
(customers, products, quotes, orders, invoices, vendors, purchase orders).
Only entities with no commerce equivalent get dedicated `flow_*` pgTables.

**Shared (type alias):** The Flow schema re-exports TypeScript types
(`FlowCustomer`, `FlowOrder`, etc.) that are `InferSelectModel` /
`InferInsertModel` wrappers around the commerce table.
Each alias file documents the column mapping between spec names and actual columns.

**Dedicated:** Production jobs, shipments, payments, vendor-product links,
and domain events are Flow-specific and live in their own `flow_*` tables.

## Enums

| Enum | Drizzle Identifier | PG Name | Source |
|------|--------------------|---------|--------|
| Quote Status | `flowQuoteStatusEnum` | `flow_quote_status` | `flow/enums.ts` |
| Order Status | `flowOrderStatusEnum` | `flow_order_status` | `flow/enums.ts` |
| Purchase Order Status | `flowPurchaseOrderStatusEnum` | `flow_purchase_order_status` | `flow/enums.ts` |
| Invoice Status | `flowInvoiceStatusEnum` | `flow_invoice_status` | `flow/enums.ts` |
| Production Job Status | `flowProductionJobStatusEnum` | `flow_production_job_status` | `flow/enums.ts` |
| Shipment Status | `flowShipmentStatusEnum` | `flow_shipment_status` | `flow/enums.ts` |
| Payment Status | `flowPaymentStatusEnum` | `flow_payment_status` | `flow/enums.ts` |
| Event Type | `flowEventTypeEnum` | `flow_event_type` | `flow/enums.ts` |

> Commerce tables keep their own enums (`commerceOrderStatusEnum`, etc.).
> Flow enums define the Flow domain vocabulary for validation and new flow-specific tables.

## Indexes

All dedicated Flow tables include performance indexes:

- **flow_production_jobs:** `org_id`, `order_id`, `status`
- **flow_shipments:** `org_id`, `order_id`, `status`, `tracking_number`
- **flow_payments:** `org_id`, `order_id`, `status`, `provider_ref`
- **flow_vendor_product_links:** `org_id`, `vendor_id`, `product_id`
- **flow_domain_events:** `org_id`, `(entity_type, entity_id)`, `event_type`, `created_at`

## Relations

Defined in `flow/relations.ts`. Enables the Drizzle query API:

```ts
// Fetch order with all related data
const order = await db.query.commerceOrders.findFirst({
  with: {
    customer: true,
    lines: true,
    productionJobs: true,
    shipments: true,
    payments: true,
    invoices: true,
  },
})
```

| Relation Block | From → To |
|----------------|-----------|
| `flowCustomerRelations` | Customer → Quotes, Orders, Invoices |
| `flowQuoteRelations` | Quote → Customer, Lines, Orders |
| `flowOrderRelations` | Order → Customer, Quote, Lines, POs, Production, Shipments, Payments, Invoices |
| `flowPurchaseOrderRelations` | PO → Vendor, Lines, ProductionJobs |
| `flowVendorRelations` | Vendor → POs, ProductLinks |
| `flowProductRelations` | Product → VendorLinks |
| `flowDomainEventRelations` | DomainEvent → Org |

## Repositories

All 8 repositories live in `apps/flow/lib/repositories/`:

| Repository | File | Primary Table |
|------------|------|---------------|
| `quoteRepo` | `quote-repo.ts` | `commerceQuotes` |
| `orderRepo` | `order-repo.ts` | `commerceOrders` |
| `customerRepo` | `customer-repo.ts` | `commerceCustomers` |
| `vendorRepo` | `vendor-repo.ts` | `commerceSuppliers` |
| `purchaseOrderRepo` | `purchase-order-repo.ts` | `commercePurchaseOrders` |
| `productionRepo` | `production-repo.ts` | `flowProductionJobs` |
| `paymentRepo` | `payment-repo.ts` | `flowPayments` |
| `invoiceRepo` | `invoice-repo.ts` | `commerceInvoices` |
