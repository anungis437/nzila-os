# Flow — Guard Reference

> Guards enforce domain invariants *before* any command mutates state.
> Each guard returns `{ ok: true }` or `{ ok: false, code, message }`.

---

## Guard Chain

Commands pass through guards in a fixed order:

```
Command → Invariant → Workflow → Payment → Production → Shipment → Handler
```

Not every guard runs for every command — the control adapter selects the
applicable chain based on the command type.

---

## 1. Invariant Guard

**File:** `lib/control/guards/invariant-guard.ts`

Validates that referenced entities exist and belong to the requesting org.

| Check | When |
|-------|------|
| Customer exists | `create_quote` |
| Quote exists + belongs to org | Quote mutation commands |
| Order exists + belongs to org | Order / PO / production / shipment commands |
| Payment exists + belongs to org | `confirm_payment` |
| PO exists + belongs to org | `send_purchase_order`, `confirm_purchase_order` |
| Production job exists | `complete_production` |
| Shipment exists | `mark_shipment_shipped`, `mark_shipment_delivered` |

**Error:** `EntityNotFoundError(entityType, entityId)`

---

## 2. Workflow Guard

**File:** `lib/control/guards/workflow-guard.ts`

Validates state machine transitions using the pure transition functions in
`lib/state-machines/`.

| Workflow | Valid Transitions |
|----------|-------------------|
| **Quote** | DRAFT → INTERNAL_REVIEW → SENT_TO_CLIENT → ACCEPTED / REVISION_REQUESTED / EXPIRED / CANCELLED |
| **Order** | CREATED → CONFIRMED → DEPOSIT_REQUIRED / PAYMENT_COMPLETE → READY_FOR_PROCUREMENT → IN_PRODUCTION → READY_TO_SHIP → SHIPPED → DELIVERED → CLOSED |
| **Purchase Order** | DRAFT → SENT → CONFIRMED |
| **Production** | PENDING_PROOF → PROOF_SENT → PROOF_APPROVED → IN_PRODUCTION → QUALITY_CHECK → READY_TO_SHIP |
| **Shipment** | PENDING → PACKED / SHIPPED → IN_TRANSIT → DELIVERED / FAILED. FAILED → PENDING / RETURNED |

**Error:** `InvalidTransitionError(workflow, from, to, allowed?)`

### Terminal States (no outbound transitions)

- Quote: `CANCELLED`, `EXPIRED`, `CLOSED`
- Order: `CLOSED`
- Shipment: `DELIVERED`, `RETURNED`
- Production: `READY_TO_SHIP`

---

## 3. Payment Guard

**File:** `lib/control/guards/payment-guard.ts`

Enforces payment gates before downstream operations proceed.

| Gate | Blocks | Condition |
|------|--------|-----------|
| **Deposit gate** | `create_purchase_order` | Outstanding balance > 0 and `deposit_required` is true |
| **Overdue gate** | PO / production commands | Payment overdue past due date |
| **PO clearance** | `start_production` | Payment not confirmed |

**Error:** `PaymentGateBlockedError(orderId, gate, blockers, outstandingBalance)`

### Payment State Service

`lib/services/payment-state-service.ts` computes:

- `totalInvoiced` — sum of order line totals
- `totalPaid` — sum of confirmed payments
- `outstandingBalance` — difference
- `depositMet` — whether deposit threshold is cleared
- `paymentStatus` — `UNPAID | PARTIAL | PAID | OVERPAID`

---

## 4. Production Guard

**File:** `lib/control/guards/production-guard.ts`

Validates preconditions for starting production.

| Check | Condition |
|-------|-----------|
| PO valid | PO must exist and be in CONFIRMED status |
| Payment cleared | Deposit gate must be met |
| Vendor assigned | PO must have a `vendor_id` |

**Error:** `InvariantViolationError(invariant, context?)`

---

## 5. Shipment Guard

**File:** `lib/control/guards/shipment-guard.ts`

Validates preconditions for shipment creation and transitions.

| Check | Condition |
|-------|-----------|
| Production complete | At least one production job must be in READY_TO_SHIP |
| Address exists | Shipping address must be set on the order |

**Error:** `InvariantViolationError(invariant, context?)`

---

## Guard Composition

The control adapter builds a guard chain per command type:

```typescript
// Simplified example
const chain = [
  invariantGuard,   // always first
  workflowGuard,    // if command mutates workflow status
  paymentGuard,     // if command is payment-gated
];

for (const guard of chain) {
  const result = await guard(command, context);
  if (!result.ok) return CommandResult.failure(result.code, result.message);
}
```

Guards are **fail-fast** — the first failure stops the chain and returns
an error result. No side effects occur if any guard rejects.
