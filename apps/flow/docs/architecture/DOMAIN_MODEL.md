# Domain Model — Flow

> Canonical reference for Flow domain entities, state machines,
> events, and audit surfaces. See also: docs/DOMAIN_VS_AUDIT_MODEL.md

## Primary Entities

| Entity | Table(s) | Purpose |
|--------|----------|---------|
| **Order** | `orders` | PRIMARY — tracks Quote→Payment→Production→Fulfillment |
| Quote | `quotes` | Customer quotation (converts to Order) |
| Purchase Order | `purchase_orders` | PO generated from approved order |
| Production Job | `production_jobs` | Manufacturing / fulfilment tracking |
| Vendor | `vendors` | Material / service supplier |
| Customer | `customers` | Customer record |
| Shipment | `shipments` | Fulfillment / delivery tracking |
| Payment | `payments` | Payment transaction |
| Invoice | `invoices` | Financial billing document |
| Product | `products` | Catalogue product |
| AuditEvent | `audit_events` | Immutable audit trail |

## Status Enums

### OrderStatus (PRIMARY)
`CREATED` → `CONFIRMED` → `DEPOSIT_REQUIRED` → `PAYMENT_PARTIAL` → `PAYMENT_COMPLETE` → `READY_FOR_PROCUREMENT` → `IN_PRODUCTION` → `READY_TO_SHIP` → `SHIPPED` → `DELIVERED` → `CLOSED` | `CANCELLED`

### QuoteStatus
`DRAFT` → `INTERNAL_REVIEW` → `SENT_TO_CLIENT` → `ACCEPTED` → `CONVERTED` → `EXPIRED` | `CANCELLED`

### PurchaseOrderStatus
`DRAFT` → `SENT` → `CONFIRMED` → `IN_PRODUCTION` → `SHIPPED` → `RECEIVED`

### ProductionJobStatus
`PENDING_PROOF` → `PROOF_SENT` → `PROOF_APPROVED` → `IN_PRODUCTION` → `QUALITY_CHECK` → `READY_TO_SHIP`

### ShipmentStatus
`PENDING` → `PICKED_UP` → `IN_TRANSIT` → `DELIVERED` → `RETURNED`

### PaymentStatus
`PENDING` → `DEPOSIT_PAID` → `PARTIAL` → `PAID` → `REFUNDED`

## Primary State Tables (Source of Truth)

- `orders` — current order status, payment status, production status, fulfillment status
- `quotes` — current quote status, line items, pricing, approval state
- `purchase_orders` — current PO status, vendor, delivery
- `production_jobs` — current production status, proof approval, QC
- `customers` — current customer profile, contact
- `shipments` — current shipment status, tracking
- `payments` — current payment status, amount, method
- `invoices` — current invoice status, totals

## Workflow State Machines

| State Machine | File | States |
|---------------|------|--------|
| Order | `lib/workflows/order-workflow.ts` | CREATED → CONFIRMED → ... → CLOSED / CANCELLED (14 transitions) |
| Quote | `lib/workflows/quote-state-machine.ts` | DRAFT → INTERNAL_REVIEW → ... → CLOSED / CANCELLED |
| PurchaseOrder | `lib/workflows/po-workflow.ts` | DRAFT → SENT → CONFIRMED → IN_PRODUCTION → SHIPPED → RECEIVED |
| ProductionJob | `lib/workflows/production-workflow.ts` | PENDING_PROOF → ... → READY_TO_SHIP (with QC loops) |

## Services

| Service | File | Purpose |
|---------|------|---------|
| Order Payment Gating | `lib/services/order-payment-gating.ts` | Order-centric payment enforcement |
| Quote-to-PO | `lib/services/quote-to-po-service.ts` | Convert approved quote to PO |
| Quote Approval | `lib/services/quote-approval-service.ts` | Approval workflow |
| Payment Gating | `lib/services/payment-gating-service.ts` | Quote-level payment validation gates |
| Production Gating | `lib/services/production-gating-service.ts` | Production readiness gates |
| Share Link | `lib/services/share-link-service.ts` | Shareable quote links |
| Workflow Audit | `lib/services/workflow-audit-service.ts` | Audit trail for workflow actions |

## Integration Adapters

| Adapter | File | Purpose |
|---------|------|---------|
| Shopify | `lib/integrations/shopify.adapter.ts` | Push orders, sync products, track fulfillment |
| Zoho | `lib/integrations/zoho.adapter.ts` | Vendors, invoices, accounting sync |
| Canva | `lib/integrations/canva.adapter.ts` | Design proof links, asset references |

## Emitted Events (30+ types)

| Category | Events | Consumer |
|----------|--------|----------|
| Quote | created, sent, accepted, rejected, converted, expired | Order service, Notifications, Audit |
| Order | created, confirmed, deposit_required, payment_received, ready_for_procurement, in_production, shipped, delivered | All downstream services |
| Payment | received, deposit_cleared, refunded | Payment gating, Finance, Audit |
| PurchaseOrder | created, sent, confirmed, in_production, shipped, received | Production, Vendor mgmt, Audit |
| Production | proof_sent, proof_approved, proof_rejected, started, qc_passed, qc_failed, ready_to_ship | Fulfillment, Notifications |
| System | health_check, config_changed, seed_completed | Platform, Observability |

## Audit Surfaces

| Surface | Purpose | Tables |
|---------|---------|--------|
| Quote audit trail | Track quote lifecycle changes | `audit_entries` |
| Evidence export | Compliance evidence pack | `evidence_packs` |
| Payment audit | Financial transaction proof | `commerce_audit` |

## What is NOT a Source of Truth

| Data | Why Not |
|------|---------|
| `commerce_audit` | Audit trail only — do not query for current quote/PO state |
| `evidence_packs` | Export artefacts — not primary data source |
| Workflow audit entries | Historical record — current state lives in domain tables |
