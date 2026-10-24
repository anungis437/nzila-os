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
| `0013_authority_kernel_storage` | Sixteen `ue_authority_*` relations for the Institutional Authority Kernel: mandates, relationships, delegations, recusals, consents, approval requests and decisions, events, versioned issuance rules, acceptances, idempotency records, the financial step ledger, the review register, the union-side WorkAid referral register, the counsel engagement register and the durable counsel nonce register. Integrity constraints, append-only and in-transaction recording triggers, and a deferred constraint trigger that refuses COMMIT unless the canonical audit chain names each authority event. Revised in place before any deployment. RLS is scoped `0020`. Registered as an UNQUALIFIED addition in `tooling/scripts/lib/ue-approved-migration-lineage.json` |
| `0014_message_thread_triage` | Staff assignment of member conversations: `triage_designations` (explicit, expiring, revocable triage authority) and the append-only `message_thread_assignments`, with guard triggers on `message_threads`. Also evolves the canonical Django stubs the messaging engine depends on: column defaults on `message_threads`, the full shape of the bare `messages` and `in_app_notifications` stubs (the `message_status` and `message_type` enums included), refusing a populated stub it cannot backfill. RLS is scoped `0021`. Registered as an UNQUALIFIED addition in `tooling/scripts/lib/ue-approved-migration-lineage.json` |
| `0015_payments_transaction_source` | Adds nullable `member_id`, `amount` and `currency` (with non-negative and ISO-shape checks) to the four-column Django `payments` stub so the kernel finance policy has an authoritative transaction source. Invents no value for existing rows. Registered as an UNQUALIFIED addition in `tooling/scripts/lib/ue-approved-migration-lineage.json` |
| `0016_documents_org_id_mirror` | Adds the nullable `org_id` mirror column the Drizzle `documents` declaration selects and the external upload writes, with a check that it equals `organization_id`. Tenant authority stays on `organization_id`. Registered as an UNQUALIFIED addition in `tooling/scripts/lib/ue-approved-migration-lineage.json` |
| `0017_dues_transactions_ledger_shape` | Gives the Django `dues_transactions` stub the ledger shape the dues services declare (amounts, covered period, due date, status, payment and processor details, receipt) plus column defaults and a period-order check. Refuses a populated stub rather than inventing amounts. Registered as an UNQUALIFIED addition in `tooling/scripts/lib/ue-approved-migration-lineage.json` |
| `0018_declared_shape_tranche_1` | Evolves 47 live, tenant-scoped Django stub relations to the shape their Drizzle declarations select and write (calendar, deadlines, notifications, campaigns, remittances, signatures, external-system mirrors and others). Generated by `scripts/generate-stub-evolution.ts`; additive, NOT NULL only on empty relations, no keys or RLS. Registered as an UNQUALIFIED addition in `tooling/scripts/lib/ue-approved-migration-lineage.json` |
| `0019_declared_shape_tranche_2` | Second generated, additive evolution of 77 live Django stub relations to their declared shape, including database defaults for Django's base-model `id`, `created_at` and `updated_at` where the declarations do not supply them. NOT NULL only on empty relations, no keys or RLS. Registered as an UNQUALIFIED addition in `tooling/scripts/lib/ue-approved-migration-lineage.json` |

## What does not belong here

- Edits to `../migrations/**`
- Fixture/seed/demo data
- RLS/grants (remain in `migrations-cache`)
- Django-owned tables
