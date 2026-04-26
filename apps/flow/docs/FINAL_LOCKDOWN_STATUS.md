# Flow — Zero-Bypass Lockdown Status

**Date:** 2026-01-02  
**Pass:** Zero-Bypass Refactor (active)  
**Result:** 🟡 PARTIALLY COMPLETE — hardening in progress

## Validation Snapshot (2026-04-26)

- `pnpm pilot:check` at repository root: PASS
- `pnpm --filter @nzila/flow typecheck`: PASS
- `pnpm --filter @nzila/flow lint`: PASS
- `pnpm --filter @nzila/flow test`: PASS
- `pnpm --filter @nzila/flow lockdown:check`: PASS (0 violations)

This confirms current technical gate health while Phase 6/9 documentation tasks in this file remain open.

---

## Phase Summary

| Phase | Title | Status |
|-------|-------|--------|
| Phase 1 | Runtime/bootstrap hardening | ✅ Complete |
| Phase 2 | Remove high-risk mutation bypasses | 🟡 In Progress |
| Phase 3 | Mandatory critical command events | ✅ Complete |
| Phase 4 | Side-effect centralization hardening | 🟡 In Progress |
| Phase 5 | Taxonomy/metrics truthfulness | 🟡 In Progress |
| Phase 6 | Invariant and E2E hardening | ⬜ Pending |
| Phase 7 | CI regression enforcement | 🟡 In Progress |
| Phase 8 | Audit and runbook documentation | 🟡 In Progress |
| Phase 9 | Full validation suite | ⬜ Pending |

---

## What Is Landed

### Phase 1 — Unsafe Bypass Elimination

**`app/actions/purchase-orders.ts`** (CRITICAL FIX):

- `createPurchaseOrderAction` was calling `createPurchaseOrder` from `@nzila/commerce-db` directly — bypassing payment gate and command bus.
- `updatePurchaseOrderAction` was allowing raw `status` field writes without command validation.
- **Fix**: Both now route through `executeCommand` via `PO_STATUS_COMMAND_MAP`.

### Phase 2 — Payment Gate Hardening

**`lib/control/types.ts`**: Added `order_id?: string` to `PaymentGateCheckResult.snapshot`.

**`lib/control/guards/payment-guard.ts`**:

- Rewrote to single clean `toGateCheckResult()` accepting `orderId`.
- All three guard functions (`checkCanGeneratePO`, `checkCanStartProduction`, `checkCanShipOrder`) now pass `orderId` into snapshots.

**`lib/services/payment-state-service.ts`**: Added 4 canonical functions:

- `computeOrderPaymentState()` — derives canonical payment state enum
- `syncOrderPaymentState()` — syncs `order.paymentStatus` to computed state
- `getOutstandingBalance()` — returns `max(0, amount_due - amount_paid)`
- `getPaymentBlockingReasons()` — returns human-readable block reasons

### Phase 3 — Domain Events Hardened

**`lib/events/event-types.ts`**: Rewritten cleanly. Added `order_payment_blocked`, `order_payment_cleared`.

**`lib/events/persist.ts`**: Expanded `DB_EVENT_TYPES` from 14 to ~30 entries — all critical entity events now persist.

**`lib/control/command-bus.ts`**: Event emission guardrail added — critical commands that succeed without emitting a domain event now fail with `EVENT_REQUIREMENT_VIOLATION` and increment `event_emission_gap_count` telemetry.

**`lib/telemetry/counters.ts`**: New shared telemetry counters module (avoids circular deps).

### Phase 4 — Side Effects

Already correct. Documented in `docs/INTEGRATION_LOCKDOWN_AUDIT.md`.

### Phase 5 — Truthful Metrics

**`app/api/metrics/route.ts`**: Added 9 new DB-backed fields:

- `quote_count`, `active_orders_count`, `delivered_orders_count`
- `blocked_orders_by_payment_count`, `purchase_orders_pending_count`
- `purchase_orders_overdue_count`, `production_jobs_in_progress_count`
- `production_jobs_blocked_count`, `shipments_in_transit_count`
- Renamed `timestamp` → `generated_at`

**`app/api/governance/telemetry/route.ts`**: Added:

- `workflow_transition_error_count`, `event_emission_gap_count`
- Renamed `timestamp` → `generated_at`

### Phase 6 — E2E Tests

**`e2e/flow.spec.ts`**: Rewritten with 7 business-invariant scenarios:

1. Platform contract smoke (all API shapes + field counts)
2. Quote lifecycle auth enforcement
3. Payment gating blocked state proof
4. Payment cleared state invariants
5. Invalid state transition rejection proof
6. Shipment lifecycle contract
7. Runtime contract — event emission gap tracking

### Phase 7 — CI Enforcement

**`scripts/flow-lockdown-check.ts`**: Static CI guard now includes multiline status write detection and critical handler domain-event emission checks.

**`package.json`**: Added `"lockdown:check": "tsx scripts/flow-lockdown-check.ts"`.

---

## Remaining Gaps

1. **Legacy service bypass surfaces** still exist in a transitional state and must be fully migrated or removed.

2. **Event taxonomy alignment** across handlers, persistence acceptance, and evidence/reporting is not fully normalized yet.

3. **Full validation pass** (`typecheck`, `lint`, `test`, `lockdown:check`, and E2E) has to be run and kept green after remaining migrations.

---

## How to Run All Checks

```bash
cd apps/flow
pnpm typecheck       # TypeScript strict check
pnpm lint            # ESLint
pnpm test            # Vitest unit + integration
pnpm lockdown:check  # Static integrity enforcement
```

E2E (requires running server):

```bash
pnpm exec playwright test e2e/flow.spec.ts
```
