# Phase 0C.2 — §BR-8 Batch C forensic (setup + admin)

Status: **Red — 46 real failures + 48 did-not-run cascade, all 15 lifecycle steps green.**
Section: §BR-8 (per-project independent validation)
Batch: C = `PLAYWRIGHT_PROJECTS=setup,admin`
Run ID: `20260724064034_14e83f`
Log: `reports/audits/cupe-national-phase-0/phase-0c/phase-0c2-batch-c.log` (160 254 bytes)
Summary: `reports/audits/cupe-national-phase-0/phase-0c/run-artifacts/20260724064034_14e83f/run-summary.json`
Total elapsed: 2 103 383 ms (35 m 03 s) — playwright wall clock 2 056 810 ms (34 m 17 s).

## §BR-8.C.1 Executive verdict

Batch C **exposes the load-limit of `§BR-6` per-project mitigation**: the `admin` project alone (104 specs) exceeds the Next.js dev-server steady-state tolerance window, re-triggering the same `ensureServerReady 90 s` cascade signature (§BR-3) inside a supposedly-isolated batch.

Lifecycle steps 1-15 completed cleanly (drop-db, port release, teardown all green). But Playwright test-level results are:

| Category | Count |
|---|---|
| Total tests executed | 105 |
| Passed | 5 |
| Failed | 46 |
| Skipped | 6 |
| Did-not-run | **48** |

**Batch C is the first §BR-8 batch to fail acceptance criterion #3 (`zero did-not-run`).** The cascade is real infrastructure degradation, not spec defect. Batch A and Batch B did not exhibit it because their combined spec count (33 total) fits inside the fresh-server budget; admin's 104 specs do not.

## §BR-8.C.2 Lifecycle step evidence

| # | Step | Outcome | Elapsed | Detail |
|---|------|---------|---------|--------|
| 1 | preflight | ok | 10 ms | node=v24.13.1, port=3002 free |
| 2 | allocate-db | ok | 1 580 ms | db=`ue_e2e_20260724064034_14e83f` |
| 3 | allocate-port | ok | 2 ms | port=3002 |
| 4 | migrations.platform | ok | 0 ms | drizzle bootstrap |
| 5 | migrations.django | skipped | 0 ms | not required |
| 6 | verify-phase0b-contract | ok | 126 ms | `organization_members` present |
| 7 | seed | ok | 10 554 ms | seed-test-env applied |
| 8 | boot-server | ok | 28 688 ms | pid=39316 readyAfter=26 703 ms |
| 9 | generate-auth-states | ok | 4 681 ms | 5 roles allOk=true |
| 10 | playwright | ok | 2 056 810 ms | exitCode=1 projects=[setup,admin] |
| 11 | collect-artifacts | ok | 238 ms | playwright-report, test-results |
| 12 | stop-server | ok | 0 ms | method=sigterm |
| 13 | drop-db | ok | 0 ms | `ue_e2e_20260724064034_14e83f` |
| 14 | verify-port-release | ok | 0 ms | port 3002 released |
| 15 | finalize | ok | — | summary written |

Filter proof: `[e2e:governed]   playwright project filter: setup, admin` printed pre-step-10. Step 10 detail confirms `projects=[setup,admin]`.

## §BR-8.C.3 Failure catalog by class (46 fails + 48 did-not-run)

### Class A — RTP-1 toHaveURL landing (via `assertRoleLanding` helpers.ts:99)

Roughly **32 failures** on `authenticated-role-navigation.spec.ts` — each a role-parameterised test in the admin project asserting a "personalized landing" / "role IA" / "blocked route" expectation, all failing at `expect(page).toHaveURL` with 5 s timeout. Same underlying defect as Batch A (public) and Batch B (member/steward) — post-login redirect chain does not land where `assertRoleLanding` expects. Cross-cutting login-redirect defect confirmed at this scale.

Notable clusters within authenticated-role-navigation:
- `personalized-landing-and-role-IA` for admin persona (3× test-result dirs = 1 fail × 3 retries)
- `dashboard-debug-is-blocked-admin`
- `union-analytics-is-blocked-admin`
- `sector-analytics-is-blocked-admin`
- `analytics-admin-is-blocked-admin`
- `union-organizations-is-blocked-admin`
- `board-claims-new-is-blocked-admin`
- `billing-admin-is-blocked-admin`
- `compliance-admin-is-blocked-admin`
- `pension-admin-is-blocked-admin`
- `state-dashboard-clc-is-blocked-admin`
- `intelligence-is-blocked-admin`
- `nation-intelligence-is-blocked-admin`
- `and-primary-action-reachable-admin` (3 variants)

### Class B — RTP-3 variant `toBeVisible(reachableNav)` (authenticated-role-navigation.spec.ts:70)

**~7 failures**. Different line (:70) than Batch B's RTP-3 line (:17) but same class of defect: nav locator not visible within 5 s. Interleaved with Class A failures within `and-primary-action-reachable` tests.

### Class C — RTP-8 NEW `page.goto: Timeout 45000ms` (ocra-adaptive-flow.spec.ts:38,48,75)

**3 failures**. Goto ASSESSMENT_PATH_EN / ASSESSMENT_PATH_FR times out after 45 s. First manifestation of the "large page cold compile" defect predicted by §BR-5 for admin project. Occurs mid-batch, before cascade takes over.

### Class D — RTP-9 NEW `apiRequestContext.get: Timeout 20000ms` (governance/deployment-legitimacy-visibility.spec.ts)

**~2 failures**. API request timeouts on governance endpoints (`base-id-queries-without-5xx`, `governance-headers-when-bound`). Same signature §BR-5 forecast for admin as "governance apiRequest-20s ×2" — verified.

### Class E — RTP-6 NEW / §BR-3-in-admin cascade `Server readiness check timed out after 90000ms`

**10 beforeAll aborts** produce the 48 did-not-run cascade. Occurs late in the 34 m playwright wall clock, once Next.js dev server has been serving admin loops for ~25 m and enters degraded mode (SYN backlog + long compile blocking event loop, same mechanism as §BR-3). Once `ensureServerReady` throws in a `beforeAll`, Playwright marks every remaining test in that describe block as **did not run**, not failed — hence the 48-count.

## §BR-8.C.4 Signature roll-up

| Signature | Count | Note |
|-----------|------:|------|
| RTP-1 (`toHaveURL` landing timeout) | ~32 | continued — largest class |
| RTP-3 variant (`toBeVisible(reachableNav)` line 70) | ~7 | new line, same class |
| RTP-8 NEW (`page.goto` 45 s on assessment path) | 3 | admin only |
| RTP-9 NEW (`apiRequestContext.get` 20 s on governance) | 2 | admin only |
| RTP-6 = §BR-3-in-admin (`ensureServerReady` 90 s) | 10 aborts / 48 cascade | infrastructure |
| Rounding / interleaved | ~2 | between classes |
| **Total fail** | **46** | |
| **Did-not-run** | **48** | RTP-6 cascade |
| Skipped | 6 | test-level `.skip()` |
| Passed | 5 | |
| **Grand total** | **105** | admin ~104 + setup 1 |

## §BR-8.C.5 Reconciliation with §BR-5 register

§BR-5 admin forecast: **8 real fails, all timing-related** (3× ocra-adaptive-flow page.goto-45s + 3× stakeholder-demo page.goto-45s + 2× governance apiRequest-20s).

Batch C actual: **46 fails + 48 did-not-run**.

Delta explanation:
- Timing-only fails observed: 3 ocra + 2 governance = **5** (register said 3 + 2 = 5 in ocra+governance categories). Stakeholder-demo tests appear in the pass column here — some real fails likely hidden in cascade.
- The +41 additional real fails vs. forecast are ~32 authenticated-role-navigation RTP-1 (which cascade from `assertRoleLanding` helper's landing regex — the register classified these as "cascade" in Run 3 because §BR-3 blocked admin early). Under isolation, admin ran long enough to actually execute the `authenticated-role-navigation` loops and expose that they *also* fail the RTP-1 assertion.
- The 48 did-not-run recur under isolation — proof that admin project cannot fit inside a single fresh-server session on this hardware.

**Register must be updated in §BR-9** with admin's true failure surface: 46 real (mostly RTP-1) + 48 infra-cascade.

## §BR-8.C.6 §BR-6 acceptance-criteria audit

Per §BR-6.5:

1. **Lifecycle green** — 15/15 steps ok. ✅
2. **Playwright ran with only the requested projects** — filter=`setup, admin`. ✅
3. **Zero did-not-run** — **48 did-not-run**. ❌ **FAIL**
4. **Failure count within forecast envelope** — forecast 8, observed 46 (+38 drift). ❌ **FAIL**
5. **Signature classifiability** — 46/46 fails classified; 48/48 did-not-run classified. ✅

**Batch C fails §BR-6.5 acceptance criteria #3 and #4.** This is not a filter defect (Batch A/B passed cleanly on the same mechanism) — it is an intrinsic scale limit: admin's 104 specs cannot run in one fresh-server session.

## §BR-8.C.7 Non-negotiables audit

- ✅ No modification of `apps/union-eyes/e2e/**` specs.
- ✅ No modification of `apps/union-eyes/db/**`, migrations, `0008`.
- ✅ No new dependencies.
- ✅ No deploy, no merge, no force-push.
- ✅ Disposable DB dropped (`ue_e2e_20260724064034_14e83f`).
- ✅ Port 3002 released.
- ✅ Fresh dev-server booted (readyAfter=26 703 ms); auth states 5/5 fresh.
- ✅ `PLAYWRIGHT_PROJECTS` unset after batch.

## §BR-8.C.8 Handoff to Batch D + remediation options

### For §BR-10 remediation planning (out-of-scope for this batch)

Admin project needs finer-grained execution than "one batch = one project". Three candidates:

1. **Grep-based sub-batches**: `--grep '<pattern>'` inside admin to run half at a time; two governed runs C1/C2. Trades total wall clock for did-not-run=0.
2. **Server restart mid-project**: add a Playwright global setup hook that restarts Next.js after N tests. Bigger scope, changes shared infra.
3. **Migrate to `next start` production build**: eliminates dev-mode cold compile — largest scope, but resolves RTP-6/RTP-8 root cause holistically.

Deferred to §BR-10 planning per standing mandate; Batch C forensic **only classifies and continues**.

### Immediate next step

Proceed to **Batch D = `setup,security`** (7 specs, §BR-5 forecast 0 real fails, expected fast turnaround). Batch D validates that security project runs green under isolation — key for §BR-9 authoritative baseline.

Batches E and F similarly small and expected green:
- E = `setup,bilingual-en,bilingual-fr` (3 tests total per §13)
- F = `setup,accessibility` (5 tests per §14)

After D/E/F we have a complete per-project map and can plan the §BR-9 baseline strategy (likely will require admin split).
