# Phase 0C.2 §10 — Baseline Run 1 (first complete governed baseline)

**Section:** §10 — first complete governed baseline (full `e2e:governed`, no sampling)
**Executed at HEAD:** `d2b080d52` (Phase 0C.2 §9 reconciled inventory)
**Started:** 2026-07-24T00:48:06.608Z
**Finished:** 2026-07-24T00:48:11.188Z
**Total elapsed:** 4.58 seconds
**Playwright exit code:** `null` (never executed)
**Outcome:** **ABORTED at step 6/15**

## 1 · What was attempted

Invoked `pnpm --filter @nzila/union-eyes e2e:governed`, which runs
`tsx apps/union-eyes/scripts/lifecycle/run.ts` — the governed 15-step
orchestrator (see `phase-0c-lifecycle-design.md §5`). Environment was clean:
no leftover `AUTH_SECRET`, `DATABASE_URL`, `QA_TEST_ENV`, or `NODE_ENV`
overrides; only `E2E_DB_ADMIN_URL` was pre-set to the deterministic
localhost test default declared in
`apps/union-eyes/scripts/lifecycle/env.ts` (`DETERMINISTIC_TEST_DEFAULTS.E2E_DB_ADMIN_URL`
— points at local nzila developer PG on `localhost:5433/postgres`).

No `--grep`, no `--project` filter, no sampling — full end-to-end lifecycle.

## 2 · Step-by-step outcome

| Step | ID | Outcome | Elapsed | Detail |
|-----:|:---|:--------|--------:|:-------|
| 1 | preflight | ✔ ok | 10 ms | node=v24.13.1, port=3002 free |
| 2 | allocate-db | ✔ ok | 4 240 ms | db=`ue_e2e_20260724004806_ff82d5` runId=`20260724004806_ff82d5` |
| 3 | allocate-port | ✔ ok | 2 ms | port=3002 (preferred=3002) |
| 4 | migrations.platform | ✔ ok | 0 ms | applied during allocate-db (drizzle bootstrap) |
| 5 | migrations.django | ⚠ skipped | 0 ms | Django not required for Phase 0C.1 baseline |
| **6** | **verify-phase0b-contract** | **✘ FAILED** | **107 ms** | **`organization_members` table missing after migrations** |
| 7 | seed-fixtures | — | — | not reached |
| 8 | boot-server | — | — | not reached |
| 9 | generate-auth-states | — | — | not reached |
| 10 | playwright | — | — | **not reached (baseline never executed)** |
| 11 | copy-artifacts | — | — | not reached |
| 12 | stop-server | ⚠ skipped | 0 ms | server never booted |
| 13 | drop-db | ✔ ok | 0 ms | `ue_e2e_20260724004806_ff82d5` |
| 14 | verify-port-release | ✔ ok | 0 ms | port 3002 released |
| 15 | exit | — | — | orchestrator emitted status=`aborted`, exit=2 |

## 3 · Baseline verdict

**Zero of 193 tests ran** (per reconciled inventory `phase-0c2-e2e-inventory-reconciled.json`).
The lifecycle self-cleaned (dropped the disposable DB, released the port,
wrote per-run summary) so cluster state is clean.

## 4 · Root-cause analysis (deferred to §11 for repair)

`scripts/lifecycle/run.ts` calls `loadGovernedE2EEnv({ appRoot })` at line 137
but never calls the sibling `applyEnvToProcess(env)` helper exported from
`env.ts` (line ~272, whose docstring reads: *"Apply the loaded env to
process.env so downstream children inherit it."*).

Consequence: the returned `env` object contains
`QA_TEST_ENV='true'`, `NODE_ENV='test'`, `AUTH_SECRET=<…>`, etc., but none of
these are placed on `process.env`. When step 2 invokes
`allocateDatabase(...)` and that in turn `spawnSync('node', [bootstrap])`,
the child inherits `process.env` — which lacks `QA_TEST_ENV`. Inside
`tooling/scripts/run-union-eyes-drizzle-bootstrap.mjs:71`:

```js
const isQaOrCiBootstrap =
  process.env.QA_TEST_ENV === 'true' ||
  process.env.UE_QA_GATE === 'true' ||
  process.env.CI === 'true';
```

evaluates to `false`, so `applySqlFile(client, QA_BASELINE_SQL, 'qa-baseline')`
at line 296 is skipped. Only the 4 scoped Drizzle migrations from
`db/migrations-cache/` are applied, and they do not create
`public.organization_members` (that table is defined in
`tooling/sql/union-eyes-qa-baseline.sql:237`).

Evidence — migration log from the disposable-DB bootstrap:

```
[bootstrap] Legacy lineage freeze respected. Skipping any replay of db/migrations/.
[bootstrap] Ensuring required extensions...
[bootstrap] extension OK: uuid-ossp / pgcrypto / pg_trgm / btree_gin
[bootstrap] UE_DB_RESTORE_SNAPSHOT_URL not set — skipping canonical snapshot restore.
[bootstrap] Applying scoped Drizzle migrations from db/migrations-cache/ ...
[bootstrap] applying scoped migration: 0000_outstanding_viper
[bootstrap] applying scoped migration: 0001_lean_iron_man
[bootstrap] applying scoped migration: 0002_certain_juggernaut
[bootstrap] applying scoped migration: 0003_dizzy_alex_wilder
[bootstrap] Bootstrap attestation recorded.
[bootstrap] Bootstrap complete.
```

Notice: no `Applying canonical QA baseline SQL` line — the branch was
skipped because `isQaOrCiBootstrap === false`.

## 5 · §11 repair prescription (do not fix in §10 — §10 is capture-only)

Two-line repair inside `run.ts`:

```ts
import { loadGovernedE2EEnv, applyEnvToProcess, redactUrl } from './env'
// …
env = loadGovernedE2EEnv({ appRoot: APP_ROOT })
applyEnvToProcess(env)   // ← NEW: propagates QA_TEST_ENV / secrets / URLs to
                          //   process.env so spawned bootstrap + server children inherit them.
```

Plus a regression test in `run.test.ts` (or a new `run.env-apply.test.ts`)
asserting that after step-1 preflight, `process.env.QA_TEST_ENV === 'true'`
and `process.env.AUTH_SECRET.length >= 16`.

This is also a prerequisite for step 8 (boot server) and step 10 (Playwright
spawn), which currently receive the env only via the explicit `merged`
spread of `GovernedE2EEnv` in run.ts — a working pattern but brittle
(any new env field must be manually added to every spawn site). Calling
`applyEnvToProcess` once at load time removes that duplication.

## 6 · Cluster / worktree state after abort

- `ue_e2e_20260724004806_ff82d5` — dropped (verified: `psql -c "SELECT datname FROM pg_database WHERE datname LIKE 'ue_e2e_%'"` returns empty).
- Port 3002 — released (verify-port-release step confirmed).
- Per-run artefacts preserved at `apps/union-eyes/.e2e-lifecycle/runs/20260724004806_ff82d5/`.
- Copied to reports as `phase-0c2-baseline-run-1-summary.json` and
  `phase-0c2-baseline-run-1-migrations.log`.
- Full stdout/stderr captured in `phase-0c2-baseline-run-1-20260723-204804.log`
  (governed run) and the earlier abandoned run
  `phase-0c2-baseline-run-1-20260723-204753.log` (env-secret contamination pre-cleanup).

## 7 · Impact on §11 downstream sequencing

- §11 now has TWO baseline-failure repairs to bundle:
  1. **run.ts env application** (this §10 discovery) — unblocks lifecycle so Playwright can run at all.
  2. **loginAsRole helper reconciliation** (deferred TODO from §8 at `apps/union-eyes/e2e/helpers/auth.ts` line ~53) — needed for storageState-based persona projects to skip synthetic cookie injection.
- After §11 repairs, §11 MUST rerun the full governed baseline (call it Baseline Run 2) and produce `phase-0c2-baseline-run-2-*.{md,json,log}` capturing the actual test-level failure/pass counts.
- Only Baseline Run 2 (post-§11) is the artifact §15 flake-analysis consumes; Baseline Run 1 (this abort) is a "diagnostic zero".

## 8 · Files

Committed with this §10 evidence commit:

- `reports/audits/cupe-national-phase-0/phase-0c/phase-0c2-baseline-run-1.md` (this file)
- `reports/audits/cupe-national-phase-0/phase-0c/phase-0c2-baseline-run-1-summary.json` (copy of run-summary.json)
- `reports/audits/cupe-national-phase-0/phase-0c/phase-0c2-baseline-run-1-migrations.log` (disposable-DB bootstrap log)
- `reports/audits/cupe-national-phase-0/phase-0c/phase-0c2-baseline-run-1-20260723-204804.log` (full orchestrator stdout/stderr, force-added)
