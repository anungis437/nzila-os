# Phase 0C.2 §6 — Readiness Authoritative Endpoint Proof

**Generated:** 2026-04-25
**Scope:** `apps/union-eyes/app/api/health/readiness/route.ts` + tests + prove-script
**Verdict:** ✅ GREEN

---

## 1. Objective

The orchestrator must poll `/api/health/readiness` — never merely `/api/health/liveness`.
Liveness only proves a process is listening on a port; readiness must prove that the
database is connected, migrations are applied, schemas exist, fixtures are seeded,
and (when running in managed-server mode) the run-id contract is honored.

This section extends the Phase 0C.1 §6 endpoint (10 checks) to **15 checks** with
three additional failure classifications, and fixes the auth-state generator prove
script to poll readiness instead of liveness.

---

## 2. Changes Landed

### 2.1 New checks (5)

| # | Check ID | Query | Green criterion |
|---|---|---|---|
| 11 | `db.fixtures.orgs` | `SELECT 1 FROM public.organizations WHERE id = <uuid> LIMIT 1` for 3 canonical UUIDs | all 3 rows present |
| 12 | `db.fixtures.mappings` | `SELECT count(*)::int AS c FROM user_management.organization_users` | `count ≥ 5` (one per canonical persona) |
| 13 | `db.fixtures.memberships` | `SELECT count(*)::int AS c FROM public.organization_members` | `count ≥ 5` |
| 14 | `db.migration.lineage` | `SELECT count(*)::int AS c FROM drizzle.__drizzle_migrations` | `count ≥ 4` (canonical `migrations-cache/` floor) |
| 15 | `env.run_id` | `process.env` inspection (no DB) | skipped unless `NZILA_E2E_MANAGED_SERVER === 'true'`; else `NZILA_E2E_RUN_ID` must be a non-empty string |

The three canonical fixture org UUIDs (`primary`, `secondary`, `uxTesterIsolated`) are
duplicated as `EXPECTED_FIXTURE_ORG_IDS` inside the route module. `productionLike` (the
4th org from `scripts/test-orgs.ts`) is intentionally **not** probed because it is not
seeded by `seed-test-env.ts`.

`MIGRATION_LINEAGE_FLOOR = 4` matches the count of migrations in the canonical
`migrations-cache/` and detects non-canonical migration paths.

The managed-server env-var names (`NZILA_E2E_MANAGED_SERVER`, `NZILA_E2E_RUN_ID`) are
duplicated locally in the route (not imported from `scripts/lifecycle/`) so this route
stays app-level and does not pull the `scripts/` tree into the Next.js runtime graph.

### 2.2 Classifier expansions

`ReadinessBody['status']` gained three failure modes: `fixtures_incomplete`,
`lineage_below_floor`, `run_id_missing`. The classifier's precedence order is:

```
ready
  → database_unavailable       (db.connect fails)
  → migration_pending          (db.migrations.platform fails, i.e. 0 migrations)
  → schema_missing             (any db.schema.* fails)
  → seed_missing               (db.seed.marker fails)
  → auth_fixture_missing       (auth.fixtures fails)
  → run_id_missing             (env.run_id fails — managed mode + no run id)
  → lineage_below_floor        (db.migration.lineage fails, but platform check passed)
  → fixtures_incomplete        (orgs/mappings/memberships fail)
  → not_ready                  (fallback)
```

`run_id_missing` is ranked *before* `lineage_below_floor` because it is deterministic
and easy to diagnose. `fixtures_incomplete` is last among domain-specific modes because
it depends on seed marker having already passed.

### 2.3 Cascading db-unavailable fallback

When `db.connect` fails, all 14 downstream checks are marked `fail` with
`detail: 'db not available'` (or `'db unavailable'` from the inner catch). The 5 new
check IDs were added to both cascade lists to preserve invariant: **the response body
always contains exactly 15 checks in the same order.**

### 2.4 Production redaction

`redactChecksForProd()` still strips `detail` from every check when `NODE_ENV === 'production'`,
so no PostgreSQL error text, host, port, or run-id length leaks in prod responses.
The `runIdLen=` detail is only ever visible in test/dev.

### 2.5 Prove-script fix

`apps/union-eyes/scripts/lifecycle/prove-phase-0c2-auth-state-generator.ts` step 5
now polls `/api/health/readiness` (was `/api/health/liveness`). Variable rename
`livenessUrl → readinessUrl` and updated log lines. Auth-state generation depends
on seeded fixtures, so polling readiness catches misconfiguration *before* the
generator issues its first login request.

---

## 3. Test Evidence

**File:** `apps/union-eyes/app/api/health/readiness/route.test.ts`
**Log:** `reports/audits/cupe-national-phase-0/phase-0c/phase-0c2-readiness-authoritative-tests.log`

```
Test Files  1 passed (1)
     Tests  15 passed (15)
  Duration  718ms
```

Test groups:

| Group | Tests | Purpose |
|---|---|---|
| `happy path` | 2 | 200 ready + exact 15-check-id ordering assertion |
| `database failure modes` | 3 | `database_unavailable`, `seed_missing`, `migration_pending` |
| `Phase 0C.2 §6 — fixture completeness` | 3 | Missing org, short mappings, short memberships → `fixtures_incomplete` |
| `Phase 0C.2 §6 — migration lineage` | 2 | 0-migrations classifies as `migration_pending` (not lineage); `count=4` passes floor exactly |
| `Phase 0C.2 §6 — env.run_id gate` | 4 | Skipped w/o flag, fails w/o run-id, ok with both, exact-string `'true'` required |
| `production redaction` | 1 | Every check strips `detail` when `NODE_ENV=production` |

All 15 tests pass in 718ms. No live DB required (mocked via `vi.mock('@nzila/db')`).

---

## 4. Verification of the 3 caveats

1. **"The orchestrator must poll /api/health/readiness, not merely liveness"** —
   `prove-phase-0c2-auth-state-generator.ts` step 5 now polls `/api/health/readiness`.
   The orchestrator (`scripts/lifecycle/run.ts` step 8) already polls readiness (verified
   in §5 baseline reading, line 269). Both callers are now consistent.

2. **"Playwright authentication bypass must be structurally impossible outside
   governed test execution"** — this section does not alter that guarantee.
   The `env.run_id` check *adds* a positive assertion (managed-mode requires
   `NZILA_E2E_RUN_ID`) that the orchestrator must satisfy before Playwright
   projects can begin. Production refusal semantics from §4 are unchanged
   (still enforced by `test-auth-bypass` module).

3. **"Gitleaks exception narrowly scoped"** — this evidence file contains no
   credential-bearing URL literals. No `.gitleaks.toml` change is required.

---

## 5. Files Modified

| Path | Change |
|---|---|
| `apps/union-eyes/app/api/health/readiness/route.ts` | +125 lines: 5 new checks, expanded `CheckId` union, expanded `ReadinessBody.status` enum, expanded classifier, 5 new IDs added to both db-unavailable cascade lists |
| `apps/union-eyes/app/api/health/readiness/route.test.ts` | Rewritten: 15 tests across 6 describe groups (was 5 tests) |
| `apps/union-eyes/scripts/lifecycle/prove-phase-0c2-auth-state-generator.ts` | Step 5 polls readiness, not liveness; docblock updated |

No changes to `run.ts` (already polling readiness), `managed-server-handshake.ts`
(shipped in §5), or any Playwright config.
