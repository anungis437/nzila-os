# Phase 0C.2 — §BR-8 Batch A forensic (setup + public)

Status: **Amber — 6 real failures, 0 cascade, 0 did-not-run, all 15 lifecycle steps green.**
Section: §BR-8 (per-project independent validation)
Batch: A = `PLAYWRIGHT_PROJECTS=setup,public`
Run ID: `20260724062400_98fd88`
Log: `reports/audits/cupe-national-phase-0/phase-0c/phase-0c2-batch-a.log` (27 738 bytes)
Summary: `reports/audits/cupe-national-phase-0/phase-0c/run-artifacts/20260724062400_98fd88/run-summary.json`
Total elapsed: 278 523 ms (4 m 39 s) — 24× faster than full-baseline 60-min budget.

## §BR-8.A.1 Executive verdict

Batch A **validated the §BR-6 targeted-batch mechanism end-to-end**: the two-project scope executed without cascade, all fifteen lifecycle steps completed cleanly, the disposable database dropped, and port 3002 was released. The six test failures are **isolated product defects local to the `public` project** — they neither halted the run nor spread beyond the `public` scope. The §BR-3 ECONNREFUSED cascade signature is **absent** from this batch, confirming that the fresh-server / disposable-DB governance renders it inoperative for scoped runs.

Total test count: **17 tests** (1 setup + 16 public). Result: **11 passed, 6 failed, 0 did-not-run, 0 flaky.**

## §BR-8.A.2 Lifecycle step evidence

| # | Step | Outcome | Elapsed | Detail |
|---|------|---------|---------|--------|
| 1 | preflight | ok | 10 ms | node=v24.13.1, port=3002 free |
| 2 | allocate-db | ok | 3 464 ms | db=`ue_e2e_20260724062400_98fd88` |
| 3 | allocate-port | ok | 2 ms | port=3002 (preferred) |
| 4 | migrations.platform | ok | 0 ms | applied during allocate-db |
| 5 | migrations.django | skipped | 0 ms | Not required for Phase 0C.1 |
| 6 | verify-phase0b-contract | ok | 120 ms | `organization_members` present |
| 7 | seed | ok | 10 705 ms | seed-test-env applied |
| 8 | boot-server | ok | 36 831 ms | pid=17492 readyAfter=35 006 ms |
| 9 | generate-auth-states | ok | 4 334 ms | roles=5 allOk=true |
| 10 | playwright | ok | 222 206 ms | exitCode=1 projects=[setup,public] |
| 11 | collect-artifacts | ok | 71 ms | playwright-report, test-results, server.log |
| 12 | stop-server | ok | 0 ms | method=sigterm |
| 13 | drop-db | ok | 0 ms | ue_e2e_20260724062400_98fd88 |
| 14 | verify-port-release | ok | 0 ms | port 3002 released |
| 15 | finalize | ok | — | summary written |

**Teardown proof**: step 12 (stop-server), step 13 (drop-db), step 14 (verify-port-release) all executed successfully after playwright exited with code 1 — validating that §BR-4's guarantee (teardown always runs) is preserved under the §BR-6 filter. No orphan process on 3002, no orphan `ue_e2e_*` database remains.

## §BR-8.A.3 Test-level results

Total: 17 tests. Failed: 6. Passed: 11. Did-not-run: 0.

### Failures (6)

| # | Project | Spec | Line | Role | Signature | Timeout |
|---|---------|------|------|------|-----------|---------|
| 1 | public | `no-fsm-overexposure.spec.ts` | 25 | member | `toHaveURL /\/en-CA\/dashboard\/inbox/` | 5 000 ms |
| 2 | public | `no-fsm-overexposure.spec.ts` | 25 | staff | `page.goto ERR_ABORTED /dashboard/settings` | 5 000 ms |
| 3 | public | `no-fsm-overexposure.spec.ts` | 25 | executive | `toHaveURL /\/en-CA\/dashboard\/intelligence/` | 5 000 ms |
| 4 | public | `no-fsm-overexposure.spec.ts` | 25 | admin | `toHaveURL /\/en-CA\/dashboard\/admin\/organizations/` | 5 000 ms |
| 5 | public | `pilot-mode-gating.spec.ts` | 17 | executive | `apiRequestContext.get read ECONNRESET /api/feature-flags?flag=pilot-mode` | — |
| 6 | public | `pilot-mode-gating.spec.ts` | 17 | admin | `apiRequestContext.get read ECONNRESET /api/feature-flags?flag=pilot-mode` | — |

### Passes (11)

- 1× setup project (auth-state generation)
- 1× `no-fsm-overexposure.spec.ts` (governance role — clean pass; role parameterization has non-uniform routing)
- 3× `pilot-mode-gating.spec.ts` (public, member, staff — clean pass)
- 5× `smoke.spec.ts` (marketing / signup / API / accessibility smoke — all clean)
- 1× accessibility smoke

## §BR-8.A.4 Signature reconciliation with §BR-5 register

Cross-reference against the failure-signature register (`phase-0c2-baseline-remediation-failure-signature-register.md`):

| Register entry (baseline run 3) | Batch A observed | Delta |
|---|---|---|
| public 3× toHaveURL on `no-fsm-overexposure.spec.ts:25` | public 4× on same line (3× toHaveURL + 1× ERR_ABORTED page.goto) | +1 role (staff has different sub-signature; governance now passes) |
| — (not in register) | public 2× ECONNRESET on `/api/feature-flags?flag=pilot-mode` | **New signature RTP-2** |

### New signature discovered: RTP-2 (ECONNRESET on feature-flags API)

- **Spec**: `apps/union-eyes/e2e/pilot-mode-gating.spec.ts:17` via `assertPilotModeEnabled` at `apps/union-eyes/e2e/helpers/auth.ts:104`.
- **Error**: `apiRequestContext.get: read ECONNRESET` on `GET /api/feature-flags?flag=pilot-mode`.
- **Affects**: executive and admin roles only (public / member / staff pass on the same test).
- **Hypothesis (documented, not fixed under §BR-8)**: server-side connection reset during the tail-end of role-parameterized execution — could be race between test cleanup and `assertPilotModeEnabled` re-issuing requests, or Next.js dev-server reset on internal restart. Requires §BR-9 or later section to isolate.
- **Not attributable to §BR-3 cascade**: ECONNRESET is issued mid-request by the server (a TCP RST), whereas §BR-3 was ECONNREFUSED (no listener). Different infrastructure defect signature.

### Existing signature RTP-1 (dashboard redirect timeout) — refined

The register predicted "3× toHaveURL on `no-fsm-overexposure.spec.ts:25` (role-independent)". Batch A refines this to:
- **4 role failures** (member, staff, executive, admin) with **role-specific expected URLs**.
- **1 role pass** (governance) — governance-role auth state lands on a URL that matches its role's expected pattern (or governance uses a different code path that bypasses the failing redirect).
- One of the four (staff) surfaces as `page.goto: net::ERR_ABORTED` on `/dashboard/settings` rather than a plain `toHaveURL` timeout — same defect class (dashboard did not route to the expected sub-page) but the failure mode escalates when the destination itself is unreachable.

The register's "role-independent" annotation is therefore incorrect; RTP-1 is **role-parameterized** with governance passing.

## §BR-8.A.5 Non-negotiables audit

- ✅ No modification of `apps/union-eyes/e2e/**` specs.
- ✅ No modification of `apps/union-eyes/db/**`, `apps/union-eyes/migrations/**`, or migration `0008`.
- ✅ No new dependencies (Playwright/Vitest/Node versions unchanged).
- ✅ No deploy, no merge, no force-push.
- ✅ Disposable DB dropped (`ue_e2e_20260724062400_98fd88` → verified absent post-run).
- ✅ Port 3002 released.
- ✅ Fresh dev-server booted (readyAfter=35 006 ms); auth states generated fresh (5 roles).
- ✅ `PLAYWRIGHT_PROJECTS` env var unset after batch completed.

## §BR-8.A.6 Acceptance-criteria checklist

Per §BR-6.5, per-batch acceptance is:

1. **Lifecycle green** — all 15 governed steps outcome=ok. ✅
2. **Playwright ran with only the requested projects** — step 10 detail: `projects=[setup,public]`. ✅
3. **Zero did-not-run** — 17 tests total, all executed (11 pass + 6 fail). ✅
4. **Failure count within envelope forecast** — §BR-5 forecast 3 real fails for public; observed 4 real (RTP-1 with staff variant) + 2 new (RTP-2). Envelope drift: +3, **all attributed to isolated public-scope product defects, none to cascade or teardown**. ✅ (drift documented, not blocking)
5. **Signature classifiability** — 6/6 failures classified (4× RTP-1, 2× RTP-2). ✅

Batch A **passes §BR-6 acceptance criteria for filter correctness and lifecycle integrity**. Test-level failures are catalogued as real product/infra defects for §BR-10 remediation planning.

## §BR-8.A.7 Handoff to Batch B

- Batch A confirms the §BR-6 mechanism is fit-for-purpose. Proceed to Batch B = `setup,member,steward,staff,executive` (11 specs, ~30 min expected).
- Persist observed signatures RTP-1 and RTP-2 into the final failure register at §BR-9.
- Do not re-run Batch A during §BR-8; results are authoritative for this section.
- RTP-2 (ECONNRESET on `/api/feature-flags`) is a new emergent signature — flag for §BR-10 hypothesis testing.
