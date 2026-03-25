# Dues-Aware Platform Ledger (DAPL) Architecture

> **Status:** Implemented  
> **Domain:** Platform Economics  
> **Apps:** Union Eyes  
> **Currency:** CAD-only  

## Overview

The DAPL is Union Eyes' canonical financial backbone — a 5-layer architecture
that unifies platform billing, cost allocation, dues alignment, and
reproducible financial exports into a single, auditable system.

```
┌─────────────────────────────────────────────────────────────┐
│  Layer 5 — Finance Outputs                                  │
│  Reproducible exports, evidence packs, GL journals          │
├─────────────────────────────────────────────────────────────┤
│  Layer 4 — Dues Alignment (read-only)                       │
│  Member counts, remittances, arrears, anomaly detection     │
├─────────────────────────────────────────────────────────────┤
│  Layer 3 — Allocation Engine                                │
│  Cost distribution via 7 methods, simulation, chargebacks   │
├─────────────────────────────────────────────────────────────┤
│  Layer 2 — DAPL Core (Append-Only Ledger)                   │
│  Immutable cost entries, reversals (never deletes)          │
├─────────────────────────────────────────────────────────────┤
│  Layer 1 — Platform Billing                                 │
│  Accounts, subscriptions, invoices, payments, periods       │
└─────────────────────────────────────────────────────────────┘
```

## Design Principles

| Principle | Enforcement |
|---|---|
| **CAD-only** | All `_cad` columns; no currency field — hardcoded `'CAD'` |
| **Org isolation** | Every table has `organization_id` FK; all queries scoped |
| **Append-only ledger** | DB trigger prevents UPDATE/DELETE on `platform_cost_ledger_entries` |
| **Period locking** | Closed periods reject new entries and allocations |
| **Simulation safety** | `isSimulation=true` → no ledger entries, no chargebacks |
| **Audit trail** | Every mutation → `auditLog()` with event type + severity |
| **Reproducible exports** | SHA-256 `dataHash` on every export for tamper evidence |

## Schema

### Layer 1 — Platform Billing (`db/schema/domains/finance/platform-billing.ts`)

| Table | Purpose |
|---|---|
| `billing_accounts` | One per org, stores billing tier + contact info |
| `subscription_plans` | Catalog of available plans |
| `org_subscriptions` | Links org → plan with term dates |
| `billing_periods` | Monthly/quarterly periods with lock flag |
| `platform_invoices` | Generated invoices with line items |
| `platform_invoice_line_items` | Per-cost-type line items |
| `platform_payments` | Payment records (CAD) |
| `payment_allocations` | Maps payments → invoices |
| `billing_adjustments` | Credits, refunds, write-offs |
| `billing_terms` | Net-30/60/90 payment terms |

### Layer 2 — DAPL Core (`db/schema/domains/finance/platform-ledger.ts`)

| Table | Purpose |
|---|---|
| `platform_cost_ledger_entries` | **Append-only** — every platform cost event |

Immutability enforced by `prevent_ledger_mutation` trigger.

### Layer 3 — Allocation Engine (`db/schema/domains/finance/allocation.ts`)

| Table | Purpose |
|---|---|
| `allocation_rules` | Named rules per org |
| `allocation_rule_versions` | Versioned method + weights |
| `allocation_runs` | Execution records (posted/simulated) |
| `allocation_run_lines` | Per-local allocation lines |
| `allocation_basis_snapshots` | Frozen input data per run |
| `chargeback_statements` | Invoiceable chargebacks per local |

### Allocation Methods

| Method | Logic |
|---|---|
| `per_member_count` | Proportional to member headcount |
| `per_active_user` | Proportional to active platform users |
| `per_case_volume` | Proportional to grievance/case load |
| `per_local_flat` | Equal split across all locals |
| `weighted_hybrid` | Weighted blend of multiple methods |
| `manual_override` | Direct percentage per local via weights map |
| `subsidized` | Equal split (subsidy reduces pool pre-allocation) |

### Layer 4 — Dues Alignment (read-only)

No new tables. Queries existing dues domain:
- `member_dues_ledger` — member counts
- `employer_remittances` — remittance totals
- `member_arrears` — arrears tracking

### Layer 5 — Finance Outputs

No new tables. Generates exports from DAPL data:
- Master invoices (PDF-ready JSON)
- Allocation statements
- Chargeback reports
- GL journal (JSON + CSV)
- Evidence packs (combined)

## Services

All services are in `services/platform-economics/`:

| File | Layer | Key Exports |
|---|---|---|
| `ledger-service.ts` | 2 | `appendLedgerEntry`, `reverseLedgerEntry`, `getLedgerSummary` |
| `billing-service.ts` | 1 | `createBillingAccount`, `generateInvoice`, `recordPayment` |
| `allocation-engine.ts` | 3 | `createAllocationRule`, `runAllocation`, `getChargebacks` |
| `dues-alignment.ts` | 4 | `getOrgDuesSnapshot`, `detectAnomalies`, `generateDuesAlignmentReport` |
| `finance-outputs.ts` | 5 | `exportMasterInvoice`, `exportGlJournal`, `glJournalToCsv`, `generateEvidencePack` |

## API Routes

All under `/api/finance/`:

| Endpoint | Methods | Auth |
|---|---|---|
| `/billing` | GET, POST | officer / admin |
| `/invoices` | GET, POST | officer / admin |
| `/invoices/[id]` | GET | officer |
| `/invoices/[id]/payments` | GET, POST | officer / admin |
| `/allocation` | GET, POST | officer / admin |
| `/allocation/run` | POST | admin |
| `/chargebacks` | GET | officer |
| `/dashboard` | GET | officer |
| `/simulation` | POST | officer |
| `/exports` | GET | officer |

## UI Pages

All under `/finance/`:

| Page | Purpose |
|---|---|
| Dashboard (`/finance`) | KPI cards, invoices, anomalies, chargebacks |
| Billing (`/finance/billing`) | Account management |
| Invoices (`/finance/invoices`) | Invoice list with status badges |
| Allocation (`/finance/allocation`) | Rules, simulation preview |
| Exports (`/finance/exports`) | Multi-format export generator |

## Testing

Tests: `lib/__tests__/dapl-platform-economics.test.ts`

Coverage areas:
- All 7 allocation methods (per_member_count, per_active_user, etc.)
- Rounding reconciliation (sum always equals pool)
- CAD precision (2 decimal places)
- Anomaly detection (member mismatch, arrears spike, employer missing, remittance gap)
- GL CSV export formatting (headers, quote escaping, comma handling)
- Currency format validation
- SHA-256 hash reproducibility

## Migration

```sql
-- File: db/migrations/20260325_dapl_platform_ledger.sql
-- Run: psql -U nzila -d nzila_automation -f db/migrations/20260325_dapl_platform_ledger.sql
```

Creates all tables, enums, indexes, triggers, and seeds default billing terms.
