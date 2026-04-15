# Flow — Integration Lockdown Audit

**Date:** 2026-01-01  
**Status:** Complete

---

## Purpose

This document audits all external integration call sites to ensure they are routed through the side-effect dispatcher (`lib/control/dispatch/side-effect-dispatcher.ts`) and do NOT make direct calls to integration adapters.

---

## Side-Effect Dispatcher Architecture

All external integrations in Flow must be triggered via the dispatcher:

```
CommandHandler.execute()
  └─► dispatchSideEffect({ type: 'zoho_sync' | 'shopify_sync' | 'canva_update' | 'customer_notification', ... })
        └─► side-effect-dispatcher.ts (async, fire-and-forget)
              └─► Zoho / Shopify / Canva adapter
```

Failures in side effects produce logged warnings only — they do not roll back the domain mutation.

---

## Audit Results

### ✅ CLEAN: Register-integrations.ts

`lib/control/register-integrations.ts` registers all 4 side-effect handlers:
- `zoho_sync` → ZohoBooksAdapter
- `shopify_sync` → ShopifyAdapter
- `canva_update` → CanvaAdapter
- `customer_notification` → EmailNotificationAdapter

All external calls originate from within registered handlers. **Classification: SAFE**

### ⚠️ NOTED: supplier-service.ts — ZohoBooksClient

`lib/supplier-service.ts` imports `ZohoBooksClient` directly (line ~11). The `syncWithZoho` function accepts a `booksClient` parameter for dependency injection.

```typescript
// lib/supplier-service.ts
import { ZohoBooksClient } from './zoho/books-client'
export async function syncWithZoho(vendorId: string, booksClient: ZohoBooksClient) { ... }
```

The caller in `lib/supplier-actions.ts` has the direct client instantiation commented out:
```typescript
// const booksClient = new ZohoBooksClient(...)  // temporarily disabled
```

**Classification: ACCEPTABLE** — The parameter injection pattern means no live Zoho calls are made from this path. The adapter is not instantiated at runtime. If this function is re-enabled, the caller must route through the side-effect dispatcher by emitting a `zoho_sync` side effect instead.

**Action Required:** If `syncWithZoho` is re-activated, refactor it to emit a `zoho_sync` side effect rather than calling `ZohoBooksClient` directly.

---

## Integration Call Sites — Complete Map

| Integration | Adapter File | Called From | Via Dispatcher? |
|-------------|-------------|-------------|-----------------|
| Zoho Books (sync) | `lib/zoho/books-client.ts` | `register-integrations.ts` → zoho_sync handler | ✅ Yes |
| Zoho Books (supplier) | `lib/zoho/books-client.ts` | `lib/supplier-service.ts` (disabled) | ⚠️ Disabled |
| Shopify (sync) | `lib/shopify/` | `register-integrations.ts` → shopify_sync handler | ✅ Yes |
| Canva (update) | `lib/canva/` | `register-integrations.ts` → canva_update handler | ✅ Yes |
| Email notification | `lib/email/` | `register-integrations.ts` → customer_notification handler | ✅ Yes |

---

## Conclusion

The integration layer is LOCKED DOWN with one noted exception (supplier Zoho — currently disabled). The lockdown check script (`pnpm lockdown:check`) enforces this at CI time.
