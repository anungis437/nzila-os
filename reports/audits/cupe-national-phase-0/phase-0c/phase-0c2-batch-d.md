# Phase 0C.2 — §BR-8 Batch D forensic (setup + security)

Status: **Green — 33/33 tests passed, exit=0, all 15 lifecycle steps clean.**
Section: §BR-8 (per-project independent validation)
Batch: D = `PLAYWRIGHT_PROJECTS=setup,security`
Run ID: `20260724071857_662b68`
Log: `reports/audits/cupe-national-phase-0/phase-0c/phase-0c2-batch-d.log` (13 074 bytes)
Summary: `reports/audits/cupe-national-phase-0/phase-0c/run-artifacts/20260724071857_662b68/run-summary.json`
Total elapsed: 128 seconds (07:18:57 → 07:21:00 local) — playwright wall clock 72 667 ms (1.2 min).

## §BR-8.D.1 Executive verdict

Batch D is the **first fully-green §BR-8 batch**. All 33 tests passed (1 setup + 32 security), all 15 lifecycle steps completed cleanly, disposable DB dropped, port released. No did-not-run, no cascade, no timeouts. §BR-5 forecast (0 real fails for security) is validated exactly.

This confirms that the security project's cross-org / negative-auth suite runs deterministically under §BR-6 governed isolation. The §12 `ensureServerReady 180 s` hook budget successfully absorbs the cold `/sign-in` compile that used to defeat security tests in the full baseline (position 162/193, ~40 min mark, per §BR-3 forensic).

## §BR-8.D.2 Lifecycle step evidence

| # | Step | Outcome | Elapsed | Detail |
|---|------|---------|---------|--------|
| 1 | preflight | ok | — | node=v24.13.1, port 3002 free |
| 2 | allocate-db | ok | 3 666 ms | db=`ue_e2e_20260724071857_662b68` |
| 3 | allocate-port | ok | — | port=3002 |
| 4 | migrations.platform | ok | — | drizzle bootstrap |
| 5 | migrations.django | skipped | — | not required |
| 6 | verify-phase0b-contract | ok | — | organization_members present |
| 7 | seed | ok | — | seed-test-env applied |
| 8 | boot-server | ok | 28 377 ms | pid=51256 readyAfter=27 078 ms handshakeRunId=`20260724071857_662b68` |
| 9 | generate-auth-states | ok | 6 926 ms | 5 roles allOk=true |
| 10 | playwright | ok | 72 667 ms | **exitCode=0** projects=[setup,security] |
| 11 | collect-artifacts | ok | 16 ms | playwright-report, test-results, server.log |
| 12 | stop-server | ok | — | method=sigterm |
| 13 | drop-db | ok | — | `ue_e2e_20260724071857_662b68` |
| 14 | verify-port-release | ok | — | port 3002 released |
| 15 | finalize | ok | — | summary written |

Filter proof: `exitCode=0 projects=[setup,security]` in step 10 detail.

## §BR-8.D.3 Playwright test-level results

| Category | Count |
|---|---|
| Total tests executed | 33 |
| **Passed** | **33** |
| Failed | 0 |
| Skipped | 0 |
| Did-not-run | 0 |

Test roster (33 tests across 6 security specs + 1 setup):

1. **setup** (1 test): `playwright/setup/auth-state.setup.ts` — auth-state precondition verify.
2. **cross-org-block.spec.ts** — cross-org access denied.
3. **org-isolation-negative.spec.ts** (8 tests) — wrong-org user cannot lookup grievance / view documents / export evidence / universal search / dashboard metrics / audit log / workbench case list / workflow transition.
4. **evidence-misuse.spec.ts** — evidence misuse guards.
5. **auth-failure-handling.spec.ts** — auth failure surfaces.
6. **auth-session-switch.spec.ts** — session-switch invariants.
7. **negative-workflow-transitions.spec.ts** (multi-test) — FSM invariant negatives (member cannot self-approve / cannot direct-close / re-submitting a resolved case / unauthorized user).

Playwright summary line (verbatim from log): `33 passed (1.2m)`.

## §BR-8.D.4 Reconciliation with §BR-5 register

§BR-5 security forecast: **0 real fails** (all 6 security fails in Baseline Run 3 were §BR-3 cascade attributed to the cold `/sign-in` compile, not test-level defects).

Batch D actual: **0 real fails.** Forecast exact.

Register class RTP-6 / §BR-3-in-security recurrence: not observed — the §12 `test.setTimeout(180_000)` hardening plus fresh dev-server-per-batch isolation eliminates the cascade for this project. Security ran at position 2/33 (immediately after setup) instead of position 162/193 in the full baseline, and every navigation went through a warm-compile server.

## §BR-8.D.5 §BR-6 acceptance-criteria audit

Per §BR-6.5:

1. **Lifecycle green** — 15/15 steps ok. ✅
2. **Playwright ran with only the requested projects** — filter=`setup, security`. ✅
3. **Zero did-not-run** — 0 did-not-run. ✅
4. **Failure count within forecast envelope** — forecast 0, observed 0. ✅
5. **Signature classifiability** — 0 fails, N/A. ✅

**All five criteria pass. Batch D is authoritative green.**

## §BR-8.D.6 Non-negotiables audit

- ✅ No modification of `apps/union-eyes/e2e/**` specs.
- ✅ No modification of `apps/union-eyes/db/**`, migrations, `0008`.
- ✅ No new dependencies.
- ✅ No deploy, no merge, no force-push.
- ✅ Disposable DB dropped (`ue_e2e_20260724071857_662b68`).
- ✅ Port 3002 released.
- ✅ Fresh dev-server booted (readyAfter=27 078 ms); auth states 5/5 fresh.
- ✅ `PLAYWRIGHT_PROJECTS` unset after batch.

## §BR-8.D.7 Signature roll-up

None — Batch D produced zero failures. Signature register unchanged after Batch D.

## §BR-8.D.8 Handoff to Batch E

Proceed to **Batch E = `setup,bilingual-en,bilingual-fr`** (§13 populated these projects). §BR-9 inventory says 3 tests total (bilingual-en: 3 registered as glob-empty per §BR-9 note — actually 7 per locale × 2 = 14). §BR-5 forecast 0 real fails.

Expected duration: comparable to Batch D (~2-3 min). Batch E validates §13 bilingual smoke suite end-to-end under governed lifecycle.
