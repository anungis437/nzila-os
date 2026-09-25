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
- Wired into `tooling/scripts/run-union-eyes-drizzle-bootstrap.mjs` **after** scoped migrations
- Oracle lineage: `UNION_EYES_PLATFORM_SQL` historicalOrder **35**

## Files

| Tag | Purpose |
|---|---|
| `0001_billing_subscriptions` | Companion CREATE for billing_subscriptions (DAPL siblings remain frozen) |
| `0002_employer_execution_and_related_a` | Employer-execution cluster + break_policies + member_breaks + satisfaction_surveys |
| `0003_integration_partners_and_security_posture` | integration_partners + security_posture_checks |

## What does not belong here

- Edits to `../migrations/**`
- Fixture/seed/demo data
- RLS/grants (remain in `migrations-cache`)
- Django-owned tables
