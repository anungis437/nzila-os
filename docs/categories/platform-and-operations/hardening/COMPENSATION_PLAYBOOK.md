# Zonga — Compensation & Recovery Playbook

## Overview

When a critical operation partially fails, compensation functions restore
the system to a consistent state. All compensations write audit trail entries
for forensic traceability.

## Compensation Functions

### `compensateFailedPayout(db, payoutId, error, correlationId)`

**Trigger:** Stripe call succeeds but post-payout audit/evidence fails.

**Actions:**

1. UPDATE `payouts` → `status = 'failed'`, `failed_at = NOW()`
2. INSERT `audit_log` → `action = 'payout.compensated'` with error detail and correlation ID

**Handler integration:** `execute-payout.handler.ts` wraps post-Stripe operations
in try/catch; on failure, calls this compensator and returns `POST_EXECUTION_FAILURE`.

### `compensateFailedTicketPurchase(db, ticketId, error)`

**Trigger:** Payment confirmed but ticket record creation fails.

**Actions:**

1. UPDATE `tickets` → `status = 'cancelled'`, `cancelled_at = NOW()`
2. INSERT `audit_log` → `action = 'ticket.purchase.compensated'`

### `compensateReleaseTransition(db, releaseId, previousStatus, error)`

**Trigger:** Status transition persists but downstream effects (distribution, notifications) fail.

**Actions:**

1. UPDATE `releases` → `status = previousStatus` (revert)
2. INSERT `audit_log` → `action = 'release.transition.compensated'`

## Control-Plane Compensation

The `@nzila/zonga-control-plane` orchestrator has built-in compensation:

```
WORKFLOW_STARTED → Step 1 OK → Step 2 FAILED
                                  ↓
                   Step 1 COMPENSATED ← runs step 1's compensate()
                   WORKFLOW_COMPENSATED
```

Each workflow step can define a `compensate()` function that reverses
its effects. The orchestrator runs compensations in reverse order.

## Recovery Decision Tree

```
Operation fails
  ├── Stripe error (before payout created)
  │     → Return STRIPE_EXECUTION_FAILED, no compensation needed
  ├── Post-payout failure (Stripe succeeded, audit failed)
  │     → compensateFailedPayout() → mark payout failed
  ├── Ticket purchase partial failure
  │     → compensateFailedTicketPurchase() → cancel ticket
  └── Release transition downstream failure
        → compensateReleaseTransition() → revert status
```

## Operational Guidelines

1. **Always log the original error** in the compensation audit entry
2. **Include correlation IDs** for tracing across systems
3. **Compensations are idempotent** — running twice is safe
4. **Alert on compensation events** — these indicate system instability
5. **Review audit_log** entries with `action LIKE '%.compensated'` daily
