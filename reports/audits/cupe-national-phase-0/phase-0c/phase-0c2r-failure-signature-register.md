# Phase 0C.2R §7 — Exact failure-signature register (by TRUE root cause)

**Author:** Phase 0C.2R execution  
**Ground truth:** [phase-0c2r-run3-failures.json](phase-0c2r-run3-failures.json) (50-entry Run 3 extraction from `apps/union-eyes/playwright-report/data/*.md`)  
**Baseline:** §BR-9 Run 3 (`20260724094416_90145a`, 2026-07-24 09:44→10:46 UTC, HEAD `eaab6c62a`)  
**Total classified:** 50 / 50 (0 unclassified)  
**Supersedes:** [phase-0c2-baseline-remediation-failure-signature-register.md](phase-0c2-baseline-remediation-failure-signature-register.md) (RTP-1…RTP-11 — grouped by spec file, mixed root causes into single tags, over-attributed failure counts to admin-project cascade).

---

## §7.1 Why the prior register was invalid

Six defects in RTP-1…RTP-11:

| # | Defect | Consequence |
| - | - | - |
| 1 | Grouped by **spec file**, not **failure signature** | RTP-1 "helpers.ts:99 toHaveURL landing" absorbed 13 failures across specs with unrelated errors. |
| 2 | Treated `ensureServerReady` cascade as a **project-scoped** signature (RTP-6, "admin only") | Run 3 has 30 helper-timeout failures across **29 distinct specs in 8 projects** — the pattern is cross-project, not admin-only. |
| 3 | Merged product/spec drift (RTP-10 bilingual) with routing bugs and timing timeouts under undifferentiated headings | Repair strategy could not target the right layer. |
| 4 | Anchored RTP-7 to a **helper line number** (`helpers.ts:99`) never confirmed present in current source | RTP-7 was reserved but never materialised — dead register slot. |
| 5 | Cited counts from **§BR-8 filtered batches** as if they were baseline observations | The 13 RTP-1 sightings came from Batch A + B (project-filtered runs), not from a full baseline. |
| 6 | Concluded from these tainted counts that admin exclusion was "structurally infeasible" | This is the illegitimate conclusion Aubert rejected in §BR-10R. |

The rebuild below fixes all six defects.

---

## §7.2 Rebuilt taxonomy (Run 3, all 50 failures)

Signatures are named **`FSR-<letter>` = Failure Signature Register**, keyed by root-cause bucket letter matching [phase-0c2r-three-run-reconciliation.md §3.2](phase-0c2r-three-run-reconciliation.md#32-run-3-failures-bucketed).

| ID | Root cause | Count | % | Fix layer | Section |
| - | - | -:| -:| - | - |
| FSR-A | `ensureServerReady` helper 90s budget exhausted (per-request 10s × 3 endpoints × iterations) | **30** | 60.0% | test helper (`_helpers.ts:9-46`) | §8 (helper), §14 (per-project) |
| FSR-B | `page.goto` 45s navigation timeout on 2 route bundles | 6 | 12.0% | Next.js dev-mode compile / config `navigationTimeout` | §6 execution mode / §10 spec batches |
| FSR-C | `expect(page).toHaveURL(pattern)` failed after login redirect | 5 | 10.0% | product routing OR spec assertion | §8 auth/landing / §11 assertion review |
| FSR-D | `expect(locator).toBeVisible()` failed on nav aside | 2 | 4.0% | product markup OR persona bootstrap | §8 auth/landing |
| FSR-E | `expect(body).toContain(...)` failed on API 4xx envelope | 2 | 4.0% | route handler status shape | §11 security runtime |
| FSR-F | `expect(url).toMatch(...)` failed on unauth redirect | 2 | 4.0% | product routing (unauth destination) | §11 security runtime |
| FSR-G | `apiRequestContext.get: Timeout 20000ms` on `/api/health` | 2 | 4.0% | route perf under load OR spec timeout | §11 security runtime |
| FSR-H | `apiRequestContext.post: Timeout 20000ms` on `/api/cases/assign` | 1 | 2.0% | route perf under load OR spec timeout | §11 security runtime |
| — | **TOTAL** | **50** | **100.0%** | — | — |

---

## §7.3 FSR-A — `ensureServerReady` helper 90s budget exhausted

**Signature:** `[ue:e2e] Server readiness check timed out after 90000ms (apiRequestContext.get: Timeout 10000ms exceeded.`  
**Source location:** [apps/union-eyes/tests/e2e/_helpers.ts](../../../../apps/union-eyes/tests/e2e/_helpers.ts) lines 9-46  
**Mechanism:** Helper polls three endpoints (`/api/auth_core/health/`, `/api/health`, `/sign-in`) with `timeout: 10_000` per request and `pollMs: 1_500`. Total helper budget = `90_000` ms. The enclosing test wrapper sets `test.setTimeout(180_000)` (§12 hardening) — so the helper has **90 s of unused headroom** relative to the caller's ceiling. When Next.js dev-mode compile of `/sign-in` (SSR + auth pipeline) exceeds ~60-80 s in aggregate polling, the helper aborts inside its own budget before hitting the caller's 180 s cap.  
**Blast radius (30 failures across 29 unique specs, 8 projects):**

| Spec (top of describe) | Line | Project(s) |
| - | -:| - |
| `e2e/a11y/smoke.spec.ts` | 88:7 | accessibility |
| `e2e/authenticated-role-navigation.spec.ts` | 29:9 | member/steward/staff/executive/admin (loop) |
| `e2e/bilingual/_helpers.ts` | 51:9 | bilingual-en, bilingual-fr |
| `e2e/cape-features.spec.ts` | 34, 126, 171, 275, 356, 383 | steward |
| `e2e/cba-intelligence.spec.ts` | 66:7 | steward |
| `e2e/dashboard.spec.ts` | 25:7 | member |
| `e2e/empty-states.spec.ts` | 83:7 | member |
| `e2e/missing-routes.spec.ts` | 54:7 | admin |
| `e2e/permission-boundaries.spec.ts` | 85:9 | admin (blocked-surface test) |
| `e2e/pilot-journey.spec.ts` | 15:7 | member |
| `e2e/stakeholder-demo-journeys.spec.ts` | 30:7 | admin |
| `e2e/ue-workflow.spec.ts` | 20:7 | admin |
| `tests/e2e/admin-assignment.spec.ts` | 14:7 | admin |
| `tests/e2e/auditor-readonly.spec.ts` | 14:7 | security |
| `tests/e2e/auth-failure-handling.spec.ts` | 47:7 | security |
| `tests/e2e/auth-session-switch.spec.ts` | 24:7 | security |
| `tests/e2e/case-escalation.spec.ts` | 14:7 | admin |
| `tests/e2e/case-resolution.spec.ts` | 14:7 | admin |
| `tests/e2e/cross-org-block.spec.ts` | 14:7 | security |
| `tests/e2e/evidence-misuse.spec.ts` | 39:7 | security |
| `tests/e2e/external-ux-tester.spec.ts` | 15:7 | security |
| `tests/e2e/negative-workflow-transitions.spec.ts` | 36:7 | security |
| `tests/e2e/org-isolation-negative.spec.ts` | 42:7 | security |
| `tests/e2e/steward-review.spec.ts` | 14:7 | steward |

**Repair strategy (§8):**
1. Raise `timeoutMs` from `90_000` to `180_000` (match enclosing `test.setTimeout(180_000)`).
2. Raise per-request `timeout` from `10_000` to `30_000` (accommodate cold-compile bursts on `/sign-in`).
3. Add regression guard test verifying the two constants.
4. Re-verify via full baseline that count drops from **30 → ≤ 5** (residual = specs where the underlying failure is NOT the helper — must be re-classified into FSR-B…H).

**Do NOT:**
- Skip these specs.
- Exclude the affected projects from the baseline.
- Retry the helper more than once (masking a real defect).
- Increase the enclosing `test.setTimeout` beyond 180 s (would balloon overall run time without improving signal).

---

## §7.4 FSR-B — `page.goto` 45 s navigation timeout

**Signature:** `TimeoutError: page.goto: Timeout 45000ms exceeded.`  
**Config source:** [apps/union-eyes/playwright.config.ts](../../../../apps/union-eyes/playwright.config.ts) line 158 (`navigationTimeout: 45_000`).  
**Blast radius (6 failures, 2 spec files):**

| Spec | Line | Route hit | Note |
| - | -:| - | - |
| `e2e/ocra-adaptive-flow.spec.ts` | 35, 47, 56 | `ASSESSMENT_PATH` (`/continuity-assessment/start`) | Large route bundle, dev-mode cold compile |
| `e2e/stakeholder-demo-journeys.spec.ts` | 145, 183, 207 | Multiple marketing→app continuity routes | Dev-mode cold compile after long-running admin project |

**Repair strategy (§10 batches + §6 execution mode):**
1. First: re-measure after FSR-A helper repair (many of these will disappear because they immediately follow a spec that currently blows the helper budget and leaves the dev server in a slow state).
2. If residual: prove/refute the dev-mode structural claim in §6 by rerunning under `next start` (production build) with the exact same specs. If prod-mode passes cleanly, the fix is execution-mode; if not, the fix is at the spec level (increase per-`goto` timeout with justification, or split route bundle).
3. Do NOT unconditionally raise `navigationTimeout` — that hides the real product signal.

---

## §7.5 FSR-C — `expect(page).toHaveURL(...)` failed

**Signature:** `Error: expect(page).toHaveURL(expected) failed`  
**Blast radius (5 failures, 2 spec files):**

| Spec | Line | Assertion | Persona |
| - | -:| - | - |
| `e2e/no-fsm-overexposure.spec.ts` | 25 (×3) | Post-login URL contains role-specific dashboard | admin / member / (third role — from loop) |
| `e2e/member-journey.spec.ts` | 175, 185 | Governance persona destination | governance |

**Repair strategy (§8 auth/landing per persona):**
1. Verify the login-redirect chain per persona (member/steward/staff/executive/admin/governance) in current product source.
2. Determine whether each failure is: (a) the product routing is wrong (product bug), (b) the spec expectation is stale (spec bug), or (c) a race with the auth-state cookie apply (timing bug).
3. Repair at the correct layer; regression-guard the fix.

---

## §7.6 FSR-D — `expect(locator).toBeVisible()` failed on nav aside

**Signature:** `Error: expect(locator).toBeVisible() failed Locator: locator('aside nav').first() Expected: visible`  
**Blast radius (2 failures, 1 spec file):**

| Spec | Line | Detail |
| - | -:| - |
| `e2e/member-journey.spec.ts` | 43 | member: governance nav items not visible (invariant assertion — nav should exist) |
| `e2e/member-journey.spec.ts` | 49 | member: case-management nav items not visible |

**Repair strategy (§8):** verify current member layout renders `aside nav` unconditionally. If layout was refactored, update spec anchor; if regression, repair layout.

---

## §7.7 FSR-E / FSR-F — Permission-boundaries assertion drift

| ID | Signature | Line | Detail |
| - | - | -:| - |
| FSR-E | `expect([401,403]).toContain(response.status())` on `POST /api/cases/intake` | permission-boundaries.spec.ts:47 | Unauth POST expected 401/403 — got other |
| FSR-E | `expect([401,403]).toContain(response.status())` on `PATCH /api/cases/transition` | permission-boundaries.spec.ts:61 | Unauth PATCH — same |
| FSR-F | `expect(url).toMatch(/sign-in\|login\|signup/)` after visiting `/dashboard` unauth | permission-boundaries.spec.ts:31 | Redirect target regex fails |
| FSR-F | Same, `/dashboard/admin` unauth | permission-boundaries.spec.ts:40 | Redirect target regex fails |

**Repair strategy (§11):** verify the current unauth-guard middleware for these routes. Either the guard is missing/mis-wired (product bug) or the spec's expected redirect regex is out of date (spec bug). Both are legitimate outcomes; repair at the correct layer.

---

## §7.8 FSR-G — `/api/health` slow

**Signature:** `TimeoutError: apiRequestContext.get: Timeout 20000ms exceeded.` on `/api/health`  
**Blast radius (2 failures, 1 spec file):**

| Spec | Line | Detail |
| - | -:| - |
| `e2e/governance/deployment-legitimacy-visibility.spec.ts` | 10, 14 | `health endpoint exposes release identity governance headers` |

**Repair strategy (§11):** measure `/api/health` p95 under Playwright load in current build. If handler is legitimately slow (DB probe, external check), either add caching or raise the spec's request timeout; if intermittent, treat as flake pending §16 flake analysis.

---

## §7.9 FSR-H — `/api/cases/assign` POST slow

**Signature:** `TimeoutError: apiRequestContext.post: Timeout 20000ms exceeded.`  
**Blast radius (1 failure):**

| Spec | Line | Detail |
| - | -:| - |
| `e2e/permission-boundaries.spec.ts` | 72 | Unauth POST to `/api/cases/assign` expected 401/403 |

**Repair strategy (§11):** identical to FSR-G — measure route perf, decide layer.

---

## §7.10 What this register does NOT do

- It does not yet cover **131-132 did-not-run** executions. Those are documented separately in §4 (DNR register) and are structurally distinct from the 50 failures — they need per-execution accounting, not signature bucketing.
- It does not draw flake conclusions. Runs 1-2 preserved no per-test artefacts, so cross-run flake vs deterministic classification requires §16 (three fresh green-comparable runs after §8 helper repair).
- It does not exclude the administrator project. All admin failures above remain in scope.
- It does not attempt a fix count promise. The FSR-A repair is expected to convert ~30 failures — but the observed drop must be measured empirically after §8, not assumed.

---

## §7.11 Governance

- Prior file `phase-0c2-baseline-remediation-failure-signature-register.md` is preserved as historical evidence and cited above as the invalid predecessor. It is **not** deleted.
- Machine-readable ground truth: `phase-0c2r-run3-failures.json` (committed alongside).
- Any future baseline run with a JSON reporter (§3.1) can regenerate the same bucketing with the same script; the taxonomy is reproducible.

**End of §7 rebuilt signature register.**
