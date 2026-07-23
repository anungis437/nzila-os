# Phase 0C.1 §7 — Disposable Database Fixture Proof

**Status:** PASS
**Generated:** 2026-07-23T19:58:01.678Z → 2026-07-23T19:58:05.286Z
**Host:** localhost:5433 (native PG, role `nzila`)
**Prover:** `apps/union-eyes/scripts/lifecycle/prove-db-allocator.ts`

## What was proven

1. `allocateDatabase()` creates a uniquely-named disposable database.
2. The new DB is reachable and accepts `SELECT 1`.
3. `dropDatabase()` removes the database by default.
4. `E2E_PRESERVE_DB=true` prevents drop; forced cleanup still works.
5. `nzila_automation` (developer DB) name-collision guard holds.

## Live log

```
[2026-07-23T19:58:01.679Z] Step 1 — allocateDatabase(skipMigrations=true) proves DB creation independent of migration wiring
[2026-07-23T19:58:04.231Z]   → runId=20260723195801_863340 db=ue_e2e_20260723195801_863340 url=postgresql://<user>:<pw>@localhost:5433/ue_e2e_20260723195801_863340 runDir=C:\APPS\nzila-automation-phase0c\apps\union-eyes\.e2e-lifecycle\runs\20260723195801_863340 preserved=false
[2026-07-23T19:58:04.231Z] Step 2 — verify DB exists via admin query
[2026-07-23T19:58:04.295Z]   → confirmed DB 'ue_e2e_20260723195801_863340' exists
[2026-07-23T19:58:04.295Z] Step 3 — connect to the disposable DB and run SELECT 1
[2026-07-23T19:58:04.358Z]   → SELECT 1 succeeded
[2026-07-23T19:58:04.358Z] Step 4 — dropDatabase — expected to drop
[2026-07-23T19:58:04.574Z]   → drop result: {"dropped":true}
[2026-07-23T19:58:04.574Z] Step 5 — verify DB no longer exists
[2026-07-23T19:58:04.653Z]   → confirmed DB 'ue_e2e_20260723195801_863340' dropped
[2026-07-23T19:58:04.654Z] Step 6 — preservation test with E2E_PRESERVE_DB=true
[2026-07-23T19:58:05.084Z]   → allocated ue_e2e_20260723195804_3e5dbc with preserved=true
[2026-07-23T19:58:05.086Z]   → drop skipped as expected: {"dropped":false,"reason":"preserved"}
[2026-07-23T19:58:05.286Z]   → cleanup drop succeeded: {"dropped":true}
[2026-07-23T19:58:05.286Z] Step 7 — assert nzila_automation was never touched (name check)
[2026-07-23T19:58:05.286Z]   → no collision with nzila_automation
[2026-07-23T19:58:05.286Z] ALL STEPS PASSED
```

## Notes

- Migrations were **skipped** in this proof (`skipMigrations: true`) so the DB-lifecycle contract is validated in isolation from the Drizzle bootstrap orchestrator. Migration application is exercised end-to-end by the governed lifecycle command.
- Independence guarantee — `nzila_automation` was neither read from nor written to during any step. Every operation targeted the `postgres` admin DB and the run-scoped `ue_e2e_*` disposable DBs.

## Lifecycle history

Recorded in `apps/union-eyes/.e2e-lifecycle/history.jsonl` (gitignored).
