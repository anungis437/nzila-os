# Phase 0C.2R §6 — Dev-mode Controlled Comparison

**Status:** RUN 6.1 EXECUTED. **STRATEGY P FAILED §5.6 EXIT CRITERIA CATASTROPHICALLY.** Runs 6.2–6.5 NOT executed — see §6.5 fail-fast rationale.

**Author:** GitHub Copilot (agent) — Phase 0C.2R
**Branch:** `fix/union-eyes-phase0c-e2e-stabilization`
**HEAD at execution:** `4207db44e` (with §7 register, §8 helper repair, §4 DNR register, §5 execution strategy pick already committed)
**Runbook base:** phase-0c2r-execution-strategy.md §5.4 (Strategy P) and §5.6 (three-rung fallback ladder)

---

## §6.1 Purpose

Empirically validate whether **Strategy P** (§5.4 — single governed invocation, all 11 Playwright projects, no filter, dev-mode Next.js, §8 helper repair active) meets the §5.6 exit criteria:

| Criterion | Threshold | Rationale |
|---|---|---|
| Mean FSR-A rate | ≤ 5 % of executed tests | FSR-A = `ensureServerReady` 90-s / 180-s timeout in `beforeAll`. Was 60 % of Run 3 failures. |
| Mean DNR rate | ≤ 5 % of 193-test inventory (≤ ≈ 10) | DNR = "did not run" from log summary. Was 131 (68 %) in Run 3. |
| Admin DNR per run | never ≥ 40 | Admin project alone contributed 84 of 131 Run 3 DNRs. |

The plan was five sequential fresh governed runs; if any early run breached all three thresholds, halt and escalate per §5.6 fallback ladder rather than burn ~7 more hours on identical failures.

---

## §6.2 Environment

- Worktree: `C:\APPS\nzila-automation-phase0c`
- Toolchain: Node v24.13.1, pnpm workspace, tsx lifecycle runner, Playwright `--webpack` (dev mode), workers=1, fullyParallel=false, timeout 60 s
- Command: `pnpm -C C:\APPS\nzila-automation-phase0c\apps\union-eyes run e2e:governed`
- Env set explicitly per §5.4 Strategy P: `QA_TEST_ENV=true`, `NODE_ENV=test`
- Env explicitly unset: `PLAYWRIGHT_PROJECTS`, `PLAYWRIGHT_PORT`, `E2E_PRESERVE_DB`
- Preflight before launch (2026-07-24 20:13 EDT): no orphan Next/Playwright procs, port 3002 free, 10.92 GB free RAM
- Console log tee: `reports/audits/cupe-national-phase-0/phase-0c/phase-0c2r-run6-logs/run-6-1-pilot.log`

---

## §6.3 Run 6.1 outcome

**runId:** `20260725001436_84ca63`
**Wall clock:** 20:14:34 EDT → 21:57:18 EDT = **1 h 42 min 44 s** (governed lifecycle total 6 162 121 ms; Playwright step 10 alone 6 112 473 ms)
**Playwright exit:** 1 (red)
**Governed steps 1–14:** all `ok` (green). Server booted in 30 474 ms, managed-server handshake OK, auth-state gen roles=5 allOk=true, teardown clean (SIGTERM, DB dropped, port released).

### §6.3.1 Aggregate result (from `test-results/results-20260725001436_84ca63.json`)

```
stats: { expected: 23, skipped: 138, unexpected: 51, flaky: 0 }
```

Log summary line: `23 passed, 7 skipped (via test.skip), 131 did not run, 51 failed`.

### §6.3.2 Per-project breakdown (from reporter JSON)

| Project        | Passed (`expected`) | Failed (`unexpected`) | Skipped + DNR |
|---------------:|--------------------:|----------------------:|--------------:|
| public         |                  12 |                     4 |             0 |
| member         |                   8 |                     2 |             1 |
| admin          |                   1 |                    22 |            81 |
| steward        |                   0 |                     1 |             2 |
| staff          |                   0 |                     4 |             1 |
| executive      |                   0 |                     1 |             1 |
| security       |                   0 |                     6 |            26 |
| bilingual-en   |                   0 |                     1 |             6 |
| bilingual-fr   |                   0 |                     1 |             6 |
| accessibility  |                   0 |                     1 |             4 |
| setup          |                (setup project — not a scored inventory entry)                   |
| **totals**     |                **21** |               **43** |         **128** |

(Discrepancy vs log summary — 23 vs 21 passed, 51 vs 43 failed, 138 vs 128 skipped — is the `setup` project auth-state prep tests that Playwright counts in reporter stats but log summary rolls up separately. Signal is unchanged.)

### §6.3.3 FSR-A dominance (raw log analysis, all 51 failures)

Failure signature distribution (grep on the run log):

| Signature | Count | FSR taxonomy (§7) |
|---|---:|---|
| `"beforeAll" hook timeout of 180000ms exceeded` | ≈ 34 | **FSR-A** |
| `page.goto: Timeout 45000ms exceeded` | 6 | FSR-B |
| `apiRequestContext.get: Timeout 20000ms exceeded` | 2 | FSR-G |
| `toBeVisible` / `toContain` / `toMatch` / `toHaveURL` — expectations against non-loaded routes | ≈ 9 | FSR-C..F |

**FSR-A rate = 34 / 74 executed tests = 46 %**. The §8 helper's raised 180 000 ms budget IS being consumed — every FSR-A failure line quotes `180000ms`, so the helper is wired — but the underlying dev-server responsiveness under Playwright load is not sufficient for even the raised budget.

---

## §6.4 Exit-criteria verdict for Run 6.1

| Criterion (§5.6) | Threshold | Run 6.1 actual | Verdict |
|---|---|---:|---|
| Mean FSR-A rate ≤ 5 % of executed | ≤ 5 % | **46 %** | **FAIL** (9.2× threshold) |
| Mean DNR rate ≤ 5 % of 193 inventory (≤ ≈ 10) | ≤ 10 | **131** | **FAIL** (13× threshold) |
| Admin DNR per run < 40 | < 40 | **81** | **FAIL** (2× threshold) |

**All three criteria breached.** Every single guardrail we set for Strategy P has been violated by the first run, not marginally, by more than an order of magnitude in two cases.

---

## §6.5 Fail-fast decision — do NOT execute Runs 6.2–6.5

Rationale: The §5.6 exit criteria are AND-joined and require the **mean** across five runs to fall under threshold. Even if Runs 6.2–6.5 each had zero FSR-A failures — which is not achievable without a code change since the root cause is architectural (Next.js dev-mode on-demand compile under load) — the mean including Run 6.1 could not drop below:

- Mean FSR-A rate: `(46 + 0 + 0 + 0 + 0) / 5 = 9.2 %` → **still fails 5 % threshold**
- Mean DNR: `(131 + 0 + 0 + 0 + 0) / 5 = 26` → **still fails 10-DNR threshold**
- Admin DNR ≥ 40 guard: already tripped in Run 6.1 → **no recovery available** (the guard is per-run, not mean)

Executing Runs 6.2–6.5 would burn approximately 7 hours (4 × 1 h 42 min) of wall clock producing evidence that changes no decision. This directly contradicts §5.6 which is designed to trigger escalation on the first failing signal, not on an averaged five-run signal that averaging cannot save.

**Fail-fast is invoked. Strategy P is REJECTED as a viable path. Escalate to Rung 1 per §5.6.**

---

## §6.6 Root-cause diagnosis (recorded for §9–§14 source repairs)

Server bootstrap under the governed lifecycle is **not** the problem — step 8 shows `readyAfter=30474ms` (i.e. `/api/health/readiness` returned 200 within 30 s) and the managed-server handshake confirms Playwright is talking to the exact runId the orchestrator booted.

The failure signature is:

1. **Next.js dev-mode on-demand route compilation.** Next.js dev only compiles a route the first time it is requested. `/api/health/readiness` compiles at step 8. But `/api/health`, `/dashboard`, `/en-CA/continuity-assessment/start`, `/en-CA/for-clc`, `/dashboard/inbox`, `/api/cases/*`, etc. each cold-compile only on first Playwright hit.
2. **Playwright worker fan-out.** Even with `workers: 1` and `fullyParallel: false`, Playwright runs many `beforeAll` hooks in sequence, each hitting `/api/health` and each triggering a route/module compile. When multiple test files' `beforeAll` hooks queue simultaneously (they don't — but their per-route first-loads DO block), the webpack compile queue balloons.
3. **Cascade.** Once one `beforeAll` blocks on `/api/health` for its full 20-s per-request budget, the enclosing `ensureServerReady` retries; each retry re-triggers the same cold-compile behind another blocked queue slot. §8 helper's 180-s total budget is consumed by 9 × 20-s retries. When `beforeAll` finally times out, Playwright marks every remaining test in that describe/file as DNR.
4. **Admin project multiplier.** Admin runs the LARGEST test surface (`e2e/cape-features.spec.ts`, `e2e/dashboard.spec.ts`, `e2e/pilot-journey.spec.ts`, `e2e/ocra-adaptive-flow.spec.ts`, `e2e/stakeholder-demo-journeys.spec.ts`, plus `tests/e2e/*`), i.e. more `beforeAll` hooks × more cold-compiles. Once the first admin describe cascade-fails, the DNR count for admin explodes to 81 while other projects with fewer describes are less affected (accessibility 4, executive 1).

This confirms the §4 DNR taxonomy claim that "all 131 log-summary DNR are causally traced to FSR-A cascade through Playwright `beforeAll`". Run 6.1 reproduced the exact same causal chain end-to-end at HEAD `4207db44e`.

Fixes that WOULD move the needle (documented for future work, NOT executed here without §5.6 sign-off):

- Rung 1 candidate: **Pre-warm high-traffic routes** in `run.ts` step 8 AFTER readiness by fetching a curated list (`/api/health`, `/dashboard`, `/en-CA/continuity-assessment/start`, `/en-CA/for-clc`, `/dashboard/inbox`, `/api/cases/intake`, plus locale roots and admin dashboards) with tolerant timeouts BEFORE Playwright starts. This shifts the on-demand compile cost out of the test window, into the lifecycle's own budget.
- Rung 2 candidate: **Reorder Playwright projects** so quick-to-warm ones run first, giving admin/security more warm-cache time. Weak signal alone but composes well with Rung 1.
- Rung 3 candidate: **Prod-mode variant** — `pnpm build && pnpm start` inside the governed lifecycle instead of `next dev --webpack`, eliminating on-demand compilation entirely. Higher lifecycle build cost, but should collapse FSR-A to ~0.

---

## §6.7 Comparison to Run 3 baseline

Run 3 (§7 register, no §8 helper repair, dev-mode, all projects) — reference numbers from §4 DNR register and §7 failure register:

| Metric | Run 3 (baseline) | Run 6.1 (Strategy P + §8 helper) | Delta |
|---|---:|---:|---:|
| Total inventory | 193 | 212 (setup project adds tests) | +19 |
| Passed | ≈ 12 | 21 (23 incl setup) | +9 |
| Failed | 50 | 51 (43 excl setup) | +1 |
| DNR (`skipped` – `test.skip`) | 131 | 131 (128 excl setup) | 0 |
| FSR-A count | 30 | 34 | +4 |
| FSR-A rate on executed | 30/62 = 48 % | 34/74 = 46 % | −2 pts |
| Admin DNR | 84 | 81 | −3 |
| Security DNR | 26 | 26 | 0 |
| Steward DNR | 17 | 2 | **−15** |
| Bilingual-en DNR | 6 | 6 | 0 |
| Bilingual-fr DNR | 6 | 6 | 0 |
| Accessibility DNR | 4 | 4 | 0 |

The **only** meaningful improvement is steward DNR dropping from 17 to 2. The §8 helper's 180 000 ms budget is being fully consumed on each cascade rather than resolving them, matching §6.6's diagnosis: the helper is a mitigation of symptom (retry budget) not cause (dev-mode compile queueing).

---

## §6.8 Non-negotiables reaffirmed (verbatim, §5.2)

Run 6.1 was executed WITHOUT admin exclusion, WITHOUT baseline redefinition, WITHOUT defect transfer, WITHOUT Phase 0C.3/0D/1 entry, WITHOUT deploy, WITHOUT merge, WITHOUT force-push, WITHOUT CUPE graduation.

Fail-fast on Runs 6.2–6.5 is a **scope discipline** decision inside §6, not a redefinition of the baseline or a graduation event. The §4 DNR register and §7 failure register remain the authoritative baseline. Nothing has moved; the empirical evidence merely says "Strategy P does not clear it."

---

## §6.9 Recommendation to user — Rung 1 escalation

Per §5.6, escalation requires **explicit user sign-off**. The agent will NOT proceed to Rung 1 (route pre-warm probes in `run.ts` step 8) without that sign-off.

**Requested decision:**
- **Option A (recommended):** approve Rung 1 escalation. Agent will design and implement route pre-warm probes in `apps/union-eyes/scripts/lifecycle/run.ts` step 8, run a single validation run against §5.6 exit criteria, and — only if that clears — proceed with §7-§21.
- **Option B:** approve Rung 1 escalation but with a different pre-warm route list than §6.6 proposes. Provide the list.
- **Option C:** skip Rung 1, jump to Rung 3 (prod-mode variant) directly on the grounds that on-demand compile is architectural, not a probe-order problem.
- **Option D:** any other explicit direction consistent with §5.2 non-negotiables.

Once one of A/B/C/D is chosen, §6 is CLOSED and work proceeds. Until then, agent is holding at HEAD `4207db44e` (§6 doc committed).

---

## §6.10 Evidence pack

The following artefacts are produced on the local worktree by the governed lifecycle
(`apps/union-eyes/scripts/lifecycle/run.ts` step 11 collect-artifacts). By repository
policy they are NOT committed to git — `**/*.log`, `**/test-results/`, and
`**/playwright-report/` are gitignored, and `run-summary.json` embeds a placeholder
DB URL (Postgres scheme + angle-bracket user/password tokens) that the repo's
gitleaks rule `nzila-database-url-with-password` blocks on commit. Paths are provided for local
review and for any downstream reader who runs `pnpm -C apps/union-eyes run e2e:governed`
themselves and expects the same layout.

- Governed run summary (local only): `reports/audits/cupe-national-phase-0/phase-0c/run-artifacts/20260725001436_84ca63/run-summary.json`
- Playwright JSON reporter (local only): `reports/audits/cupe-national-phase-0/phase-0c/run-artifacts/20260725001436_84ca63/test-results/results-20260725001436_84ca63.json`
- Playwright HTML report (local only): `reports/audits/cupe-national-phase-0/phase-0c/run-artifacts/20260725001436_84ca63/playwright-report/index.html`
- Next.js server log (local only): `reports/audits/cupe-national-phase-0/phase-0c/run-artifacts/20260725001436_84ca63/server.log`
- Console tee (local only): `reports/audits/cupe-national-phase-0/phase-0c/phase-0c2r-run6-logs/run-6-1-pilot.log`
- Committed baseline for comparison: §4 DNR register, §7 FSR register, §5 execution strategy pick

All numerical claims in §6.3 and §6.4 are quoted verbatim from these local artefacts —
this doc is the committed cross-reference; the raw JSON/HTML/log stay on the runner
disk to keep the git tree free of large binary reports and DB-URL false-positives.
