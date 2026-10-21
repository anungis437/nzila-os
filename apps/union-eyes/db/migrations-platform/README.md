# Post-freeze PLATFORM_SQL migrations — Union Eyes

**Status:** ACTIVE forward-only SCHEMA_CREATION root (authorized 2026-09-23).
**Owner:** PLATFORM_SQL_OWNED
**Does not reopen** the frozen historical lineage at `../migrations/` (`.lineage-frozen`).

## Why this root exists

After 2026-05-09, `apps/union-eyes/db/migrations/` is frozen archaeological lineage.
`migrations-cache/` is reserved for scoped cache/RLS/runtime-support.
This directory is the governed home for forward SCHEMA_CREATION of PLATFORM_SQL_OWNED
business tables that already had Drizzle projections / runtime authority but lacked CREATE lineage.

## Execution

- Journal: `meta/_journal.json`
- Ledger: `drizzle.__drizzle_migrations` (shared hash ledger with scoped; content hashes differ)
- Executor: `tooling/scripts/lib/union-eyes-platform-migrations.mjs`
- Wired into `tooling/scripts/run-union-eyes-drizzle-bootstrap.mjs` after runtime privilege quarantine and before scoped `0014`
- Oracle lineage: `UNION_EYES_PLATFORM_SQL` historicalOrder **35**

## Files

| Tag | Purpose |
|---|---|
| `0001_billing_subscriptions` | Companion CREATE for billing_subscriptions (DAPL siblings remain frozen) |
| `0002_employer_execution_and_related_a` | Employer-execution cluster + break_policies + member_breaks + satisfaction_surveys |
| `0003_integration_partners_and_security_posture` | integration_partners + security_posture_checks |
| `0004_audit_gap_canonical_tables` | Audit-gap canonical tables |
| `0005_organization_members_deleted_at` | Additive organization_members columns, including deleted_at |
| `0006_documents_runtime_columns` | Documents runtime columns |
| `0007_claim_updates_runtime_columns` | Claim-update runtime columns |
| `0008_strike_fund_disbursements_canonical` | Canonical CREATE for `strike_fund_disbursements` when the table is absent |
| `0008_strike_fund_uuid_membership_provenance` | Current-lifecycle strike-fund organization provenance for UUID membership |
| `0008_dapl_enum_label_evolution` | Additive labels for historical DAPL enums before `0009` checks canonical order |
| `0008_fee_adjustment_enum_label_evolution` | Adds `partial_reversal` to historical `fee_adjustment_type` before `0009` |
| `0008_django_stub_relation_evolution` | Widens empty Django stubs and casts historical committee text status columns to canonical enums before `0009`. Populated incompatible rows and values outside the enum are refused |
| `0009_canonical_lineage_relations` | Forward CREATE for current Drizzle relations required by the 0014 preflight and its parent or 0015 dependencies |
| `0010_billing_relation_shape_authority` | Align empty `org_subscriptions`, `platform_invoices`, and `platform_payments` to the Drizzle enum and `billing_account_id` contract. Populated incompatible rows are refused |
| `0012_knowledge_transfer_runtime_relations` | `ue_cognition_memory`, `ue_reasoning_sessions` and `ue_copilot_conversations`, previously created by application code in request paths. Legacy runtime-created relations are converted in place only when every id and org_id is a UUID; otherwise the migration fails closed. RLS is scoped `0018` |

## What does not belong here

- Edits to `../migrations/**`
- Fixture/seed/demo data
- RLS/grants (remain in `migrations-cache`)
- Django-owned tables
