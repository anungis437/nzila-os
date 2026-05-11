# ADR — Dues-Aware Platform Ledger (DAPL)

> **ADR ID:** ADR-PE-001  
> **Status:** Accepted  
> **Date:** 2026-03-25  
> **Decision Makers:** NzilaOS Engineering  
> **Domain:** Platform Economics (UnionEyes)  

---

## Context

UnionEyes operates as a multi-tenant, multi-local union management platform.
Until now, billing, cost allocation, and financial reporting were handled through
ad-hoc queries, manual spreadsheets, and disconnected domain tables. This
created three critical gaps:

1. **No canonical source of financial truth** — costs scattered across
   modules with no unified ledger.
2. **Manual allocation** — platform costs distributed to locals via
   spreadsheet, making audits difficult and error-prone.
3. **No reproducibility** — financial exports could not be regenerated
   with identical results.

Union contracts require transparent dues accounting, employer remittance
tracking, and cost-sharing documentation. The existing dues domain tables
(member_dues_ledger, employer_remittances, member_arrears) handle collection;
what was missing was the *platform economics* layer that bills for platform
usage and allocates costs back to locals.

### Constraints

1. **CAD-only** — all union operations are in Canadian dollars; no
   multi-currency support needed.
2. **Read-only dues integration** — DAPL must never modify dues domain
   tables (payroll/dues collection is a separate system concern).
3. **Immutable ledger** — financial entries cannot be edited or deleted;
   errors corrected via reversal entries.
4. **Org isolation** — all data scoped by `organization_id`; no cross-org
   queries allowed.
5. **Period locking** — closed billing periods reject new mutations.
6. **Audit requirements** — every mutation must produce an audit log entry.

## Decision

Implement a 5-layer Dues-Aware Platform Ledger:

| Layer | Responsibility | Writes? |
|---|---|---|
| 1 — Platform Billing | Accounts, subscriptions, invoices, payments | Yes |
| 2 — DAPL Core | Append-only cost ledger with DB-enforced immutability | Append-only |
| 3 — Allocation Engine | Rule-based cost distribution with simulation | Yes (when not simulating) |
| 4 — Dues Alignment | Read-only ingestion of dues domain signals | No |
| 5 — Finance Outputs | Reproducible exports with SHA-256 data hashes | No |

### Why 5 layers?

- **Separation of concerns**: billing (invoicing customers) vs. ledger
  (recording costs) vs. allocation (distributing costs) are distinct
  financial operations.
- **Dues alignment as read-only adapter**: avoids coupling platform
  economics to dues collection while enabling anomaly detection.
- **Outputs as pure functions**: export logic never writes to DB, ensuring
  reproducibility and idempotency.

### Why append-only ledger?

Financial systems require an immutable audit trail. Rather than soft deletes
or update flags, we enforce immutability via a PostgreSQL trigger that
prevents UPDATE and DELETE on `platform_cost_ledger_entries`. Corrections
are made by reversals (negative entries referencing the original).

### Why 7 allocation methods?

Different union structures need different fairness models:

- Large unions with many locals → per_member_count
- Tech-forward unions → per_active_user
- Grievance-heavy environments → per_case_volume
- Simple structures → per_local_flat
- Complex negotiations → weighted_hybrid or manual_override
- Subsidized onboarding → subsidized

### Why CAD-only?

All current and anticipated UnionEyes customers operate in Canada. Adding
multi-currency would introduce exchange rate complexity, hedging concerns,
and regulatory requirements with no current customer demand. If multicurrency
is needed later, the `_cad` suffix on all columns makes migration paths
explicit.

## Consequences

### Positive

- Single source of truth for all platform financial data
- Auditable allocation with frozen basis snapshots
- Simulation mode enables "what-if" analysis without side effects
- Reproducible exports with cryptographic hash verification
- Anomaly detection catches data quality issues before they affect billing
- Period-locked entries prevent retroactive manipulation

### Negative

- Append-only ledger will grow indefinitely (mitigated by periodic
  archival and partitioning if needed)
- 7 allocation methods increase testing surface
- Schema migration is large (20+ tables in one SQL file)

### Risks

- Dues domain table schemas may change, breaking Layer 4 queries
  (mitigated: raw SQL queries are isolated in `dues-alignment.ts`)
- Large allocation runs with many locals could be slow
  (mitigated: simulation mode allows preview before commit)

## Alternatives Considered

1. **External billing system (Stripe/ChargeBee)**: Rejected — union dues
   and cost-sharing models don't fit SaaS billing abstractions. Allocation
   and chargeback logic would still need custom implementation.

2. **Single-table ledger with views**: Rejected — combining billing,
   allocation, and dues signals in one table would create an unmaintainable
   schema with >40 nullable columns.

3. **Event-sourced architecture**: Considered but deferred — event sourcing
   would be ideal for the immutable ledger, but the team's expertise and
   existing infra favor relational tables with triggers. The append-only
   pattern is effectively a simplified event store.
