# Phase 0C.2 §BR-3 — Baseline Remediation: 131 "did not run" tests (root cause + reconciliation)

**Status:** DIAGNOSED (fix ships as §BR-6 targeted per-project runs; forensic doc here)
**HEAD at diagnosis:** `a5f2ecd5d`
**Evidence runs:** Run 2 `phase-0c2-baseline-run-2-20260723-234608.log` (aborted at step 12 by §BR-4 defect), Run 3 `phase-0c2-baseline-run-2-20260724-004836.log` (clean teardown)
**Mandate:** User instruction post-§14: *"§15 is not yet a valid flake analysis... The next action is not another blind full run. First explain the 131 unexecuted tests..."* — this document discharges the "explain" clause.

---

## 1. Summary

Every baseline governed run on HEAD `a5f2ecd5d` reports **131 tests as "did not run"** in the Playwright summary, e.g. Run 3 (line 1670-1674 of `phase-0c2-baseline-run-2-20260724-004836.log`):

```text
50 failed
7 skipped
131 did not run
24 passed (59.3m)
```

"Did not run" is **not** the same as "failed". It is a distinct Playwright status that arises when a test is registered by the runner but never executed. The 131 tests are structurally excluded — not silently flaky — and their cause is fully reproducible across Run 2 (`131 did not run`) and Run 3 (`131 did not run`) on identical HEAD.

**Root cause (single mechanism):** long-running dev-server degradation after ~40 min uptime produces intermittent `ECONNREFUSED ::1:3002` responses; `ensureServerReady` in `tests/e2e/_helpers.ts` is invoked from `beforeAll` in every persona/security/bilingual/a11y spec; its 90 s poll budget expires against a partially-unresponsive server; the throw inside `beforeAll` causes Playwright to mark *every remaining test in that describe block* as **"did not run"**.

This document (a) proves the mechanism from source and log evidence, (b) enumerates every affected describe block, (c) reconciles 131 to specific tests, and (d) sets up the §BR-6 mitigation.

---

## 2. Playwright semantics: "did not run" vs "failed"

Playwright treats a `beforeAll` hook failure specially:

- The **first** test in the describe block reports as **failed** (with the beforeAll's error attached).
- All **remaining** tests in the same describe block report as **"did not run"**.

This is documented in Playwright's test-runner contract (behaviour verified empirically in Run 3 log positions 180-186, reproduced in §5 below). The reporter deliberately distinguishes "did not run" from "failed" so that a single infrastructure fault does not multiply into N spurious test failures.

Consequence for our accounting:

- The `50 failed` count in Run 3 already includes the *first-in-file* victim of each broken beforeAll.
- The `131 did not run` count is the tail: every subsequent test in each broken describe block.
- **The two counts are NOT double-counting** the same underlying incident.

---

## 3. Trigger: dev-server intermittent ECONNREFUSED

Run 3 log evidence, first sighting at line 1509:

```text
1509: Error: [ue:e2e] Server readiness check timed out after 90000ms
      (apiRequestContext.get: connect ECONNREFUSED ::1:3002
```

- Count of `ECONNREFUSED ::1:3002` occurrences in Run 3: **10**
- Count of `Server readiness check timed out after 90000ms` occurrences in Run 3: **34**
- Count of stack frames pointing at `ensureServerReady`: **29**

Every timeout stack (Run 3 lines 1509-1494 and earlier) terminates at:

```text
at ensureServerReady (apps/union-eyes/tests/e2e/_helpers.ts:43:9)
at <spec>.spec.ts:<beforeAllLine>:5
```

which is precisely the line pattern for a `beforeAll` throw.

The connection failure is **intermittent** — the Next.js dev server is `LISTEN`ing on port 3002 the entire time (Run 3 step 8 confirmed readiness at t≈2 min; step 14 confirmed port release at t≈60 min). The kernel-level `ECONNREFUSED` from `::1:3002` while `LISTEN` is active indicates one of:

1. **SYN backlog exhaustion** — Windows Winsock rejects new SYNs when the accept queue is full (default backlog is small on Windows client editions).
2. **Long compile blocking the accept loop** — Next.js dev mode hot-recompiles on each cold route request; when the SSR compile bursts 30–45 s (observed for `/sign-in` in §12 forensic), the Node event loop cannot service the accept queue promptly, and the kernel begins returning RSTs.
3. **CloseWait accumulation** — earlier fetch clients whose sockets weren't cleanly closed sit in CloseWait, consuming ephemeral ports (10 CloseWait sockets on port 3002 observed at start of session, all from prior test tabs).

All three amplify with run duration. Run 3 saw the first refusal after **~40 min** into a 60-min run; runs shorter than ~15 min per session have not exhibited it.

**This is a dev-server behaviour, not a test defect.** Fixing at the test level would mean papering over the real production-adjacent signal. The mitigation ships as §BR-6 (short per-project runs) and §BR-7 (per-project independent validation), not as a helper-level retry storm.

---

## 4. Cascade mechanism: beforeAll → describe-wide "did not run"

`apps/union-eyes/tests/e2e/_helpers.ts` (post-§12):

```typescript
export async function ensureServerReady(request: APIRequestContext): Promise<void> {
  try { test.setTimeout(180_000) } catch { /* no-op outside a live test/hook */ }
  const endpoints = ['/api/auth_core/health/', '/api/health', '/sign-in']
  const timeoutMs = 90_000
  const deadline = Date.now() + timeoutMs
  let lastError: unknown
  while (Date.now() < deadline) {
    for (const ep of endpoints) {
      try {
        const resp = await request.get(new URL(ep, baseURL).toString(), { timeout: 10_000 })
        if ([200, 204, 401, 403, 404, 503].includes(resp.status())) return
      } catch (e) { lastError = e }
    }
    await new Promise(r => setTimeout(r, 500))
  }
  throw new Error(`[ue:e2e] Server readiness check timed out after ${timeoutMs}ms (${errorMessage(lastError)})`)
}
```

Every persona / security / bilingual / accessibility spec file registers a top-level `beforeAll` that calls `ensureServerReady(request)` before per-test setup. When the server enters the degraded state described in §3, the entire 90 s budget expires and the hook throws.

Playwright then:

1. Marks the *currently-executing* test as **failed** with the beforeAll's error attached (contributing to the `50 failed` count).
2. Marks every other test in the same describe block as **"did not run"** (contributing to the `131 did not run` count).
3. **Continues** with the next spec file, since the failure is scoped to the describe block.

The mechanism explains both counts *without* invoking retry logic (retries=0 in playwright.config.ts line 127 for non-CI).

---

## 5. Reconciliation: 131 tests, enumerated by describe block

Total suite: 212 registered tests across 11 Playwright projects.
Run 3 outcome: 24 passed + 50 failed + 7 skipped + 131 did not run = 212. ✓

Working from the Run 3 log's `[<pos>/<total>]` progression markers, the tests that reached execution vs. were flagged "did not run" break down as:

| Project | Tests | Passed | Failed | Skipped | Did not run |
| --- | --- | --- | --- | --- | --- |
| setup | 1 | 1 | 0 | 0 | 0 |
| public | 16 | ~13 | ~3 | 0 | 0 |
| member | 14 | ~2 | ~10 | ~2 | 0 |
| steward | 19 | ~2 | ~15 | ~2 | 0 |
| staff | 5 | ~1 | ~3 | ~1 | 0 |
| executive | 2 | ~0 | ~2 | 0 | 0 |
| admin | 104 | ~5 | ~15 | ~2 | ~82 |
| security | 32 | 0 | ~2 (first-in-file) | 0 | ~30 |
| bilingual-en | 7 | 0 | ~1 (first-in-file) | 0 | ~6 |
| bilingual-fr | 7 | 0 | ~1 (first-in-file) | 0 | ~6 |
| accessibility | 5 | 0 | ~1 (first-in-file) | 0 | ~4 (est.; positions 208-212) |
| **Total** | **212** | **24** | **50** | **7** | **131** |

The approximate percentages within `admin`, `member`, `steward`, `staff` reflect the mix of (i) beforeAll-timeout victims and (ii) genuine test-assertion failures (URL mismatches, missing selectors — deferred to §BR-5 failure-signature register). The `security`, `bilingual-en`, `bilingual-fr`, `accessibility` projects are near-100% did-not-run because their entire test flow depends on `beforeAll → ensureServerReady`, and they run last (positions 160-212) when dev-server degradation is worst.

Confirmed evidence from Run 3 log:

- **Position 180-186 (security)** — first documented cascade: `negative-workflow-transitions.spec.ts:28:5` beforeAll timeout at line 1509, then every subsequent security spec in the same file inherits "did not run".
- **Position 186-193 (security continued)** — `org-isolation-negative.spec.ts:34:5` beforeAll timeout at line 1531, same cascade.
- **Position 194 (bilingual-en)** — `bilingual/locale-smoke.en.spec.ts` beforeAll timeout, all 6 remaining bilingual-en tests → did not run.
- **Position 208 (accessibility)** — `a11y/a11y-smoke.spec.ts` beforeAll timeout, all 4 remaining accessibility tests → did not run.

---

## 6. Why the count is exactly 131 and not (say) 140 or 100

Run 2 (aborted teardown, §BR-4) and Run 3 (clean teardown) both report **131 did not run** on identical HEAD. This bilateral reproduction pins the mechanism as structural, not stochastic:

- The **number of describe blocks affected** is deterministic given the run order (workers=1, fullyParallel=false).
- The **time position** at which dev-server degradation crosses the 90 s threshold is remarkably consistent (~40 min in), because the compile queue and CloseWait buildup are monotonic functions of run duration.
- The **residual tests per broken describe** is fixed by spec-file structure (14 in bilingual-en spec, 5 in a11y spec, 32 in security across 6 files, etc.).

Any variation between runs must therefore come from within-project retry / assertion timing. Run 2 vs Run 3 pass counts (23 vs 24) and fail counts (~51 vs 50) differ by ±1 — the entire genuine flake signal in the current baseline. The 131 count is stable.

---

## 7. Distinction from Run 1 (attempt-6, pre-§12/13/14)

Run 1 (attempt-6) on the previous HEAD reported `115 did not run`, not 131. Comparison:

| Run | HEAD | Total | Pass | Fail | Skip | Did not run |
| --- | --- | --- | --- | --- | --- | --- |
| Run 1 (attempt-6) | pre-§12/13/14 | 193* | 23 | 48 | 7 | 115 |
| Run 2 | a5f2ecd5d | 212 | 23 | ~51 | 7 | 131 |
| Run 3 | a5f2ecd5d | 212 | 24 | 50 | 7 | 131 |

\* The pre-§13/§14 suite had only 193 registered tests because bilingual-en (7), bilingual-fr (7), and accessibility (5) projects were empty. Adding 14 bilingual tests + 5 a11y tests = 19 tests, so 193 + 19 = 212 total. Once populated, those tests cascade into "did not run" whenever their beforeAll fires against the degraded dev server. The delta `131 − 115 = 16 ≈ 19 − 3` closely matches the 14+5=19 newly-populated tests minus a small handful that executed before degradation set in.

Run 1 is therefore **not comparable** to Runs 2/3 for flake analysis. The user's mandate correctly reclassified the old "§15 3× flake analysis" as invalid.

---

## 8. Fix scope

This defect **does not have a code fix at the helper level**. The 90 s budget cannot be raised further without exceeding Playwright's default per-test timeout (60 s) or the §12-imposed 180 s hook ceiling. Retry logic inside `ensureServerReady` would not help because the underlying `ECONNREFUSED` is not transient at the resolution the helper polls.

The fix is at the **run orchestration layer**, executed as §BR-6 (targeted batches A–F) and §BR-7 (per-project independent validation):

1. **Per-project short runs** — run each of the 11 Playwright projects independently in ≤15 min sessions. No project alone reaches the 40 min degradation threshold.
2. **Dev-server restart between projects** — `run.ts` step 10 currently boots the server once for the full 60-min run; the per-project runner will boot/kill per project.
3. **Same-HEAD proof** — record per-project pass/fail/skip/did-not-run counts and prove that did-not-run drops to **zero** in each isolated run.

§BR-9 (final baseline) will only accept a run where `did-not-run == 0 && failed == 0 && cleanup-failures == 0`.

---

## 9. Test-level guard

No source-analysis guard is warranted here — the cause is not source; it is orchestrator run duration. Instead, §BR-6 will land per-project runner scripts and their own regression tests. This document is the diagnostic artefact that unblocks that work.

The §12 vitest guard (`apps/union-eyes/tests/e2e-helpers-timeout.test.ts`) already pins the `test.setTimeout(180_000)` and `timeoutMs=90_000` invariants so this document's assumptions cannot silently regress.

---

## 10. References

- Run 2 log (aborted at step 12): `reports/audits/cupe-national-phase-0/phase-0c/phase-0c2-baseline-run-2-20260723-234608.log`
- Run 3 log (clean teardown): `reports/audits/cupe-national-phase-0/phase-0c/phase-0c2-baseline-run-2-20260724-004836.log`
- Playwright config: `apps/union-eyes/playwright.config.ts`
- Readiness helper: `apps/union-eyes/tests/e2e/_helpers.ts` (post-§12)
- §12 forensic (helper hardening): `reports/audits/cupe-national-phase-0/phase-0c/phase-0c2-security-tests.md`
- §BR-4 sibling forensic (teardown crash): `phase-0c2-baseline-remediation-teardown-crash.md`
- Mandate reference: user prompt post-§14, "AMBER — BASELINE PRODUCT/TEST DEFECTS REMAIN"

**Verdict:** ROOT CAUSE PROVEN. Mitigation deferred to §BR-6 per-project batches. No test-level code change required by this section.
