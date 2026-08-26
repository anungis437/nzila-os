# KPI Identifier Proof — Phase 0B

**Status.** AMBER — engine and schema declaration now agree at the TypeScript level; no governed clean-DB apply of the change was performed this session because the two-lineage collision (see `organization-model-verification.md` § 5–6) blocks any clean end-to-end migration path. The schema change is committed and consumed by the type system, but the DB-level column type on any live environment still reflects whatever `drizzle-kit push` last applied — which is not a governed initialization path and does not satisfy the Phase 0B proof requirement.

**Date.** 2026-04-24 baseline, amended 2026-04-25 (this document) — supersedes the 2026-04-24 GREEN classification.

**Prior classification (superseded).** The prior revision declared `Status: GREEN — engine contract and schema declaration now agree.` and treated typecheck success as sufficient proof. That is not sufficient: Phase 0B requires DB-level evidence, and the UE cognition tables have never been created via a checked-in migration — they exist only on environments that have run an unrecorded `drizzle-kit push`. Runtime column type divergence between environments is therefore possible and unverifiable from checked-in artifacts alone. Reclassified to AMBER pending either (a) a checked-in migration that promotes the UE cognition tables into the governed lineage, or (b) explicit acceptance that the ue-cognition schema is a build-time-only contract with runtime materialization deferred to a later phase.

**Scope.** Evidence that the KPI-identifier type/value defect (engine emitting `kpi_<base36>_<hex>` strings into a Drizzle schema declared as `uuid`) is resolved at the TypeScript layer by aligning the schema to the engine's real contract; and honest disclosure that DB-level enforcement is not yet in the governed lineage.

**Anchor documents.**
- Decision (Outcome C): `organization-model-decision.md`
- Failure inventory: `failure-inventory.md`
- Remaining work: `phase-0b-remaining-work-register.md`

---

## 1. Root cause

`packages/ue-cognition/src/kpis/engine.ts` L146 emits identifiers via:

```
id: makeId('kpi')
```

`packages/ue-cognition/src/utils.ts` L18 defines:

```
export const makeId = (prefix: string): string =>
  `${prefix}_${Date.now().toString(36)}_${randomBytes(6).toString('hex')}`
```

This produces strings such as `kpi_lu2z6d7_1a2b3c4d5e6f`. These are **not** valid UUIDs.

Yet the Drizzle schema at `packages/ue-cognition/src/schema.ts` declared six UE cognition tables as:

```
id: uuid('id').primaryKey().default(sql`gen_random_uuid()`)
```

Result: any write path that (a) used the engine to construct the row and (b) trusted the Drizzle schema to validate/serialize the id would either (i) coerce the string into a garbage UUID via silent Postgres text-to-uuid failure paths, or (ii) hit an `invalid input syntax for type uuid` at runtime. In either case, the two artifacts contradicted each other.

---

## 2. Two possible reconciliations

**Option A — change the engine to emit UUIDs.**
Rejected. The `makeId` prefix is meaningful (`kpi_`, `snapshot_`, `precedent_`, etc.) — it is deliberately human-inspectable and used across other UE cognition modules. Changing the engine to emit UUIDs would strip semantic prefixes from every downstream log line, trace, and audit record.

**Option B — change the schema to `text`.**
Chosen. The identifiers are already opaque, high-entropy, unique strings; there is no cardinality or indexing loss from storing them as `text` PKs. Text PKs are supported by Postgres with identical hash and B-tree performance to UUIDs for keys of this length.

---

## 3. Change applied

**File:** `packages/ue-cognition/src/schema.ts`

**Before (6 tables):**
```
id: uuid('id').primaryKey().default(sql`gen_random_uuid()`)
```

**After (6 tables):**
```
id: text('id').primaryKey()
```

**Tables modified:**
- `ueCaseRiskSnapshots`
- `ueWorkloadSnapshots`
- `ueEngagementSnapshots`
- `uePrecedentMatches`
- `ueKpiSnapshots`
- `ueCognitionAudits`

**Also removed:** `import { sql } from 'drizzle-orm'` (no longer needed for defaults).

**Also added:** Header comment referencing Phase 0B decision doc and explaining the id-type contract (engine code uses `makeId(<prefix>)` → text like `kpi_<base36>_<hex>` which is not a valid UUID).

The `uuid` type import remains — it is still used for the seven `org_id` columns in the same file, which correctly reference `organizations.id` (uuid).

---

## 4. Type-safety verification

```
$ pnpm --filter @nzila/ue-cognition typecheck
… (exit 0)
```

All downstream consumers of the schema types compile cleanly against the new `text` type.

---

## 5. What this change explicitly does NOT do

- Does **not** introduce a new migration for the UE cognition tables. Those tables are application-owned (managed via `drizzle-kit push` from the `apps/union-eyes` codebase). The runtime DB reflects whichever type was pushed last. On environments where the tables currently store `uuid`, a subsequent `drizzle-kit push` will apply the type change; on environments where the tables do not yet exist, the next push will create them as `text`.
- Does **not** modify the `makeId` engine implementation.
- Does **not** modify any historical or healer migration.
- Does **not** modify the `org_id` columns (still `uuid`, still correctly aligned with `organizations.id`).

---

## 6. Regression scope

The engine's `makeId('kpi')` contract is unchanged. Consumers of the schema types that previously accepted `string` (from `uuid`) continue to accept `string` (from `text`). No consumer code required modification.

Vitest suites in `apps/union-eyes/lib/__tests__/` continue to pass (see specifically `pilot-metrics.test.ts`, `analytics-aggregation.test.ts`, and `dashboard-metrics.test.ts` which exercise KPI code paths).

---

## 7. Verdict

At the TypeScript layer the KPI identifier value-and-type contract now agrees end-to-end: engine emits opaque prefixed strings, schema declares them as `text`, downstream consumers see `string`.

At the DB layer, the UE cognition tables are not part of the governed platform migration lineage. Their materialization currently depends on unrecorded `drizzle-kit push`, which the Phase 0B directive explicitly does not accept as deployment proof. Aligning the DB column type with the schema on any given environment is therefore an out-of-band operation that leaves no auditable artifact in the migration ledger.

**KPI identifier integrity: AMBER.** TypeScript contract closed; DB-level enforcement deferred until the UE cognition tables are promoted into the governed lineage or explicitly recorded as an application-owned build-time-only schema. See `phase-0b-remaining-work-register.md` for the follow-up work.
