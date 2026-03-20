# Mutation Purity — Enforcement Status

> Documents which server actions route mutations through the command bus,
> which use hybrid patterns, and known gaps.

## Command Bus Routing Coverage

| File | Pattern | Status |
|---|---|---|
| `orders.ts` | `statusCommandMap` routes 6 statuses through `executeCommand` | ✅ Full |
| `payments.ts` | `recordPaymentAction` uses `executeCommand('record_payment')` | ✅ Full |
| `purchase-orders.ts` | `sendPO`, `acknowledgePO`, `receiveLine`, `cancelPO` use `executeCommand` | ⚠️ Partial |
| `workflow-triggers.ts` | All 3 trigger actions use `executeCommand` exclusively | ✅ Full |
| `invoices.ts` | `updateInvoiceAction` writes status directly via Drizzle | ❌ None |

## Hybrid CRUD Pattern

Several actions combine direct Drizzle writes for non-workflow fields (e.g. notes, supplier
reference, expected date) with command bus routing for status transitions:

- `updateOrderAction` — Direct write for CRUD fields; delegates to `statusCommandMap → executeCommand` when `data.status` is present.
- `updatePurchaseOrderAction` — Direct write for all fields **including status**. Workflow-specific actions (`sendPO`, `cancelPO`, etc.) route through the command bus.

This hybrid pattern is intentional: CRUD updates don't need guard/event/audit overhead,
while status transitions require the full pipeline.

## Known Gaps

1. **invoices.ts** — `updateInvoiceAction` updates status directly with no command bus involvement. Handlers `createInvoiceHandler`, `issueInvoiceHandler`, `voidInvoiceHandler` exist but are only called from `workflow-triggers.ts`.
2. **updatePurchaseOrderAction** — Can set `status` directly, bypassing PO workflow guards. The dedicated actions (`sendPurchaseOrderAction`, etc.) properly use the command bus.

## Architecture Tests

`tests/architecture-purity.test.ts` enforces these invariants via static source analysis:

- All action files import and use `executeCommand`
- `statusCommandMap` in orders.ts contains entries for all 6 critical statuses
- `workflow-triggers.ts` has zero direct DB imports
- `register-handlers.ts` includes all 26 expected handlers
