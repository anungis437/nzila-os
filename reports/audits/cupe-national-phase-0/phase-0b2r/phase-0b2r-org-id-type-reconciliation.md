# Phase 0B.2R §8 — Reconcile Org ID Types (UE Cognition)

**Status:** VERIFIED — no accidental prefixed text ID leakage into UE Cognition
**Verified by:** Aubert Nungisa
**Verified at:** 2026-07-23
**Live database:** `phase0b2_compose_20260723094502` (PostgreSQL 17.8, port 5433)

---

## 1. Purpose

Phase 0B.2R §8 verifies the mandate constraint:

> *"Do not accidentally convert organization identifiers to prefixed text IDs."*

against the six UE Cognition telemetry tables introduced in Phase 0B.2 §12
(migration `packages/db/drizzle/0039_ue_cognition_text_id_promotion.sql`).

The Phase 0B.2 §12 migration promotes the **primary-key** `id` column from
`uuid` to `text` because the runtime writes prefixed identifiers (`crs_*`,
`wls_*`, `mes_*`, `pcm_*`, `kpi_*`, `aud_*`). §8 confirms this promotion
was scoped to the row-level `id` column only, and did **not** accidentally
leak into the organization identifier column (`org_id`).

## 2. Verification method

Live SQL introspection of `information_schema.columns` against the disposable
Phase 0B.2R compose database. Cross-checked against the Drizzle declaration
in `packages/ue-cognition/src/schema.ts`.

## 3. DB storage verification

Query:

```sql
SELECT table_schema, table_name, column_name, data_type, udt_name, is_nullable
FROM information_schema.columns
WHERE table_schema='union_eyes'
  AND table_name LIKE 'ue_%'
  AND (column_name LIKE '%org%' OR column_name LIKE '%tenant%')
ORDER BY table_name, column_name;
```

Result — 12 rows across 6 UE Cognition tables:

| table_name                | column_name  | data_type | udt_name | is_nullable |
|---------------------------|--------------|-----------|----------|-------------|
| ue_case_risk_snapshots    | org_id       | **uuid**  | uuid     | NO          |
| ue_case_risk_snapshots    | tenant_id    | text      | text     | NO          |
| ue_cognition_audits       | org_id       | **uuid**  | uuid     | NO          |
| ue_cognition_audits       | tenant_id    | text      | text     | NO          |
| ue_engagement_snapshots   | org_id       | **uuid**  | uuid     | NO          |
| ue_engagement_snapshots   | tenant_id    | text      | text     | NO          |
| ue_kpi_snapshots          | org_id       | **uuid**  | uuid     | NO          |
| ue_kpi_snapshots          | tenant_id    | text      | text     | NO          |
| ue_precedent_matches      | org_id       | **uuid**  | uuid     | NO          |
| ue_precedent_matches      | tenant_id    | text      | text     | NO          |
| ue_workload_snapshots     | org_id       | **uuid**  | uuid     | NO          |
| ue_workload_snapshots     | tenant_id    | text      | text     | NO          |

**Finding: PASS.** All six UE Cognition `org_id` columns are stored as
`uuid NOT NULL` at the physical DB layer. The prefixed text-ID promotion
introduced in Phase 0B.2 §12 was correctly scoped to the primary-key `id`
column and did not leak into the organization identifier surface.

## 4. `tenant_id text` disambiguation

Each UE Cognition table also has a `tenant_id text NOT NULL` column. This is
**not** an organization identifier — it is the multi-tenant partition key used
by the UE cognition write path for cache/query scoping. It is distinct from
`org_id` (the Option D organization identity) both semantically and in the
runtime code:

- `org_id` (UUID) — matches the Option D contract; joins to
  `public.orgs.id` and `union_eyes.organizations.id` (both UUID).
- `tenant_id` (text) — internal cognition-write scope key, populated by
  `packages/ue-cognition/src/utils.ts` from the caller's tenant context.

The mandate constraint applies to `org_id`. The `tenant_id text` column is
correctly typed for its purpose.

## 5. Drizzle declaration verification

File: `packages/ue-cognition/src/schema.ts` (lines 35–112).

All six tables declare:

```ts
tenantId: text('tenant_id').notNull(),
orgId: text('org_id').notNull(), // uuid at DB level; string in TS to match Option D tenant contract
```

**Assessment:** The `text()` helper is used as a TS-surface convenience —
Drizzle + postgres.js coerce values in both directions:

- **Write path:** JS `string` → PG `uuid` via implicit cast (PG accepts any
  string that parses as a UUID).
- **Read path:** PG `uuid` → JS `string` (postgres.js returns UUIDs as
  strings by default).

This does **not** violate the mandate because:
1. The physical storage is UUID (verified in §3 above).
2. All comparison and join semantics execute at the DB layer against the
   UUID column, not against the TS type declaration.
3. Attempting to write a non-UUID string (e.g., `"crs_abc123"`) would
   fail with a PG `invalid input syntax for type uuid` error at the driver.

The comment on line 36 of `schema.ts` documents this design decision as
intentional ("uuid at DB level; string in TS to match Option D tenant
contract"). No code change is required for §8.

**Note (defer to Wave 1):** For long-term type-safety and IDE support,
these declarations could be normalized to `uuid('org_id')`. This would
narrow the TS surface and let `drizzle-kit` catch mismatches at generate
time. Because it is a non-runtime, purely-ergonomic change and would touch
the six declarations plus any downstream consumers, it is deferred out of
Phase 0B.2R to avoid rework risk during the corrective phase.

## 6. Runtime write-path verification

File: `packages/ue-cognition/src/utils.ts` — the `makeId(prefix)` helper is
used ONLY for the row-level primary key (`id`) and is NEVER called to
produce an organization identifier. Cognition writes receive `orgId` from
the caller's authenticated context (resolved via the runtime resolver, §7
scope), and pass it through unchanged.

Grep confirms:

- `makeId(` callsites are limited to `id` field initialization in cognition
  write operations.
- No `makeId('org' | 'ue-org' | 'organization')` prefix exists.
- `orgId` values in cognition writes originate from `session.orgId` /
  `resolver.getPlatformTenantId()` outputs, both of which return UUID
  strings sourced from `public.orgs.id`.

## 7. Cross-table integrity spot check

Query:

```sql
SELECT COUNT(*) AS ue_cognition_rows_with_bad_orgid FROM (
  SELECT org_id FROM union_eyes.ue_case_risk_snapshots
  UNION ALL SELECT org_id FROM union_eyes.ue_workload_snapshots
  UNION ALL SELECT org_id FROM union_eyes.ue_engagement_snapshots
  UNION ALL SELECT org_id FROM union_eyes.ue_precedent_matches
  UNION ALL SELECT org_id FROM union_eyes.ue_kpi_snapshots
  UNION ALL SELECT org_id FROM union_eyes.ue_cognition_audits
) AS all_org_ids
WHERE NOT EXISTS (SELECT 1 FROM public.orgs o WHERE o.id = all_org_ids.org_id);
```

Deferred to §10 (clean composition proof), which materializes all six
cognition tables with seed data. In the current compose DB the cognition
tables are empty (no snapshots yet emitted). The **schema-level** guarantee
is what §8 verifies; the **data-level** guarantee is deferred to §9 (KPI
proof) and §10 (clean composition proof) which write real cognition rows.

## 8. What §8 does NOT do

- ✗ Does not modify the Drizzle declarations (documented as intentional).
- ✗ Does not add FK constraints from cognition `org_id` → `public.orgs.id`
  (this was intentionally deferred to Wave 1 in Phase 0B.2 §12 to avoid
  cross-schema circular-dependency issues during migration ordering).
- ✗ Does not verify the runtime resolver behaviour (that is §7).
- ✗ Does not verify KPI snapshot correctness (that is §9).

## 9. Next section

§7 — Runtime resolver integration test (API/server action → resolver →
PostgreSQL). This is the largest-scope §, requiring a real integration
test that boots at least one of the five documented integration paths
against a live disposable DB.
