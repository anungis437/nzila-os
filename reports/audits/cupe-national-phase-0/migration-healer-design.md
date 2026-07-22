# Phase 0A.1 · Migration healer design

**Date:** 2026-07-23
**Scope:** Phase 0A.1 closure only — historical migration lineage repair.
**Runner:** [tooling/scripts/apply-platform-migrations.mjs](../../../tooling/scripts/apply-platform-migrations.mjs)
**Healers authored:** `0034_heal_orchestrator_runtime_hardening.sql`, `0035_heal_trustcore_law25_chain.sql`, `0036_heal_audit_events_canonical_hash.sql`, `0037_heal_pilot_alerting_hardening.sql`
**Allowlist:** [packages/db/drizzle/.known-partial-failures.json](../../../packages/db/drizzle/.known-partial-failures.json) — 7 entries.

---

## 1. Design axiom

> The checked-in prerequisite baseline plus every incremental migration must run from an empty PostgreSQL database to completion, with zero pending migrations, zero unapproved failures, and a successful idempotent second execution.

Each historical migration that is tolerated as an "approved partial" **must** be paired with a later healer that restores the complete intended state. No exceptions.

## 2. Root-cause finding — PostgreSQL 14+ implicit transaction wrapping

Phase 0A originally assumed that the PostgreSQL wire protocol committed each statement in a multi-statement query up to the first failure ("commits N statements before aborting"). This assumption was wrong on empty databases.

**Empirical finding validated during Phase 0A.1:**

- The runner uses the node-postgres client in **simple query protocol** (each `.sql` file dispatched via a single `Query` message).
- PostgreSQL 14 and later wrap the entire `Query` message in a single **implicit transaction**.
- **Any runtime error inside a multi-statement file rolls back ALL statements in that file**, not just the offending statement and its successors.
- The dev DB `nzila_automation` **masked** this behaviour because prior out-of-band `drizzle-kit push` invocations had already materialized most historical artifacts, so most historical failures short-circuited on `IF NOT EXISTS`-guarded paths and never entered runtime error territory.

Consequence: Phase 0A's PH0-OPEN-006 / -007 / -008 diagnoses were structurally correct (the underlying SQL bugs are real) but their impact-radius claims — "commits ADD COLUMNs then fails at DROP INDEX" — were only accurate on the pre-populated dev DB. On empty DBs those partial-commit statements **also** roll back, meaning the healers must restore **everything** the failed migration intended, not merely the statements after the point of failure.

This finding also surfaced a fourth defect chain that was invisible in Phase 0A: `0010_pilot_alerting_hardening.sql` contains a parser-level error (`ADD CONSTRAINT IF NOT EXISTS`, unsupported), causing PG14+ to roll back the entire `pilot_alerts` hardening step. `0033_fix_pilot_alerts_rule_fk.sql` then fails because `pilot_alert_rules` was never created. This was tracked in Phase 0A as PH0-FIX-001 (healed only the FK on the dev DB where the columns were already present via drizzle-kit push). On an empty DB, `0033` fails cascade-style.

## 3. Healer contract (all four healers)

Every healer file must:

1. Be prefixed with a header block naming the defect, the source migration(s) it repairs, the PG14+ wrapping insight, and the "FULLY RESTORED" list of objects.
2. Use `IF NOT EXISTS` on every `CREATE TABLE`, `CREATE INDEX`, `ADD COLUMN`.
3. Use `DO $tag$ … EXCEPTION WHEN duplicate_object THEN NULL; END $tag$;` guards on every `CREATE TYPE` (enums).
4. Use `DO $tag$ … EXCEPTION WHEN duplicate_object THEN NULL; END $tag$;` guards on every `ADD CONSTRAINT` (FK / UNIQUE) — since PG does not support `ADD CONSTRAINT IF NOT EXISTS`.
5. Guard every `ALTER COLUMN … SET NOT NULL` behind a `DO $tag$ IF is_nullable = 'YES' THEN … END IF; END $tag$;` block so re-runs against an already-tightened column are no-ops.
6. Perform any backfill (`UPDATE … WHERE col IS NULL`) **before** flipping columns to `NOT NULL`.
7. Be wrapped in a single `BEGIN; … COMMIT;` block for atomicity.
8. Be idempotent — a second execution must be a full no-op.

## 4. Per-healer summary

### 4.1 `0034_heal_orchestrator_runtime_hardening.sql` — heals PH0-OPEN-006

Repairs `0013_orchestrator_runtime_hardening.sql`, which fails at its `DROP INDEX IF EXISTS automation_commands_correlation_id_unique` statement because 0003 created that name as a `UNIQUE CONSTRAINT`, not a plain index. Under PG14+ the failure rolls back all of 0013.

**Restores on `automation_commands`:** 9 columns (`org_id`, `idempotency_key`, `version`, `attempt_count`, `execution_owner`, `lease_expires_at`, `last_heartbeat_at`, `started_at`, `completed_at`), backfills, tightens `org_id` + `idempotency_key` to `NOT NULL`, drops the UNIQUE constraint via `ALTER TABLE … DROP CONSTRAINT IF EXISTS`, and creates 5 indexes (`org_status_idx`, `org_created_idx`, `execution_owner_idx`, `lease_expires_idx`, `correlation_id_idx`).

**Restores on `automation_events`:** `org_id uuid` (added, backfilled, then tightened to `NOT NULL`) plus 2 indexes (`org_created_idx`, `command_id_created_idx`).

### 4.2 `0035_heal_trustcore_law25_chain.sql` — heals PH0-OPEN-007

Repairs the `0017 → 0019 → 0025` chain. `0017_trustcore_law25.sql` uses `CREATE TYPE IF NOT EXISTS` which is not valid PostgreSQL syntax — the parser rejects the file before any statement runs. On an empty DB, `0019_trustcore_policies.sql` and `0025_trustcore_privacy_programs_org_name.sql` then fail because their prerequisites do not exist.

**Restores:** 14 `tc_*` enums (each behind `DO $tag$ … EXCEPTION $tag$`), 8 `trustcore_*` tables (`_privacy_programs`, `_data_assets`, `_consent_records`, `_dsr_requests`, `_incidents`, `_pias`, `_evidence_events`, `_vendors`), plus the `onboarding_completed_at` and `org_name` columns 0025 was to add to `trustcore_privacy_programs`, plus 22 supporting indexes.

Section (4b) additionally restores what `0019_trustcore_policies.sql` was to create: the `tc_policy_type` enum, the `trustcore_policies` table, and its two indexes (`tc_policies_org_idx`, `tc_policies_org_type_idx`). This is required because on an empty DB `0019` cannot commit any of its statements when PG14+ rolls the whole file back.

### 4.3 `0036_heal_audit_events_canonical_hash.sql` — heals PH0-OPEN-008

Repairs `0032_audit_events_canonical_hash.sql`, which fails at line 43 with `column "org_id" does not exist`. Under PG14+ the failure rolls back all of 0032, including the preceding `ADD COLUMN occurred_at` and `ADD COLUMN hash_version` statements.

**Restores on `audit_events`:** `occurred_at timestamptz NOT NULL DEFAULT now()`, `hash_version text NOT NULL DEFAULT 'linkage-only-v0'`, `org_id uuid` (added, guarded FK to `orgs(id)` via `ALTER TABLE … ADD CONSTRAINT audit_events_org_id_orgs_id_fk`, then tightened to `NOT NULL`), plus the `audit_events_org_occurred_idx` index. Also asserts (via a hash-columns runtime check) that the 14 canonical hash columns 0032 was to introduce all exist.

### 4.4 `0037_heal_pilot_alerting_hardening.sql` — heals PH0-OPEN-010 (new)

Repairs the `0010 → 0033` chain. `0010_pilot_alerting_hardening.sql` uses `ADD CONSTRAINT IF NOT EXISTS` which the PostgreSQL parser rejects; the entire file rolls back. `0033_fix_pilot_alerts_rule_fk.sql` (originally PH0-FIX-001, effective only against the dev DB where prior drizzle-kit push had materialized `pilot_alert_rules` and the `rule_id` column) then fails on an empty DB because the referenced table does not exist.

**Restores on `pilot_alerts`:** 21 columns (rule identity, correlation, escalation state, dedup window). Creates `pilot_alert_rules` and `pilot_alert_escalations` from scratch. Adds the `pilot_alerts_rule_fk` FK behind a `DO $tag$ EXCEPTION WHEN duplicate_object $tag$` guard, plus 3 rules indexes, 2 escalations indexes, and dedup/correlation/partial-open-dedup indexes on `pilot_alerts`.

## 5. Runner enforcement

`tooling/scripts/apply-platform-migrations.mjs` was hardened as part of Phase 0A.1 so that:

- The `drizzle.__platform_migrations` tracking table carries `partial`, `sqlstate`, `error_signature`, `statement_location`, `healer_filename`, and `outcome_class` columns. Existing installations receive them via `ADD COLUMN IF NOT EXISTS`.
- On every applied migration, the runner records not just the hash but the outcome class (`full-success` / `approved-partial`).
- On any partial-apply the runner reads `.known-partial-failures.json`, matches by SQLSTATE + error signature, and refuses to record unless a matching healer filename is present in the allowlist **and** that healer file exists on disk.
- `--verify` fails with exit code 2 if any allowlisted partial in the tracking table lacks a corresponding recorded healer with `outcome_class = 'full-success'`.

## 6. Allowlist — 7 entries

Each entry references a healer that this design authors:

| Source (partial) | SQLSTATE | Healer |
|---|---|---|
| `0010_pilot_alerting_hardening.sql` | 42601 | `0037_heal_pilot_alerting_hardening.sql` |
| `0013_orchestrator_runtime_hardening.sql` | 2BP01 | `0034_heal_orchestrator_runtime_hardening.sql` |
| `0017_trustcore_law25.sql` | 42601 | `0035_heal_trustcore_law25_chain.sql` |
| `0019_trustcore_policies.sql` | 42P01 | `0035_heal_trustcore_law25_chain.sql` |
| `0025_trustcore_privacy_programs_org_name.sql` | 42P01 | `0035_heal_trustcore_law25_chain.sql` |
| `0032_audit_events_canonical_hash.sql` | 42703 | `0036_heal_audit_events_canonical_hash.sql` |
| `0033_fix_pilot_alerts_rule_fk.sql` | 42P01 | `0037_heal_pilot_alerting_hardening.sql` |
