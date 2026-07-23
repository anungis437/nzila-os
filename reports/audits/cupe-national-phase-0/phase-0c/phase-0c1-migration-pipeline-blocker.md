# Phase 0C.1 — Disposable-DB Migration Pipeline Blocker

**Status:** AMBER-INFRA-INCOMPLETE (blocking evidence for §14 authoritative baseline)
**Date recorded:** 2026-07-23
**Recorded by:** governed E2E orchestrator (`apps/union-eyes/scripts/lifecycle/run.ts`)
**Related design doc:** `phase-0c-lifecycle-design.md` §7

## Summary

The Phase 0C.1 governed E2E lifecycle now builds a disposable PostgreSQL
database per run (see `phase-0c-database-fixture-proof.md`), but the
subsequent migration pipeline cannot produce a Phase 0B-contract-complete
schema. As a result, `/api/health/readiness` `db.contract` and
`db.seed.marker` checks will not go green, and no Playwright baseline can be
executed against an isolated database.

This is the AMBER outcome the design spec anticipated:
> *"Under this constrained window, honest closure is likely AMBER — E2E
> INFRASTRUCTURE INCOMPLETE."*

## Reproduction

```powershell
cd apps/union-eyes
pnpm exec tsx -e "import('./scripts/lifecycle/run.ts')"
```

Observed sequence:

1. `env` → OK
2. `preflight` → OK (node 24.13.1, port 3002 free)
3. `allocate-db` step 1 (platform bootstrap via
   `tooling/scripts/run-union-eyes-drizzle-bootstrap.mjs`) → OK
   - Applies scoped platform migrations `db/migrations-cache/0000..0003`.
   - Skips legacy lineage `db/migrations/*` by design (freeze respected).
   - Skips canonical snapshot restore (`UE_DB_RESTORE_SNAPSHOT_URL` unset).
4. `allocate-db` step 2 (Union Eyes app migrations via
   `tooling/scripts/run-union-eyes-drizzle-migrate.mjs`) → **FAIL**
   ```
   Migration failed: 0008_lean_mother_askani (statement #7105)
   relation "knowledge_base" does not exist
   ```
5. `allocateDatabase` now rolls back the just-created DB
   (`event=migration-failed-rollback` → `event=rollback-dropped` in
   `.e2e-lifecycle/history.jsonl`), and the orchestrator finishes cleanup.
6. `/api/health/readiness` never gets a chance to run against a valid DB.

## Root causes (two, layered)

1. **No Phase 0B contract in scoped platform migrations.**
   `db/migrations-cache/{0000..0003}` establishes extensions and platform
   scaffolding but does not include `organization_members`, the anchor of
   the Phase 0B contract. Production/demo obtain this table via a snapshot
   restore (`UE_DB_RESTORE_SNAPSHOT_URL` per
   `docs/architecture/orm-governance/environment-bootstrap-strategy.md`).
   The disposable-DB lifecycle has no such snapshot, so it must apply the
   legacy migrator to obtain the contract.

2. **Legacy migrator aborts at `0008_lean_mother_askani.sql`.**
   Statement #7105 references a `knowledge_base` relation before it exists.
   File-level inspection shows the migration contains ≥10 duplicated
   `CREATE TABLE IF NOT EXISTS "knowledge_base_articles"` blocks and other
   evidence of a corrupt/replayed generation, consistent with the
   fault-tolerance patches already resident in the migrator itself. The
   underlying defect is beyond the scope of Phase 0C.1 (which is a
   lifecycle-plumbing pass, not a schema-repair pass).

## Impact on Phase 0C.1 close-out

- **§14 authoritative baseline** — CANNOT be produced. Playwright execution
  requires a UE-contract-complete DB.
- **§15–§19** (bilingual, a11y, cross-org security, 3-run flake) —
  transitively BLOCKED for the same reason.
- **§20 non-E2E validation battery** — remains executable (typecheck, lint,
  docs, governance, unit tests).
- **§9 auth-state generator, §10 Playwright projects restructure,
  §12 duplicate spec deletion** — safely landable; the orchestrator itself
  is functional up to and including the migration boundary.

## Classification

**AMBER — E2E INFRASTRUCTURE INCOMPLETE** per design spec §23:
- Disposable-DB allocation itself is verified green
  (`phase-0c-database-fixture-proof.md`, 7-step live PG proof).
- Governed process/port/PID discipline is verified green
  (`apps/union-eyes/scripts/lifecycle/process.test.ts`, 12 tests).
- Governed env module is verified green (13 tests).
- Readiness endpoint is verified green (5 tests) but its `db.contract` and
  `db.seed.marker` checks depend on the migration pipeline that cannot
  currently complete.

## Recommended follow-up (outside Phase 0C.1 scope)

Any ONE of the following unblocks §14:

1. **Publish a canonical UE snapshot** and expose it via
   `UE_DB_RESTORE_SNAPSHOT_URL` in E2E env. The scoped bootstrap +
   snapshot restore is the architected path per environment-bootstrap-
   strategy.md.
2. **Repair `0008_lean_mother_askani.sql`** so it applies cleanly against
   a fresh DB. Requires investigating the `knowledge_base` FK dependency
   and de-duplicating the ≥10 replayed table-creation blocks.
3. **Compact the UE app lineage into `db/migrations-cache/`** as a
   second-stage scoped migration set that the platform bootstrap already
   applies. Highest-effort but eliminates the legacy migrator entirely.

## Artefact index

- Orchestrator: `apps/union-eyes/scripts/lifecycle/run.ts`
- Allocator with rollback: `apps/union-eyes/scripts/lifecycle/allocate-db.ts`
- Latest failed run log:
  `apps/union-eyes/.e2e-lifecycle/runs/{runId}/migrations.log`
- Lifecycle history:
  `apps/union-eyes/.e2e-lifecycle/history.jsonl`
- Migration file (defective):
  `apps/union-eyes/db/migrations/0008_lean_mother_askani.sql`
