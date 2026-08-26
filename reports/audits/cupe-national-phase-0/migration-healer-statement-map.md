# Phase 0A.1 · Healer statement map

For each historical partial-apply source migration, maps each source statement to the healer statement that restores its intended effect (or documents that it succeeds independently on subsequent runs). All references are to files in `packages/db/drizzle/`.

## 1. `0010_pilot_alerting_hardening.sql` (SQLSTATE 42601, parser rejection)

Healer: `0037_heal_pilot_alerting_hardening.sql`.

| 0010 source statement | Healer statement |
|---|---|
| `ALTER TABLE pilot_alerts ADD COLUMN rule_id …` and 20 sibling `ADD COLUMN`s | `ADD COLUMN IF NOT EXISTS` for all 21 columns (§ "pilot_alerts columns") |
| `CREATE TABLE pilot_alert_rules …` | `CREATE TABLE IF NOT EXISTS pilot_alert_rules` |
| `ALTER TABLE pilot_alerts ADD CONSTRAINT IF NOT EXISTS pilot_alerts_rule_fk …` (parser rejects) | `DO $healer_0037_fk$ … EXCEPTION WHEN duplicate_object THEN NULL; END $healer_0037_fk$;` wrapping `ALTER TABLE pilot_alerts ADD CONSTRAINT pilot_alerts_rule_fk FOREIGN KEY (rule_id) REFERENCES pilot_alert_rules(id)` |
| Rules indexes (3) | `CREATE INDEX IF NOT EXISTS pilot_alert_rules_org_idx`, `pilot_alert_rules_severity_idx`, `pilot_alert_rules_enabled_idx` |
| `CREATE TABLE pilot_alert_escalations …` | `CREATE TABLE IF NOT EXISTS pilot_alert_escalations` + 2 indexes |
| pilot_alerts dedup / correlation / partial-open indexes | `CREATE INDEX IF NOT EXISTS` for each |

## 2. `0013_orchestrator_runtime_hardening.sql` (SQLSTATE 2BP01, dependent-object drop)

Healer: `0034_heal_orchestrator_runtime_hardening.sql`.

| 0013 source statement | Healer statement |
|---|---|
| `automation_commands` 9 `ADD COLUMN` (org_id, idempotency_key, version, attempt_count, execution_owner, lease_expires_at, last_heartbeat_at, started_at, completed_at) | `ADD COLUMN IF NOT EXISTS` for each of the 9 |
| `UPDATE automation_commands SET org_id = …, idempotency_key = …` backfill | `UPDATE automation_commands SET org_id = coalesce(org_id, gen_random_uuid()), idempotency_key = coalesce(idempotency_key, id::text) WHERE org_id IS NULL OR idempotency_key IS NULL` |
| `ALTER TABLE automation_commands ALTER COLUMN org_id SET NOT NULL`, same for `idempotency_key` | `DO $healer_0034_commands_notnull$` guarded flip |
| `DROP INDEX IF EXISTS automation_commands_correlation_id_unique` (fails — it is a constraint) | `ALTER TABLE automation_commands DROP CONSTRAINT IF EXISTS automation_commands_correlation_id_unique` |
| 5 `CREATE INDEX` on automation_commands (org_status, org_created, execution_owner, lease_expires, correlation_id) | `CREATE INDEX IF NOT EXISTS` for each |
| `ALTER TABLE automation_events ADD COLUMN org_id uuid` | `ADD COLUMN IF NOT EXISTS org_id uuid` |
| `UPDATE automation_events SET org_id = …` backfill | `UPDATE automation_events SET org_id = coalesce(org_id, gen_random_uuid()) WHERE org_id IS NULL` |
| `ALTER TABLE automation_events ALTER COLUMN org_id SET NOT NULL` | `DO $healer_0034_events_notnull$` guarded flip |
| 2 `CREATE INDEX` on automation_events (org_created, command_id_created) | `CREATE INDEX IF NOT EXISTS` for each |

## 3. `0017_trustcore_law25.sql` (SQLSTATE 42601, parser rejection)

Healer: `0035_heal_trustcore_law25_chain.sql` (§§ 1–4a).

| 0017 source statement | Healer statement |
|---|---|
| `CREATE TYPE IF NOT EXISTS tc_severity …` and 13 sibling enums (parser rejects) | `DO $healer_0035_tc_severity$ CREATE TYPE tc_severity …; EXCEPTION WHEN duplicate_object THEN NULL; END $healer_0035_tc_severity$;` — one guarded block per enum, 14 total |
| Enum-drift assertion | `DO $healer_0035_enum_drift$` verifying all 14 enum labels present |
| 8 `CREATE TABLE trustcore_*` | `CREATE TABLE IF NOT EXISTS trustcore_privacy_programs`, `_data_assets`, `_consent_records`, `_dsr_requests`, `_incidents`, `_pias`, `_evidence_events`, `_vendors` |
| 22 supporting indexes | `CREATE INDEX IF NOT EXISTS` for each |

## 4. `0019_trustcore_policies.sql` (SQLSTATE 42P01, missing prerequisite)

Healer: `0035_heal_trustcore_law25_chain.sql` (§ 4b).

| 0019 source statement | Healer statement |
|---|---|
| `CREATE TYPE tc_policy_type AS ENUM ('privacy_policy', 'data_governance')` | `DO $healer_0035_tc_policy_type$ CREATE TYPE tc_policy_type AS ENUM ('privacy_policy', 'data_governance'); EXCEPTION WHEN duplicate_object THEN NULL; END $healer_0035_tc_policy_type$;` |
| `CREATE TABLE trustcore_policies (id uuid PRIMARY KEY, org_id uuid REFERENCES orgs(id), type tc_policy_type, content text, version int, generated_by text, created_at timestamptz)` | `CREATE TABLE IF NOT EXISTS trustcore_policies (…)` with identical shape |
| `CREATE INDEX tc_policies_org_idx`, `tc_policies_org_type_idx` | `CREATE INDEX IF NOT EXISTS` for each |

## 5. `0025_trustcore_privacy_programs_org_name.sql` (SQLSTATE 42P01, missing prerequisite)

Healer: `0035_heal_trustcore_law25_chain.sql` (§§ 3–4a).

| 0025 source statement | Healer statement |
|---|---|
| `ALTER TABLE trustcore_privacy_programs ADD COLUMN onboarding_completed_at timestamptz` | `ADD COLUMN IF NOT EXISTS onboarding_completed_at timestamptz` (once the healer creates `trustcore_privacy_programs` in § 2) |
| `ALTER TABLE trustcore_privacy_programs ADD COLUMN org_name text` | `ADD COLUMN IF NOT EXISTS org_name text` |

## 6. `0032_audit_events_canonical_hash.sql` (SQLSTATE 42703, missing column reference)

Healer: `0036_heal_audit_events_canonical_hash.sql`.

| 0032 source statement | Healer statement |
|---|---|
| `ALTER TABLE audit_events ADD COLUMN occurred_at timestamptz NOT NULL DEFAULT now()` | `ADD COLUMN IF NOT EXISTS occurred_at timestamptz NOT NULL DEFAULT now()` |
| `ALTER TABLE audit_events ADD COLUMN hash_version text NOT NULL DEFAULT 'linkage-only-v0'` | `ADD COLUMN IF NOT EXISTS hash_version text NOT NULL DEFAULT 'linkage-only-v0'` |
| `ALTER TABLE audit_events ADD COLUMN org_id uuid NOT NULL REFERENCES orgs(id)` (fails at line 43 because runtime cast can't resolve NULL) | `ADD COLUMN IF NOT EXISTS org_id uuid` + backfill + `DO $healer_0036_fk$` guarded FK + `DO $healer_0036_notnull$` guarded NOT NULL flip |
| `CREATE INDEX audit_events_org_occurred_idx ON audit_events (org_id, occurred_at DESC)` | `CREATE INDEX IF NOT EXISTS audit_events_org_occurred_idx ON audit_events (org_id, occurred_at DESC)` |
| Canonical-hash columns assertion (14 columns) | `DO $healer_0036_hash_columns$` block that verifies all 14 canonical hash columns exist |

## 7. `0033_fix_pilot_alerts_rule_fk.sql` (SQLSTATE 42P01, missing prerequisite)

Healer: `0037_heal_pilot_alerting_hardening.sql` (see § 1 above).

| 0033 source statement | Healer statement |
|---|---|
| `ALTER TABLE pilot_alerts ADD CONSTRAINT pilot_alerts_rule_fk FOREIGN KEY (rule_id) REFERENCES pilot_alert_rules(id)` (fails — `pilot_alert_rules` does not exist because 0010 rolled back) | Healer creates `pilot_alert_rules`, adds the `rule_id` column to `pilot_alerts`, then attaches the FK inside a `DO $healer_0037_fk$` block. |

## 8. Not tolerated (no allowlist entry)

Every migration not enumerated above must apply cleanly on an empty database. As of 2026-07-23 the fully-restored probe DB (`nzila_phase0a1_probe`) reports 27 `full-success` incrementals in `drizzle.__platform_migrations`, plus 4 `full-success` healers (0034 / 0035 / 0036 / 0037), plus 7 `approved-partial` entries paired 1:1 with the healers above.
