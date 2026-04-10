# Flow — Workflow Reference

> Definitive guide to all state machines in the Flow commerce & production engine.

## 1. Order Workflow (PRIMARY)

**File:** `lib/workflows/order-workflow.ts`
**14 transitions** covering the full order lifecycle.

```
CREATED ──► CONFIRMED ──► DEPOSIT_REQUIRED ──► PAYMENT_PARTIAL ──► PAYMENT_COMPLETE
                                                                         │
CANCELLED ◄── (any active state)                                         ▼
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

### Key Functions
- `validateOrderTransition(from, to)` — check if transition is valid
- `attemptOrderTransition(from, to)` — returns `TransitionResult`
- `applyOrderTransition(from, to)` — throws `InvalidTransitionError` on failure
- `getAvailableOrderTransitions(from)` — list valid next states

## 2. Quote Workflow

**File:** `lib/workflows/quote-state-machine.ts`
**13 states, 21+ transitions** covering quote lifecycle.

```
DRAFT → INTERNAL_REVIEW → SENT_TO_CLIENT → ACCEPTED → DEPOSIT_REQUIRED → READY_FOR_PO
                                    ↕                                          │
                           REVISION_REQUESTED                                  ▼
                                                                         IN_PRODUCTION → SHIPPED → DELIVERED → CLOSED
                                                           EXPIRED / CANCELLED (exits)
```

## 3. Purchase Order Workflow

**File:** `lib/workflows/po-workflow.ts`
**6 transitions** — linear procurement lifecycle.

```
DRAFT → SENT → CONFIRMED → IN_PRODUCTION → SHIPPED → RECEIVED
```

## 4. Production Job Workflow

**File:** `lib/workflows/production-workflow.ts`
**7 transitions** with QC loops for proof rejection and quality failure.

```
PENDING_PROOF → PROOF_SENT → PROOF_APPROVED → IN_PRODUCTION → QUALITY_CHECK → READY_TO_SHIP
                    ↑                                               │
                    └────── PROOF_REJECTED ◄────────────────────────┘
                                                              (QC_FAILED loops back)
```

## Shared Types

**File:** `lib/workflows/types.ts`

- `InvalidTransitionError` — thrown when a transition is not allowed
- `Transition<S>` — `{ from, to, label }`
- `TransitionResult<S>` — `{ allowed, from, to, label? }`

## Payment Gating Integration

The order workflow is gated by payment status:
- `canStartProduction(order, amountPaid, depositRule)` — returns `{ allowed, blockers[] }`
- `canGeneratePO(order, amountPaid, depositRule)` — returns `{ allowed, blockers[] }`
- Orders cannot advance past `DEPOSIT_REQUIRED` without payment clearing

See `lib/services/order-payment-gating.ts` for implementation.
