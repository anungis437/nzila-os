# Phase 0B.1 — KPI Database Migration Proof (Gap Analysis)

**Status:** ⚠️ **DATABASE GAP** — TypeScript schema in
`packages/ue-cognition/src/schema.ts` (commit `896a18e0c`) declares six
tables with `text` primary keys, but **no corresponding SQL migration
exists in `packages/db/drizzle/*.sql`**.

## Evidence

`grep -R "ue_case_risk_snapshots|ue_workload_snapshots|ue_engagement_snapshots|ue_precedent_matches|ue_kpi_snapshots|ue_cognition_audits"`
against `packages/db/drizzle/*.sql` returns **zero matches**. These six
tables have never been created as SQL DDL.

The schema.ts file's own header comment acknowledges this:

> "NOT YET RUN AS A MIGRATION. Phase-1 storage is file-backed JSON under
> `ops/ue-cognition/`. These tables describe the eventual move to Postgres
> so the schema is reviewable + testable today and the file→DB swap is a
> single store-adapter change."

## Table × column matrix for the required migration

Every row's `id` is `text` (app-generated via `makeId(<prefix>)`, format
`<prefix>_<base36 ts>_<12 hex>`). Every `org_id` is `uuid`. Every
`snapshot_at`/`computed_at`/`occurred_at`/`retrieved_at` is
`timestamptz NOT NULL DEFAULT now()`.

| Table | id | org_id | other required columns |
| --- | --- | --- | --- |
| `ue_case_risk_snapshots` | `text PRIMARY KEY` | `uuid NOT NULL` | `tenant_id text NN`, `case_id text NN`, `case_kind text NN`, `risk_score int NN`, `risk_probability double NN`, `risk_tier text NN`, `confidence double NN`, `recommended_action text NN`, `rationale text NN`, `top_factors jsonb NN`, `factors jsonb NN`, `trajectory jsonb NN`, `model_version text NN`, `snapshot_at timestamptz NN default now()` |
| `ue_workload_snapshots` | `text PRIMARY KEY` | `uuid NOT NULL` | `tenant_id text NN`, `steward_id text NN`, `current_caseload int NN`, `max_caseload int NN`, `utilization_ratio double NN`, `at_risk_case_count int NN`, `avg_response_days double NULL`, `status text NN`, `sla_risk_score double NN`, `burnout_signal double NN`, `recommended_reassignments jsonb NN`, `snapshot_at timestamptz NN default now()` |
| `ue_engagement_snapshots` | `text PRIMARY KEY` | `uuid NOT NULL` | `tenant_id text NN`, `member_id text NN`, `engagement_score int NN`, `disengagement_probability double NN`, `tier text NN`, `days_since_last_activity double NN`, `recent_signals jsonb NN`, `recommended_channel text NN`, `recommended_timing_hours double NN`, `model_version text NN`, `snapshot_at timestamptz NN default now()` |
| `ue_precedent_matches` | `text PRIMARY KEY` | `uuid NOT NULL` | `tenant_id text NN`, `for_case_id text NN`, `matches jsonb NN`, `typical_days_to_resolve double NULL`, `typical_settlement_amount double NULL`, `success_rate double NN`, `retrieved_at timestamptz NN default now()` |
| `ue_kpi_snapshots` | `text PRIMARY KEY` | `uuid NOT NULL` | `tenant_id text NN`, `window_days int NN`, `window_start timestamptz NN`, `window_end timestamptz NN`, `payload jsonb NN`, `model_version text NN`, `computed_at timestamptz NN default now()` |
| `ue_cognition_audits` | `text PRIMARY KEY` | `uuid NOT NULL` | `tenant_id text NN`, `resource text NN`, `action text NN`, `actor_id text NULL`, `resource_id text NN`, `details jsonb NN`, `occurred_at timestamptz NN default now()` |

**Critical:** `id` MUST be `text`, NOT `uuid`. `makeId()` output is not a
valid UUID; declaring the column as `uuid` triggers SQLSTATE `22P02`
(`invalid input syntax for type uuid`) on every insert. The comment in
schema.ts is explicit about this. **The migration must NOT declare
`DEFAULT gen_random_uuid()`** — the schema.ts change explicitly removed
that vestigial default because it silently produces UUIDs that fail the
`text`/`makeId(...)` contract.

## Companion migration file

Migration `packages/db/drizzle/0039_ue_cognition_text_id_promotion.sql`
(name subject to numbering-collision check at time of authoring) will:

1. `CREATE TABLE IF NOT EXISTS` for each of the six tables using the
   column definitions above.
2. Create indices on `(org_id, snapshot_at DESC)` / `(org_id, computed_at
   DESC)` / `(org_id, occurred_at DESC)` per table for the read patterns
   in `packages/ue-cognition/src/` cognition modules.
3. Add an outcome record to `drizzle.__phase0b_outcomes` with
   `outcome_class = 'applied'` when tables were created, or
   `'deferred-app-schema-absent'` when the schema was intentionally left
   file-backed (Phase-1 stance).
4. Not add FK from `org_id` to `orgs(id)` or `organizations(id)` until the
   architecture decision fixes which one is the platform-tenant column
   owner. The FK is deferred to a follow-up migration once
   `phase-0b-lineage-architecture-decision.md` is signed off.

## Idempotency validation plan

The migration must be tested against three DB states:

| State | Expected behaviour |
| --- | --- |
| Empty DB (never seen the migration) | All six tables created; outcome row `applied`. |
| Partial state (subset of the six tables already present) | Missing tables created; existing tables untouched (guarded by `IF NOT EXISTS`); outcome row `applied`. |
| Disposable DB with all six already present | No DDL executed; outcome row `applied` recorded once by the idempotent outcome upsert. |

Validation script: `scripts/audit/validate-phase0b-kpi-migration.ps1`
(to be authored). It provisions a disposable Postgres container, runs the
migration three times against each state, and asserts:

- `SELECT COUNT(*) FROM ue_kpi_snapshots` succeeds.
- `SELECT column_name, data_type FROM information_schema.columns WHERE
  table_name='ue_kpi_snapshots' AND column_name='id'` returns `text`.
- `INSERT INTO ue_kpi_snapshots (id, ...) VALUES ('kpi_lz3f2a_9b71c2ae4f10', ...)`
  succeeds (prefixed-text id round-trip).
- Same insert with a UUID literal in the `id` column still succeeds
  (both are valid `text`); this proves no reverse regression.

## Non-actions

- Phase 0B.1 does not execute this migration against any environment.
- Phase 0B.1 does not author the migration file itself. Authoring is a
  companion commit on the clean branch scheduled after the architecture
  decision.
- Phase 0B.1 does not delete or edit the schema.ts change from `896a18e0c`
  on the historical branch. The historical branch preserves that commit
  as recorded.
