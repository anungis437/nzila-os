# Monetization Architecture — Nzila OS

> Canonical reference for the Monetization Infrastructure Layer (MIL).
> Last updated: 2026-07-03 (review only — no substantive change since 2026-03-25)

---

## 1. Business Model

Nzila OS monetizes through five complementary mechanisms:

| # | Mechanism | Description |
|---|-----------|-------------|
| 1 | **Central Platform Billing** | Parent union body (national/division) pays platform subscription + module fees |
| 2 | **Internal Allocation / Chargeback** | Parent distributes platform cost across locals/divisions using governed rules |
| 3 | **Module-Based Monetization** | Each feature suite (governance, grievance, finance, AI) is a separately entitled module |
| 4 | **Transaction Fee Capture** | Platform takes percentage/flat fee on eligible monetized payment flows |
| 5 | **Contract-Aware Runtime** | Commercial contracts govern which modules, orgs, and usage tiers are active at runtime |

**Non-goals:** No payroll dues collection, no employer deduction rails, no parallel billing, no cosmetic-only allocation.

---

## 2. Existing Assets (Canonical Ownership)

### 2.1 Schema Layer

| File | Tables | Layer |
|------|--------|-------|
| `platform-billing.ts` | billing_accounts, subscription_plans, org_subscriptions, billing_periods, platform_invoices, invoice_line_items, platform_payments, payment_allocations, billing_adjustments | L1 — Platform Billing |
| `platform-ledger.ts` | platform_cost_ledger_entries | L2 — DAPL Ledger |
| `allocation.ts` | allocation_rules, allocation_rule_versions, allocation_runs, allocation_run_lines, allocation_basis_snapshots, chargeback_statements | L3 — Allocation |
| `contracts.ts` | commercial_contracts, contract_line_items, org_entitlements, entitlement_usage_log | L1.5 — Contracts |
| `usage-metering.ts` | usage_meters, usage_events, usage_aggregates | L1.5 — Usage Metering |
| `dunning.ts` | dunning_policies, dunning_steps, dunning_cases, subscription_events_log | L1.5 — Dunning |
| `transaction-fees.ts` | transaction_fee_rules, transaction_fee_events, fee_settlement_batches, fee_settlement_lines, fee_adjustments | L1.5 — Transaction Fees |
| `contract-amendments.ts` | contract_rate_cards, contract_amendments, contract_covered_orgs | Contracts extension |
| `pricing-templates.ts` | pricing_templates, pricing_template_modules | L1 — Plan Templates |
| `reconciliation.ts` | reconciliation_runs, reconciliation_matches, reconciliation_exceptions | L5 — Reconciliation |

### 2.2 Service Layer

| Service | File | Layer |
|---------|------|-------|
| Billing Service | `billing-service.ts` | L1 |
| Ledger Service | `ledger-service.ts` | L2 |
| Allocation Engine | `allocation-engine.ts` | L3 |
| Dues Alignment | `dues-alignment.ts` | L4 |
| Finance Outputs | `finance-outputs.ts` | L5 |
| Contract Service | `contract-service.ts` | L1.5 |
| Usage Metering | `usage-metering-service.ts` | L1.5 |
| Proration Engine | `proration-engine.ts` | L1.5 |
| Dunning Service | `dunning-service.ts` | L1.5 |
| Subscription Lifecycle | `subscription-lifecycle-service.ts` | L1.5 |
| Transaction Fee Engine | `transaction-fee-engine.ts` | L1.5 |
| Reconciliation Service | `reconciliation-service.ts` | L5 |
| Entitlement Guard | `entitlement-guard.ts` | L7 — Runtime Enforcement |
| Pricing Template Service | `pricing-template-service.ts` | L1 |

### 2.3 API Routes

| Domain | Route Prefix | Endpoints |
|--------|-------------|-----------|
| Billing | `/api/billing/` | invoices, send-invoice, send-batch, validate, credits, subscriptions, batch-status |
| Payments | `/api/payments/` | checkout, webhooks/stripe, webhooks/paypal |
| Dues | `/api/dues/` | arrears, calculate, balance, billing-cycle, late-fees, ledger, payment-history, payment-plans, receipt, reconcile, remittances |
| Finance | `/api/finance/` | allocation, billing, chargebacks, dashboard, exports, invoices, simulation |
| Contracts | `/api/contracts/` | list, create, get, update, terminate |
| Pension | `/api/pension/` | plans, members, benefits, t4a, trustees |

---

## 3. Gaps Closed by This Implementation

| Gap | Resolution | Phase |
|-----|-----------|-------|
| Transaction fee capture | New `transaction-fees.ts` schema + `transaction-fee-engine.ts` service | 4 |
| Contract rate cards | New `contract-amendments.ts` with rate card + amendment tables | 3 |
| Contract rollout scoping | `contract_covered_orgs` table restricts which locals/divisions are covered | 3 |
| Pricing templates | New `pricing-templates.ts` schema + `pricing-template-service.ts` | 9 |
| Reconciliation engine | New `reconciliation.ts` schema + `reconciliation-service.ts` | 8 |
| Contract-aware runtime enforcement | `entitlement-guard.ts` middleware for route-level module checks | 7 |
| Webhook deduplication | Idempotency key enforcement on fee events | 8 |
| Fee reversal on refund | `reverseTransactionFee()` in fee engine | 4 |

---

## 4. Canonical Target Model

```
┌─────────────────────────────────────────────────────────┐
│                    COMMERCIAL LAYER                      │
│  Contracts → Entitlements → Module Guards → Runtime      │
│  Rate Cards → Fee Rules → Fee Capture → Settlement       │
│  Pricing Templates → Subscription Plans → Billing        │
├─────────────────────────────────────────────────────────┤
│              L1 — PLATFORM BILLING                       │
│  billing_accounts → org_subscriptions → billing_periods  │
│  → platform_invoices → invoice_line_items                │
│  → platform_payments → payment_allocations               │
├─────────────────────────────────────────────────────────┤
│              L2 — DAPL LEDGER (immutable)                │
│  platform_cost_ledger_entries (append-only)              │
├─────────────────────────────────────────────────────────┤
│              L3 — ALLOCATION ENGINE                      │
│  allocation_rules → allocation_runs → run_lines          │
│  → chargeback_statements                                 │
├─────────────────────────────────────────────────────────┤
│              L4 — DUES ALIGNMENT (read-only)             │
│  org_dues_snapshot → local_dues_snapshot                  │
├─────────────────────────────────────────────────────────┤
│              L5 — FINANCE OUTPUTS & RECONCILIATION       │
│  master_invoice_export → gl_export → evidence_pack       │
│  reconciliation_runs → matches → exceptions              │
└─────────────────────────────────────────────────────────┘
```

---

## 5. Migration / Deprecation Plan

| Item | Action | Risk |
|------|--------|------|
| varchar amounts in dues | Coexist; platform billing uses DECIMAL exclusively | Low |
| Legacy `commerce_refunds` | Keep; distinct from platform refund/adjustment flow | None |
| Existing payment routes | No change; new fee capture wraps existing payment flows | None |
| Console platform-economics page | Extend; do not replace | None |
| Manual contract management | Superseded by contract service; keep seed data path | Low |

---

## 6. Monetary Standards

- **Currency:** CAD exclusively. Foreign currency requires CRA T106 exception flow.
- **Precision:** DECIMAL(14,2) for totals, DECIMAL(12,6) for unit prices, DECIMAL(14,4) for quantities.
- **Fee rates:** DECIMAL(8,6) — supports percentage rates like 0.029000 (2.9%).
- **Rounding:** HALF_EVEN (banker's rounding) on all financial calculations.
- **Idempotency:** All fee events and usage events carry unique idempotency keys.
- **Immutability:** Ledger entries, usage logs, and subscription event logs are append-only. Reversals create contra entries.

---

## 7. Security & Audit Requirements

- All commercial mutations logged at `AuditSeverity.HIGH` minimum
- Contract activation/termination logged at `AuditSeverity.CRITICAL`
- Fee capture logged with source transaction reference
- Reconciliation exceptions flagged for manual review
- Entitlement bypass attempts logged and denied server-side
- Webhook signature verification required on all payment processor endpoints
- Idempotency keys prevent duplicate fee capture on webhook retries
