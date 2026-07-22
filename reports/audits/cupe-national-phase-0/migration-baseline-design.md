# Phase 0A · Migration baseline design (Option A)

**Decision date:** 2026-07-23
**Decided by:** Aubert (choice: Option A, executed as a separate Phase 0A)
**Executed by:** Phase 0A migration-lineage-closure agent
**Branch:** `fix/union-eyes-reality-remediation`

---

## 1. Decision

Aubert selected **Option A** from
[migration-lineage-gap.md](migration-lineage-gap.md#3-what-remains-and-cannot-be-done-without-a-decision):
author a checked-in prerequisite baseline that materializes every schema-only
table currently missing from the incremental `packages/db/drizzle/*.sql`
chain, and upgrade the platform migration runner to a two-phase lifecycle
(bootstrap → incrementals). The alternative options (B: formalize
`drizzle-kit push`; C: extract per-schema materialize) were explicitly rejected
in the directive:

> No `drizzle-kit push` as authoritative. No renumbering / rewriting of
> historical migrations 0000–0033. No Option C.

## 2. What was authored

### 2.1 Baseline SQL

**File:** [packages/db/bootstrap/0000_platform_schema_prerequisites.sql](../../../packages/db/bootstrap/0000_platform_schema_prerequisites.sql)

Ownership: **checked-in prerequisite**, runs BEFORE any file in
`packages/db/drizzle/*.sql`. Idempotent (`CREATE EXTENSION IF NOT EXISTS`,
`CREATE TYPE … EXCEPTION WHEN duplicate_object`, `CREATE TABLE IF NOT EXISTS`).

Scope (11 objects total):

| Kind | Names |
|------|-------|
| Extensions | `uuid-ossp`, `pgcrypto`, `pg_trgm`, `btree_gin` |
| Enums (5) | `commerce_supplier_status`, `commerce_product_status`, `commerce_purchase_order_status`, `commerce_order_status`, `commerce_quote_status` |
| Tables (6) | `orgs`, `commerce_suppliers`, `commerce_products`, `commerce_quotes`, `commerce_orders`, `commerce_purchase_orders` |

Reverse-engineered from the schema modules
[packages/db/schema/orgs.ts](../../../packages/db/schema/orgs.ts) and
[packages/db/schema/commerce.ts](../../../packages/db/schema/commerce.ts).

### 2.2 Reconciliation manifest

**File:** [packages/db/bootstrap/platform_schema_prerequisites.json](../../../packages/db/bootstrap/platform_schema_prerequisites.json)

Declares the contract (columns, types, nullability, primary keys, enum values)
that the runner uses to decide whether an existing target database is
compatible with the baseline. The manifest is the source of truth for
reconciliation; the SQL file is the source of truth for creation.

Reconciliation policy (from the manifest):

**Required checks (drift → refuse):**
1. Table / enum exists.
2. Every documented column exists with declared `data_type`.
3. Nullability matches when `notNull: true` is declared.
4. Primary-key columns match by position.

**Tolerated differences (no action):**
1. Extra columns not listed in the manifest.
2. Extra foreign keys.
3. Extra indexes.
4. Extra unique constraints.
5. Extra enum values (logged as additive).

## 3. Two-phase runner lifecycle

Runner: [tooling/scripts/apply-platform-migrations.mjs](../../../tooling/scripts/apply-platform-migrations.mjs)

Six mutually-exclusive modes:

| Mode | Purpose |
|------|---------|
| _(default)_ | Assert bootstrap satisfied, then apply pending incrementals from `packages/db/drizzle/`. |
| `--check` | Report pending incrementals; do not modify DB. |
| `--verify` | Exit code 2 if any bootstrap artifact or incremental is pending. CI gate. |
| `--baseline` | Record all incremental hashes without executing SQL. Legacy onboarding for pre-Phase-0A dev DBs. |
| `--bootstrap-check` | Report each bootstrap artifact as `RECORDED`, `APPLY-safe`, `RECONCILE-safe`, or `DRIFT`. |
| `--bootstrap-apply` | Execute the baseline SQL against an empty (or partially populated but drift-free) target, then record `mode='apply'` in `drizzle.__platform_bootstrap`. |
| `--bootstrap-reconcile` | Record `mode='reconcile'` in `drizzle.__platform_bootstrap` without executing SQL, iff all manifest objects are present and contract-compatible. |

**Tracking tables (both under `drizzle` schema, deliberately separate from
`drizzle.__drizzle_migrations` which drizzle-kit owns):**

```sql
CREATE TABLE drizzle.__platform_bootstrap (
  id           SERIAL PRIMARY KEY,
  filename     TEXT NOT NULL,
  hash         TEXT NOT NULL UNIQUE,
  mode         TEXT NOT NULL,       -- 'apply' | 'reconcile'
  recorded_at  BIGINT NOT NULL
);

CREATE TABLE drizzle.__platform_migrations (
  id          SERIAL PRIMARY KEY,
  filename    TEXT NOT NULL,
  hash        TEXT NOT NULL UNIQUE,
  created_at  BIGINT NOT NULL
);
```

**Non-goals (from the runner header docblock):**

- Never modifies historical incremental files (0000–0033 immutable).
- Never touches `drizzle.__drizzle_migrations`.
- Never uses `drizzle-kit push` as an authoritative source.

## 4. Incremental execution semantics — `psql -f` autocommit

**Change from prior runner:** the per-file `BEGIN … COMMIT` transaction wrapper
was removed. Each incremental file is now executed as a single
`client.query(fileContents)` call. PostgreSQL's simple-query protocol
autocommits each statement independently — matching `psql -f` semantics.

Rationale: several historical migrations
(e.g. [`0033_fix_pilot_alerts_rule_fk.sql`](../../../packages/db/drizzle/0033_fix_pilot_alerts_rule_fk.sql))
are **healer migrations** whose contract with a prior file assumes that the
prior file's earlier statements are still committed after its final statement
errored. Wrapping the file in a transaction rolls back those earlier
statements and breaks the heal contract.

## 5. Known-partial-failure allowlist

**File:** [packages/db/drizzle/.known-partial-failures.json](../../../packages/db/drizzle/.known-partial-failures.json)

Declares the (small, auditable) set of incremental migrations that are
historically known to abort partway through and whose partial-apply behavior
is intentionally relied on by a later catch-up (healer) migration. The runner:

1. Loads the allowlist at startup.
2. On error during incremental apply, checks whether the failing file is
   listed.
3. If **listed AND** the healer migration named in the entry is also present
   in `packages/db/drizzle/`, records the file as applied and continues,
   emitting a `[migrate:warn] partial-apply tolerated…` log line.
4. If **not listed**, hard-fails with a message directing the operator to
   patch the DB, add a healer migration, or add an allowlist entry.
5. If **listed but healer missing**, hard-fails.

The allowlist is the **only** sanctioned mechanism for tolerating a mid-file
failure. Widening it requires a linked ledger entry and a matching healer
migration.

**Current allowlist (1 entry):**

| Filename | Healer | Reason |
|----------|--------|--------|
| `0010_pilot_alerting_hardening.sql` | `0033_fix_pilot_alerts_rule_fk.sql` | PostgreSQL does not support `ADD CONSTRAINT IF NOT EXISTS`. |

## 6. Proofs executed this session

| Proof | Target | Result | Evidence |
|-------|--------|--------|----------|
| Empty-DB · bootstrap-apply | `nzila_migration_probe` | GREEN — 1 artifact applied | [migration-clean-run.log](migration-clean-run.log) |
| Empty-DB · incrementals 0000–0009 | same | GREEN — 10 applied | same |
| Empty-DB · incremental 0010 | same | GREEN — partial-apply tolerated per allowlist | same |
| Empty-DB · incrementals 0011–0012 | same | GREEN — 2 applied | same |
| Empty-DB · incremental 0013 | same | **RED — pre-existing defect** (`DROP INDEX IF EXISTS` on a UNIQUE constraint, not an index) | [migration-clean-run.log](migration-clean-run.log) |
| Empty-DB · incrementals 0014–0016 (post manual patch) | same | GREEN — 4 applied | [migration-survey.log](migration-survey.log) |
| Empty-DB · incremental 0017 | same | **RED — pre-existing defect** (`CREATE TYPE IF NOT EXISTS` unsupported syntax) | same |
| Empty-DB · incrementals 0018–0032 (post workaround) | same | Mixed — 0032 hits **RED — pre-existing defect** (`column "org_id" does not exist`) | same |
| Existing-DB · bootstrap-check on dev | `nzila_automation` | GREEN — correctly reported APPLY-safe (5 present + 6 missing, no drift on present) | [migration-existing-db-reconciliation.log](migration-existing-db-reconciliation.log) |
| Existing-DB · bootstrap-reconcile on dev | same | GREEN (correctly refused — 6 objects missing) | same |
| Existing-DB · bootstrap-apply on dev | same | GREEN — 1 artifact applied, gaps filled | same |
| Existing-DB · bootstrap-apply repeat | same | GREEN — no-op (RECORDED) | same |
| Reconcile-safe · bootstrap-reconcile on fully-materialized DB | `nzila_reconcile_probe` | GREEN — recorded `mode='reconcile'` without executing SQL | [migration-reconcile-safe.log](migration-reconcile-safe.log) |

## 7. Additional pre-existing defects surfaced (out of Phase 0A scope)

Phase 0A closed the LINEAGE gap (missing baseline). Executing the full chain
end-to-end on an empty DB additionally surfaced three previously-undocumented
migration defects. These are logged as new open items on the phase ledger
and require dedicated healer migrations in a follow-up phase. They are
**not** modifications to files 0000–0033.

See [migration-lineage-gap.md](migration-lineage-gap.md#4-additional-defects-surfaced-by-phase-0a-empty-db-proof).

## 8. Non-changes preserved

- Migrations `0000_initial.sql` – `0033_fix_pilot_alerts_rule_fk.sql` are byte-identical to the pre-session state.
- `drizzle.__drizzle_migrations` untouched.
- No `drizzle-kit push` executed in any proof.
- The seven CUPE audit registers under `reports/audits/` untouched.
- 31 unrelated dirty lines in the working tree remain unstaged and out of Phase 0A commits.
