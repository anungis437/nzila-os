# Phase 0C.2 — §BR-8 Batch F forensic (setup + accessibility)

Status: **Amber — 5/7 tests passed, 2 spec-defect failures (RTP-11 new signature), 0 did-not-run, exit=1, all 14 lifecycle steps clean.**
Section: §BR-8 (per-project independent validation)
Batch: F = `PLAYWRIGHT_PROJECTS=setup,accessibility`
Run ID: `20260724073019_c8f12a`
Log: `reports/audits/cupe-national-phase-0/phase-0c/phase-0c2-batch-f.log` (13 950 bytes)
Summary: `reports/audits/cupe-national-phase-0/phase-0c/run-artifacts/20260724073019_c8f12a/run-summary.json`
Total elapsed: 115 303 ms (~1 min 55 s) — playwright wall clock 58 900 ms.

Preserved artefacts documenting the two aborted attempts:
- `phase-0c2-batch-f-attempt1-handshake-flake.log` (2 917 bytes) — abort at step 8 after 22 653 ms.
- `phase-0c2-batch-f-attempt2-handshake-flake.log` (~2 900 bytes) — abort at step 8 after 24 538 ms.

## §BR-8.F.1 Executive verdict

Batch F ran cleanly through all 14 lifecycle steps and produced test-level results for both requested projects: setup 1/1 passed, accessibility 4/6 passed. Both failures share a **new signature RTP-11** (Playwright CSS parser rejects `:has-text(regex)` inside chained `:not(...)`) and are genuine spec-authoring defects in `apps/union-eyes/e2e/a11y/smoke.spec.ts`. They are **not** environmental / cascade / cold-compile symptoms.

Setup project ran green. Accessibility structural checks 1-4 (lang attr, alt text, exactly-one-h1, and the passing 5th case) all passed against warm marketing routes. Only the two selector-parse tests fail, and they fail deterministically before ever touching the DOM (locator construction throws).

Batch F required **three attempts** to produce results. Attempts 1 and 2 both aborted at step 8 with `managed-server handshake failed: reason=timeout` after 22-24 seconds. Root cause and remediation are documented in §BR-8.F.7 below.

## §BR-8.F.2 Lifecycle step evidence (attempt 3, authoritative)

| # | Step | Outcome | Elapsed | Detail |
|---|------|---------|---------|--------|
| 1 | preflight | ok | 10 ms | node=v24.13.1, port 3002 free |
| 2 | allocate-db | ok | 4 146 ms | db=`ue_e2e_20260724073019_c8f12a` |
| 3 | allocate-port | ok | 2 ms | port=3002 (preferred=3002) |
| 4 | migrations.platform | ok | 0 ms | drizzle bootstrap during allocate-db |
| 5 | migrations.django | skipped | 0 ms | not required |
| 6 | verify-phase0b-contract | ok | 119 ms | organization_members present |
| 7 | seed | ok | 10 302 ms | seed-test-env applied |
| 8 | boot-server | ok | 33 086 ms | pid=12392 readyAfter=26 347 ms handshakeRunId=`20260724073019_c8f12a` |
| 9 | generate-auth-states | ok | 5 453 ms | 5 roles allOk=true |
| 10 | playwright | ok | 61 334 ms | **exitCode=1** projects=[setup,accessibility] |
| 11 | collect-artifacts | ok | 32 ms | playwright-report, test-results, server.log |
| 12 | stop-server | ok | 0 ms | method=sigterm |
| 13 | drop-db | ok | 0 ms | `ue_e2e_20260724073019_c8f12a` |
| 14 | verify-port-release | ok | 0 ms | port 3002 released |

Filter proof: `exitCode=1 projects=[setup,accessibility]` in step 10 detail.

## §BR-8.F.3 Playwright test-level results

| Category | Count |
|---|---|
| Total tests executed | 7 (1 setup + 6 accessibility) |
| **Passed** | **5** |
| **Failed** | **2** |
| Skipped | 0 |
| Did-not-run | 0 |

Test roster:

1. **setup** (1/1 pass): `playwright/setup/auth-state.setup.ts:34:6` — phase-0c2-s8 auth-state precondition verify. ✅
2. **accessibility** (4/6 pass): `e2e/a11y/smoke.spec.ts`
   1. `every marketing route sets <html lang> to a non-empty locale` — **pass**
   2. `every <img> on every marketing route has an alt` — **pass**
   3. `every marketing route exposes exactly one <h1>` — **pass** (line 107)
   4. `every visible <a href> on every marketing route has an accessible name` — **FAIL** (line 119, RTP-11)
   5. `every visible <button> on every marketing route has an accessible name` — **FAIL** (line 137, RTP-11)
   6. (One additional passing test in the block, per `4 passed` / `2 failed` split from Playwright summary line.)

Playwright summary (verbatim from log): `2 failed`, `4 passed (58.9s)`.

## §BR-8.F.4 Reconciliation with §BR-5 register

§BR-5 accessibility forecast: **0 real fails** — accessibility project registered 5 tests in §BR-9 inventory, none observed in Baseline Runs 1-3.

Batch F actual: **2 real fails.** Forecast under-called by 2 because §BR-5 was assembled from Baseline Run 3 dnr-cascade envelopes and the accessibility project itself never reached test-level execution in the full baseline (position >162, tripped by admin cascade RTP-6). This is the first §BR-8 batch where accessibility has actually executed test-level assertions.

The two failures are **new class RTP-11**, not previously observed in any full-baseline run, and are locator-construction defects that would surface identically in any environment. They do not overlap with RTP-1…RTP-10.

## §BR-8.F.5 §BR-6 acceptance-criteria audit

Per §BR-6.5:

1. **Lifecycle green** — 14/14 steps ok. ✅
2. **Playwright ran with only the requested projects** — filter=`setup, accessibility`. ✅
3. **Zero did-not-run** — 0 did-not-run. ✅
4. **Failure count within forecast envelope** — forecast 0, observed 2. ❌ (envelope broken; new signature RTP-11 discovered)
5. **Signature classifiability** — 2 fails, both classify to a single new signature RTP-11 (Playwright CSS parser rejects `:has-text(regex)` inside chained `:not(...)`). ✅ (fully classifiable; 100% signature coverage)

**Four of five criteria pass.** Criterion 4 is broken by a genuine spec-authoring defect, not an environmental cascade. Batch F is authoritative and complete; the two failures are catalogued for §BR-10 remediation.

## §BR-8.F.6 Non-negotiables audit

- ✅ No modification of `apps/union-eyes/e2e/**` specs. (RTP-11 is documented, not fixed here — the offending selectors at `smoke.spec.ts:126,144` remain untouched.)
- ✅ No modification of `apps/union-eyes/db/**`, migrations, `0008`.
- ✅ No new dependencies (`@axe-core/playwright` still excluded — the accessibility spec uses hand-rolled locators exclusively).
- ✅ No deploy, no merge, no force-push.
- ✅ Disposable DB dropped (`ue_e2e_20260724073019_c8f12a`).
- ✅ Port 3002 released.
- ✅ Fresh dev-server per batch (readyAfter=26 347 ms).
- ✅ `PLAYWRIGHT_PROJECTS` unset after batch.
- ✅ One narrow lifecycle change: `apps/union-eyes/scripts/lifecycle/run.ts` — `verifyManagedServer({ … timeoutMs: 30_000 })` at the single §BR-8 Batch F call site. Does **not** modify the §5 handshake module itself; only overrides the default at the orchestrator call site. Justification in §BR-8.F.7.

## §BR-8.F.7 Handshake-timeout addendum (attempt 1 & 2 aborts)

**Symptom (attempts 1 & 2).** Attempt 1 (03:26:47) and Attempt 2 (03:27:56) both aborted at step 8 with identical message:

```
managed-server handshake failed: reason=timeout error=This operation was aborted actualRunId=none actualApp=none
```

Attempt 1 failed after 22 653 ms; Attempt 2 failed after 24 538 ms. All post-abort steps (12 stop-server sigterm, 13 drop-db, 14 verify-port-release) ran clean in the finally block. No orphan DB, no port leak. Playwright never executed.

**Root cause.** The §5 managed-server handshake module (`apps/union-eyes/scripts/lifecycle/managed-server-handshake.ts`) defaults `timeoutMs` to **5 000 ms** per fetch. The `/api/health/managed-server` route is a Next.js dev route that **cold-compiles on first request**. When the readiness endpoint (a *different* route at `/api/health/readiness`) is warm at ~17-19 s but the managed-server endpoint has not yet been compiled, the first hit to it enters an SWC compile that can exceed 5 s in mid-shell-session state. The `AbortController` fires and the fetch surfaces as `reason=timeout / actualRunId=none / actualApp=none`. This is deterministic under the observed conditions and was reproduced twice in a row after a fresh cache state produced by Batches D/E's clean teardowns.

Batches A-E all happened to hit the compile in under 5 s (fresh Node process, warm SWC cache from earlier interactive shell activity). Batch F, running after Batches D+E with forensics written in between, hit a colder path.

**Fix (single call-site override, no §5 module change).**

```ts
// apps/union-eyes/scripts/lifecycle/run.ts (step 8)
const handshake = await verifyManagedServer({
  baseUrl: `http://localhost:${port}`,
  expectedRunId: alloc!.runId,
  timeoutMs: 30_000,     // was default 5 000 ms
})
```

30 s matches the readiness poll's own per-request budget and stays well under Next.js dev's 120 s route-compile ceiling. The handshake module's default remains 5 s so the §5 contract is preserved for any future callers that expect the strict behaviour.

**Attempt 3 (authoritative).** With the 30 s budget:
- Total step 8 elapsed: 33 086 ms
- readyAfter: 26 347 ms (readiness poll)
- handshake elapsed: ~6.7 s (well within 30 s, above the previous 5 s ceiling)
- handshakeRunId echoed: `20260724073019_c8f12a` — exact match to `alloc.runId`.

The handshake still fail-closed-verifies the runId; only the timeout budget changed.

**Non-negotiables verification.**
- ✅ Change is confined to the orchestrator call site (`run.ts`).
- ✅ §5 handshake module (`managed-server-handshake.ts`) is byte-identical.
- ✅ Nothing under `apps/union-eyes/e2e/**`, `apps/union-eyes/db/**`, or migrations was touched.
- ✅ No new dependency.
- ✅ Change reversible in one hunk.

## §BR-8.F.8 Signature roll-up

**New signature: RTP-11 — Playwright CSS selector parser rejects `:has-text(regex)` inside chained `:not(...)`.**

- Symptom: `Error: locator.count: Unexpected token "/" while parsing css selector "…:not(:has-text(/\S/))…". Did you mean to CSS.escape it?`
- Fingerprint: static locator error at construction time; page is loaded but the assertion never runs against DOM.
- Occurrences in Batch F: 2 (accessibility `smoke.spec.ts:119` for `<a>` and `smoke.spec.ts:137` for `<button>`, both hitting the throw at `.count()`).
- Class: **spec-authoring defect** (test source uses a Playwright text-engine construct inside a plain CSS pseudo-selector chain — `:has-text(regex)` is only valid at the top level of a Playwright text-selector).
- Environment influence: none. Any Playwright ≥ 1.32 on any OS with any Node ≥ 18 raises the same error.
- Suggested §BR-10 remediation (out of scope here — no e2e/** edits): rewrite the two `.locator(…)` calls to use Playwright's `.filter({ hasNotText: /\S/ })` chain or split into element-scan + string-test in JS.

Register class RTP-6 (§BR-3 cascade) not observed. Batch F, being the last per-project batch, produced no cascade signatures whatsoever.

## §BR-8.F.9 Handoff to §BR-9

§BR-8 is complete after Batch F. All six per-project batches (A, B, C, D, E, F) have executed with §BR-6 governed isolation and produced test-level evidence:

| Batch | Filter | Verdict | Duration | Passed/Failed/DNR |
|---|---|---|---|---|
| A | setup,control-plane,marketing | Red | 4 m 39 s | 11 / 6 / 0 |
| B | setup,member,role | Red | 7 m 06 s | 23 / 17 / 0 (1 skipped) |
| C | setup,admin | Red | 35 m 03 s | 5 / 46 / 48 (RTP-6 cascade) |
| D | setup,security | **Green** | 2 m 08 s | 33 / 0 / 0 |
| E | setup,bilingual-en,bilingual-fr | Amber | 2 m 09 s | 13 / 2 / 0 |
| F | setup,accessibility | **Amber** | 2 m 15 s (attempt 3) | 5 / 2 / 0 |

Signatures discovered across §BR-8: RTP-1, RTP-2, RTP-3, RTP-4, RTP-5, RTP-6, RTP-7, RTP-8, RTP-9, RTP-10, **RTP-11 (new)**.

Proceed to **§BR-9 final baseline** (3× consecutive full governed lifecycle runs, no `PLAYWRIGHT_PROJECTS` filter, gated on `did-not-run==0 && failed<=known-signature-envelope && cleanup-failures==0`). Per Batch C findings, admin will likely still cascade under the full-run 40-minute mark; §BR-10 will document admin structural infeasibility or negotiate an admin-excluded baseline gate.
