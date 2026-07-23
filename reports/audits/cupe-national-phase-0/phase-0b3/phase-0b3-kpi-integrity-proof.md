# Phase 0B.3 — KPI Identifier Integrity Proof

**Section:** 9
**Date:** 2026-07-23 (America/New_York)
**Migration:** `packages/db/drizzle/0039_ue_cognition_text_id_promotion.sql`

---

## 1. Phase 0B pillar

Pillar 2 (Identifier value/type contract): UE Cognition KPI tables
must physically store `org_id` as `uuid` at the DB, aligned with the
platform `orgs.id` UUID contract.

## 2. Physical DB verification (from Phase 0B.2R §9)

Migration `0039` idempotently:

- Alters `org_id` from `text` to `uuid` (with backfill via
  `::uuid` cast where existing rows are UUID-shaped strings) on 6 UE
  Cognition tables.
- Round-tripped against real data in `nzila_automation` (6/6 rows,
  all `org_id` values physically UUID after migration).
- Idempotent — re-running the migration is a no-op.

Real-data proof: `phase-0b2r-ue-cognition-kpi-real-data-proof.md`
(clean composition + upgrade proofs also validated this).

## 3. TS surface — deliberate `text` at the language layer

In `packages/ue-cognition/src/schema.ts` lines 35–112, six tables
declare:

```ts
orgId: text('org_id').notNull(),
// uuid at DB level; string in TS to match Option D tenant contract
```

### 3.1 Why `text` and not `uuid()` in TS

The Option D tenant contract exposes tenant identifiers as branded
`string` at the TS surface (`PlatformTenantId = string & { __brand }`).
Because the resolver returns `Promise<string>`, and the DB physically
stores UUID, using `text('org_id')` in Drizzle TS keeps the language
type aligned with what application code holds. Drizzle's `uuid()` type
would force `crypto.randomUUID()`-typed values through the schema layer,
which is not what the resolver returns.

### 3.2 Why this is safe

- Physical storage is UUID — enforced by the migration.
- The Drizzle `text` column is compatible with a physical `uuid` column
  at the postgres.js layer because parameter binding will present the
  string to PG, and PG will coerce a well-formed UUID string to `uuid`
  at insert time.
- We do **not** run `drizzle-kit push` against these tables — SQL
  migrations are hand-authored and version-controlled under
  `packages/db/drizzle/`. Drizzle-kit-driven DDL regeneration is
  explicitly out of the loop.
- The gap is documented inline in the schema file and cross-referenced
  from `phase-0b2r-org-id-type-reconciliation.md`.

### 3.3 Wave 1 normalization plan (not Phase 0B scope)

Deferred Wave 1 task: introduce a Drizzle custom type
`platformTenantId` that maps to `uuid` at DB level but presents as
branded `string` at the TS level; migrate the 6 UE Cognition tables to
use it. This is a language-ergonomics improvement, not an integrity
gate.

## 4. Phase 0B impact assessment

| Pillar | Affected? |
| ------ | --------- |
| 1 — two-lineage organization model | NO |
| 2 — KPI identifier value/type contract (physical UUID at DB) | ✅ Landed by migration 0039 |
| 3 — sanctioned cross-lineage provisioning entry point | NO |
| 4 — at least one runtime proof | NO (KPI ingest resolver-wire is Phase 0C) |

## 5. Blockers

**Phase 0B blockers introduced by TS-surface `text` typing: 0.**

## 6. Cross-references

- Migration: [`packages/db/drizzle/0039_ue_cognition_text_id_promotion.sql`](../../../../packages/db/drizzle/0039_ue_cognition_text_id_promotion.sql)
- Drizzle schema: [`packages/ue-cognition/src/schema.ts`](../../../../packages/ue-cognition/src/schema.ts)
- Real-data proof: [../phase-0b2r/phase-0b2r-ue-cognition-kpi-real-data-proof.md](../phase-0b2r/phase-0b2r-ue-cognition-kpi-real-data-proof.md)
- Type reconciliation note: [../phase-0b2r/phase-0b2r-org-id-type-reconciliation.md](../phase-0b2r/phase-0b2r-org-id-type-reconciliation.md)
- Open items register (OPEN-07): [phase-0b3-open-items-register.md](phase-0b3-open-items-register.md)
