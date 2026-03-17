# Flow — Workflow Model

> Formal state machines for every Flow domain entity.
> See also: [WORKFLOWS.md](WORKFLOWS.md) for API functions, [DRIZZLE_DOMAIN_MODEL.md](DRIZZLE_DOMAIN_MODEL.md) for schema.

## Order Lifecycle (Primary)

```
CREATED → CONFIRMED → DEPOSIT_REQUIRED → PAYMENT_PARTIAL → PAYMENT_COMPLETE
                                                                    │
CANCELLED ◄── (any active state)                                    ▼
                                                          READY_FOR_PROCUREMENT
                                                                    │
                                                                    ▼
                                                             IN_PRODUCTION
                                                                    │
                                                                    ▼
                                                             READY_TO_SHIP
                                                                    │
                                                                    ▼
                                                                SHIPPED
                                                                    │
                                                                    ▼
                                                               DELIVERED
                                                                    │
                                                                    ▼
                                                                 CLOSED
```

**Enum:** `flowOrderStatusEnum` (12 values)
**Gating rules:**
- `DEPOSIT_REQUIRED → PAYMENT_PARTIAL`: requires deposit payment recorded
- `PAYMENT_COMPLETE → READY_FOR_PROCUREMENT`: automatic once fully paid
- `IN_PRODUCTION → READY_TO_SHIP`: requires all production jobs completed
- `SHIPPED → DELIVERED`: requires shipment delivered confirmation

## Quote Lifecycle

```
DRAFT → INTERNAL_REVIEW → SENT_TO_CLIENT → ACCEPTED → (converts to Order)
                               │
                               ▼
                       REVISION_REQUESTED → SENT_TO_CLIENT (re-send)
                               │
                               ▼
                           REJECTED / EXPIRED
```

**Enum:** `flowQuoteStatusEnum` (7 values)

## Purchase Order Lifecycle

```
DRAFT → SENT → CONFIRMED → IN_PRODUCTION → SHIPPED → RECEIVED
                                                         │
CANCELLED ◄── (DRAFT | SENT)                             ▼
                                                    (triggers production job update)
```

**Enum:** `flowPurchaseOrderStatusEnum` (7 values)

## Production Job Lifecycle

```
PENDING_PROOF → PROOF_SENT → PROOF_APPROVED → IN_PRODUCTION → QUALITY_CHECK → READY_TO_SHIP → COMPLETED
                                                                                                   │
BLOCKED ◄── (any active state)                                                                     ▼
                                                                                        (triggers order READY_TO_SHIP)
```

**Enum:** `flowProductionJobStatusEnum` (8 values)

## Shipment Lifecycle

```
PENDING → PACKED → SHIPPED → IN_TRANSIT → DELIVERED
                                             │
FAILED / RETURNED ◄── (SHIPPED | IN_TRANSIT) ▼
                                        (triggers order DELIVERED)
```

**Enum:** `flowShipmentStatusEnum` (7 values)

## Payment Lifecycle

```
NOT_REQUIRED ──────────────────────────────► (no payment gate)
PENDING_DEPOSIT → PARTIALLY_PAID → PAID
                                     │
OVERDUE ◄── (PENDING_DEPOSIT)        ▼
FAILED ◄── (any pending)        (triggers order PAYMENT_COMPLETE)
REFUNDED ◄── (PAID | PARTIALLY_PAID)
```

**Enum:** `flowPaymentStatusEnum` (7 values)

## Invoice Lifecycle

```
DRAFT → ISSUED → PARTIALLY_PAID → PAID
                      │
                      ▼
                   OVERDUE → PAID
VOID ◄── (DRAFT | ISSUED)
```

**Enum:** `flowInvoiceStatusEnum` (6 values)

## Domain Events

Every state transition emits a domain event recorded in `flow_domain_events`.

**Enum:** `flowEventTypeEnum` (14 event types)

| Event | Trigger |
|-------|---------|
| `quote_created` | New quote saved |
| `quote_sent` | Quote sent to client |
| `quote_accepted` | Client accepts quote |
| `quote_revision_requested` | Client requests revision |
| `order_created` | Quote converted to order |
| `deposit_required` | Payment gate activated |
| `payment_received` | Payment recorded |
| `po_created` | Purchase order generated |
| `po_sent` | PO sent to vendor |
| `po_confirmed` | Vendor confirms PO |
| `production_started` | Production job begins |
| `production_completed` | All production jobs done |
| `shipment_created` | Shipment dispatched |
| `order_delivered` | Final delivery confirmed |

## Cross-Entity Gating

Flow enforces gating rules between entities:

1. **Payment → Production:** Order cannot enter `IN_PRODUCTION` until payment status is `PAYMENT_COMPLETE` (or deposit clears if `dueBeforeProduction = true`)
2. **Production → Shipment:** Shipment cannot be created until production job is `READY_TO_SHIP` or `COMPLETED`
3. **Shipment → Order Close:** Order cannot be `CLOSED` until all shipments are `DELIVERED` and all payments are `PAID`
