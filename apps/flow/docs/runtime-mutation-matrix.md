# Runtime Mutation Matrix — Flow

> Audit date: 2026-03-19  
> Status: **REMEDIATED** — all critical mutations now route through command bus

## Overview

Flow uses a command bus architecture (`lib/control/command-bus.ts`) to enforce the canonical mutation lifecycle:

1. Validate input (Zod)
2. Resolve actor + org
3. Load domain state
4. Governance check (invariant guard)
5. Workflow transition validation (workflow guard)
6. Domain invariants
7. Payment / production / shipment gating
8. Persist via repository
9. Emit domain events
10. Write audit entry
11. Dispatch side effects (integrations)
12. Return structured `CommandResult`

---

## Mutation Entrypoint Classification

### Tier 1 — CRITICAL (must use command bus)

Mutations that change workflow state, financial state, or fulfillment state.

| Mutation | Command Type | Handler | Status |
|----------|-------------|---------|--------|
| Create quote | `create_quote` | `create-quote.handler.ts` | ✅ Governed |
| Send quote to client | `send_quote` | `send-quote.handler.ts` | ✅ Governed |
| Accept quote | `accept_quote` | `accept-quote.handler.ts` | ✅ Governed |
| Request quote revision | `request_quote_revision` | `request-quote-revision.handler.ts` | ✅ Governed |
| Convert quote → order | `convert_quote_to_order` | `convert-quote-to-order.handler.ts` | ✅ Governed |
| Confirm order | `confirm_order` | `confirm-order.handler.ts` | ✅ Governed |
| Require deposit | `require_deposit` | `require-deposit.handler.ts` | ✅ Governed |
| Record payment | `record_payment` | `record-payment.handler.ts` | ✅ Governed |
| Confirm payment | `confirm_payment` | `confirm-payment.handler.ts` | ✅ Governed |
| Create purchase order | `create_purchase_order` | `create-purchase-order.handler.ts` | ✅ Governed |
| Send purchase order | `send_purchase_order` | `send-purchase-order.handler.ts` | ✅ Governed |
| Confirm purchase order | `confirm_purchase_order` | `confirm-purchase-order.handler.ts` | ✅ Governed |
| Start production | `start_production` | `start-production.handler.ts` | ✅ Governed |
| Complete production | `complete_production` | `complete-production.handler.ts` | ✅ Governed |
| Create shipment | `create_shipment` | `create-shipment.handler.ts` | ✅ Governed |
| Mark shipment shipped | `mark_shipment_shipped` | `mark-shipment-shipped.handler.ts` | ✅ Governed |
| Mark shipment delivered | `mark_shipment_delivered` | `mark-shipment-delivered.handler.ts` | ✅ Governed |
| Submit for review | `submit_for_review` | `submit-for-review.handler.ts` | ✅ Governed |
| Create invoice | `create_invoice` | `create-invoice.handler.ts` | ✅ Governed |
| Issue invoice | `issue_invoice` | `issue-invoice.handler.ts` | ✅ Governed |
| Void invoice | `void_invoice` | `void-invoice.handler.ts` | ✅ Governed |
| Sales → Procurement | `trigger_sales_to_procurement` | `trigger-sales-to-procurement.handler.ts` | ✅ Governed |
| Start fulfillment | `start_fulfillment` | `start-fulfillment.handler.ts` | ✅ Governed |
| Complete order | `complete_order` | `complete-order.handler.ts` | ✅ Governed |
| Cancel order | `cancel_order` | `cancel-order.handler.ts` | ✅ Governed |

### Tier 2 — REFERENCE DATA (thin control, no workflow)

CRUD operations on reference/catalog entities. These use org-scoped context
and audit logging but do NOT require workflow guards or payment gates.

| Mutation | File | Pattern |
|----------|------|---------|
| Customer CRUD | `app/actions/customers.ts` | ✅ Org-scoped via `getDbContext()` |
| Product CRUD | `app/actions/products.ts` | ✅ Org-scoped via `getDbContext()` |
| Supplier CRUD | `app/actions/suppliers.ts` | ✅ Org-scoped via `getDbContext()` |
| Inventory management | `app/actions/inventory.ts` | ✅ Org-scoped via `getDbContext()` |

### Tier 3 — READ-ONLY (no mutation)

| Action | File |
|--------|------|
| Profitability analysis | `app/actions/profitability.ts` |
| Order metrics | `queries/order-metrics.ts` |
| Dashboard reads | All `get*Action()` functions |

---

## Server Action → Command Routing Table

All write-path server actions in `app/actions/` and `lib/` now route critical
mutations through `executeCommand()` from `lib/control/control-adapter.ts`.

| Server Action File | Critical Mutations | Routing |
|---|---|---|
| `lib/actions.ts` | `createQuoteAction`, `updateQuoteStatusAction` | ✅ Command bus |
| `lib/payment-actions.ts` | `setDepositRequirementAction`, `recordPaymentAction` | ✅ Command bus |
| `lib/send-quote-actions.ts` | `sendQuoteToClientAction`, `submitForReviewAction` | ✅ Command bus |
| `lib/po-actions.ts` | `createPOAction`, `sendPOAction`, `cancelPOAction` | ✅ Command bus |
| `lib/production-actions.ts` | `confirmOrderAction`, `startFulfillmentAction`, `completeOrderAction`, `cancelOrderAction` | ✅ Command bus |
| `lib/financial-actions.ts` | `createInvoiceFromOrderAction`, `issueInvoiceAction`, `voidInvoiceAction` | ✅ Command bus |
| `app/actions/orders.ts` | `createOrderAction`, `updateOrderAction` | ✅ Command bus |
| `app/actions/purchase-orders.ts` | `sendPurchaseOrderAction`, `acknowledgePurchaseOrderAction` | ✅ Command bus |
| `app/actions/workflow-triggers.ts` | `triggerSalesToProcurementAction` | ✅ Command bus |

---

## Route Handlers

| Route | Method | Purpose | Governed? |
|-------|--------|---------|-----------|
| `POST /api/quotes` | POST | Create quote | ✅ via command bus |
| `PATCH /api/quotes/[id]` | PATCH | Update quote | ✅ via command bus |
| `POST /api/quotes/send` | POST | Send quote | ✅ via command bus |
| `POST /api/quotes/review` | POST | Submit for review | ✅ via command bus |
| `POST /api/quote/[token]/respond` | POST | Client accept/reject | ✅ via command bus |
| `POST /api/shopify/webhook` | POST | Shopify webhook | ✅ HMAC verified, adapter-based |
| `POST /api/zoho/webhook` | POST | Zoho webhook | ✅ Adapter-based |
| `GET /api/health` | GET | Health check | ✅ Read-only |
| `GET /api/metrics` | GET | Metrics | ✅ Read-only |

---

## Guards Matrix

| Guard | Protects | Enforcement |
|-------|----------|-------------|
| `invariant-guard.ts` | Entity existence, org ownership, referential integrity | All handlers |
| `workflow-guard.ts` | State machine transitions (quote, order, PO, production, shipment) | All status mutations |
| `payment-guard.ts` | Deposit requirement, payment status, PO/production/shipment gating | Order → PO, Production, Shipment |
| `production-guard.ts` | Production readiness (payment cleared, vendor assigned, proofing done) | Start production |
| `shipment-guard.ts` | Shipment readiness (production complete, address exists) | Create/ship shipment |

---

## Remediation Summary (2026-03-19)

### Phase 1 — Runtime Mutation Consistency (COMPLETE)

| File | Previous Pattern | New Pattern |
|------|-----------------|-------------|
| `app/actions/orders.ts` | Direct commerce-db writes | ✅ Command bus for status changes |
| `app/actions/purchase-orders.ts` | Direct commerce-db writes | ✅ Command bus for workflow transitions |
| `app/actions/workflow-triggers.ts` | Direct Drizzle ORM | ✅ Command bus for quote→PO handoff |
| `lib/production-actions.ts` | Service calls only | ✅ Command bus for all transitions |
| `lib/po-actions.ts` | Service calls only | ✅ Command bus for create/send/cancel |
| `lib/financial-actions.ts` | Service calls only | ✅ Command bus for create/issue/void |
| `lib/send-quote-actions.ts` | Direct repo update for review | ✅ Command bus via `submit_for_review` |

### Phase 2 — Domain Model Hardening (COMPLETE)

| Artifact | Purpose | Status |
|----------|---------|--------|
| `domain/invariants.ts` | 20 pure predicate functions for all entity types | ✅ Created |
| `domain/conversion-rules.ts` | 4 entity promotion rules (quote→order, order→PO, PO→production, order→invoice) | ✅ Created |
| `domain/index.ts` | Barrel export for all invariants + conversion rules | ✅ Updated |
| `send-quote.handler.ts` | Wired `quoteCanBeSent()` domain invariant | ✅ Hardened |
| `confirm-order.handler.ts` | Wired `orderCanBeConfirmed()` domain invariant | ✅ Hardened |
| `send-purchase-order.handler.ts` | Wired `poCanBeSent()` domain invariant | ✅ Hardened |
| `convert-quote-to-order.handler.ts` | Wired `canConvertQuoteToOrder()` conversion rule | ✅ Hardened |
| `issue-invoice.handler.ts` | Wired `invoiceCanBeIssued()` domain invariant | ✅ Hardened |
| `void-invoice.handler.ts` | Wired `invoiceCanBeVoided()` domain invariant | ✅ Hardened |
| `docs/DOMAIN_MODEL_HARDENED.md` | Comprehensive domain reference (entities, machines, invariants, conversion chain) | ✅ Created |
