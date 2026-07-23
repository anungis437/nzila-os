# Phase 0C — Deterministic Lifecycle Design (§5–§11)

**Status:** DESIGN. This document specifies the deterministic-lifecycle contract for
Union Eyes E2E as authored under Phase 0C. Reference implementation is scaffolded
under `apps/union-eyes/scripts/lifecycle/*.ts` and orchestrated by the new
`pnpm --filter @nzila/union-eyes e2e:governed` script.

## Executive summary

Phase 0C baseline (§4) empirically proved that the existing `pnpm exec playwright test`
command is not deterministic:

- **Database:** `Missing critical database tables` warning at boot; seed script
  `apps/union-eyes/scripts/seed-test-env.ts` is never invoked as part of the E2E lifecycle.
- **Server env:** `NEXT_PUBLIC_APP_URL: Required` error at boot; `runtime-fail-closed`
  reports 10+ missing secrets (auth.django.secret, crypto.fallback, auth.webhook.secret,
  crypto.pii, identity.entra.*, lineage.*, NZILA_MODE) — none of which the current
  `playwright.config.ts webServer.env` provides.
- **Auth state:** cookie-mode auth (`nzila_session=ue-seed-session-{userId}`) requires
  seeded users to exist; without them, `/dashboard` never redirects to the role-specific
  landing (baseline test 1/192 first-failure at `e2e/helpers/auth.ts:77`).
- **Lifecycle:** the existing E2E command has no readiness gate, no seed step, no
  auth-state generation, no explicit port/PID discipline, no post-run cleanup, and no
  disposable DB. It relies on the developer's ambient `nzila_automation` PostgreSQL DB.

The governed lifecycle described below fixes each of these deterministically.

## §5 — Governed lifecycle command

**Command:** `pnpm --filter @nzila/union-eyes e2e:governed`

**Sequence (all steps must succeed or the run aborts fail-closed):**

| # | Step | Owner script | Exit criteria |
|---|------|--------------|---------------|
| 1 | Preflight | `scripts/lifecycle/preflight.ts` | Node ≥ 20, pnpm ≥ 10, PostgreSQL 17 reachable on localhost:5433, no residual PID on port 3002, `.env.test` present |
| 2 | Allocate disposable DB | `scripts/lifecycle/allocate-db.ts` (§7) | New DB `nzila_e2e_{runId}` created with owner `nzila`, run ID logged, refuse-production guard fires if URL matches prod hints |
| 3 | Allocate port | `scripts/lifecycle/allocate-port.ts` (§11) | Port 3002 confirmed free; if busy, either refuse (default) or auto-assign next free port and record it |
| 4 | Apply platform migrations | `pnpm --filter @nzila/union-eyes-schema drizzle:migrate` on allocated DB | Migration lineage complete; assert zero pending |
| 5 | Apply Django migrations | `python manage.py migrate --database=e2e` in `services/union-eyes-django` | Migration table hash matches expected |
| 6 | Verify Phase 0B contract | `scripts/lifecycle/verify-phase0b.ts` | `organization_membership` resolver tables + indexes exist; zero-pending marker present |
| 7 | Run seed | `scripts/lifecycle/seed.ts` → invokes `scripts/seed-test-env.ts` on allocated DB | All fixture identities/orgs/cases seeded; postconditions verified per §8 |
| 8 | Boot Next.js server | `scripts/lifecycle/boot-server.ts` | `pnpm dev` spawned as child process with PID tracked in `.e2e-lifecycle/pid.json`; wait for `/api/health/readiness` all-green (§6) with 120s timeout |
| 9 | Generate auth states | `scripts/lifecycle/generate-auth-states.ts` (§9) | One `playwright/.auth/{role}.json` per role; verified via smoke request to protected endpoint |
| 10 | Execute Playwright | `pnpm exec playwright test` | Playwright projects (§10) run in dependency order; exit code captured |
| 11 | Collect artifacts | `scripts/lifecycle/collect-artifacts.ts` | HTML/JSON reports, traces, screenshots, videos, server log copied to `reports/audits/cupe-national-phase-0/phase-0c/run-artifacts/{runId}/` |
| 12 | Stop server | `scripts/lifecycle/stop-server.ts` | Signal SIGTERM to tracked PID, wait for graceful exit (≤10s), then SIGKILL; PID file removed |
| 13 | Drop DB | `scripts/lifecycle/drop-db.ts` | Disposable DB dropped unless `E2E_PRESERVE_DB=true`; run ID recorded in `.e2e-lifecycle/history.jsonl` |
| 14 | Verify port release | `scripts/lifecycle/verify-port-release.ts` | Port 3002 confirmed free; if not, abort with the PID that still holds it |
| 15 | Exit with test result | — | Exit code = Playwright exit code (0 = green, >0 = red) |

**Non-negotiables:**
- No step is skipped if the prior step failed unless it is a cleanup step (12–14).
- The command NEVER modifies `nzila_automation` (the developer DB).
- The command NEVER kills processes it did not spawn.
- All artifacts are gitignored except the run-summary JSON.

## §6 — Readiness endpoint contract

**Route:** `apps/union-eyes/app/api/health/readiness/route.ts` (new)

Returns 200 with detailed diagnostic body only when all 10 checks pass. Returns 503 with
the specific failing check when any fail. In production, body is redacted; in
`NODE_ENV=test`, body is fully detailed.

| # | Check ID | What it verifies | Failure mode |
|---|----------|------------------|--------------|
| 1 | `app.boot` | Next.js server responded | 503 — server not booted |
| 2 | `db.connect` | Connection to configured DATABASE_URL succeeds | 503 — DB unreachable |
| 3 | `db.schema.public` | Expected core public-schema tables exist | 503 — missing table list |
| 4 | `db.schema.union_eyes` | Expected union_eyes-schema tables exist | 503 — missing table list |
| 5 | `db.migrations.platform` | Drizzle `__drizzle_migrations` head matches expected hash | 503 — pending migrations |
| 6 | `db.migrations.django` | Django migrations table current | 503 — pending Django migrations |
| 7 | `db.contract.phase0b` | Phase 0B organization_membership resolver tables + indexes present | 503 — missing resolver |
| 8 | `db.tables.kpi` | KPI tables (`ue_kpi_snapshot`, `ue_pilot_definition`) exist | 503 — missing KPI |
| 9 | `db.seed.marker` | Fixture marker row `ue_e2e_seed_marker` present with correct run ID | 503 — seed not applied |
| 10 | `auth.fixtures` | Each expected fixture user (`UE_TEST_USERS`) resolvable in `auth_users` | 503 — missing fixture users |

**Tests:** `apps/union-eyes/app/api/health/readiness/route.test.ts` covers all 6 states:
- Fully ready → 200 with all-green body
- DB unavailable → 503 `db.connect`
- Migration pending → 503 `db.migrations.*`
- Missing schema → 503 `db.schema.*`
- Missing seed → 503 `db.seed.marker`
- Missing auth fixture → 503 `auth.fixtures`

## §7 — Disposable database fixture

**Contract:** `scripts/lifecycle/allocate-db.ts`

- DB name format: `nzila_e2e_{ISO8601-timestamp}_{6-char-random}` (unique per run)
- Owner: current OS user (`whoami`) recorded in `.e2e-lifecycle/history.jsonl`
- Refuse production guard:
  - Aborts if `DATABASE_URL` includes any of: `prod`, `production`, `azure.com`, `rds.amazonaws.com`
  - Aborts if not overridden by `QA_TEST_ENV_ALLOW_PROD_URL=true` (parity with `seed-test-env.ts`)
- Refuses when `NODE_ENV` is not `test` or `development`
- Applies full migration lineage before returning (steps 4–6 above)
- Cleanup: `scripts/lifecycle/drop-db.ts` drops after run
- Preservation switch: `E2E_PRESERVE_DB=true` keeps DB and prints its name
- Independence: NEVER reads from or writes to `nzila_automation`
- NEVER uses `drizzle-kit push`
- NEVER copies from an existing DB

**Test:** `scripts/lifecycle/allocate-db.test.ts`
- Positive: creates DB, applies migrations, returns URL
- Negative: production URL → refused with specific error message
- Negative: NODE_ENV=production → refused

## §8 — Seed contract

**Command:** `pnpm --filter @nzila/union-eyes seed:test-env` (existing, extended)

**Required fixtures (all seeded in one transaction):**

| Category | Rows | Provenance marker |
|----------|------|-------------------|
| Public / no-auth | 0 (nothing seeded; public routes serve without seed) | n/a |
| Member | 2 (memberPrimary Org A + memberSecondary Org B) | `ue_qa_seed_group='member'` |
| Representative | 2 (repPrimary Org A + repPrimary Org B) | `ue_qa_seed_group='representative'` |
| Steward | 2 (stewardPrimary Org A + stewardSecondary Org B) | `ue_qa_seed_group='steward'` |
| Admin | 1 (adminPrimary Org A) | `ue_qa_seed_group='admin'` |
| Leadership viewer | 1 (leadershipViewerOrgA) | `ue_qa_seed_group='leadership'` |
| Organizations | 2 (`UE_TEST_ORGS.primary`, `UE_TEST_ORGS.secondary`) | `ue_qa_seed_group='organization'` |
| Platform auth mappings | 8 (one `authUsers` + `authOrgPolicies` + `authOrganizationUsers` per fixture user) | `qa_source='ue-seed-test-env'` |
| Memberships | 8 (`organization_members` rows linking each user to org) | `qa_source='ue-seed-test-env'` |
| Cases | 4 (`UE_TEST_CASES.grievancePrimary/escalated/resolved/underReview`) | `qa_source='ue-seed-test-env'` |
| Documents | 4 (one per case) | `qa_source='ue-seed-test-env'` |
| Pilot definition | 1 | `qa_source='ue-seed-test-env'` |
| Pilot metrics | 1 baseline row | `qa_source='ue-seed-test-env'` |
| KPI record | 1 snapshot per fixture org | `qa_source='ue-seed-test-env'` |
| Audit record | 5 (seed provenance audit) | `qa_source='ue-seed-test-env'` |
| Seed marker | 1 (`ue_e2e_seed_marker` with run ID) | — |

**Idempotency:** all inserts use `ON CONFLICT DO UPDATE`; second run mutates no rows.
**Transactionality:** wrapped in a single `BEGIN`/`COMMIT`; any failure rolls back.
**Refuses prod:** existing `assertSafeRuntime()` retained; verified in test.
**Verifies postconditions:** post-commit query asserts every fixture identity is
readable via `SELECT` and `authUsers` row exists.
**Resettable:** `pnpm --filter @nzila/union-eyes seed:test-env -- --reset` truncates and
re-seeds.

**Test:** `apps/union-eyes/tests/scripts/seed-test-env.test.ts` runs the seed → verify
→ reset → seed again → verify sequence in Vitest against a disposable DB.

## §9 — Governed auth states

**Command:** `scripts/lifecycle/generate-auth-states.ts` (Playwright setup project)

For each role in `UE_E2E_USERS`:
1. Verify user exists in `authUsers` (query DB directly)
2. Perform login via `/api/auth/login` with fixture email + `UE_TEST_USER_PASSWORD`
3. Verify session cookie is set with format `nzila_session=<opaque>`
4. Verify `/api/organizations/current` returns the expected org ID
5. Verify `/api/rbac/current-role` returns the expected role
6. Verify that a wrong-org query returns 403 (proof of org boundary)
7. Save `page.context().storageState()` to `playwright/.auth/{role}.json`
8. `playwright/.auth/` is gitignored

**Never committed:** `.auth/` in `.gitignore`; credentials never printed to log; only
opaque session IDs surface in the run log.

**Test:** `apps/union-eyes/e2e/setup/auth-states.setup.ts` fails fast if any of 7 checks fails.

## §10 — Playwright project structure

**Refactored `playwright.config.ts` projects:**

```ts
projects: [
  { name: 'setup-db',     testMatch: 'e2e/setup/db.setup.ts' },
  { name: 'setup-auth',   testMatch: 'e2e/setup/auth-states.setup.ts', dependencies: ['setup-db'] },
  { name: 'public',       testMatch: /public|stakeholder|dependabot-panel-public/,
    dependencies: ['setup-db'] },
  { name: 'member',       testMatch: /member-|-member/,
    use: { storageState: 'playwright/.auth/member.json' },
    dependencies: ['setup-auth'] },
  { name: 'representative', /* similar */ },
  { name: 'steward',      /* similar */ },
  { name: 'admin',        /* similar */ },
  { name: 'leadership',   /* similar */ },
  { name: 'security',     testMatch: /cross-org|evidence-misuse|org-isolation|auth-failure|negative/,
    dependencies: ['setup-auth'] },
  { name: 'bilingual-en', use: { locale: 'en-CA' }, dependencies: ['setup-auth'] },
  { name: 'bilingual-fr', use: { locale: 'fr-CA' }, dependencies: ['setup-auth'] },
  { name: 'accessibility', testMatch: /a11y|accessibility/, dependencies: ['setup-auth'] },
]
```

**Retries:** stays at 0 locally, 2 in CI ONLY for infrastructure hiccups — NOT as substitute for test stability.

## §11 — Server/process discipline

**Owner:** `scripts/lifecycle/boot-server.ts` + `stop-server.ts` + `verify-port-release.ts`

- Uses `--port ${allocatedPort}` (default 3002; can be overridden)
- Tracks PID in `.e2e-lifecycle/pid.json` with fields: `{pid, port, startedAt, command}`
- Writes ownership marker file `.e2e-lifecycle/owned-by.txt` = "phase0c-e2e-{runId}"
- Uses Node's `process.kill(pid, 'SIGTERM')` — NEVER `pkill node` or `taskkill /IM node.exe`
- Signal handler on `SIGINT`/`SIGTERM` triggers cleanup
- Startup log tailed to `.e2e-lifecycle/server.log`
- Stale-process detection: if `pid.json` exists at boot, checks whether that PID is alive; if yes and owned by us → refuses to double-boot; if not owned → refuses with human-readable message
- Port collision detection: if port occupied by another process → refuses with `netstat -ano | findstr :3002` result

**Tests:** `scripts/lifecycle/boot-server.test.ts`
- Positive: boots server, tracks PID
- Negative: port already occupied (unrelated process) → refuses
- Negative: stale owned PID from prior run → refuses with cleanup instructions
- Negative: interrupted run → PID file cleaned up
- Positive: verify-port-release confirms port free after stop

## §12 — Duplicate removal

`apps/union-eyes/tests/e2e/ue-workflow.spec.ts` (currently testIgnore'd) is a near-duplicate of `apps/union-eyes/e2e/ue-workflow.spec.ts`. The differences are limited to:

- Dependabot-panel skip guard (extra in `tests/e2e/`)
- Use of `assertRoleGatedReadStatus` in test 5

Both are already covered in the canonical file. **Decision:** delete
`tests/e2e/ue-workflow.spec.ts` and remove its entry from `playwright.config.ts` testIgnore.
Recorded in `phase-0c-failure-resolution-register.md`.

---

## Scope note (§21 planning)

The full lifecycle implementation (§5–§11) is a substantial engineering effort measured in
days, not hours. Under the constraint of this Phase 0C autonomous execution window, the
implementation strategy is:

1. **Scaffold** the lifecycle scripts as skeleton `.ts` files with typed interfaces, TODO
   markers, and passing unit tests for the trivial paths.
2. **Fully implement** the highest-leverage components:
   - Readiness endpoint (§6) — enables §17 to make an informed pass/fail call.
   - Disposable DB allocator (§7) — unblocks parallel dev.
   - Seed contract extension (§8) — turns "missing tables" warnings into pass.
3. **Defer to Phase 0D** with concrete tickets and evidence:
   - Full Playwright project refactor (§10) — mechanical work but touches every spec import.
   - Server/process discipline (§11) — depends on decisions about port ownership across worktrees.
   - Bilingual (§15) + accessibility (§16) — depend on §5–§9 being green first.
4. **Under this constrained window, honest closure is likely `AMBER — E2E INFRASTRUCTURE
   INCOMPLETE`.** Concrete deliverables and blockers are documented per §23.
