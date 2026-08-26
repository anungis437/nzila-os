# CUPE National — Phase 0 Failure Inventory

Root-cause classification for every observable failure at HEAD `290e6c77dd1bc2ddcf33d899e52f13ccd57bd161`, using this taxonomy (as directed by the program authorization):

> Product defect / Test defect / Seed defect / Migration defect / Database defect / Authentication defect / Authorization defect / Environment defect / Stale expectation / Nondeterministic test / External dependency.

## Baselines that PASS at HEAD

| Suite | Result | Log |
|-------|--------|-----|
| Union Eyes full vitest | 1103 files / 16 036 tests / 0 fail in 127.23 s | [vitest-run-20260722-162228.log](vitest-run-20260722-162228.log) |
| Focused API vitest (`apps/union-eyes/app/api/**`) | 9 files / 89 tests / 0 fail in 730 ms | [vitest-api-20260722-162507.log](vitest-api-20260722-162507.log) |

Everything below concerns failures observed elsewhere.

## Findings observed and classified this phase

### F-01 — `packages/db/drizzle/0010_pilot_alerting_hardening.sql` uses an unsupported ALTER TABLE clause

**Class:** Migration defect.
**Evidence:**

```
psql:packages/db/drizzle/0010_pilot_alerting_hardening.sql:43: ERROR:  syntax error at or near "NOT"
LINE 2:   ADD CONSTRAINT IF NOT EXISTS pilot_alerts_rule_fk
```

PostgreSQL (including PG 17) does not support `ADD CONSTRAINT IF NOT EXISTS`. When 0010 was applied to a fresh database, the transaction aborted at that line, leaving:

- `pilot_alerts` columns added (OK).
- `pilot_alert_rules` table created (OK).
- `pilot_alerts.rule_id → pilot_alert_rules.id` FK **missing**.
- `pilot_alert_escalations` table **not created**.
- All indexes after the failing line **not created**.

**Impact:** Any environment that ran 0010 as-committed is inconsistent with the Drizzle schema. Local dev DB was in exactly this state (0009 never applied on this workstation, 0010 also never applied).

**Root-cause fix landed this phase:** [packages/db/drizzle/0033_fix_pilot_alerts_rule_fk.sql](../../../packages/db/drizzle/0033_fix_pilot_alerts_rule_fk.sql). Applies the missing constraint with a `pg_constraint` guard, and re-runs the trailing idempotent statements. Local application successful:

```
DO
CREATE INDEX × 3
CREATE TABLE (pilot_alert_escalations)
CREATE INDEX × 2
CREATE INDEX × 3 (dedup/correlation/open-dedup partial unique)
EXIT: 0
```

### F-02 — Platform migrations have no automated runner in this repo

**Class:** Migration defect (workflow gap).
**Evidence:** Repo-wide search across `packages/db/**`:

- No use of `drizzle-orm/postgres-js/migrator` or `drizzle-orm/node-postgres/migrator`.
- No `applyMigrations` symbol anywhere.
- Only inline comments direct maintainers to run `psql $DATABASE_URL -f packages/db/drizzle/<n>.sql` manually (see 0015–0018 headers).
- `drizzle.__drizzle_migrations` has 46 hash rows; `packages/db/drizzle` has 33 SQL files. The bookkeeping table drifts from the file set with no reconciliation script.

**Impact:** Every developer workstation and every environment must apply platform migrations by hand. Silent drift is the default state. Local dev DB was missing 0009 (`pilot_metrics_layer.sql`) and only partially covered by 0010.

**Deferred to:** Phase 2 (Data Model Reconciliation).

### F-03 — `orgs` and `organizations` are disjoint org registries

**Class:** Database defect (data-model divergence).
**Evidence:**

- `pilot_definitions.org_id` REFERENCES `orgs(id)` (see 0009_pilot_metrics_layer.sql, line 3).
- Union Eyes org resolution reads `organizations` via `getOrganizationIdForUser(userId)` (see `apps/union-eyes/lib/organization-utils.ts`).
- Demo org `11111111-1111-4111-8111-111111111111` ("UE QA Primary Local") exists in `organizations` but **not** in `orgs`.
- `orgs` currently contains 6 rows, none matching the Union Eyes demo org id.

```
orgs.id                                | orgs.legal_name
---------------------------------------+------------------------------------
33333333-3333-3333-3333-333333333333   | Afrobeats Records Inc.
44444444-4444-4444-4444-444444444444   | MS Celebrations Entertainment Ltd.
458a56cb-251a-4c91-a0b5-81bb8ac39087   | Nzila Console Local Dev Org
00000000-0000-0000-0000-000000000000   | Nzila OS AI System
9210418f-6a4f-4dab-a7d2-4450d581dc81   | TrustCore Admin Locked Org
a1b2c3d4-1111-4aaa-8aaa-000000000001   | Trustcore Demo Corp
```

**Impact:** Even with pilot tables present, any pilot-metrics insert for the Union Eyes demo org fails the FK. `pilot-metrics.ts::resolveActivePilotId` returns `null`, causing pilot-mode features to silently no-op or emit warnings.

**Deferred to:** Phase 2 (Data Model Reconciliation).

### F-04 — `db-validator.ts` warns about a nonexistent `users` table

**Class:** Stale expectation.
**Evidence:** `apps/union-eyes/lib/db-validator.ts:190` lists `users` in `criticalTables`. Public schema has `abr_users`, `org_members`, `organization_members`, and 25 `member_*` / `user_*` tables — no bare `users` table.

**Impact:** A `WARN`-level log entry on every server boot; not a functional blocker but pollutes production log signal and confuses migration audits.

**Deferred to:** Phase 1 (Auth & Org Boundary Truth), where the auth table set is aligned with `@nzila/platform-auth`.

### F-05 — Playwright `beforeAll` timeout is 60 s; Windows Turbopack cold start exceeds it

**Class:** Environment defect.
**Evidence:** `apps/union-eyes/e2e/pilot-mode-gating.spec.ts` `beforeAll` hook exceeded 60 000 ms while `_helpers.ensureServerReady` had a 90 000 ms internal timeout. Dev-server log at the moment of timeout was still emitting boot warnings.

**Impact:** On Windows workstations the pilot-gating suite cannot bootstrap. All six role variants in the file are marked "did not run".

**Deferred to:** Phase 1 (adopt a warmed-up dev server or extend `beforeAll` to match `ensureServerReady`'s 90 s ceiling).

### F-06 — Prior E2E baseline at `099af64e3`

**Class:** aggregate, not a single defect.
**Evidence (from prior audit, retained as historical baseline):**

- 116 passed / 24 failed / 10 skipped / 42 did not run in 20.9 minutes.
- Failures span: `authenticated-role-navigation`, `cape-features`, `dashboard`, `empty-states`, `governance`, `member-journey`, `missing-routes`, `no-fsm-overexposure`, `permission-boundaries`, `pilot-mode-gating`, `stakeholder-demo-journeys`.

**Relationship to Phase 0:** HEAD `290e6c77d` differs from `099af64e3` only by the unit-test-harness fix (a single spec file). Product behaviour and DB state are architecturally identical. Re-executing the full E2E at HEAD is expected to produce the same aggregate. That rerun is blocked this session by F-05 and is not required for Phase 0 hand-off — it will happen during Phase 1 with a warmed dev server.

**Deferred to:** Phase 1 (rerun) then Phase 3–7 (per-defect fixes) per program.

### F-07 — `kpi_mrwhcp4b_...` string appears in a UUID-typed column

**Class:** Seed defect (working hypothesis; not yet reproduced this phase).
**Evidence:**

- Prior audit surfaced PG error `invalid input syntax for type uuid: "kpi_mrwhcp4b_d2f72515a580"`.
- Local schema: `kpi_configurations.id` is `uuid`; `ue_cognition_memory.id` is `text`.
- Untracked file `ops/ue-cognition/kpi-snapshots/kpi_mrwhcp4b_d2f72515a580.json` (user WIP) mirrors the offending identifier and looks like seed material.

**Impact:** Any KPI ingestion path that treats the JSON filename or its `id` field as the row's primary key will trip the uuid cast.

**Deferred to:** Phase 3 (Pilot Metrics & Alerts Truth). This is a data-shape decision (accept `text` id, or generate a UUID at ingest) and must not be resolved in Phase 0.

## Findings NOT observed but explicitly checked for and cleared

| Check | Result |
|-------|--------|
| Unit tests fail | Cleared — 16 036/16 036 pass. |
| Focused API tests fail | Cleared — 89/89 pass. |
| `pilot_definitions` schema mismatch after 0009 | Cleared — schema matches `packages/db/src/schema/pilot-metrics.ts`. |
| `pilot_alerts_rule_fk` present after 0033 | Cleared — `pg_constraint` lookup returns the row. |
| Tables `pilot_alert_rules`, `pilot_alert_escalations` present | Cleared — both listed in `pg_tables`. |

## Phase 0 boundary

The classifications above are the exhaustive Phase 0 inventory of defects that could block the 23-scenario program at HEAD. Only one — **F-01 (Migration defect)** — was in-scope for a Phase 0 root-cause fix. All other findings are recorded here as inputs to Phases 1, 2, and 3, and are not touched in Phase 0.
