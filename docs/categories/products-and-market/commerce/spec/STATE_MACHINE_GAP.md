# STATE_MACHINE_GAP.md — Nzila Commerce Engine

> Phase 4 Deliverable — State Machine Gap Analysis
> Generated from legacy `shop_quoter_tool_v1-main` audit

---

## 1. Executive Summary

The legacy shop quoter has **three partially-overlapping lifecycle engines** that evolved independently:

| Engine | File | Lines | States |
|--------|------|-------|--------|
| Quote Workflow | `workflow-engine.ts` | 613 | 8 |
| Mandate Automation | `mandate-workflow-automation.ts` | 1133 | 9 |
| Invoice/Payment | `purchase-order-service.ts` | ~400 | 6 |

These engines share no common state interface, no event bus, and no transition validation.
The target Nzila Commerce Engine requires a **single unified state machine** with clear
bounded transitions, audit trails, and org-scoped state isolation.

---

## 2. Legacy State Machines — Current Shape

### 2.1 Quote Lifecycle (`workflow-engine.ts`)

```
draft ──► ai_processing ──► proposals_ready ──► sent
                                                  │
                                                  ├──► client_reviewing ──► accepted
                                                  │                         │
                                                  │                         ▼
                                                  │                    [invoice created]
                                                  │
                                                  ├──► declined
                                                  │
                                                  └──► expired
```

**Observed transitions:**

| From | To | Guard | Side Effect |
|------|----|-------|-------------|
| `draft` | `ai_processing` | none | Calls OpenAI API |
| `ai_processing` | `proposals_ready` | AI response parsed | Stores 3 tier proposals in DB |
| `proposals_ready` | `sent` | none | Marks `sent_at` timestamp |
| `sent` | `client_reviewing` | none | No-op status change |
| `client_reviewing` | `accepted` | none | Triggers invoice + inventory reservation |
| `client_reviewing` | `declined` | none | No cleanup |
| `sent` | `expired` | 30-day timeout | No cleanup, no inventory release |

**Gaps identified:**

| # | Gap | Severity |
|---|-----|----------|
| G-QS1 | No transition validation — any status can jump to any other via raw DB UPDATE | HIGH |
| G-QS2 | `accepted` triggers invoice creation inline (not via event/queue) | HIGH |
| G-QS3 | No `revision` or `superseded` state — quotes cannot be versioned | HIGH |
| G-QS4 | `expired` performs no cleanup (reserved inventory stays locked) | MEDIUM |
| G-QS5 | `declined` has no re-open path | LOW |
| G-QS6 | No `cancelled` state distinct from `declined` | LOW |
| G-QS7 | `client_reviewing` is cosmetic — no client-facing portal exists | LOW |

---

### 2.2 Mandate Lifecycle (`mandate-workflow-automation.ts`)

```
quotation ──► approved ──► inventory_allocated ──► production
                                                      │
                                                      ▼
                                                  quality_check ──► shipped ──► delivered ──► completed
```

**Observed transitions:**

| From | To | Guard | Side Effect |
|------|----|-------|-------------|
| `quotation` | `approved` | Manual trigger | Links to quote record |
| `approved` | `inventory_allocated` | Inventory check passes | Reserves items in `inventory_items` |
| `inventory_allocated` | `production` | none | Creates production tasks |
| `production` | `quality_check` | All tasks completed | Validates QC checklist |
| `quality_check` | `shipped` | QC pass | Creates shipping record |
| `shipped` | `delivered` | Delivery confirmation | Updates tracking |
| `delivered` | `completed` | none | Triggers final invoice |

**Gaps identified:**

| # | Gap | Severity |
|---|-----|----------|
| G-ML1 | No `on_hold` or `blocked` state — production issues have no representation | HIGH |
| G-ML2 | No `cancelled` state — mandate cannot be cancelled mid-flight | HIGH |
| G-ML3 | `quality_check` failure has no defined rollback path | HIGH |
| G-ML4 | No partial fulfillment (all-or-nothing delivery) | MEDIUM |
| G-ML5 | `approved` → `inventory_allocated` has no backorder handling | MEDIUM |
| G-ML6 | No `returned` or `rma` state post-delivery | MEDIUM |
| G-ML7 | Transition from `delivered` → `completed` has no payment verification | MEDIUM |
| G-ML8 | No event emission on transitions — other systems cannot react | HIGH |
| G-ML9 | Stage history stored as flat array, not as immutable event log | MEDIUM |

---

### 2.3 Invoice / Payment Lifecycle (`purchase-order-service.ts`)

```
draft ──► sent ──► partial ──► paid
                     │
                     ├──► overdue
                     │
                     └──► cancelled
```

**Observed transitions:**

| From | To | Guard | Side Effect |
|------|----|-------|-------------|
| `draft` | `sent` | none | Sends via Zoho Books |
| `sent` | `partial` | Partial payment received | Updates `amount_paid` |
| `partial` | `paid` | Remaining balance = 0 | Marks complete |
| `sent` | `overdue` | Due date passed | No automated action |
| `sent` | `cancelled` | Manual | No refund logic |

**Gaps identified:**

| # | Gap | Severity |
|---|-----|----------|
| G-IV1 | No `refunded` state | HIGH |
| G-IV2 | No `disputed` state | HIGH |
| G-IV3 | `overdue` has no escalation or retry mechanism | MEDIUM |
| G-IV4 | `cancelled` from `partial` has no refund handling | HIGH |
| G-IV5 | No credit note / adjustment flow | MEDIUM |
| G-IV6 | Tax amount is computed at invoice creation, not locked at quote acceptance | HIGH |
| G-IV7 | Invoice numbering is not sequential or auditable | MEDIUM |

---

### 2.4 Production Task Lifecycle (embedded in `mandate-workflow-automation.ts`)

```
pending ──► sourcing ──► assembly ──► qc ──► packaging ──► shipped ──► completed
```

**Gaps identified:**

| # | Gap | Severity |
|---|-----|----------|
| G-PT1 | No `failed` or `rejected` state at any stage | HIGH |
| G-PT2 | No duration tracking per stage | MEDIUM |
| G-PT3 | Task assignment is hardcoded, not role-based | MEDIUM |

---

## 3. Cross-Machine Integration Gaps

| # | Gap | Description | Severity |
|---|-----|-------------|----------|
| G-XM1 | **No event bus** | Transitions in one machine cannot trigger transitions in another. Quote acceptance triggers invoice creation via direct function call, creating tight coupling. | CRITICAL |
| G-XM2 | **No saga / compensating transactions** | If invoice creation fails after quote acceptance, quote stays `accepted` with no invoice — orphaned state. | CRITICAL |
| G-XM3 | **No unified timeline** | Each entity has its own `updated_at` but there is no cross-entity audit log showing the full lifecycle. | HIGH |
| G-XM4 | **Mandate duplicates quote lifecycle** | `mandate-workflow-automation.ts` re-implements parts of the quote workflow (re-checking inventory, re-computing prices) instead of referencing a locked quote snapshot. | HIGH |
| G-XM5 | **No state machine definition as data** | All transitions are procedural if/else chains. No declarative state chart that can be validated, visualized, or versioned. | MEDIUM |

---

## 4. Target State Machine — Nzila Commerce Engine

### 4.1 Unified Commerce Lifecycle

```
                        ┌─────────────────────────────────────────────────────────┐
                        │                  Nzila Commerce Lifecycle                │
                        └─────────────────────────────────────────────────────────┘

  Opportunity ──► Quote (v1..vN) ──► Approval ──► Order ──► Fulfillment ──► Delivery ──► Invoice ──► Closed
       │              │                  │          │           │              │            │           │
       │              ├─► Revised         │          │           ├─► Partial     │            ├─► Partial  │
       │              ├─► Expired         │          │           ├─► On Hold     │            ├─► Overdue  │
       │              └─► Cancelled       │          │           ├─► Blocked     │            ├─► Disputed │
       │                                  │          │           └─► Cancelled   │            ├─► Refunded │
       ▼                                  ▼          ▼                          ▼            └─► Cancelled│
    Lost                              Rejected   Cancelled                  Returned                     │
                                                                           (RMA)                    Credit Note
```

### 4.2 Required States (not in legacy)

| State | Domain | Why Required |
|-------|--------|--------------|
| `opportunity` | Pre-quote | Track leads before formal quoting |
| `revised` | Quote | Support quote versioning (v1, v2, v3) |
| `approval` | Quote → Order | Manager approval gate for large orders |
| `order` | Commerce | **Missing entirely in legacy** — quotes jump straight to invoice |
| `on_hold` | Fulfillment | Pause production without cancellation |
| `blocked` | Fulfillment | External dependency blocking progress |
| `partial_fulfillment` | Fulfillment | Ship available items, backorder rest |
| `returned` | Post-delivery | RMA / returns management |
| `disputed` | Invoice | Customer disputes a charge |
| `refunded` | Invoice | Full or partial refund issued |
| `credit_note` | Invoice | Accounting credit adjustment |
| `closed` | Terminal | Explicit closure with reason code |
| `lost` | Opportunity | Opportunity that didn't convert |

### 4.3 Target State Machine Contract

```typescript
// Target interface — declarative state machine definition
interface CommerceStateMachine {
  entity: 'quote' | 'order' | 'fulfillment' | 'invoice' | 'mandate';
  states: Record<string, StateDefinition>;
  transitions: TransitionDefinition[];
}

interface StateDefinition {
  name: string;
  type: 'initial' | 'intermediate' | 'terminal' | 'error';
  allowedTransitions: string[];    // target state names
  onEnter?: string;                // event name to emit
  onExit?: string;                 // event name to emit
  timeout?: {
    duration: string;              // ISO 8601 duration (e.g. "P30D")
    targetState: string;           // auto-transition target
  };
}

interface TransitionDefinition {
  from: string;
  to: string;
  guard?: string;                  // named guard function
  action?: string;                 // named side-effect function
  compensate?: string;             // rollback function if action fails
  requires?: {
    role?: string[];               // RBAC roles required
    approval?: boolean;            // needs manager approval
    orgScope?: boolean;            // must match org_id
  };
  audit: {
    reason: boolean;               // require reason text
    evidence?: boolean;            // require evidence attachment
  };
}
```

### 4.4 Quote State Machine (Target)

| # | From | To | Guard | Action | Roles |
|---|------|----|-------|--------|-------|
| T1 | `draft` | `pricing` | items.length > 0 | computePricing() | sales, admin |
| T2 | `pricing` | `ready` | pricing.valid | lockPriceSnapshot() | system |
| T3 | `ready` | `sent` | — | sendToClient() | sales, admin |
| T4 | `sent` | `reviewing` | — | — | client |
| T5 | `reviewing` | `accepted` | — | createOrder() | client |
| T6 | `reviewing` | `declined` | — | notifySales() | client |
| T7 | `sent` | `expired` | now > sent_at + 30d | releaseReservations() | system |
| T8 | `any` | `revised` | — | createNewVersion() | sales, admin |
| T9 | `any` | `cancelled` | — | releaseReservations() | sales, admin |

### 4.5 Order State Machine (Target — entirely new)

| # | From | To | Guard | Action | Roles |
|---|------|----|-------|--------|-------|
| T10 | `created` | `confirmed` | payment.verified | reserveInventory() | system |
| T11 | `confirmed` | `fulfillment` | inventory.allocated | startFulfillment() | warehouse |
| T12 | `fulfillment` | `shipped` | all items packed | createShipment() | warehouse |
| T13 | `shipped` | `delivered` | tracking.confirmed | — | system |
| T14 | `delivered` | `completed` | invoice.paid | closeOrder() | system |
| T15 | `any` | `cancelled` | refund.policy.allows | compensate() | admin |
| T16 | `delivered` | `return_requested` | within return window | createRMA() | client |

### 4.6 Invoice State Machine (Target)

| # | From | To | Guard | Action | Roles |
|---|------|----|-------|--------|-------|
| T17 | `draft` | `issued` | order.confirmed | lockTaxSnapshot() | system |
| T18 | `issued` | `sent` | — | sendInvoice() | finance |
| T19 | `sent` | `partial_paid` | payment > 0 | recordPayment() | system |
| T20 | `partial_paid` | `paid` | balance == 0 | markPaid() | system |
| T21 | `sent` | `overdue` | now > due_date | escalate() | system |
| T22 | `overdue` | `paid` | payment received | recordPayment() | system |
| T23 | `any` | `disputed` | — | freezeCollection() | client, admin |
| T24 | `disputed` | `resolved` | resolution.decided | applyResolution() | admin |
| T25 | `any` | `refunded` | refund.approved | processRefund() | admin |
| T26 | `refunded` | `credit_note` | — | issueCreditNote() | finance |

---

## 5. Migration Gap Summary

### 5.1 By Severity

| Severity | Count | Legacy Gaps | New States Required |
|----------|-------|-------------|---------------------|
| CRITICAL | 2 | G-XM1, G-XM2 | Event bus, saga pattern |
| HIGH | 12 | G-QS1–3, G-ML1–2, G-ML8, G-IV1–2, G-IV4, G-IV6, G-PT1, G-XM3–4 | 13 new states across 4 machines |
| MEDIUM | 11 | G-QS4, G-ML4–7, G-ML9, G-IV3, G-IV5, G-IV7, G-PT2–3, G-XM5 | Declarative state definitions |
| LOW | 3 | G-QS5–7 | Nice-to-have UX states |
| **Total** | **28** | | |

### 5.2 Migration Priority

| Priority | Action | Effort |
|----------|--------|--------|
| P0 | Implement declarative state machine engine with transition guards | 2–3 weeks |
| P1 | Add `Order` entity (completely missing in legacy) | 1–2 weeks |
| P2 | Implement event bus for cross-machine communication | 1 week |
| P3 | Add compensating transactions / saga for multi-step flows | 1–2 weeks |
| P4 | Add missing terminal states (refunded, disputed, credit_note) | 1 week |
| P5 | Implement immutable event log (replace flat stage arrays) | 1 week |
| P6 | Add timeout-based auto-transitions with cron/scheduler | 3 days |
| P7 | Build state visualization / admin dashboard | 1 week |

---

## 6. Recommended State Machine Library

For NzilaOS, the state machine should be:

1. **Declarative** — defined as data (JSON/TypeScript), not procedural code
2. **Org-scoped** — every state instance carries `org_id`
3. **Event-sourced** — transitions are immutable events, current state is derived
4. **Guarded** — transitions require role + business rule validation
5. **Compensable** — failed side effects trigger rollback

Recommended approach: **XState v5** or a lightweight custom engine using the
`CommerceStateMachine` interface defined in §4.3 above.

---

## 7. Key Architectural Decision

> **ADR: The `Order` entity is the fulcrum.**

In the legacy system, quote acceptance directly creates an invoice. This is the single
most impactful architectural gap. The Order entity serves as:

- Price lock point (snapshot of accepted quote pricing)
- Payment verification gate
- Fulfillment trigger
- Invoice source of truth
- Return/refund reference

Without Order, the system has no concept of "what was agreed upon" vs "what was billed."

---

*Document generated as Phase 4 deliverable for Nzila Commerce Engine migration.*
