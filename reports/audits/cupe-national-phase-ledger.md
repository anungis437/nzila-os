# CUPE National — Phase Ledger

Single source of truth for phase progression. Updated at the close of each phase.

## Phase 0 — Baseline Stabilization

**Status:** in progress
**Authorized at commit:** `290e6c77dd1bc2ddcf33d899e52f13ccd57bd161`
**Branch:** `fix/union-eyes-reality-remediation`
**Local database:** native Windows PostgreSQL 17.8 on `localhost:5433`, DB `nzila_automation`, user `nzila`

### Phase 0 exit checklist

- [x] Truth re-established (branch, HEAD, dirty scope recorded).
- [x] Fix commit `290e6c77d` confirmed as HEAD.
- [x] Full Union Eyes vitest baseline recorded (1103 files, 16 036 tests, 0 fail, 127.23 s).
- [x] Focused API vitest baseline recorded (9 files, 89 tests, 0 fail, 730 ms).
- [x] Failure inventory drafted at [cupe-national-phase-0/failure-inventory.md](cupe-national-phase-0/failure-inventory.md).
- [x] Migration defect fix landed as `packages/db/drizzle/0033_fix_pilot_alerts_rule_fk.sql`.
- [x] Missing platform migrations (0009, 0010) applied to local dev database.
- [ ] E2E baseline re-recorded at HEAD (blocked by dev-server cold-start timeout on Windows; documented in failure inventory).
- [ ] Staging deployment attempted or external blocker recorded.
- [ ] Post-deployment smoke suite result recorded.
- [ ] Maintainer sign-off recorded.

### Phase 0 evidence

| Artefact | Path |
|---------|------|
| Program document | [cupe-national-implementation-program.md](cupe-national-implementation-program.md) |
| Failure inventory | [cupe-national-phase-0/failure-inventory.md](cupe-national-phase-0/failure-inventory.md) |
| Vitest baseline | [cupe-national-phase-0/vitest-run-20260722-162228.log](cupe-national-phase-0/vitest-run-20260722-162228.log) |
| Focused API baseline | [cupe-national-phase-0/vitest-api-20260722-162507.log](cupe-national-phase-0/vitest-api-20260722-162507.log) |
| E2E probe log | [cupe-national-phase-0/e2e-pilot-mode-gating-20260722.log](cupe-national-phase-0/e2e-pilot-mode-gating-20260722.log) |
| Migration fix | [packages/db/drizzle/0033_fix_pilot_alerts_rule_fk.sql](../../packages/db/drizzle/0033_fix_pilot_alerts_rule_fk.sql) |

### Phase 0 root-cause fixes landed

| ID | Class | File / change | Evidence |
|----|-------|---------------|----------|
| PH0-FIX-001 | Migration defect | New forward migration `packages/db/drizzle/0033_fix_pilot_alerts_rule_fk.sql` restores the FK and idempotent statements that 0010 skipped because of the invalid `ADD CONSTRAINT IF NOT EXISTS` clause. | Applied locally with `psql -v ON_ERROR_STOP=1`; `pilot_alerts_rule_fk` now present. |

### Phase 0 open items (not blockers to hand-off record, but blockers to scenario graduation)

| ID | Class | Description | Owner in phase |
|----|-------|-------------|----------------|
| PH0-OPEN-001 | Migration defect | Platform migrations `packages/db/drizzle/*.sql` have no automated runner in this repo. Local databases drift silently from committed migrations. | Phase 2 |
| PH0-OPEN-002 | Data-model divergence | `pilot_definitions.org_id` references `orgs`; Union Eyes writes org context to `organizations`. Demo org `11111111-1111-4111-8111-111111111111` exists in `organizations` but not in `orgs`. | Phase 2 |
| PH0-OPEN-003 | Stale expectation | [apps/union-eyes/lib/db-validator.ts](../../apps/union-eyes/lib/db-validator.ts) hardcodes `users` as a critical table. Current schema has no `users` table (see `abr_users`, `org_members`, `organization_members`). | Phase 1 |
| PH0-OPEN-004 | Environment defect | Playwright `beforeAll` timeout is 60 s but Windows Turbopack cold start plus dev-server bootstrap regularly exceeds that. Server-readiness endpoint budget is 90 s but is never given a chance. | Phase 1 |
| PH0-OPEN-005 | Seed defect (hypothesis) | Untracked file `ops/ue-cognition/kpi-snapshots/kpi_mrwhcp4b_d2f72515a580.json` uses a `kpi_…` string identifier. Any code path that inserts this identifier into a `uuid` column (candidate: `kpi_configurations.id`) will produce the runtime error `invalid input syntax for type uuid: "kpi_mrwhcp4b_d2f72515a580"` recorded in the prior audit. | Phase 3 |

### Phase 0 non-changes

The following remain untouched:

- The seven CUPE audit registers under [reports/audits/](../../).
- All Union Eyes product code, routes, actions, and FSM under `apps/union-eyes/`.
- All 32 historical migrations `packages/db/drizzle/0000_*` through `0032_*`.
- 31 unrelated dirty lines in the working tree (governance drift, ops KPI snapshots, docs). They must not enter any Phase 0 commit.

---

## Phase 1 – 10

Not started. Sections will be added at authorization time.
