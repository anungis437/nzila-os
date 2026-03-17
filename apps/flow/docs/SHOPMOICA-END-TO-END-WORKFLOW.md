# ShopMoiCa — End-to-End Workflow

> Internal implementation reference. All code must follow this state model.

## Canonical Business Flow

```text
1. Client Request / Lead
   └─ customer contacts ShopMoiCa (email, web form, phone, Zoho CRM)
   └─ staff creates a quote in DRAFT status

2. Quote Draft
   └─ staff adds line items, quantities, pricing tier
   └─ taxes calculated via @nzila/pricing-engine (GST/QST)
   └─ customer and shipping details attached

3. Quote Internal Review
   └─ status: INTERNAL_REVIEW
   └─ margin floor and discount cap gates evaluated
   └─ governance approval required if total > $10,000

4. Quote Sent to Client
   └─ status: SENT_TO_CLIENT
   └─ secure share link generated (hashed token, expirable)
   └─ client views quote via /quote/[token] (no auth required)
   └─ audit: quote_sent_to_client, quote_share_link_created

5. Client Accepts OR Requests Revision
   └─ ACCEPTED: client clicks accept on portal → status becomes ACCEPTED
   └─ REVISION_REQUESTED: client submits revision message → status becomes REVISION_REQUESTED
   └─ staff addresses revision → resolves → can re-send
   └─ audit: quote_accepted_by_client, quote_revision_requested

6. Deposit / Payment Requirement Evaluated
   └─ status: DEPOSIT_REQUIRED (if deposit policy applies)
   └─ payment-gating-service evaluates: deposit_required, deposit_percent, deposit_amount
   └─ if no deposit required, skip to READY_FOR_PO

7. Invoice or Deposit Request Issued
   └─ deposit invoice created via financial-service or Zoho Books
   └─ audit: deposit_request_created

8. Payment Status Updated
   └─ payment recorded (manual confirmation or Zoho sync)
   └─ status: PENDING_DEPOSIT → PARTIALLY_PAID → PAID
   └─ audit: payment_status_changed

9. Purchase Order Created for Supplier
   └─ status: READY_FOR_PO
   └─ quote-to-po-service validates: accepted + payment cleared + supplier selected
   └─ PO created via po-service (PO-YYYY-### format)
   └─ audit: po_created_from_quote

10. Production Starts
    └─ status: IN_PRODUCTION
    └─ production-gating-service validates: PO valid + payment clear + details complete
    └─ order fulfilment and allocation via production-service
    └─ audit: production_started

11. Shipped / Delivered
    └─ status: SHIPPED → DELIVERED
    └─ shipping notice sent to customer
    └─ audit: order_shipped, order_delivered

12. Final Invoice / Closeout
    └─ status: CLOSED
    └─ final invoice issued (balance after deposit)
    └─ audit: quote_closed
```

## Quote Statuses

| Status               | Description                                     | Internal? |
|----------------------|-------------------------------------------------|-----------|
| DRAFT                | Quote created, not yet reviewed                 | Yes       |
| INTERNAL_REVIEW      | Under internal margin/governance review         | Yes       |
| SENT_TO_CLIENT       | Sent to customer via secure link                | Yes       |
| REVISION_REQUESTED   | Client requested changes                        | Yes       |
| ACCEPTED             | Client accepted the quote                       | Yes       |
| DEPOSIT_REQUIRED     | Deposit payment needed before PO                | Yes       |
| READY_FOR_PO         | All gates passed, PO can be created             | Yes       |
| IN_PRODUCTION        | Order is being fulfilled                        | Yes       |
| SHIPPED              | Order has been shipped                          | Yes       |
| DELIVERED            | Order delivered to customer                     | Yes       |
| CLOSED               | Quote lifecycle complete                        | Yes       |
| EXPIRED              | Quote validity lapsed without acceptance        | Yes       |
| CANCELLED            | Quote cancelled by staff                        | Yes       |

## Allowed Transitions

```text
DRAFT              → INTERNAL_REVIEW
DRAFT              → CANCELLED
INTERNAL_REVIEW    → SENT_TO_CLIENT
INTERNAL_REVIEW    → DRAFT              (returned for edits)
SENT_TO_CLIENT     → ACCEPTED
SENT_TO_CLIENT     → REVISION_REQUESTED
SENT_TO_CLIENT     → EXPIRED
SENT_TO_CLIENT     → CANCELLED
REVISION_REQUESTED → DRAFT              (re-edit after revision)
REVISION_REQUESTED → SENT_TO_CLIENT     (re-send after addressing)
ACCEPTED           → DEPOSIT_REQUIRED
ACCEPTED           → READY_FOR_PO       (no deposit needed)
DEPOSIT_REQUIRED   → READY_FOR_PO       (deposit received)
READY_FOR_PO       → IN_PRODUCTION
IN_PRODUCTION      → SHIPPED
SHIPPED            → DELIVERED
DELIVERED          → CLOSED
```

## Order Statuses

| Status            | Description                              |
|-------------------|------------------------------------------|
| created           | Order record created from approved quote |
| confirmed         | Order confirmed, awaiting fulfilment     |
| fulfillment       | Materials allocated, production active   |
| shipped           | Order shipped to customer                |
| delivered         | Delivery confirmed                       |
| completed         | All invoices settled, order closed       |
| cancelled         | Order cancelled                          |
| return_requested  | Customer requested return                |
| needs_attention   | Issue flagged for operator review        |

## Payment Statuses

| Status           | Description                          |
|------------------|--------------------------------------|
| NOT_REQUIRED     | No deposit/payment gating needed     |
| PENDING_DEPOSIT  | Deposit invoice issued, awaiting pay |
| PARTIALLY_PAID   | Partial payment received             |
| PAID             | Full payment received                |
| OVERDUE          | Payment past due date                |

## Key Services

| Service                       | File                                        | Responsibility                           |
|-------------------------------|---------------------------------------------|------------------------------------------|
| Quote Repository              | lib/db.ts                                   | CRUD for quotes and customers            |
| Quote State Machine           | lib/workflows/quote-state-machine.ts        | Enforces status transitions              |
| Payment Gating Service        | lib/services/payment-gating-service.ts      | Evaluates deposit/payment requirements   |
| Quote-to-PO Service           | lib/services/quote-to-po-service.ts         | Validates and creates PO from quote      |
| Production Gating Service     | lib/services/production-gating-service.ts   | Validates production readiness           |
| Financial Service             | lib/financial-service.ts                    | Invoicing, payments, aging               |
| PO Service                    | lib/po-service.ts                           | Purchase order CRUD                      |
| Production Service            | lib/production-service.ts                   | Order fulfilment and allocation          |
| Share Link Service            | lib/services/share-link-service.ts          | Secure client-facing links               |
| Customer Communication        | lib/customer-communication/templates.ts     | Email/message templates                  |
| Audit / Evidence              | lib/evidence.ts                             | Audit trail and evidence packs           |

## Zoho Integration Points

- **Zoho CRM**: Customer/contact sync, deal stage mapping
- **Zoho Books**: Invoice creation, payment recording, vendor sync
- **Zoho Inventory**: Product/stock sync

The finance model in this app tracks local state. Zoho Books is the source of truth
for accounting. Payment confirmation can be manual (staff) or via Zoho sync.

## Security Model

- Internal routes: Clerk authentication required
- Customer portal: Token-based access (no auth account needed)
  - Tokens are SHA-256 hashed server-side
  - Tokens have configurable expiry (default 7 days)
  - Tokens can be revoked
  - Access is logged with IP hash and timestamp
- All state transitions emit audit events
- Evidence export includes workflow events
