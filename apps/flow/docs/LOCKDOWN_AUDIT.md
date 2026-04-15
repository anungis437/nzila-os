# Flow — Lockdown Audit

**Date:** 2026-01-02  
**Status:** In Progress (Zero-Bypass Hardening)  
**Auditor:** Automated integrity pass + manual command-path review

---

## Summary

Critical lifecycle mutation paths in the Flow app are under active hardening. Paths are classified as **SAFE** (routes through the command bus), **MIGRATED** (was unsafe, now fixed), or **TRANSITIONAL EXEMPT** (known legacy surface pending migration).

---

## Mutation Path Classification

### Order Status Mutations

| Path | File | Classification | Notes |
|------|------|----------------|-------|
| `createPurchaseOrderAction` | `app/actions/purchase-orders.ts` | ✅ MIGRATED | Was calling `createPurchaseOrder` from `@nzila/commerce-db` directly. Now routes through `executeCommand({ type: 'create_purchase_order' })` with payment gate enforced. |
| `updatePurchaseOrderAction` — status transitions | `app/actions/purchase-orders.ts` | ✅ MIGRATED | Was allowing raw `status` writes. Now maps to `PO_STATUS_COMMAND_MAP` and executes via command bus. |
| `statusCommandMap` routing in orders | `app/actions/orders.ts` | ✅ SAFE | Was already routing all status transitions via `executeCommand`. |
| All order lifecycle handlers | `lib/control/handlers/*.handler.ts` | ✅ SAFE | All 30 handlers are registered and route mutations through `OrderRepository.update()` called from within command handlers only. |

### Purchase Order Mutations

| Path | File | Classification | Notes |
|------|------|----------------|-------|
| `create_purchase_order` handler | `lib/control/handlers/create-purchase-order.handler.ts` | ✅ SAFE | Gated by `checkCanGeneratePO` before any DB write. |
| `send_purchase_order` handler | `lib/control/handlers/send-purchase-order.handler.ts` | ✅ SAFE | Command-only. |
| `confirm_purchase_order` handler | `lib/control/handlers/confirm-purchase-order.handler.ts` | ✅ SAFE | Command-only. |

### Payment Mutations

| Path | File | Classification | Notes |
|------|------|----------------|-------|
| `record_payment` handler | `lib/control/handlers/record-payment.handler.ts` | ✅ SAFE | Command-only, emits `payment_recorded` event. |
| `confirm_payment` handler | `lib/control/handlers/confirm-payment.handler.ts` | ✅ SAFE | Command-only. |

### Production Mutations

| Path | File | Classification | Notes |
|------|------|----------------|-------|
| `start_production` handler | `lib/control/handlers/start-production.handler.ts` | ✅ SAFE | Gated by `checkCanStartProduction` (deposit required check). |
| `complete_production` handler | `lib/control/handlers/complete-production.handler.ts` | ✅ SAFE | Command-only. |

---

## Direct Repository Access (TRANSITIONAL EXEMPT)

The following use repository methods directly but are currently classified as transitional exemptions because they are read-only or are called from authorised command handlers. These exemptions are being reduced as legacy services are removed.

| Access | Justification |
|--------|---------------|
| `orderRepo.findById()` in guards | Read-only context loading. |
| `paymentRepo.totalPaidForOrder()` in guards | Read-only aggregate. |
| `orderRepo.update()` inside command handlers | Write inside authorised handler — this IS the command bus mutation site. |

---

## Lockdown Check Script

Run `pnpm lockdown:check` from `apps/flow` to statically verify no bypass regressions have been introduced.

Rules enforced:

- `DIRECT_STATUS_MUTATION` — `.set({ status: ... })` outside handlers/repos
- `DIRECT_STATUS_MUTATION` — multiline `*.update(..., { status: ... })` outside handlers/repos
- `DIRECT_INTEGRATION_IMPORT` — ZohoBooksClient/ShopifyClient outside adapter files
- `DIRECT_COMMERCE_DB_CREATE` — `createPurchaseOrder()` called from `app/actions/`
- `CRITICAL_HANDLER_NO_DOMAIN_EVENT` — critical command handlers missing `dispatchDomainEvent()`
