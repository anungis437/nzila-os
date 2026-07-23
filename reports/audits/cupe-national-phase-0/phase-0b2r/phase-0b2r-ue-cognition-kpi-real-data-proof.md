# Phase 0B.2R §9 — UE Cognition KPI DB migration proof (with real data)

> **Status:** COMPLETE (foundational KPI migration verified with data)
> **Governance track:** AMBER-remains-until-§15
> **Section owner:** ue-cognition
> **Commit:** _pending_

## 1. Purpose

Phase 0B.1 [`kpi-database-migration-proof.md`](../phase-0b1/kpi-database-migration-proof.md)
declared a **DATABASE GAP**: the six UE Cognition telemetry tables
(`ue_case_risk_snapshots`, `ue_workload_snapshots`,
`ue_engagement_snapshots`, `ue_precedent_matches`, `ue_kpi_snapshots`,
`ue_cognition_audits`) existed as Drizzle TypeScript definitions but had
no SQL migration.

Phase 0B.1 also flagged the KPI identifier defect (failure F-07 in
[failure-inventory.md](../failure-inventory.md#f-07)): the engine emits
`kpi_<base36>_<hex>` strings via `makeId('kpi')`, but the schema
declared `id uuid`, triggering SQLSTATE `22P02` on every insert.

Phase 0B.2 shipped migration
[`0039_ue_cognition_text_id_promotion.sql`](../../../../packages/db/drizzle/0039_ue_cognition_text_id_promotion.sql)
to (a) relocate the tables into the `union_eyes` schema per the
ownership manifest, (b) promote `id` from `uuid` to `text`, and (c)
verify the outcome. It was applied only against schema-shape checks —
never against a real INSERT round-trip.

Aubert's Phase 0B.2R mandate requires re-running §9 with **real data**,
not just schema-shape validation.

## 2. Verification method

**Live PostgreSQL instance:** native Windows PostgreSQL 17.8 on
`localhost:5433`, database `nzila_automation`, user `nzila`. Migration
0039 applied idempotently (all statements guarded with `IF NOT EXISTS`,
wrapped in `BEGIN`/`COMMIT`, and includes a `DO` block that verifies
each table lives in `union_eyes` with `id text`).

**Proof script:** [`phase-0b2r-section9-ue-cognition-real-data.sql`](./phase-0b2r-section9-ue-cognition-real-data.sql)
inserts one realistic row into each of the six tables (using
`ON CONFLICT (id) DO NOTHING` for idempotency), SELECTs each back, then
runs an aggregate count.

**Run log:** [`phase-0b2r-section9-run.log`](./phase-0b2r-section9-run.log)
captures full psql output.

## 3. Migration application transcript

```
$ psql -f packages/db/drizzle/0039_ue_cognition_text_id_promotion.sql
BEGIN
CREATE SCHEMA
DO           -- step 2: legacy relocation (no-op — nothing in public.ue_*)
CREATE TABLE  x6   -- step 3: create in union_eyes
DO           -- step 4: uuid→text id promotion (no-op — already text)
DO           -- step 5: verification (all 6 tables present with id text)
COMMIT
```

## 4. Schema verification

```
SELECT table_name,
       (SELECT data_type FROM information_schema.columns
         WHERE table_schema='union_eyes' AND table_name=t.table_name
           AND column_name='id')      AS id_type,
       (SELECT data_type FROM information_schema.columns
         WHERE table_schema='union_eyes' AND table_name=t.table_name
           AND column_name='org_id')  AS org_id_type
  FROM information_schema.tables t
 WHERE table_schema='union_eyes' AND table_name LIKE 'ue_%'
 ORDER BY table_name;

       table_name        | id_type | org_id_type
-------------------------+---------+-------------
 ue_case_risk_snapshots  | text    | uuid
 ue_cognition_audits     | text    | uuid
 ue_engagement_snapshots | text    | uuid
 ue_kpi_snapshots        | text    | uuid
 ue_precedent_matches    | text    | uuid
 ue_workload_snapshots   | text    | uuid
(6 rows)
```

Every table matches the contract:

* `id` is `text` — accepts `makeId('<prefix>')` output; no `22P02` risk.
* `org_id` is `uuid` — must be bound as UUID, not textual coercion.
* All tables live in `union_eyes` schema per ownership manifest
  (UNION_EYES_OWNED_EXCLUSIVE).

## 5. Real-data round-trip

Full transcript in [`phase-0b2r-section9-run.log`](./phase-0b2r-section9-run.log).
Excerpts of the six INSERT+SELECT pairs:

**5.1 `ue_case_risk_snapshots`**

```
INSERT 0 1
               id               |                org_id                | risk_tier |  model_version
--------------------------------+--------------------------------------+-----------+------------------
 crs_phase0b2r-9_deadbeef000001 | 00000007-0000-4007-8007-000000000007 | high      | phase0b2r-crs-v1
```

**5.2 `ue_workload_snapshots`**

```
INSERT 0 1
               id               |                org_id                |  steward_id   | utilization_ratio |   status
--------------------------------+--------------------------------------+---------------+-------------------+------------
 wls_phase0b2r-9_deadbeef000002 | 00000007-0000-4007-8007-000000000007 | steward_alpha |               0.9 | overloaded
```

**5.3 `ue_engagement_snapshots`**

```
INSERT 0 1
               id               |                org_id                |   member_id    |  tier
--------------------------------+--------------------------------------+----------------+---------
 mes_phase0b2r-9_deadbeef000003 | 00000007-0000-4007-8007-000000000007 | member_epsilon | at_risk
```

**5.4 `ue_precedent_matches`**

```
INSERT 0 1
               id               |                org_id                |    for_case_id     | success_rate
--------------------------------+--------------------------------------+--------------------+--------------
 pcm_phase0b2r-9_deadbeef000004 | 00000007-0000-4007-8007-000000000007 | case_phase0b2r_001 |         0.72
```

**5.5 `ue_kpi_snapshots`**

```
INSERT 0 1
               id               |                org_id                | window_days |  model_version   | total_grievances
--------------------------------+--------------------------------------+-------------+------------------+------------------
 kpi_phase0b2r-9_deadbeef000005 | 00000007-0000-4007-8007-000000000007 |          30 | phase0b2r-kpi-v1 | 47
```

`payload->>'total_grievances'` shows `jsonb` round-tripped correctly.

**5.6 `ue_cognition_audits`**

```
INSERT 0 1
               id               |                org_id                |    resource     | action  |          resource_id
--------------------------------+--------------------------------------+-----------------+---------+--------------------------------
 aud_phase0b2r-9_deadbeef000006 | 00000007-0000-4007-8007-000000000007 | ue_kpi_snapshot | compute | kpi_phase0b2r-9_deadbeef000005
```

`resource_id` correctly references the `ue_kpi_snapshots.id` text value,
proving cross-table text-id references also work.

**5.7 Aggregate — 6 tables, 6 rows, all bound to the same UUID org**

```
       table_name        | phase0b2r_rows
-------------------------+----------------
 ue_case_risk_snapshots  |              1
 ue_cognition_audits     |              1
 ue_engagement_snapshots |              1
 ue_kpi_snapshots        |              1
 ue_precedent_matches    |              1
 ue_workload_snapshots   |              1
(6 rows)
```

## 6. Mandate constraints verified

* ✅ `id` values are **text** in `makeId(<prefix>)_<base36>_<hex>`
  format — NOT UUIDs. Phase 0B.1 F-07 defect is resolved at the DB
  layer.
* ✅ `org_id` values are **UUID** (`00000007-0000-4007-8007-000000000007`)
  — bound as `::uuid`, no accidental prefixed-text coercion.
* ✅ All six tables live in `union_eyes` schema — matches ownership
  manifest UNION_EYES_OWNED_EXCLUSIVE (Phase 0B.2R §4R closure).
* ✅ `jsonb` payloads round-trip (`total_grievances` extracted from
  `payload->>` proves storage + retrieval works).
* ✅ Migration 0039 is idempotent — repeated invocation is a no-op
  (`CREATE TABLE IF NOT EXISTS` + `DO` blocks that check
  `information_schema` first).
* ✅ Insert script is idempotent — `ON CONFLICT (id) DO NOTHING`
  allows re-runs.

## 7. What §9 does NOT do

* Does not add FK from `org_id` → `orgs(id)` on the six UE Cognition
  tables. Per the migration comment and Phase 0B.1 architecture
  decision, the FK is deferred until the platform-tenant column owner
  is stable across environments; the resolver (§7) provides the
  application-level guarantee in the meantime.
* Does not backfill legacy `ops/ue-cognition/*.json` file-backed
  rows into the DB. Phase-1 store-adapter cutover is out of scope.
* Does not modify `packages/ue-cognition/src/schema.ts` — the schema
  file already declares `id text` (verified in Phase 0B.2R §8), so
  Drizzle types match the DB DDL.
* Does not exercise the engine (`packages/ue-cognition/src/kpis/engine.ts`
  etc.) against real DB. This is a table-level DDL + data proof; the
  engine currently writes to the JSON file store, and swapping to the
  DB adapter is a follow-up.

## 8. Files added in this section

| File | Change | LOC |
|---|---|---|
| `reports/audits/cupe-national-phase-0/phase-0b2r/phase-0b2r-section9-ue-cognition-real-data.sql` | **new** — proof script | +~155 |
| `reports/audits/cupe-national-phase-0/phase-0b2r/phase-0b2r-section9-run.log` | **new** — captured psql output | +~55 |
| `reports/audits/cupe-national-phase-0/phase-0b2r/phase-0b2r-ue-cognition-kpi-real-data-proof.md` | **new** — this report | +this file |

## 9. Cross-references

* Prior gap analysis: [`../phase-0b1/kpi-database-migration-proof.md`](../phase-0b1/kpi-database-migration-proof.md)
* Migration source: [`packages/db/drizzle/0039_ue_cognition_text_id_promotion.sql`](../../../../packages/db/drizzle/0039_ue_cognition_text_id_promotion.sql)
* Failure inventory F-07: [`../failure-inventory.md`](../failure-inventory.md#f-07)
* Ownership manifest: `packages/db/schema-ownership-manifest.json`
* UE Cognition schema: `packages/ue-cognition/src/schema.ts`
* Seed org origin (Phase 0B.2R §7): [`phase-0b2r-resolver-runtime-integration.md`](./phase-0b2r-resolver-runtime-integration.md)
* Next section: §10 (clean composition proof — 15 steps)

---

_This is a Phase 0B.2R foundational-blocker closure. The overall Phase
0B.2R status remains AMBER until §15 closure._
