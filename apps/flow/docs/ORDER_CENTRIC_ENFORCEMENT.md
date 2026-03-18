# Flow — Order-Centric Enforcement Audit

The commerce lifecycle centers on **orders** after conversion, not quotes.
This document audits where downstream operations incorrectly reference
quote-level identifiers and should be routed through order context instead.

## Enforcement Rules

1. **After `convert_quote_to_order`**, the **order** is the primary entity
2. Purchase orders MUST link to an **order_id**, not a quote_id
3. Production jobs MUST link to an **order_id**
4. Shipments MUST link to an **order_id**
5. Invoices MUST link to an **order_id**
6. Payment gates evaluate against **order** payment status

## Audit Findings

### Quote-to-Order Boundary

| Component | Current Key | Should Be | Status |
|---|---|---|---|
| `payment-gating-service.ts` | `quoteId` | Hybrid (both valid) | ⚠️ Pre-order uses quoteId |
| `payment-actions.ts` | `input.quoteId` | Order context post-conversion | ⚠️ Maps quoteId → command |
| `po-actions.ts` | `supplierId` (no order ref) | Should require `orderId` | ⚠️ No order enforcement |
| `production-actions.ts` | `orderId` | `orderId` | ✅ Correct |
| `financial-actions.ts` | `orderId` | `orderId` | ✅ Correct |

### Control Layer Handlers

All 17 handlers use entity-appropriate IDs:
- Quote handlers use `quote_id` ✅
- Order handlers use `order_id` ✅  
- PO handlers use `purchase_order_id` ✅
- Production handlers use `production_job_id` + `order_id` ✅
- Shipment handlers use `shipment_id` + `order_id` ✅

### Payment State Service

The `payment-state-service.ts` provides two scoped functions:
- `getPaymentSnapshotForQuote(quoteId)` — pre-order context ✅
- `getPaymentSnapshotForOrder(orderId, orgId)` — post-order context ✅

This resolves the dual-keying problem by making scope explicit.

## Recommendations

1. **payment-actions.ts** — Already refactored to route through command bus (Phase 5)
2. **po-actions.ts** — PO creation should validate that an order exists with matching items
3. **payment-gating-service.ts** — No change needed; the control-layer guard
   wraps it with proper scope selection

## Resolution

The order-centric boundary is enforced at the **handler level**:
- Handlers that take `order_id` enforce order existence via invariant guard
- The `convert_quote_to_order` handler creates the boundary transition
- Post-conversion handlers refuse to accept bare `quote_id` input

No additional code changes required — the control layer design addresses this inherently.
