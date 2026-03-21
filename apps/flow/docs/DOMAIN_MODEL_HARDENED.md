# Flow — Domain Model Reference (Phase 2 Hardened)

> Comprehensive reference for all domain entities, state machines,
> invariants, conversion rules, and governance enforcement points.
>
> Supersedes the original `DOMAIN_MODEL.md` with full typing and
> enforcement details. Generated during Phase 2: Domain Model Hardening.

---

## Architecture Principle

Flow is **ORDER-CENTRIC**. The order is the primary operational entity.

```
QUOTE → ORDER → PO → PRODUCTION → SHIPMENT → INVOICE
```

Every lifecycle transition is enforced by:
1. **Domain invariants** — pure predicate functions (`domain/invariants.ts`)
2. **Workflow state machines** — explicit transition tables (`lib/workflows/`)
3. **Command bus** — 10-step canonical pipeline (`lib/control/command-bus.ts`)
4. **Guards** — invariant, workflow, payment, production, shipment

No bypass is permitted. All critical mutations route through `executeCommand()`.

---

## Entity Catalog

### Quote
**File:** `domain/entities.ts` — `QuoteSchema`

| Field | Type | Notes |
|-------|------|-------|
| id | UUID | Primary key |
| org_id | string | Multi-org isolation |
| customer_id | UUID | Required for send |
| status | QuoteStatus | State machine governed |
| title | string | 1–500 chars |
| total_amount | number | Must be > 0 to send |
| currency | Currency | CAD, USD, EUR, GBP, XAF |
| margin_estimate | number? | Nullable |
| valid_until | Date? | Enforced by `quoteNotExpired()` |
| notes | string? | Max 5000 |
| created_by | string | Actor reference |

**Statuses:** `DRAFT` → `INTERNAL_REVIEW` → `SENT_TO_CLIENT` → `ACCEPTED` / `REVISION_REQUESTED` / `REJECTED` / `EXPIRED`

---

### Order (PRIMARY ENTITY)
**File:** `domain/entities.ts` — `OrderSchema`

| Field | Type | Notes |
|-------|------|-------|
| id | UUID | Primary key |
| org_id | string | Multi-org isolation |
| quote_id | UUID? | Source quote (nullable for manual orders) |
| customer_id | UUID | Required |
| status | OrderStatus | Main lifecycle state |
| total_amount | number | Must be > 0 |
| currency | Currency | |
| payment_status | PaymentStatus | Composite sub-state |
| production_status | ProductionStatus | Composite sub-state |
| fulfillment_status | FulfillmentStatus | Composite sub-state |

**Composite Status Model:**
- **OrderStatus** (12): CREATED → CONFIRMED → DEPOSIT_REQUIRED → PAYMENT_PARTIAL → PAYMENT_COMPLETE → READY_FOR_PROCUREMENT → IN_PRODUCTION → READY_TO_SHIP → SHIPPED → DELIVERED → CLOSED / CANCELLED
- **PaymentStatus** (5): NOT_REQUIRED, PENDING_DEPOSIT, PARTIALLY_PAID, PAID, OVERDUE
- **ProductionStatus** (7): NOT_STARTED, PENDING_PROOF, PROOF_SENT, PROOF_APPROVED, IN_PRODUCTION, QUALITY_CHECK, COMPLETE
- **FulfillmentStatus** (5): NOT_STARTED, READY_TO_SHIP, SHIPPED, IN_TRANSIT, DELIVERED

---

### Customer
**File:** `domain/entities.ts` — `CustomerSchema`

Reference entity — no state machine. Validates email format, max lengths.

---

### Product
**File:** `domain/entities.ts` — `ProductSchema`

Reference entity — no state machine. SKU, unit price, category, active flag.

---

### Vendor
**File:** `domain/entities.ts` — `VendorSchema`

Reference entity — no state machine. Contact info, lead time, rating.

---

### Purchase Order
**File:** `domain/entities.ts` — `PurchaseOrderSchema`

| Field | Type | Notes |
|-------|------|-------|
| id | UUID | Primary key |
| org_id | string | Multi-org isolation |
| order_id | UUID | Parent order |
| vendor_id | UUID | Assigned vendor |
| status | PurchaseOrderStatus | State machine governed |
| total_amount | number | |
| expected_delivery | Date? | |

**Statuses:** `DRAFT` → `SENT` → `CONFIRMED` → `IN_PRODUCTION` → `SHIPPED` → `RECEIVED` / `CANCELLED`

---

### Production Job
**File:** `domain/entities.ts` — `ProductionJobSchema`

| Field | Type | Notes |
|-------|------|-------|
| id | UUID | Primary key |
| order_id | UUID | Parent order |
| purchase_order_id | UUID? | Optional PO link |
| vendor_id | UUID | Required |
| status | ProductionJobStatus | State machine governed |
| proof_url | URL? | Design proof link |
| estimated_completion | Date? | |
| actual_completion | Date? | |

**Statuses:** `PENDING_PROOF` → `PROOF_SENT` ↔ `PENDING_PROOF` (rejection loop) → `PROOF_APPROVED` → `IN_PRODUCTION` ↔ `QUALITY_CHECK` (QC loop) → `READY_TO_SHIP`

---

### Shipment
**File:** `domain/entities.ts` — `ShipmentSchema`

| Field | Type | Notes |
|-------|------|-------|
| id | UUID | Primary key |
| order_id | UUID | Parent order |
| carrier | string? | Required for tracking |
| tracking_number | string? | Required for tracking |
| tracking_url | URL? | |
| status | ShipmentStatus | State machine governed |

**Statuses:** `PENDING` → `PACKED` → `SHIPPED` → `IN_TRANSIT` → `DELIVERED` / `FAILED` → `RETURNED` or retry

---

### Invoice
**File:** `domain/entities.ts` — `InvoiceSchema`

| Field | Type | Notes |
|-------|------|-------|
| id | UUID | Primary key |
| order_id | UUID | Parent order |
| customer_id | UUID | Billing target |
| status | InvoiceStatus | |
| amount | number | > 0 to issue |
| due_date | Date | |

**Statuses:** `DRAFT` → `SENT` → `PAID` / `OVERDUE` / `VOID`

---

### Payment
**File:** `domain/entities.ts` — `PaymentSchema`

Append-only record — no state machine. Amount, method, reference, received_at.

---

### Audit Event
**File:** `domain/entities.ts` — `AuditEventSchema`

Append-only record. actor_id, entity_type, entity_id, action, metadata, timestamp.

---

## State Machine Transitions

### Quote Transitions
**File:** `lib/workflows/quote-state-machine.ts`

```
DRAFT ──→ INTERNAL_REVIEW ──→ SENT_TO_CLIENT ──→ ACCEPTED ──→ DEPOSIT_REQUIRED ──→ READY_FOR_PO
  │              │                    │              │                                    │
  └─ CANCELLED   └─ DRAFT (return)   ├─ REVISION_REQUESTED → DRAFT / SENT_TO_CLIENT     │
                                     ├─ EXPIRED                                          │
                                     └─ CANCELLED              ┌─────────────────────────┘
                                                               ↓
                                                         IN_PRODUCTION → SHIPPED → DELIVERED → CLOSED
```

### Order Transitions
**File:** `lib/workflows/order-workflow.ts`

```
CREATED ──→ CONFIRMED ──→ DEPOSIT_REQUIRED ──→ PAYMENT_PARTIAL ──→ PAYMENT_COMPLETE
  │              │              │                                        │
  └─ CANCELLED   ├─ CANCELLED  └─ CANCELLED                             │
                 │                                                       ↓
                 └─ PAYMENT_COMPLETE ──────────────────→ READY_FOR_PROCUREMENT
                                                                │
                                                                ↓
                                          IN_PRODUCTION → READY_TO_SHIP → SHIPPED → DELIVERED → CLOSED
```

### Purchase Order Transitions
**File:** `lib/workflows/po-workflow.ts`

```
DRAFT ──→ SENT ──→ CONFIRMED ──→ IN_PRODUCTION ──→ SHIPPED ──→ RECEIVED
  │         │          │              │
  └─ CANCEL └─ DRAFT   └─ CANCELLED  └─ CANCELLED
             └─ CANCELLED
```

### Production Transitions
**File:** `lib/workflows/production-workflow.ts`

```
PENDING_PROOF ←─→ PROOF_SENT → PROOF_APPROVED → IN_PRODUCTION ←─→ QUALITY_CHECK → READY_TO_SHIP
     (rejection loop)                                   (QC failure loop)
```

### Shipment Transitions
**File:** `lib/workflows/shipment-state-machine.ts`

```
PENDING ──→ PACKED ──→ SHIPPED ──→ IN_TRANSIT ──→ DELIVERED
  │                                     │
  └── SHIPPED (direct shortcut)         ├─ FAILED ──→ PENDING (retry)
                                        └─ FAILED ──→ RETURNED
```

---

## Domain Invariants

**File:** `domain/invariants.ts`

All invariants are **pure functions** — no DB access. They take entity data and return `InvariantResult { valid: boolean, violations: string[] }`.

| Invariant | Entity | Checks |
|-----------|--------|--------|
| `quoteHasLines(count)` | Quote | At least one line item |
| `quoteHasCustomer(quote)` | Quote | `customer_id` is set |
| `quoteNotExpired(quote)` | Quote | `valid_until` not past |
| `quoteCanBeSent(quote, lines)` | Quote | All above + total > 0 |
| `orderHasCustomer(order)` | Order | `customer_id` is set |
| `orderNotCancelled(order)` | Order | Status ≠ CANCELLED |
| `orderNotClosed(order)` | Order | Status ≠ CLOSED |
| `orderCanBeConfirmed(order)` | Order | Customer + not cancelled + total > 0 |
| `depositSatisfied(info)` | Payment | Paid ≥ deposit% × total |
| `fullPaymentSatisfied(info)` | Payment | Paid ≥ total |
| `poHasVendor(po)` | PO | `vendor_id` is set |
| `poNotCancelled(po)` | PO | Status ≠ CANCELLED |
| `poCanBeSent(po, lines)` | PO | Vendor + not cancelled + lines + total > 0 |
| `productionHasVendor(job)` | Production | `vendor_id` is set |
| `productionCanStart(job, payment)` | Production | Vendor + deposit met |
| `shipmentHasTrackingInfo(shipment)` | Shipment | Carrier + tracking number |
| `invoiceNotVoid(invoice)` | Invoice | Status ≠ VOID |
| `invoiceNotPaid(invoice)` | Invoice | Status ≠ PAID |
| `invoiceCanBeIssued(invoice)` | Invoice | Not void + DRAFT status + amount > 0 |
| `invoiceCanBeVoided(invoice)` | Invoice | Status ≠ PAID |

---

## Conversion Rules

**File:** `domain/conversion-rules.ts`

Entity promotion follows this chain:

```
QUOTE (ACCEPTED) ──canConvertQuoteToOrder()──→ ORDER (CREATED)
                                                   │
                        ┌──canCreatePOFromOrder()───┘
                        ↓
                 PURCHASE ORDER (DRAFT)
                        │
        ┌──canStartProductionFromPO()──┘
        ↓
   PRODUCTION JOB (PENDING_PROOF)
        │
     (automatic on completion)
        ↓
     SHIPMENT (PENDING) ──→ DELIVERED
        │
   canCreateInvoiceFromOrder()
        ↓
     INVOICE (DRAFT) ──→ SENT ──→ PAID
```

| Rule | From | To | Requirements |
|------|------|----|-------------|
| `canConvertQuoteToOrder()` | Quote | Order | Status ACCEPTED/READY_FOR_PO, customer set, lines > 0, total > 0 |
| `canCreatePOFromOrder()` | Order | PO | Status CONFIRMED/PAYMENT_COMPLETE/READY_FOR_PROCUREMENT, vendor assigned |
| `canStartProductionFromPO()` | PO | Production | PO CONFIRMED, vendor set, payment at least partial |
| `canCreateInvoiceFromOrder()` | Order | Invoice | Not CREATED/CANCELLED, customer set, total > 0 |

---

## Command Bus Pipeline

**File:** `lib/control/command-bus.ts`

Every critical mutation flows through these 10 steps:

```
1. Validate     → Zod parse of command input
2. Load         → Fetch domain state from repository
3. Invariant    → domain/invariants.ts pure predicates
4. Workflow     → lib/workflows/* state machine validation
5. Payment      → Payment gate guard (clear/blocked/warning)
6. Production   → Production gate guard (PO + vendor + proof)
7. Shipment     → Shipment gate guard (production complete + address)
8. Persist      → Repository write
9. Event        → Domain event dispatch
10. Audit       → Audit log entry
```

**25 registered command types:**

| Command | Entity | Handler |
|---------|--------|---------|
| `create_quote` | Quote | `create-quote.handler.ts` |
| `send_quote` | Quote | `send-quote.handler.ts` |
| `accept_quote` | Quote | `accept-quote.handler.ts` |
| `request_quote_revision` | Quote | `request-quote-revision.handler.ts` |
| `submit_for_review` | Quote | `submit-for-review.handler.ts` |
| `convert_quote_to_order` | Quote→Order | `convert-quote-to-order.handler.ts` |
| `confirm_order` | Order | `confirm-order.handler.ts` |
| `start_fulfillment` | Order | `start-fulfillment.handler.ts` |
| `complete_order` | Order | `complete-order.handler.ts` |
| `cancel_order` | Order | `cancel-order.handler.ts` |
| `require_deposit` | Order | `require-deposit.handler.ts` |
| `confirm_payment` | Order | `confirm-payment.handler.ts` |
| `record_payment` | Payment | `record-payment.handler.ts` |
| `create_purchase_order` | PO | `create-purchase-order.handler.ts` |
| `send_purchase_order` | PO | `send-purchase-order.handler.ts` |
| `confirm_purchase_order` | PO | `confirm-purchase-order.handler.ts` |
| `start_production` | Production | `start-production.handler.ts` |
| `complete_production` | Production | `complete-production.handler.ts` |
| `create_shipment` | Shipment | `create-shipment.handler.ts` |
| `mark_shipment_shipped` | Shipment | `mark-shipment-shipped.handler.ts` |
| `mark_shipment_delivered` | Shipment | `mark-shipment-delivered.handler.ts` |
| `create_invoice` | Invoice | `create-invoice.handler.ts` |
| `issue_invoice` | Invoice | `issue-invoice.handler.ts` |
| `void_invoice` | Invoice | `void-invoice.handler.ts` |
| `trigger_sales_to_procurement` | Quote→Order | `trigger-sales-to-procurement.handler.ts` |

---

## Guard Architecture

### Invariant Guard (`lib/control/guards/invariant-guard.ts`)
- **DB-level checks:** entity exists, belongs to org, linked records exist
- **Delegates to** `domain/invariants.ts` for pure predicate checks in handlers

### Workflow Guard (`lib/control/guards/workflow-guard.ts`)
- **Unified facade** for all 5 state machines
- `validateTransition(workflow, from, to)` → `WorkflowCheckResult`
- `getAvailableTransitions(workflow, currentStatus)` → `string[]`

### Payment Guard (`lib/control/guards/payment-guard.ts`)
- Returns `PaymentGateCheckResult` with gate_state: `clear | blocked | warning`
- Includes `required_actions` for UI-readable blocking reasons

### Production Guard (`lib/control/guards/production-guard.ts`)
- Checks: PO valid, payment cleared, vendor assigned, proofing satisfied

### Shipment Guard (`lib/control/guards/shipment-guard.ts`)
- Checks: production complete, shipping address exists

---

## Multi-Tenancy

All entities carry `org_id`. All repository methods require `orgId` as a parameter.
Context resolution:
- **Commands:** `resolveOrgContext()` → `{ orgId, actorId, role, permissions }`
- **Reads:** `getReadContext()` / `getDbContext()` → commerce-db scoped client

No cross-org data access is possible at the repository layer.

---

## File Map

```
apps/flow/
├── domain/
│   ├── entities.ts          — Zod schemas + types for all 11 entities
│   ├── invariants.ts        — Pure predicate functions (20 invariants)
│   ├── conversion-rules.ts  — Entity promotion rules (4 rules)
│   └── index.ts             — Barrel export
├── lib/
│   ├── commands/
│   │   └── types.ts         — 25 command Zod schemas + FlowCommand union
│   ├── control/
│   │   ├── command-bus.ts   — Central execution pipeline
│   │   ├── control-adapter.ts — executeCommand() / executeCommandV2()
│   │   ├── types.ts         — CommandContext, CommandResult, guard types
│   │   ├── guards/
│   │   │   ├── invariant-guard.ts
│   │   │   ├── workflow-guard.ts
│   │   │   ├── payment-guard.ts
│   │   │   ├── production-guard.ts
│   │   │   └── shipment-guard.ts
│   │   ├── handlers/        — 25 command handlers
│   │   ├── dispatch/
│   │   │   ├── event-dispatcher.ts
│   │   │   ├── audit-dispatcher.ts
│   │   │   └── side-effect-dispatcher.ts
│   │   └── register-handlers.ts
│   └── workflows/
│       ├── types.ts              — Transition, TransitionResult, InvalidTransitionError
│       ├── quote-state-machine.ts
│       ├── order-workflow.ts
│       ├── po-workflow.ts
│       ├── production-workflow.ts
│       └── shipment-state-machine.ts
```

---

## Known Gaps

1. **Status casing:** Domain entities use UPPERCASE (`CONFIRMED`, `CANCELLED`), DB layer uses lowercase (`confirmed`, `cancelled`). Handlers bridge this with `.toUpperCase()`.
2. **Quote state machine vs. entity enum:** The quote state machine includes `DEPOSIT_REQUIRED`, `READY_FOR_PO`, `IN_PRODUCTION`, `SHIPPED`, `DELIVERED`, `CLOSED` — but `QuoteStatus` in entities.ts only has 7 values. The extended statuses live in `QuoteWorkflowStatus` (workflow-schemas.ts).
3. **Fulfillment gap:** The `start_fulfillment` handler maps to order status but `FULFILLMENT` is not a value in `OrderStatus`. The handler uses `IN_PRODUCTION` as the nearest match.
