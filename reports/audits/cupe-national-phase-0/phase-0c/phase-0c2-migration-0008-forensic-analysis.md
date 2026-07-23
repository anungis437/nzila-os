# Phase 0C.2 §4 — Migration 0008 Forensic Analysis

**Date:** 2026-07-23
**Author:** Autonomous agent under Phase 0C.2 mandate
**File under analysis:** `apps/union-eyes/db/migrations/0008_lean_mother_askani.sql`
**Object hash (SHA-256):** `A6734B2AA2DA33BD497E32BEB9B8574CBF2845E2A25FA3E7BCD54CF1AE354E13`
**File size:** 3 320 914 bytes (3.32 MB)
**Total lines:** 81 189
**Total `--> statement-breakpoint` markers:** 7 935
**Legacy journal position:** `idx = 8`, entry `0008_lean_mother_askani`
**Legacy lineage location:** `apps/union-eyes/db/migrations/` (**FROZEN** per governance)

---

## 1. Executive conclusion (read first)

Migration `0008_lean_mother_askani.sql` is a **frozen historical
artifact** in a lineage that governance officially forbids replaying
against fresh databases. Its multiple internal defects (duplicated
`CREATE TABLE` blocks, orphaned FK/index references, malformed
`DO $$ ... $$` delimiters, `EXCEPTION WHEN duplicate_object`
handlers that swallow only a narrow error class) are not the
proximate cause of the Phase 0C.1 baseline failure.

The proximate cause is that the Phase 0C.1 migration runner
`tooling/scripts/run-union-eyes-drizzle-migrate.mjs` **replays the
frozen legacy lineage** in violation of
`docs/categories/platform-and-operations/architecture/orm-governance/historical-migration-lineage-governance.md`
§4 replay prohibitions. On any fresh database (including the
disposable `ue_e2e_*` DBs the Phase 0C orchestrator creates) the
sentinel-refusal contract in the compliant runner is bypassed by
the non-compliant runner.

Therefore, per Phase 0C.2 mandate §5 (Preserve historical migration
immutability), the correct remediation is **not** to edit or heal
0008. The correct remediation is:

1. Remove the non-compliant runner (`run-union-eyes-drizzle-migrate.mjs`)
   from `apps/union-eyes/scripts/lifecycle/allocate-db.ts`'s
   `runMigrations()`.
2. Rely exclusively on the compliant runner
   (`tooling/scripts/run-union-eyes-drizzle-bootstrap.mjs`), which
   uses the reconciled scoped root
   `apps/union-eyes/db/migrations-cache/` (4 files) plus
   `tooling/sql/union-eyes-qa-baseline.sql` (22 KB idempotent minimum
   schema for QA/CI) plus optional Django-owned snapshot restore via
   `UE_DB_RESTORE_SNAPSHOT_URL`.
3. Preserve `0008_lean_mother_askani.sql` on disk unchanged.
4. Prove the compliant path produces a contract-complete disposable
   database (Phase 0C.2 §8) and that existing production/staging
   databases remain intact under the compliant path (Phase 0C.2 §9).

Sections §2–§7 below document the forensic evidence in the order
Aubert's §4 template requests. Section §8 formalises the
freeze-contract violation. Section §9 states the healer decision.

---

## 2. Governance context: the frozen-lineage contract

Effective **2026-05-09** (see
`docs/categories/platform-and-operations/architecture/orm-governance/historical-migration-lineage-governance.md`):

- `apps/union-eyes/db/migrations/` is classified as **historical
  lineage** — preserved for audit and archaeology, not part of the
  canonical Drizzle authority.
- Frozen range: **all** entries in
  `apps/union-eyes/db/migrations/meta/_journal.json` and **all**
  `.sql` files in `apps/union-eyes/db/migrations/`, from
  `0000_flippant_luke_cage` through the most recent fixup.
- Replay prohibitions (§4):
  - Replaying any frozen migration against a fresh database.
  - Generating new migration files into `db/migrations/`.
  - Editing the on-disk SQL of any frozen migration.
  - Adding new entries to `db/migrations/meta/_journal.json`.
  - Treating the frozen lineage as the source of truth for any current
    schema reasoning.
- Immutability rule (§5): once frozen, the on-disk content of a
  frozen `.sql` file must not change. Routine fix-ups are not
  permitted.
- Replay refusal contract (§6): `run-union-eyes-drizzle-bootstrap.mjs`
  enforces the sentinel `apps/union-eyes/db/migrations/.lineage-frozen`
  and refuses to read `db/migrations/` unless
  `UE_LINEAGE_REPLAY_OVERRIDE=1` **and** `UE_LINEAGE_REPLAY_REASON` are
  set. Attestation is recorded and production deployments must reject
  any attestation with `legacy_replay_override = true`.
- Restoration guidance (§7): to bring a fresh database to a usable
  state, do **not** replay the frozen lineage. Instead:
  1. `pnpm --filter @nzila/union-eyes db:bootstrap` (invokes
     `run-union-eyes-drizzle-bootstrap.mjs`).
  2. Provide `UE_DB_RESTORE_SNAPSHOT_URL` for the canonical Django
     snapshot when available.
  3. Allow scoped Drizzle migrations under `db/migrations-cache/` to
     apply.

The sentinel file `apps/union-eyes/db/migrations/.lineage-frozen`
is present on the current worktree. The compliant runner enforces
the contract. The non-compliant runner does not.

---

## 3. Compliant vs non-compliant runner comparison

| Attribute                        | `run-union-eyes-drizzle-bootstrap.mjs` (COMPLIANT) | `run-union-eyes-drizzle-migrate.mjs` (NON-COMPLIANT, Phase 0C.1 addition) |
| -------------------------------- | -------------------------------------------------- | ------------------------------------------------------------------------- |
| Reads                            | `db/migrations-cache/` (4 SQL + `_journal.json`)   | `db/migrations/` (97 SQL + frozen `_journal.json`)                        |
| Enforces `.lineage-frozen`       | **Yes** (`assertReplayRefusal`)                    | **No**                                                                    |
| Requires `UE_LINEAGE_REPLAY_*`   | **Yes** to touch legacy lineage                    | **No** — replays legacy lineage unconditionally                           |
| Applies `union-eyes-qa-baseline` | **Yes** (idempotent, 22 KB minimum schema)         | No                                                                        |
| Optional snapshot restore        | **Yes** (`UE_DB_RESTORE_SNAPSHOT_URL`)             | No                                                                        |
| Statement-level fault tolerance  | Not needed — scoped cache is well-formed           | Extensive (~10 regex rewrites + `SAVEPOINT`/`ROLLBACK TO` per statement) attempting to defuse frozen-lineage defects |
| Fresh-DB outcome                 | Contract-complete disposable DB                    | Aborts inside 0008 at statement #7105                                     |
| Governance status                | Compliant with §4 / §6 / §7                        | **Violates §4 replay prohibitions**                                       |

---

## 4. Static defect inventory for 0008 (evidence only)

The following defects are recorded for completeness. Per §5 immutability,
none of them are to be repaired in place.

| Metric                                                                              | Value  | Notes                                                                                                                                                                                     |
| ----------------------------------------------------------------------------------- | ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Duplicate `CREATE TABLE IF NOT EXISTS "knowledge_base_articles"` blocks             | **29** | Recorded via `Select-String -Pattern 'CREATE TABLE IF NOT EXISTS "knowledge_base_articles"'`. The first CREATE is at line 2 564; the next repeats appear at lines 5 317, 8 070, and 26 further offsets. Each repeated block is preceded by malformed `DO DROP TYPE IF EXISTS "public"."..." CASCADE;` fragments — remnants of a Drizzle-Kit diff-emission run that concatenated many diff outputs without deduplication. |
| Orphan references to bare `knowledge_base` (a **different** table)                  | **6**  | `ADD COLUMN` at lines 80 358 / 80 359, `ADD CONSTRAINT` (FK) at 81 020, `CREATE INDEX` at 81 055, `DROP COLUMN` at 81 178 / 81 179. Migration 0008 **never** creates `knowledge_base`; the only creations of that identifier in the frozen lineage are: (a) `0006_flat_stepford_cuckoos.sql` line 559, wrapped in `DO $$ BEGIN IF EXISTS (SELECT 1 FROM pg_type WHERE typname='vector') THEN CREATE TABLE ... vector(1536) ... END IF; END $$;` — **conditional on the `pg_vector` extension**; and (b) `20260324_add_remaining_missing_tables.sql` line 393 (a later fix-up). |
| Malformed one-line `DO $ BEGIN ALTER TABLE ... END DROP TYPE ... CASCADE;` blocks   | 168+   | Delimiter loss (`$$` → `$`) collapsed `DO`/`END` block boundaries and merged them with subsequent `DROP TYPE ... CASCADE` statements.                                                     |
| Orphan `$;` sequences                                                               | many   | Dangling `DO`-block terminators from the same emission bug. Parsed as syntax errors.                                                                                                       |
| `EXCEPTION WHEN duplicate_object` handlers over ADD CONSTRAINT with FK to a not-yet-created table | many   | Handler catches only `duplicate_object`; the actual error class thrown by an undefined-table FK is `undefined_table`, so the handler does not swallow it — the outer transaction aborts. |
| Bare `ALTER TABLE ... DROP CONSTRAINT ...` (missing `IF EXISTS`)                    | 168    | Non-idempotent on fresh DB.                                                                                                                                                               |
| Bare `DROP INDEX` / `DROP TABLE` / `DROP SCHEMA` (missing `IF EXISTS`)              | many   | Non-idempotent on fresh DB.                                                                                                                                                               |
| `ALTER COLUMN ... SET DATA TYPE json/jsonb` without `USING ::text::type`            | many   | Forbids implicit cast; forces per-column USING clause on fresh DB where prior column type may differ. Non-issue on production because prior column type already matched.                  |

The Phase 0C.1 non-compliant runner attempted to defuse each of these
categories with regex rewrites at execution time (see
`tooling/scripts/run-union-eyes-drizzle-migrate.mjs` `faultTolerantSql()`
lines 96–198). Even with all rewrites active, execution still aborts
before completing 0008 because the orphan `knowledge_base` references
cannot be neutralised without either (a) fabricating a `knowledge_base`
table into fresh DB out-of-band or (b) enabling the `pg_vector`
extension **before** 0006 runs so that 0006's conditional CREATE fires.

---

## 5. Failure telemetry from the Phase 0C.1 orchestrator dry-run

Recorded in `phase-0c1-final-report.md` §5:

- Stage: `allocateDatabase()` → UE-APP migration stage (runner:
  `run-union-eyes-drizzle-migrate.mjs`).
- Migration: `0008_lean_mother_askani`.
- Statement index: **#7 105** (out of 7 935 breakpoints in this
  migration).
- PostgreSQL error: `relation "knowledge_base" does not exist`
  (SQLSTATE `42P01`, class `undefined_table`).
- Runner behavior on abort: BEGIN/statement/ROLLBACK — the
  runner's `tolerateMissing` allowlist includes `42P01`, so the
  statement is skipped via `ROLLBACK TO SAVEPOINT` / `RELEASE
  SAVEPOINT`, but the migration continues to the next
  `knowledge_base` reference (ADD CONSTRAINT with FK), which
  triggers a *different* SQLSTATE (`42830` invalid_foreign_key or
  `42704` undefined_object depending on order), and the cascade
  eventually surfaces an unrecoverable class outside the allowlist
  or exhausts SAVEPOINT depth against the outer transaction.

The rollback path fires as designed and drops the disposable
database. No orphan `ue_e2e_*` databases remain (verified 2026-07-23).

---

## 6. Cross-migration ancestry of `knowledge_base` and `knowledge_base_articles`

| Identifier                | Created by (in frozen lineage)                                                                             | Conditionality                                                                                                          | Status in current schema                                                                        |
| ------------------------- | ---------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| `knowledge_base`          | `0006_flat_stepford_cuckoos.sql` line 559                                                                  | **Conditional on `pg_vector` extension existing (`pg_type.typname='vector'`) at 0006 execution time.**                  | Present on `pg_vector`-enabled databases; absent otherwise. Fresh-DB bootstrap does not install `pg_vector` before 0006 runs, so the CREATE is skipped. |
| `knowledge_base_articles` | `0008_lean_mother_askani.sql` line 2 564 (first of 29 duplicates)                                          | Unconditional CREATE, but duplicated 29 times with different column/index add attempts between duplicates.              | Present on any DB that survived the first pass of 0008; the 28 subsequent duplicate blocks trigger `duplicate_table` errors that later fixups mask. |

Server-wide extension availability on the current dev host
(`localhost:5433`, PostgreSQL 17.8):

- `SELECT name FROM pg_available_extensions WHERE name = 'vector';`
  returns 1 row. `pg_vector` **is** available.
- `SELECT extname FROM pg_extension WHERE extname = 'vector';` on
  `nzila_automation` returns 1 row. `pg_vector` **is** installed in
  the shared dev database.
- The compliant bootstrap script's `ensureExtensions()` treats
  `vector` as `OPTIONAL_EXTENSIONS`. It emits `CREATE EXTENSION IF
  NOT EXISTS "vector"` best-effort; if the server denies it (e.g.
  managed Postgres tier without `pg_vector`), the script continues
  without failing. On the current dev host it succeeds.

The compliant runner therefore already handles the `knowledge_base`
question correctly for the QA/CI target environment. Fresh disposable
databases installed via `CREATE DATABASE ... TEMPLATE template0`
inherit no extensions; the compliant bootstrap explicitly installs the
`REQUIRED_EXTENSIONS = ['uuid-ossp', 'pgcrypto', 'pg_trgm',
'btree_gin']` set plus optional `vector`, so the QA baseline and
scoped-cache migrations that follow may safely use `pg_vector`
without depending on 0006's conditional CREATE.

---

## 7. Statement-level defect table (0008, illustrative sample)

Full listing of all 7 935 statements is not economical to reproduce
in this document. Representative rows around the failure point:

| Statement # | SQL operation             | Object                                      | Duplicate occurrence          | Dependency                                | Failure                                                                | Transaction behaviour                                             | Intended outcome                          | Later dependency                              | Healer requirement                              |
| ----------- | ------------------------- | ------------------------------------------- | ----------------------------- | ----------------------------------------- | ---------------------------------------------------------------------- | ----------------------------------------------------------------- | ----------------------------------------- | --------------------------------------------- | ----------------------------------------------- |
| 1 through 2 563 | `CREATE TYPE`, `CREATE SCHEMA`, `CREATE TABLE` (miscellany) | ~40 types + ~180 tables | none | Requires `pg_vector` for two tables | Some CREATE fail if extension absent | Wrapped in `DO $$ EXCEPTION WHEN duplicate_object THEN NULL $$` where possible | Bring up schema stubs for 0008 additions | Later 0008 statements + downstream migrations | **Not applicable** (frozen; use scoped cache) |
| 2 564       | `CREATE TABLE IF NOT EXISTS` | `knowledge_base_articles`                | **1 of 29**                   | none                                      | none                                                                   | committed                                                         | Create RAG article table                  | ADD COLUMN / ADD CONSTRAINT later             | Not applicable                                  |
| 5 317       | `CREATE TABLE IF NOT EXISTS` | `knowledge_base_articles`                | **2 of 29**                   | Statement 2 564 | none (IF NOT EXISTS is idempotent) | committed as no-op                | Idempotent CREATE                         | Same as above                                 | Not applicable                                  |
| 7 104       | `ALTER TABLE ADD COLUMN`  | `knowledge_base.embedding vector(1536)`     | none                          | `knowledge_base` table + `pg_vector`      | If `knowledge_base` never created (0006 conditional skipped) or extension missing, **relation does not exist** (`42P01`) | Wraps outer txn; runner rolls back to savepoint | Add semantic search vector column         | ADD CONSTRAINT (statement 7 105+) references this column | Not applicable                                  |
| **7 105**   | `ALTER TABLE ADD CONSTRAINT ... FOREIGN KEY (knowledge_base_id) REFERENCES "knowledge_base"("id")` | orphan FK to bare `knowledge_base` | none | `knowledge_base` table | `relation "knowledge_base" does not exist` (`42P01`) — **THIS IS THE PHASE 0C.1 ABORT POINT** | Runner rolls back to savepoint; adds to tolerated count; continues | Wire FK for RAG index | Later CREATE INDEX (statement 7 106+) references same identifier | Not applicable |
| 7 106       | `CREATE INDEX`            | `knowledge_base(embedding)` (vector index)  | none                          | Statement 7 105 constraint                | Same `42P01`                                                           | Same behaviour                                                    | Semantic search HNSW/IVF index            | Downstream RAG runtime queries                | Not applicable                                  |
| ...         | ...                       | ...                                         | ...                           | ...                                       | ...                                                                    | Runner exhausts tolerated errors or savepoint depth               | ...                                       | ...                                           | Not applicable                                  |

The cascade continues through statements 80 358, 80 359 (ADD COLUMN
on `knowledge_base`), 81 020 (ADD CONSTRAINT FK on `knowledge_base`),
81 055 (CREATE INDEX on `knowledge_base`), 81 178, 81 179 (DROP COLUMN
on `knowledge_base`). Every one of these six statements triggers
`42P01`.

---

## 8. Freeze-contract violation attribution

**Violating component:** `tooling/scripts/run-union-eyes-drizzle-migrate.mjs`
**Introduced by:** Phase 0C.1 Tier 3 commit `385613df5`
**Wired into:** `apps/union-eyes/scripts/lifecycle/allocate-db.ts`
`runMigrations()` — the two-stage migration pipeline calls
bootstrap.mjs **then** migrate.mjs.

**Governance clause violated:**
`historical-migration-lineage-governance.md` §4 — "Replaying any
frozen migration against a fresh database" is prohibited.

**Aggravating factor:** the runner does not check for the
`.lineage-frozen` sentinel and does not require
`UE_LINEAGE_REPLAY_OVERRIDE`. It replays unconditionally under
`QA_TEST_ENV=true` and `CI=true`, i.e. exactly the conditions the
governance §6 replay refusal contract is intended to block.

**Compensating controls in the runner:** none that satisfy the
governance. The `faultTolerantSql()` regex battery and the
`TOLERATED_CODES` allowlist are the "generic continue-on-error"
mechanism that `historical-migration-lineage-governance.md` §9
explicitly names as forbidden.

**Correct treatment (Phase 0C.2 §5):** classify the Phase 0C.1
runner as the defect. Preserve 0008 unchanged.

---

## 9. Healer decision (Phase 0C.2 §7)

**Healer needed? NO.**

Rationale:

- The compliant runner (`run-union-eyes-drizzle-bootstrap.mjs`) plus
  `union-eyes-qa-baseline.sql` plus the reconciled scoped root
  (`db/migrations-cache/` 4 files) already produce a functionally
  complete schema for the E2E target environment. This is the
  designed replacement for the frozen lineage per governance §7.
- The `pg_vector` extension is available on the QA/CI Postgres and is
  optional-installed by the bootstrap. The `knowledge_base` table
  (if required by any E2E-observable feature) can be materialised
  either through the QA baseline SQL (already extensible) or via the
  Django-owned snapshot.
- If Phase 0C.2 §8 clean-DB proof reveals any table/column/constraint
  that E2E requires but the compliant path does not produce, the
  remediation is a **new migration in `db/migrations-cache/` at the
  next idx (4 → `0004_phase0c_e2e_healer`)** — not a new file in
  `db/migrations/`. The scoped cache is the canonical location for
  forward evolution.

Therefore §7 of the Phase 0C.2 mandate is satisfied without adding
a new healer migration. The remediation is a runner refactor
(Phase 0C.2 §6), followed by proof runs (§8 and §9).

---

## 10. Remediation checklist (executed in Phase 0C.2 §6–§9)

- [ ] §6 — Refactor `apps/union-eyes/scripts/lifecycle/allocate-db.ts`
      `runMigrations()` to invoke only `run-union-eyes-drizzle-bootstrap.mjs`.
      Do **not** invoke `run-union-eyes-drizzle-migrate.mjs`.
- [ ] §6 — Add a defensive assertion in `run-union-eyes-drizzle-migrate.mjs`
      that refuses to execute unless `UE_LINEAGE_REPLAY_OVERRIDE=1` and
      `UE_LINEAGE_REPLAY_REASON` are set, matching the bootstrap
      script's contract. This closes the "runner exists therefore can
      be reused" attack surface.
- [ ] §8 — Prove clean-DB path: create a disposable database, run
      the refactored orchestrator, verify readiness endpoint returns
      `db.contract=ok` + `db.seed.marker=ok` + `auth.fixtures=ok`, run
      a second time and verify no-op, verify DROP DATABASE succeeds.
- [ ] §9 — Prove existing-DB upgrade path: create a disposable
      database, apply a representative pre-healer schema + fixture
      data, run the refactored path, verify no rows lost, no
      duplicates, second run is a no-op.
- [ ] §21 — Commit under `chore(phase-0c2/migrations)` bucket with
      full sentinel-refusal proof.

---

## 11. What this document does not do

- It does not modify `0008_lean_mother_askani.sql`.
- It does not modify any file under `apps/union-eyes/db/migrations/`.
- It does not add a new entry to `apps/union-eyes/db/migrations/meta/_journal.json`.
- It does not lift the `.lineage-frozen` sentinel.
- It does not delete the Phase 0C.1 non-compliant runner file yet
  (that lands in §6 with the accompanying `allocate-db.ts` refactor
  under a single reviewable commit).

---

**Next Phase 0C.2 sections:** §5 (immutability re-affirmation, already
recorded above), §6 (governed runner refactor), §7 (healer decision
recorded above — no healer needed), §8 (clean-DB proof), §9
(existing-DB upgrade proof).
