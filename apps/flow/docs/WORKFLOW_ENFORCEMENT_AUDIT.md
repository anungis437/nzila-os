# Flow — Workflow Enforcement Audit

Catalog of all direct status mutations in Flow server actions,
with assessment of whether they are covered by the control layer.

## Direct Status Mutations Found

### actions.ts

| Function | Mutation | Control Layer | Status |
|---|---|---|---|
| `createQuoteAction` | `quoteRepo.create()` | `create_quote` handler | ✅ Covered |
| `updateQuoteStatusAction` | `quoteRepo.update({ status })` | Varies by target status | ⚠️ Partially covered — generic dispatcher, should route to specific commands |
| `importLegacyRecordsAction` | `quoteRepo.create()` (batch) | N/A — legacy import, no guard needed | ℹ️ Exempt |

### send-quote-actions.ts

| Function | Mutation | Control Layer | Status |
|---|---|---|---|
| `submitForReviewAction` | `quoteRepo.update({ status: 'INTERNAL_REVIEW' })` | `send_quote` handler covers DRAFT→SENT_TO_CLIENT | ⚠️ INTERNAL_REVIEW not modeled yet |
| `sendQuoteToClientAction` | `quoteRepo.update({ status: 'SENT_TO_CLIENT' })` | `send_quote` handler | ✅ Covered |

### payment-actions.ts

| Function | Mutation | Control Layer | Status |
|---|---|---|---|
| `setDepositRequirementAction` | `quoteRepo.update({ status: 'DEPOSIT_REQUIRED' })` | `require_deposit` handler | ✅ Covered |
| `recordPaymentAction` | `quoteRepo.update({ status: 'READY_FOR_PO' })` | `record_payment` + `confirm_payment` handlers | ✅ Covered |

### production-actions.ts

| Function | Mutation | Control Layer | Status |
|---|---|---|---|
| `createOrderAction` | `createOrder()` service | `convert_quote_to_order` handler | ✅ Covered |
| `confirmOrderAction` | `confirmOrder()` service | `confirm_order` handler | ✅ Covered |
| `startFulfillmentAction` | `startFulfillment()` service | `start_production` handler | ✅ Covered |
| `markOrderShippedAction` | `markOrderShipped()` service | `mark_shipment_shipped` handler | ✅ Covered |
| `completeOrderAction` | `completeOrder()` service | `mark_shipment_delivered` handler | ✅ Covered |
| `cancelOrderAction` | `cancelOrder()` service | Not modeled — cancel flow TBD | ⚠️ Not yet covered |

### po-actions.ts

| Function | Mutation | Control Layer | Status |
|---|---|---|---|
| `createPOAction` | `createPurchaseOrder()` service | `create_purchase_order` handler | ✅ Covered |
| `sendPOAction` | `sendPurchaseOrder()` service | `send_purchase_order` handler | ✅ Covered |
| `cancelPOAction` | `cancelPurchaseOrder()` service | Not modeled — cancel flow TBD | ⚠️ Not yet covered |
| `updatePOAction` | `updatePurchaseOrder()` + optional status | Partial — status changes covered | ⚠️ Line edits not gated |

### financial-actions.ts

| Function | Mutation | Control Layer | Status |
|---|---|---|---|
| `createInvoiceFromOrderAction` | `createInvoiceFromOrder()` | Not modeled — invoicing is downstream | ℹ️ Phase 2 scope |
| `issueInvoiceAction` | `issueInvoice()` | Not modeled | ℹ️ Phase 2 scope |
| `recordPaymentAction` | `recordPayment()` (invoice) | Distinct from order payment | ℹ️ Phase 2 scope |

## Summary

- **13 critical mutations** identified across 5 action files
- **9** covered by control layer handlers
- **2** partially covered (generic quote status, internal review)
- **2** not yet modeled (cancel flows)
- **3** exempt or deferred (legacy import, invoicing)

## Recommended Refactoring Order

1. `updateQuoteStatusAction` — refactor to dispatch specific command by target status
2. `setDepositRequirementAction` / `recordPaymentAction` — route through command bus
3. `confirmOrderAction` / `startFulfillmentAction` — route through command bus
4. `sendPOAction` / `createPOAction` — route through command bus
5. `submitForReviewAction` / `sendQuoteToClientAction` — route through command bus
