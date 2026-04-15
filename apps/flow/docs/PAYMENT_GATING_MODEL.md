# Flow — Payment Gating Model

## Overview

Payment gating enforces that certain lifecycle transitions cannot happen until financial requirements are met. It is implemented as a **guard** that runs inside command handlers — not as middleware or UI-level validation.

## The Guard (Single Source of Truth)

`lib/control/guards/payment-guard.ts` is the ONLY authoritative source for payment gate decisions. It exposes three async functions:

```typescript
checkCanGeneratePO(orderId, orgId): Promise<PaymentGateCheckResult>
checkCanStartProduction(orderId, orgId): Promise<PaymentGateCheckResult>
checkCanShipOrder(orderId, orgId): Promise<PaymentGateCheckResult>
```

Each returns a `PaymentGateCheckResult` with:

- `allowed: boolean` — whether the operation is permitted
- `gate_state: 'clear' | 'blocked'`
- `reasons: string[]` — human-readable block reasons
- `required_actions: string[]` — what the user must do to unblock
- `snapshot` — full context: `{ order_id, payment_status, amount_due, amount_paid, deposit_required, due_before_production }`

## Deposit Requirement Resolution

```
Order → has quote_id?
  └─ YES → paymentRequirementRepo.findByQuoteId() → DepositRequirement
  └─ NO  → DEFAULT_DEPOSIT (not required)
```

`DEFAULT_DEPOSIT.required = false` — orders without quotes are not payment-gated by default.

## Gate Logic (Pure Functions)

The actual gate logic is in `lib/services/order-payment-gating.ts`:

```typescript
canGeneratePO(order, totalPaid, depositRule) → { allowed, blockers }
canStartProduction(order, totalPaid, depositRule) → { allowed, blockers }
canShipOrder(order, totalPaid) → { allowed, blockers }
```

These are pure functions with no DB access — the guard loads context and feeds them.

## Payment State Service

`lib/services/payment-state-service.ts` provides canonical payment state management:

```typescript
computeOrderPaymentState(orderId, orgId): Promise<OrderPaymentState>
// Returns: 'NOT_REQUIRED' | 'PENDING_DEPOSIT' | 'PARTIAL' | 'PAID' | 'OVERDUE' | 'FAILED'

syncOrderPaymentState(orderId, orgId): Promise<OrderPaymentState>
// Computes + writes to order.paymentStatus column

getOutstandingBalance(orderId, orgId): Promise<number>
// Returns: max(0, amountDue - amountPaid)

getPaymentBlockingReasons(orderId, orgId): Promise<string[]>
// Returns: [] (clear) or list of human-readable block reasons
```

## Events Emitted

| Condition | Event |
|-----------|-------|
| Payment guard blocks an operation | `order_payment_blocked` |
| Order payment status changes to PAID | `order_payment_cleared` |
| Payment recorded | `payment_recorded` |
| Payment confirmed | `payment_confirmed` |

## What CANNOT Happen

- A PO cannot be created without payment gate check (enforced in `create-purchase-order.handler.ts`)
- Production cannot start without payment gate check (enforced in `start-production.handler.ts`)
- `app/actions/purchase-orders.ts` no longer calls `createPurchaseOrder` directly
- No server action can bypass the command bus for PO creation
