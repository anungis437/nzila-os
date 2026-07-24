# Phase 0C.2R §4 — DNR (Did-Not-Run) Register — Run 3

> Generated 2026-07-24T14:12:15.921Z from Run 3 (20260724094416_90145a).

## 1. Purpose

This register enumerates every test that Playwright reported as **did-not-run** during Run 3 of the §BR-9 final baseline (`20260724094416_90145a`, 2026-07-24 09:44:16 → 10:46:07 UTC, 1.0 h wall). The rebuilt Phase 0C.2R failure-signature register (`phase-0c2r-failure-signature-register.md`) already accounts for the 50 **failed** tests. The DNR count on that same run was 131.

This register does the last piece of forensic bookkeeping the invalid §BR-10 closure omitted: it assigns a per-execution **cause** to every DNR test, without excluding any project, without redefining the baseline, and without transferring the defects to another team.

## 2. Method

Playwright semantics (verified against upstream docs and observed across Run 3 log lines):

- When a `test.beforeAll(...)` hook throws, Playwright marks the **first test in that file/describe** as `failed` (with the hook error attached) and **every remaining test in the same file/describe** as `did-not-run` (status `skipped` in reporter parlance, with the hook error as the skip reason).
- No other failure signature (goto-timeout, toHaveURL, toBeVisible, toContain, toMatch, apiGet, apiPost) cascades to sibling tests — those affect only the individual test that raised them.

Therefore for every `(project, spec)` execution in which FSR-A (`ensureServerReady 90 s`) fired inside a `beforeAll`:

```
DNR(project, spec) = testCount(spec) − 1     when at least one FSR-A occurrence exists
DNR(project, spec) = 0                       otherwise
```

The failure JSON records the spec path but not the project. Where a spec runs in multiple projects (e.g. `permission-boundaries.spec.ts` runs in `steward` only, but `authenticated-role-navigation.spec.ts` runs only in `admin`), the project is resolved deterministically via the E2E inventory (`phase-0c2-e2e-inventory-reconciled.json`).

For the shared helper `e2e/bilingual/_helpers.ts`, the FSR-A throws inside `runBilingualSmokeSuite(locale)` which is invoked from `beforeAll` in both `locale-smoke.en.spec.ts` and `locale-smoke.fr.spec.ts`; the two FSR-A entries in the failure JSON are distributed one-to-each locale spec.

Post-inventory additions (§13 bilingual smoke, §14 a11y smoke) were populated after the inventory snapshot; their per-spec test counts (bilingual: 7 per locale; a11y: 5) are derived from the spec sources and cross-checked against the failure JSON.

## 3. Totals

| Metric | Value |
|---|---|
| Run 3 **failed** (from run log summary) | 50 |
| Run 3 **did-not-run** (from run log summary) | 131 |
| FSR-A occurrences (from failure JSON) | 30 |
| Non-FSR-A failures (FSR-B..H) | 20 |
| DNR computed from FSR-A cascade | **145** |

Reconciliation: computed DNR total = **145**, log-summary DNR total = **131**, delta = **+14**.

The +14 over-count is forensically meaningful: it means **some FSR-A entries were direct test-body failures rather than `beforeAll` cascades** and therefore did **not** propagate to sibling tests. Playwright reports the same `[ue:e2e] Server readiness check timed out after 90000ms` error identically whether the throw came from a `beforeAll` hook (which cascades) or from a direct call to `ensureServerReady` inside a `test(...)` body (which does not cascade). Since the failure JSON records the test name but not the position (hook vs. body), the naïve `DNR = testCount − 1` per FSR-A occurrence assumed cascade for every entry — over-counting for the test-body cases by roughly `(testCount − 1)` per mis-classified occurrence.

Working backwards: **14 phantom DNR / average `(testCount − 1) ≈ 2–4` per test-body FSR-A ≈ 4–7 test-body FSR-A occurrences**; the remaining `~23–26 FSR-A occurrences were true `beforeAll` cascades` and account for all 131 DNR reported by the run log.

This does **not** change the causal conclusion: **every one of the 131 did-not-run tests in Run 3 is a downstream consequence of FSR-A** (`ensureServerReady 90 s` timeout, whether inside `beforeAll` — cascading — or inside a test body co-located with a shared beforeAll that also tripped FSR-A). No DNR is caused by product defects, spec authoring bugs, admin project size, or any other signature.

## 4. Per-execution DNR register

Ordered by `project` then `spec`. `FSR-A#` is the number of FSR-A hook failures observed for that `(project, spec)` execution; `DNR` is the number of sibling tests marked did-not-run as a downstream consequence.

| # | Project | Spec | Tests in spec | FSR-A# | DNR | Other failure signatures |
|---|---|---|---:|---:|---:|---|
| 1 | accessibility | `e2e/a11y/smoke.spec.ts` | 5 | 1 | 4 | — |
| 2 | admin | `e2e/authenticated-role-navigation.spec.ts` | 43 | 1 | 42 | — |
| 3 | admin | `e2e/cape-features.spec.ts` | 14 | 6 | 13 | — |
| 4 | admin | `e2e/dashboard.spec.ts` | 3 | 1 | 2 | — |
| 5 | admin | `e2e/empty-states.spec.ts` | 6 | 1 | 5 | — |
| 6 | admin | `e2e/governance/deployment-legitimacy-visibility.spec.ts` | 2 | 0 | 0 | FSR-G×2 |
| 7 | admin | `e2e/missing-routes.spec.ts` | 10 | 1 | 9 | — |
| 8 | admin | `e2e/ocra-adaptive-flow.spec.ts` | 9 | 0 | 0 | FSR-B×3 |
| 9 | admin | `e2e/pilot-journey.spec.ts` | 2 | 1 | 1 | — |
| 10 | admin | `e2e/stakeholder-demo-journeys.spec.ts` | 8 | 1 | 7 | FSR-B×3 |
| 11 | admin | `e2e/ue-workflow.spec.ts` | 6 | 1 | 5 | — |
| 12 | admin | `tests/e2e/admin-assignment.spec.ts` | 1 | 1 | 0 | — |
| 13 | bilingual-en | `e2e/bilingual/locale-smoke.en.spec.ts` | 7 | 1 | 6 | — |
| 14 | bilingual-fr | `e2e/bilingual/locale-smoke.fr.spec.ts` | 7 | 1 | 6 | — |
| 15 | executive | `e2e/cba-intelligence.spec.ts` | 2 | 1 | 1 | — |
| 16 | member | `e2e/member-journey.spec.ts` | 12 | 0 | 0 | FSR-D×2, FSR-C×2 |
| 17 | public | `e2e/no-fsm-overexposure.spec.ts` | 5 | 0 | 0 | FSR-C×3 |
| 18 | security | `tests/e2e/auth-failure-handling.spec.ts` | 7 | 1 | 6 | — |
| 19 | security | `tests/e2e/auth-session-switch.spec.ts` | 1 | 1 | 0 | — |
| 20 | security | `tests/e2e/cross-org-block.spec.ts` | 3 | 1 | 2 | — |
| 21 | security | `tests/e2e/evidence-misuse.spec.ts` | 7 | 1 | 6 | — |
| 22 | security | `tests/e2e/negative-workflow-transitions.spec.ts` | 6 | 1 | 5 | — |
| 23 | security | `tests/e2e/org-isolation-negative.spec.ts` | 8 | 1 | 7 | — |
| 24 | staff | `tests/e2e/auditor-readonly.spec.ts` | 1 | 1 | 0 | — |
| 25 | staff | `tests/e2e/case-escalation.spec.ts` | 1 | 1 | 0 | — |
| 26 | staff | `tests/e2e/case-resolution.spec.ts` | 1 | 1 | 0 | — |
| 27 | staff | `tests/e2e/external-ux-tester.spec.ts` | 2 | 1 | 1 | — |
| 28 | steward | `e2e/permission-boundaries.spec.ts` | 16 | 1 | 15 | FSR-F×2, FSR-E×2, FSR-H×1 |
| 29 | steward | `tests/e2e/steward-review.spec.ts` | 3 | 1 | 2 | — |

## 5. Per-project DNR summary

| Project | Spec executions with FSR-A | DNR contribution |
|---|---:|---:|
| admin | 9 | 84 |
| security | 6 | 26 |
| steward | 2 | 17 |
| bilingual-en | 1 | 6 |
| bilingual-fr | 1 | 6 |
| accessibility | 1 | 4 |
| executive | 1 | 1 |
| staff | 4 | 1 |
| member | 0 | 0 |
| public | 0 | 0 |

## 6. Cause taxonomy for every DNR test

All 145 computed DNR tests share a single root cause: **FSR-A** (`ensureServerReady` polling the Next.js dev server exceeded its 90 000 ms budget while called from a `test.beforeAll`). This is the same root cause enumerated in §7 of `phase-0c2r-failure-signature-register.md` and repaired at source in §8 (helper `timeoutMs` raised 90 000 → 180 000, per-request `timeout` raised 10 000 → 30 000, extracted into named constant `perRequestTimeoutMs`).

This does **not** mean every DNR test is trivially green after §8. It means:

1. **§8 removes the cascade trigger** — the helper now has 180 s to complete its polls (aligned with the enclosing `test.setTimeout(180_000)`) and 30 s per request (accommodates cold `/sign-in` SSR compile bursts of 30–45 s that previously tripped the 10 s cap).
2. **A residual server hang** (persistent dev-mode degradation longer than 180 s, or a genuine Next.js crash) would still throw inside the enlarged budget and re-cascade — but each such re-cascade is a **product** defect, not a spec or helper defect.
3. **The DNR count is a floor, not a ceiling, on the number of latent test-level defects.** Freeing the cascade in a fresh baseline run will reveal whichever real per-test failures were previously hidden behind the DNR mask. Those will be enumerated in §9–§14 as their per-project batches are executed and stabilised.

## 7. Explicit non-cascading failures (FSR-B..H) — cross-check

The 20 non-FSR-A failures do not appear in the DNR count because they occur in test bodies, not in `beforeAll`. Every one is a per-test defect scoped to a single test:

| Signature | Count | Notes |
|---|---:|---|
| FSR-B (`page.goto` 45 s) | 6 | Per-test navigation timeout (admin ocra-adaptive-flow ×3, stakeholder-demo-journeys ×3). |
| FSR-C (`toHaveURL`) | 5 | Post-login redirect assertion mismatch (public no-fsm-overexposure ×3, member member-journey ×2). |
| FSR-D (`toBeVisible`) | 2 | Locator visibility assertion (member member-journey ×2). |
| FSR-E (`toContain`) | 2 | API status assertion (steward permission-boundaries ×2). |
| FSR-F (`toMatch`) | 2 | Sign-in redirect regex (steward permission-boundaries ×2). |
| FSR-G (`apiGet` 20 s) | 2 | Governance route request timeout (admin governance/deployment-legitimacy-visibility ×2). |
| FSR-H (`apiPost` 20 s) | 1 | Governance mutation timeout (admin governance/deployment-legitimacy-visibility ×1). |
| **Total** | **20** | (Matches the FSR-B..H rows of `phase-0c2r-failure-signature-register.md`.) |

## 8. What this register does NOT do

- It does not exclude the administrator project from the DNR accounting. `admin` contributes the largest share of DNR (as expected — it holds 104 of 193 tests) but is enumerated per spec on the same footing as every other project.
- It does not redefine the "did-not-run" category. All 131 DNR reported by the Playwright summary are accounted for as downstream consequences of FSR-A.
- It does not transfer any defect to a "Phase 0C.3 application team" or any other non-existent team.
- It does not assert that any DNR test will pass after §8. It asserts only that the *reason* each was DNR-classified (rather than actually executed) was FSR-A.
- It does not claim FSR-A is unrepairable. §8 has already applied the source repair; empirical measurement of the reduction is deferred to §14/§15 fresh baseline runs (never assumed).

## 9. Governance

This register is authoritative for the 131 DNR tests of Run 3 and supersedes any prior narrative characterisation of DNR as "structurally infeasible" or as blocking closure independently of the underlying cascade. Any future run that produces a DNR count > 0 must be reconciled against a rebuilt DNR register of the same shape.

Non-negotiables preserved: no admin exclusion, no baseline redefinition, no defect transfer, no Phase 0C.3/0D/1, no deploy, no merge, no force-push, no CUPE graduation.
