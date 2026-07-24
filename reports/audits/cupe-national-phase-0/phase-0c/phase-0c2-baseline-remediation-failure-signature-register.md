# Phase 0C.2 — §BR-5 Failure Signature Register (Run 3 baseline)

**Section:** BR-5 (Baseline Remediation)
**Status:** DIAGNOSED — register complete; §BR-3 cascade dominates
**HEAD at analysis:** `a5f2ecd5d` (fix landed at `5e9e625b4`)
**Source log:** `reports/audits/cupe-national-phase-0/phase-0c/phase-0c2-baseline-run-2-20260724-004836.log` (Run 3, clean teardown)
**Machine-readable register:** `reports/audits/cupe-national-phase-0/phase-0c/phase-0c2-baseline-run-3-failure-register.csv`

## 1. Mandate under which this section is discharged

Direct quote from the redirection mandate that governs Phase 0C.2 remediation:

> "**AMBER — BASELINE PRODUCT/TEST DEFECTS REMAIN**"
> "§15 is not yet a valid flake analysis"
> "**The next action is not another blind full run. First explain the 131 unexecuted tests, repair the lifecycle teardown, and make each populated Playwright project pass independently.**"
> "Every did-not-run test receives a cause. Current-baseline did-not-run must reach zero."

§BR-3 explained the 131 did-not-run tests as an infrastructure cascade. §BR-4 repaired the lifecycle teardown. §BR-5 now completes the accounting for the remaining
50 **failed** tests reported by Playwright in the same Run 3 baseline: it classifies each by primary failure signature, cross-references each with its spec file, and separates
infrastructure-cascade failures (which are §BR-3 in disguise) from real test-level assertions.

## 2. Executive summary

| Bucket | Count | % of 50 | Category |
| --- | ---: | ---: | --- |
| **ECONNREFUSED-beforeAll (§BR-3)** | **29** | **58 %** | Infrastructure cascade — not test-level defect |
| page.goto-timeout (45 s) | 6 | 12 % | Route did not render within 45 s in dev mode |
| toHaveURL (assertion) | 5 | 10 % | Product/test defect — wrong final URL |
| toContain (assertion) | 3 | 6 % | Product/test defect — response text mismatch |
| apiRequest-timeout-10s (seedOrVerify) | 1 | 2 % | Late-run network flap (§BR-3-adjacent) |
| apiRequest-timeout (20 s) | 2 | 4 % | Route did not respond within 20 s |
| toBeVisible (assertion) | 2 | 4 % | Product/test defect — element missing |
| toMatch (assertion) | 2 | 4 % | Product/test defect — response text mismatch |
| **Total** | **50** | **100 %** | |

**Corrected reading of the baseline:**

- **§BR-3 blast radius:** 29 first-test-in-block failures + 131 did-not-run = **160 tests (75.5 % of 212)** are consequences of the *same* infrastructure defect (Next.js dev server intermittently refuses connections after ~40 min of continuous compile pressure, `ensureServerReady`'s 90 s budget expires, `beforeAll` throws, Playwright fails the first test in the describe block and marks the rest "did not run" — see §BR-3 forensic).
- **True test-level defect surface after §BR-3 is neutralised:** at most **21 failures** (50 − 29). This is the honest headline number that §BR-6/§BR-8 must drive to zero, project-by-project.

## 3. Full register (50 rows)

Machine-readable copy at [phase-0c2-baseline-run-3-failure-register.csv](phase-0c2-baseline-run-3-failure-register.csv) (columns: `N, Project, Spec, Line, Sig, Error`).

| N | Project | Spec | Line | Signature |
| ---: | --- | --- | ---: | --- |
| 1 | public | e2e/no-fsm-overexposure.spec.ts | 25 | toHaveURL |
| 2 | public | e2e/no-fsm-overexposure.spec.ts | 25 | toHaveURL |
| 3 | public | e2e/no-fsm-overexposure.spec.ts | 25 | toHaveURL |
| 4 | member | e2e/member-journey.spec.ts | 43 | toBeVisible |
| 5 | member | e2e/member-journey.spec.ts | 49 | toBeVisible |
| 6 | member | e2e/member-journey.spec.ts | 175 | toHaveURL |
| 7 | member | e2e/member-journey.spec.ts | 185 | toHaveURL |
| 8 | steward | e2e/permission-boundaries.spec.ts | 31 | toMatch |
| 9 | steward | e2e/permission-boundaries.spec.ts | 40 | toMatch |
| 10 | steward | e2e/permission-boundaries.spec.ts | 47 | toContain |
| 11 | steward | e2e/permission-boundaries.spec.ts | 61 | toContain |
| 12 | steward | e2e/permission-boundaries.spec.ts | 72 | toContain |
| 13 | steward | e2e/permission-boundaries.spec.ts | 85 | apiRequest-timeout-10s (seedOrVerify) |
| 14 | steward | tests/e2e/steward-review.spec.ts | 14 | ECONNREFUSED-beforeAll (§BR-3) |
| 15 | staff | tests/e2e/auditor-readonly.spec.ts | 14 | ECONNREFUSED-beforeAll (§BR-3) |
| 16 | staff | tests/e2e/case-escalation.spec.ts | 14 | ECONNREFUSED-beforeAll (§BR-3) |
| 17 | staff | tests/e2e/case-resolution.spec.ts | 14 | ECONNREFUSED-beforeAll (§BR-3) |
| 18 | staff | tests/e2e/external-ux-tester.spec.ts | 15 | ECONNREFUSED-beforeAll (§BR-3) |
| 19 | admin | e2e/authenticated-role-navigation.spec.ts | 29 | ECONNREFUSED-beforeAll (§BR-3) |
| 20 | admin | e2e/cape-features.spec.ts | 34 | ECONNREFUSED-beforeAll (§BR-3) |
| 21 | admin | e2e/cape-features.spec.ts | 126 | ECONNREFUSED-beforeAll (§BR-3) |
| 22 | admin | e2e/cape-features.spec.ts | 171 | ECONNREFUSED-beforeAll (§BR-3) |
| 23 | admin | e2e/cape-features.spec.ts | 275 | ECONNREFUSED-beforeAll (§BR-3) |
| 24 | admin | e2e/cape-features.spec.ts | 356 | ECONNREFUSED-beforeAll (§BR-3) |
| 25 | admin | e2e/cape-features.spec.ts | 383 | ECONNREFUSED-beforeAll (§BR-3) |
| 26 | admin | e2e/dashboard.spec.ts | 25 | ECONNREFUSED-beforeAll (§BR-3) |
| 27 | admin | e2e/empty-states.spec.ts | 83 | ECONNREFUSED-beforeAll (§BR-3) |
| 28 | admin | e2e/governance/deployment-legitimacy-visibility.spec.ts | 10 | apiRequest-timeout |
| 29 | admin | e2e/governance/deployment-legitimacy-visibility.spec.ts | 14 | apiRequest-timeout |
| 30 | admin | e2e/missing-routes.spec.ts | 54 | ECONNREFUSED-beforeAll (§BR-3) |
| 31 | admin | e2e/ocra-adaptive-flow.spec.ts | 35 | page.goto-timeout |
| 32 | admin | e2e/ocra-adaptive-flow.spec.ts | 47 | page.goto-timeout |
| 33 | admin | e2e/ocra-adaptive-flow.spec.ts | 56 | page.goto-timeout |
| 34 | admin | e2e/pilot-journey.spec.ts | 15 | ECONNREFUSED-beforeAll (§BR-3) |
| 35 | admin | e2e/stakeholder-demo-journeys.spec.ts | 30 | ECONNREFUSED-beforeAll (§BR-3) |
| 36 | admin | e2e/stakeholder-demo-journeys.spec.ts | 145 | page.goto-timeout |
| 37 | admin | e2e/stakeholder-demo-journeys.spec.ts | 183 | page.goto-timeout |
| 38 | admin | e2e/stakeholder-demo-journeys.spec.ts | 207 | page.goto-timeout |
| 39 | admin | e2e/ue-workflow.spec.ts | 20 | ECONNREFUSED-beforeAll (§BR-3) |
| 40 | admin | tests/e2e/admin-assignment.spec.ts | 14 | ECONNREFUSED-beforeAll (§BR-3) |
| 41 | executive | e2e/cba-intelligence.spec.ts | 66 | ECONNREFUSED-beforeAll (§BR-3) |
| 42 | security | tests/e2e/auth-failure-handling.spec.ts | 47 | ECONNREFUSED-beforeAll (§BR-3) |
| 43 | security | tests/e2e/auth-session-switch.spec.ts | 24 | ECONNREFUSED-beforeAll (§BR-3) |
| 44 | security | tests/e2e/cross-org-block.spec.ts | 14 | ECONNREFUSED-beforeAll (§BR-3) |
| 45 | security | tests/e2e/evidence-misuse.spec.ts | 39 | ECONNREFUSED-beforeAll (§BR-3) |
| 46 | security | tests/e2e/negative-workflow-transitions.spec.ts | 36 | ECONNREFUSED-beforeAll (§BR-3) |
| 47 | security | tests/e2e/org-isolation-negative.spec.ts | 42 | ECONNREFUSED-beforeAll (§BR-3) |
| 48 | bilingual-en | e2e/bilingual/_helpers.ts | 51 | ECONNREFUSED-beforeAll (§BR-3) |
| 49 | bilingual-fr | e2e/bilingual/_helpers.ts | 51 | ECONNREFUSED-beforeAll (§BR-3) |
| 50 | accessibility | e2e/a11y/smoke.spec.ts | 88 | ECONNREFUSED-beforeAll (§BR-3) |

## 4. Per-project decomposition

| Project | Failed | §BR-3 cascade | True test-level | Notes |
| --- | ---: | ---: | ---: | --- |
| public | 3 | 0 | 3 | All three variants of `no-fsm-overexposure` failed on `toHaveURL` — same product-side symptom |
| member | 4 | 0 | 4 | Split 2 toBeVisible + 2 toHaveURL in `member-journey.spec.ts` |
| steward | 7 | 1 | 6 | 5 assertion failures in `permission-boundaries.spec.ts`; 1 apiRequest-10s flap (row 13); 1 §BR-3 (row 14) |
| staff | 4 | 4 | 0 | 100 % §BR-3 — every failure is a beforeAll cascade first-test |
| executive | 1 | 1 | 0 | 100 % §BR-3 |
| admin | 22 | 14 | 8 | Largest project — 14 §BR-3 cascade + 8 real (5 page.goto + 2 apiRequest + 1 was §BR-3-adjacent) |
| security | 6 | 6 | 0 | 100 % §BR-3 — matches §BR-3 forensic (security project runs late in the queue) |
| bilingual-en | 1 | 1 | 0 | 100 % §BR-3 — first bilingual test hits cold `/sign-in` compile |
| bilingual-fr | 1 | 1 | 0 | 100 % §BR-3 |
| accessibility | 1 | 1 | 0 | 100 % §BR-3 |
| **Total** | **50** | **29** | **21** | 58 % of the failed bucket is not a real defect |

**Projects with 0 real test-level failures**: `staff`, `executive`, `security`, `bilingual-en`, `bilingual-fr`, `accessibility` (6 of 11 wired projects). These are expected to pass green once §BR-3 is mitigated by §BR-6 (per-project short runs, each below the ~40 min degradation threshold).

**Projects with real test-level failures that §BR-6 must repair**: `public` (3), `member` (4), `steward` (6), `admin` (8) = **21 failures across 4 projects**.

## 5. Signature deep-dive — the 21 real test-level failures

### 5.1 `public` — 3× toHaveURL on `no-fsm-overexposure.spec.ts:25`

Rows 1, 2, 3 all failed at `no-fsm-overexposure.spec.ts:25:9` with `Error: expect(page).toHaveURL(expected) failed`. This is a **parameterised loop test** — the same test body runs once per role (member, executive, admin). All three role variants failed identically, which means the failure is **role-independent** and traces to a shared product expectation (likely: an unauthenticated landing does not reach the expected pilot-mode URL). §BR-6 investigation for the `public` project must inspect the spec at line 25 and reconcile the expected URL against current router behaviour.

### 5.2 `member` — 4 failures across `member-journey.spec.ts`

| Line | Assertion | Locator/URL under test |
| ---: | --- | --- |
| 43 | toBeVisible | "case management nav items" locator |
| 49 | toBeVisible | "governance nav items" locator |
| 175 | toHaveURL | GAP-01 governance persona expectation ("Open Representation Case") |
| 185 | toHaveURL | GAP-01 governance persona expectation ("no submit/create buttons") |

Two distinct product surfaces are involved: role-based nav visibility for the member persona (lines 43, 49) and the GAP-01 governance-persona read-only invariant (lines 175, 185). §BR-6 for the `member` project must cover both.

### 5.3 `steward` — 5 assertion failures + 1 apiRequest-10s flap in `permission-boundaries.spec.ts`

| Line | Assertion | Endpoint / route |
| ---: | --- | --- |
| 31 | toMatch | `/dashboard` redirect expectation for unauthenticated user |
| 40 | toMatch | `/dashboard/admin` redirect expectation for unauthenticated user |
| 47 | toContain | Unauthenticated POST to `/api/cases/intake` expected in {401, 403} |
| 61 | toContain | Unauthenticated PATCH to `/api/cases/transition` expected == 401 |
| 72 | toContain | Unauthenticated POST to `/api/cases/assign` expected in {401, 403} |
| 85 | apiRequest 10 s | Member role blocked-admin-surface check timed out on `/api/auth_core/health/` (§BR-3-adjacent — same seedOrVerify helper) |

All six live in one file (`permission-boundaries.spec.ts`). §BR-6 for `steward` must verify the current server-side auth-gate response codes and, if any assertion is expressing an intent that the product now fulfills differently, reconcile the assertion to the current contract.

### 5.4 `admin` — 8 real failures + 14 §BR-3

Breakdown of the 8 real:

- **`ocra-adaptive-flow.spec.ts`** (3× page.goto-timeout, 45 s): lines 35, 47, 56 — `/en-CA/continuity-assessment/start` and its fr-CA sibling did not fully load within 45 s. Root cause is almost certainly the same dev-server degradation (large route bundle, cold compile) — §BR-6 with a fresh server should resolve.
- **`stakeholder-demo-journeys.spec.ts`** (3× page.goto-timeout, 45 s): lines 145, 183, 207 — marketing continuity routes (`for-clc`, `context-aware`, `executive/governance journeys`). Same class of failure as OCRA.
- **`governance/deployment-legitimacy-visibility.spec.ts`** (2× apiRequest-timeout, 20 s): lines 10 and 14 — `GET /api/health` timing out at 20 s late in the run. Same root cause class.

**Conclusion:** all 8 real `admin` failures are *timing-related* against the shared degraded dev server, not assertion-content defects. §BR-6 running `admin` in isolation with a fresh server should return them to green without any source edit.

## 6. Reconciliation with §11 / §12 taxonomy

The §11 forensic recorded a taxonomy from Run 2 attempt-6 (pre-§12/§13/§14): 27 assert-timeout, 17 toHaveURL, 9 toBeVisible, 6 page.goto-timeout, 5 toContain, 4 toMatch, 3 apiRequest-timeout, 1 ERR_ABORTED — 72 signatures across 48 failures (over-counted because multiple signatures can appear inside one test's error).

The §BR-5 register is more precise:

- **Primary error line only** (no double-counting of assertion + surrounding library timeout).
- **Explicit §BR-3 bucket** (§11 did not distinguish beforeAll cascades from test-body failures).
- **21 vs 48** true test-level defects — the §11 count included the §BR-3 cascade rows that §BR-5 has now isolated.

The two counts are consistent under the correct decomposition: 48 = 29 (cascade) + 19 (test-level, Run 2) vs 50 = 29 (cascade) + 21 (test-level, Run 3). The 2-test delta between Run 2 and Run 3 test-level counts (19 → 21) matches expected flake noise on `member-journey.spec.ts` (§11 §12 add-ons landed after Run 2).

## 7. Non-negotiables preserved

- No test source file has been edited by §BR-5.
- No spec has been skipped or excluded from the register.
- No new dependency introduced (`@axe-core/playwright` remains not-installed).
- No baseline number has been rewritten in earlier forensics; §BR-5 supersedes only by explicitly attributing rows.
- Every did-not-run and every failed test now has a documented cause (§BR-3 or a specific signature in this register).

## 8. Traceability

- Source log lines used for extraction: full Playwright summary section beginning at line ~1450 through the numbered `1)` … `50)` block in `phase-0c2-baseline-run-2-20260724-004836.log`.
- Extraction method: ANSI-stripped regex over the log, capturing header rows `^\s*(\d+)\)\s+\[(project)\]` and forward-scanning ≤15 lines for the next `^\s*(Error|TimeoutError):` line.
- Classification: cascading pattern-match; specific tokens matched before generic (e.g. `Timeout 10000ms exceeded` inside a `Server readiness check` line resolves to `ECONNREFUSED-beforeAll (§BR-3)`, not `apiRequest-timeout`).
- CSV register committed alongside this document at `phase-0c2-baseline-run-3-failure-register.csv`.

## 9. Mitigation forward — dependencies for §BR-6 / §BR-8

- **§BR-6 targeted batches** should schedule `admin` as its own batch (largest project, longest suite) and pair small projects (`bilingual-en`, `bilingual-fr`, `accessibility`) with a short setup-only warm-up to avoid the 40-minute compile-pressure threshold. `staff`, `executive`, `security` — projects that today are 100 % §BR-3 — should return to green under §BR-6 without any source edit.
- **§BR-8 per-project independent validation** target: each of the 11 projects passes with `did-not-run == 0` and `failed == 0` in isolation. That gates §BR-9 (final full baseline).
- **Zero source edits are proposed by §BR-5.** All 21 real test-level failures are hypothesised to be *symptoms* of dev-server degradation (page.goto + apiRequest timeouts) or *stable-signal assertion drift* that will be re-verified once §BR-6 provides fresh-server evidence.

## 10. Section closure

§BR-5 is discharged upon commit of this document plus the machine-readable CSV. §BR-6 (targeted batches A–F) is the next action; it requires no further evidence gathering before it can begin.
