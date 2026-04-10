# Flow — Staging Seed Guide

> How to use `seed:staging` to exercise the full control layer in a staging
> environment.

---

## Quick Start

```bash
cd apps/flow
pnpm seed:staging
```

This runs `tsx lib/seed-flow-staging.ts`, which dispatches commands through
the control layer's command bus — the same path production code takes.

---

## Prerequisites

1. **Database**: PostgreSQL must be running with the Flow schema migrated.
2. **Environment**: `DATABASE_URL` must point to the target database.
3. **Org data**: The seed creates its own org, customer, and vendor records.

---

## Lifecycle Scenarios

The seed exercises three distinct order lifecycle paths:

### Lifecycle A — Full Happy Path (16 steps)

Complete quote-to-delivery lifecycle with payment clearance.

| Step | Command | Expected Outcome |
|------|---------|------------------|
| 1 | `create_quote` | Quote in DRAFT |
| 2 | `send_quote` | Quote → SENT_TO_CLIENT |
| 3 | `accept_quote` | Quote → ACCEPTED |
| 4 | `convert_quote_to_order` | Order created |
| 5 | `confirm_order` | Order → CONFIRMED |
| 6 | `require_deposit` | Deposit gate set |
| 7 | `record_payment` | Payment recorded |
| 8 | `confirm_payment` | Payment confirmed, deposit met |
| 9 | `create_purchase_order` | PO created (gate cleared) |
| 10 | `send_purchase_order` | PO → SENT |
| 11 | `confirm_purchase_order` | PO → CONFIRMED |
| 12 | `start_production` | Production job started |
| 13 | `complete_production` | Production → READY_TO_SHIP |
| 14 | `create_shipment` | Shipment created |
| 15 | `mark_shipment_shipped` | Shipment → SHIPPED |
| 16 | `mark_shipment_delivered` | Shipment → DELIVERED |

### Lifecycle B — Payment-Gated Flow (7 steps)

Demonstrates the deposit gate blocking PO creation.

| Step | Command | Expected Outcome |
|------|---------|------------------|
| 1 | `create_quote` | Quote in DRAFT |
| 2 | `send_quote` | Quote → SENT_TO_CLIENT |
| 3 | `accept_quote` | Quote → ACCEPTED |
| 4 | `convert_quote_to_order` | Order created |
| 5 | `confirm_order` | Order → CONFIRMED |
| 6 | `require_deposit` | Deposit gate set |
| 7 | `create_purchase_order` | **BLOCKED** — `payment_gate_blocked` |

This is an **expected failure** — the seed verifies that the payment guard
correctly prevents PO creation when the deposit hasn't been paid.

### Lifecycle C — Revision Flow (3 steps)

Demonstrates the quote revision path.

| Step | Command | Expected Outcome |
|------|---------|------------------|
| 1 | `create_quote` | Quote in DRAFT |
| 2 | `send_quote` | Quote → SENT_TO_CLIENT |
| 3 | `request_quote_revision` | Quote → REVISION_REQUESTED |

---

## Output

The seed prints a summary report after all scenarios complete:

```
╔══════════════════════════════════════╗
║     Flow Staging Seed — Summary      ║
╠══════════════════════════════════════╣
║ Lifecycle A: 16/16 passed            ║
║ Lifecycle B: 6 passed, 1 expected ✗  ║
║ Lifecycle C: 3/3 passed              ║
╠══════════════════════════════════════╣
║ Total: 25 steps, 0 unexpected fails  ║
╚══════════════════════════════════════╝
```

- **Expected failures** (like Lifecycle B step 7) are tracked separately.
- **Unexpected failures** indicate a regression or misconfiguration.

---

## What It Validates

| Concern | How |
|---------|-----|
| Command schemas | Zod validation runs on every dispatch |
| Guard chain | Invariant, workflow, and payment guards execute |
| State machines | All transition functions are exercised |
| Event emission | Domain events are emitted and persisted |
| Payment gates | Deposit gate blocks when outstanding balance > 0 |
| Org isolation | All commands scoped to a single org |
| Error types | `PaymentGateBlockedError` surfaced and reported |

---

## Troubleshooting

| Symptom | Cause | Fix |
|---------|-------|-----|
| `EntityNotFoundError` on step 1 | Database not migrated | Run `pnpm db:migrate` first |
| All steps fail | Wrong `DATABASE_URL` | Check `.env` or env vars |
| Lifecycle B step 7 succeeds | Payment guard bypassed | Check `payment-guard.ts` |
| Connection refused | PostgreSQL not running | Start the database |
