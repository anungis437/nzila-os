# Flow — Command Reference

> All 17 commands in the Flow control layer, with schemas, guards, and outcomes.

## Command Lifecycle

Every command follows: **validate → guard → persist → event → audit → result**

---

## Quote Commands

### `create_quote`

Creates a new quote in DRAFT status.

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `customer_id` | UUID | Yes | Must exist in org |
| `title` | string | Yes | Quote title |
| `currency` | CAD/USD/EUR/GBP/XAF | Yes | |
| `lines` | array | Yes | Min 1 line |
| `lines[].description` | string | Yes | |
| `lines[].sku` | string | No | |
| `lines[].quantity` | int > 0 | Yes | |
| `lines[].unit_price` | number ≥ 0 | Yes | |
| `valid_until` | date | No | |
| `notes` | string | No | |

**Guards:** Invariant (customer exists)
**Event:** `quote_created`
**Result status:** `DRAFT`

---

### `send_quote`

Transitions a quote from DRAFT → INTERNAL_REVIEW → SENT_TO_CLIENT.

| Field | Type | Required |
|-------|------|----------|
| `quote_id` | UUID | Yes |

**Guards:** Invariant (quote exists), Workflow (DRAFT → SENT_TO_CLIENT)
**Event:** `quote_sent`

---

### `accept_quote`

Client accepts a sent quote.

| Field | Type | Required |
|-------|------|----------|
| `quote_id` | UUID | Yes |
| `customer_name` | string | No |
| `customer_email` | email | No |
| `message` | string | No |

**Guards:** Invariant, Workflow (SENT_TO_CLIENT → ACCEPTED)
**Event:** `quote_accepted`

---

### `request_quote_revision`

Client requests changes to a sent quote.

| Field | Type | Required |
|-------|------|----------|
| `quote_id` | UUID | Yes |
| `request_message` | string | Yes |

**Guards:** Invariant, Workflow (SENT_TO_CLIENT → REVISION_REQUESTED)
**Event:** `quote_revision_requested`

---

### `convert_quote_to_order`

Creates an order from an accepted quote.

| Field | Type | Required |
|-------|------|----------|
| `quote_id` | UUID | Yes |

**Guards:** Invariant, Workflow (quote must be ACCEPTED)
**Event:** `quote_converted`, `order_created`
**Result:** New order ID returned

---

## Order Commands

### `confirm_order`

Confirms a created order.

| Field | Type | Required |
|-------|------|----------|
| `order_id` | UUID | Yes |

**Guards:** Invariant, Workflow (CREATED → CONFIRMED)
**Event:** `order_confirmed`

---

### `require_deposit`

Sets deposit requirement on an order.

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `order_id` | UUID | Yes | |
| `deposit_required` | boolean | Yes | |
| `deposit_percent` | 0–100 | No | |
| `deposit_amount` | number ≥ 0 | No | |
| `due_before_production` | boolean | No | Defaults to `true` |

**Guards:** Invariant (order exists)
**Event:** `deposit_required`

---

## Payment Commands

### `record_payment`

Records a payment against an order.

| Field | Type | Required |
|-------|------|----------|
| `order_id` | UUID | Yes |
| `amount` | number > 0 | Yes |
| `currency` | CAD/USD/EUR/GBP/XAF | Yes |
| `method` | BANK_TRANSFER/CREDIT_CARD/CHECK/CASH/OTHER | Yes |
| `reference` | string | No |

**Guards:** Invariant (order exists)
**Event:** `payment_recorded`

---

### `confirm_payment`

Confirms a recorded payment.

| Field | Type | Required |
|-------|------|----------|
| `payment_id` | UUID | Yes |
| `order_id` | UUID | Yes |

**Guards:** Invariant (payment + order exist)
**Event:** `payment_confirmed`

---

## Purchase Order Commands

### `create_purchase_order`

Creates a PO for an order. **Payment-gated.**

| Field | Type | Required |
|-------|------|----------|
| `order_id` | UUID | Yes |
| `vendor_id` | UUID | Yes |
| `expected_delivery` | date | No |

**Guards:** Invariant, **Payment Gate** (deposit must be cleared)
**Event:** `po_created`
**Blocked event:** `payment_gate_blocked` if deposit not met

---

### `send_purchase_order`

Sends a PO to the vendor.

| Field | Type | Required |
|-------|------|----------|
| `purchase_order_id` | UUID | Yes |

**Guards:** Invariant, Workflow (DRAFT → SENT)
**Event:** `po_sent`

---

### `confirm_purchase_order`

Vendor confirms the PO.

| Field | Type | Required |
|-------|------|----------|
| `purchase_order_id` | UUID | Yes |

**Guards:** Invariant, Workflow (SENT → CONFIRMED)
**Event:** `po_confirmed`

---

## Production Commands

### `start_production`

Starts a production job for an order.

| Field | Type | Required |
|-------|------|----------|
| `order_id` | UUID | Yes |
| `purchase_order_id` | UUID | Yes |
| `vendor_id` | UUID | Yes |

**Guards:** Invariant, Production Gate (PO confirmed, payment cleared, vendor assigned)
**Event:** `production_started`

---

### `complete_production`

Marks a production job as complete.

| Field | Type | Required |
|-------|------|----------|
| `production_job_id` | UUID | Yes |
| `order_id` | UUID | Yes |

**Guards:** Invariant, Workflow (production must be in active state)
**Event:** `production_completed`

---

## Shipment Commands

### `create_shipment`

Creates a shipment record for an order.

| Field | Type | Required |
|-------|------|----------|
| `order_id` | UUID | Yes |
| `carrier` | string | No |
| `tracking_number` | string | No |

**Guards:** Invariant, Shipment Gate (production complete)
**Event:** `shipment_created`

---

### `mark_shipment_shipped`

Marks a shipment as shipped with tracking info.

| Field | Type | Required |
|-------|------|----------|
| `shipment_id` | UUID | Yes |
| `order_id` | UUID | Yes |
| `carrier` | string | Yes |
| `tracking_number` | string | Yes |
| `tracking_url` | URL | No |

**Guards:** Invariant, Workflow (PENDING → SHIPPED)
**Event:** `shipment_shipped`

---

### `mark_shipment_delivered`

Marks a shipment as delivered.

| Field | Type | Required |
|-------|------|----------|
| `shipment_id` | UUID | Yes |
| `order_id` | UUID | Yes |

**Guards:** Invariant, Workflow (SHIPPED/IN_TRANSIT → DELIVERED)
**Event:** `shipment_delivered`

---

## Common Fields

All commands include these base fields:

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `type` | string literal | Yes | Discriminator |
| `org_id` | string | Yes | Org isolation |
| `actor_id` | string | Yes | Who is executing |
| `correlation_id` | UUID | No | Request tracing |
| `reason` | string | No | Audit context |
| `notes` | string | No | Free-form notes |
