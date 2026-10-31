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
| `0027_workaid_union_side_disclosure` | Union-side WorkAid disclosure: versioned consent wording, member consent grants, per-document authorisations, shares and counsel-access records. No counsel-side system or content. Registered as an UNQUALIFIED addition in `tooling/scripts/lib/ue-approved-migration-lineage.json`. RLS is scoped (cache) `0026`. |
| `0028_location_deletion_log_shape` | Additive evolution of the Django-created `location_deletion_log` stub (evidence columns plus defaults on id, created_at, updated_at) so consent revocation and the 24-hour retention sweep can record their evidence. Registered as an UNQUALIFIED addition in `tooling/scripts/lib/ue-approved-migration-lineage.json`. |
| `0029_message_thread_authority_scope` | Lets a recusal name a conversation, and refuses a stored delegation of `message:place_legal_hold` or `message:release_legal_hold`. Does not issue either power. Registered as an UNQUALIFIED addition in `tooling/scripts/lib/ue-approved-migration-lineage.json`. |
| `0030_message_retention_authority_scope` | Lets a recusal name the organization's retention duty, and refuses a stored delegation of `message:adopt_retention` or `message:read_retention_policy`. Does not issue either power. Registered as an UNQUALIFIED addition in `tooling/scripts/lib/ue-approved-migration-lineage.json`. |
| `0031_reachable_stub_shape` | Additive evolution of `data_anonymization_log`, `employment_history`, `job_classifications`, and `member_leaves`. NOT NULL only on an empty relation. No keys, no RLS change, no destructive statement. Revised in place before any apply with a column-type preflight and constraint, index, policy, grant, and row-security definition fingerprints. Still an UNQUALIFIED addition in `tooling/scripts/lib/ue-approved-migration-lineage.json`. |
| `0033_election_certificate_successions` | Successor relation for a certified `council_elections` row: version, provenance hash, distinct issuer and reviewer, decision, dispute and recount references. The certified row is not rewritten. Fails closed when `council_elections` is absent. Still an UNQUALIFIED addition in `tooling/scripts/lib/ue-approved-migration-lineage.json`. |
| `0034_election_organization_ownership` | Binds one council election to one organization. Lookups join this relation and filter `organization_id`. Does not rewrite a certified column and does not issue a grant. Still an UNQUALIFIED addition in `tooling/scripts/lib/ue-approved-migration-lineage.json`. |
| `0035_election_supersession_authority_scope` | Lets a recusal name a council election and refuses a stored delegation of `governance:supersede_certified_result`. Does not issue that power. Still an UNQUALIFIED addition in `tooling/scripts/lib/ue-approved-migration-lineage.json`. |
| `0036_workaid_consent_wording_proposals` | Proposal rows for institution-supplied consent wording. Adoption by a different executive is what inserts a current consent text. Does not insert wording. Still an UNQUALIFIED addition in `tooling/scripts/lib/ue-approved-migration-lineage.json`. RLS is scoped (cache) `0028`. |
| `0037_workaid_referral_scope` | Adds immutable `referred_categories` on `ue_authority_workaid_matters`. A new referral must record its own categories. Existing rows stay null and readers fail closed. Does not copy consent scope. UNQUALIFIED. |
| `0032_notification_callback_identity` | One provider-message event on `notification_delivery_log`, and one owning organization per provider message. Existing duplicates fail the migration. Does not delete a row, choose an owner, or change `notification_queue`. Still an UNQUALIFIED addition in `tooling/scripts/lib/ue-approved-migration-lineage.json`. |
| `0025_message_thread_lifecycle_and_retention` | Message-thread lifecycle (append-only close, archive and legal-hold history with database-enforced ordering), policy-parameterised message retention (no default period) and read-state markers. Registered as an UNQUALIFIED addition in `tooling/scripts/lib/ue-approved-migration-lineage.json`. RLS is scoped (cache) `0024`. |
| `0023_signature_provider_acknowledgment` | `provider_acknowledged_at` (the event time a signature provider itself reported, immutable once set, only on a document with an external provider envelope) and `provider_status_observed_at` (local receipt time, kept apart so it is never read as an event time) on `signature_documents`. Registered as an UNQUALIFIED addition in `tooling/scripts/lib/ue-approved-migration-lineage.json` |
| `0022_document_intake_and_transcription` | Temporary document intake (`document_intakes`: open to accepted, expired or cancelled, bound to the principal, organization, exact server-chosen storage key, server checksum, MIME type, size and intended operation; an accepted intake is terminal and must name the version that holds its object; an object a version references can never be marked for deletion), append-only machine and human-reviewed transcript revisions kept separate from the immutable original (`document_transcript_revisions`), an append-only evidence publication record (`document_transcript_publications`) and an explicit `can_process_ocr` grant column. Registered as an UNQUALIFIED addition in `tooling/scripts/lib/ue-approved-migration-lineage.json` |
| `0021_employer_execution_integrity` | Adds `executed_by` / `executed_at` to `employer_payroll_runs` (the executing officer is a recorded fact, not only an audit entry) and makes two code-level rules structural: one remittance run per payroll run and one timesheet batch per organization, employer, period and source-file hash, as unique indexes. Refuses existing duplicates rather than choosing a survivor. Registered as an UNQUALIFIED addition in `tooling/scripts/lib/ue-approved-migration-lineage.json` |
| `0020_declared_shape_tranche_3` | Third generated, additive evolution of 23 live Django stub relations to their declared shape (organizing, settlements, surveys, polls, federations, safety and others). NOT NULL only on empty relations, no keys or RLS. Registered as an UNQUALIFIED addition in `tooling/scripts/lib/ue-approved-migration-lineage.json` |
| `0038_gate0_integrity_columns` | Gate 0 integrity columns: KPI direction, who recorded minutes, who submitted an interview or content item, one primary employer contact and unique SSO providers (including nullable identity-key evolution for Django's minimal SSO stub). Registered as an UNQUALIFIED addition in `tooling/scripts/lib/ue-approved-migration-lineage.json`. |
| `0039_committee_memberships_shape` | Evolve committee_memberships to its declared shape Registered as an UNQUALIFIED addition in `tooling/scripts/lib/ue-approved-migration-lineage.json`. |
| `0040_gate0_integrity_enforcement` | Enforce gate-0 integrity rules in the database Registered as an UNQUALIFIED addition in `tooling/scripts/lib/ue-approved-migration-lineage.json`. |
| `0041_room_bookings_shape` | Evolve room_bookings and refuse overlapping bookings Registered as an UNQUALIFIED addition in `tooling/scripts/lib/ue-approved-migration-lineage.json`. |
| `0042_tenant_scoped_uniqueness` | Make nine record numbers and codes unique within an organization Registered as an UNQUALIFIED addition in `tooling/scripts/lib/ue-approved-migration-lineage.json`. |
| `0043_knowledge_transfer_owner` | Record who opened each copilot conversation and reasoning session Registered as an UNQUALIFIED addition in `tooling/scripts/lib/ue-approved-migration-lineage.json`. |

## What does not belong here

- Edits to `../migrations/**`
- Fixture/seed/demo data
- RLS/grants (remain in `migrations-cache`)
- Django-owned tables
