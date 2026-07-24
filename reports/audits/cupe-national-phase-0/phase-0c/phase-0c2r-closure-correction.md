# Phase 0C.2R — §2 Closure Correction

**Status:** Forward evidence correction (not history rewrite).
**Supersedes:** `reports/audits/cupe-national-phase-0/phase-0c/phase-0c2-final-remediation-report.md` (commit `0f537fcbb`).
**Preserves:** All prior evidence commits (`5e9e625b4` → `0f537fcbb`) remain in git history as historical evidence.
**Correct classification:** `AMBER — BASELINE PRODUCT/TEST DEFECTS REMAIN`
**Date:** 2026-07-24
**Authorized phase:** Phase 0C.2R (Aubert authorization).
**Not authorized:** Phase 0C.3, Phase 0D, deployment, CUPE graduation, merge to `main`, force-push.

---

## §2.1 Why the §BR-10 closure is invalid

The §BR-9 three-run baseline proved **lifecycle reproducibility** (all 14 lifecycle steps green in every run, no orphan DBs, no port leaks, no teardown crashes). It did **not** prove baseline correctness. The observed counts are:

| Run | Passed | Failed | Skipped | Did-not-run | Elapsed | Lifecycle steps |
| --- | ---: | ---: | ---: | ---: | ---: | --- |
| §BR-9 Run 1 (`20260724074304_91c082`) | 24 | 50 | 7 | 131 | 1.0 h | 14/14 green |
| §BR-9 Run 2 (`20260724084425_b4cd7a`) | 23 | 50 | 7 | 132 | 58.5 min | 14/14 green |
| §BR-9 Run 3 (`20260724094416_90145a`) | 24 | 50 | 7 | 131 | 1.0 h | 14/14 green |

This is a **stable failure envelope**, not a deterministic passing baseline. The one pass-to-did-not-run change in Run 2 (`24p/131dnr` → `23p/132dnr`) also **prevents any claim of complete repeatability**.

### Enumerated errors in §BR-10 (commit `0f537fcbb`)

1. **Changed the closure gate after observing failures.** The original gate criterion was `failed==0 && did-not-run==0`. §BR-10 §BR-10.5 introduced a new gate (Option A: admin-excluded baseline + per-project matrix) *only after* the failures were observed. This is post-hoc gate redefinition.
2. **Proposed excluding the 104-execution admin project** rather than repairing or executing it deterministically.
3. **Transferred current-baseline product and test defects to an "application team" handoff** (§BR-10.8 Hand-off #1) — even though repairing current-baseline defects is explicitly Phase 0C work under the mandate that began Phase 0C.2.
4. **Called 131–132 did-not-run "structurally infeasible"** (§BR-9 §BR-9.7, §BR-10 §BR-10.5) without proving that production-mode serving (`next build && next start`), project batching, worker limits, or complete per-project execution cannot solve the problem. Only development-mode single-worker was executed.
5. **Declared an unauthorized "GREEN — GRADUATE TO PHASE 0C.3"** verdict. No Phase 0C.3 was authorized. The verdict conflated infrastructure hardening (which is real Phase 0C.2 progress) with baseline closure (which requires deterministic pass).
6. **Called the 50-failure count "identical" across runs** based on line-count parity alone (§BR-9 §BR-9.5). Identical **counts** of failure entries do not prove that the exact same tests failed for the exact same reasons in all three runs — that requires JSON-reporter parsing, which was not performed.

---

## §2.2 What §BR-9 actually proved and did not prove

### What §BR-9 conclusively proved (retained)
- The `apps/union-eyes/scripts/lifecycle/**` orchestrator is production-hardened: three 1-hour end-to-end runs with no teardown crashes, no orphan disposable DBs, no port leaks, all 14 lifecycle steps green.
- The `__ERR_STREAM_WRITE_AFTER_END__` teardown crash from §BR-4 is fixed (never recurred across three runs).
- The managed-server handshake `timeoutMs: 30_000` override at `run.ts` step 8 (§BR-8 Batch F) tolerates full-baseline load.
- The failure envelope is **reproducible** (50 fails, 131±1 DNR, 7 skips per run) — this is a *stable failure state*, not a stable passing state.

### What §BR-9 did NOT prove (retracted)
- Deterministic green baseline. **The current baseline is red, not green.**
- That failure counts represent the same underlying tests across runs. **Test-level reconciliation was not performed.**
- That admin-project cascade is a "structural limit" of Next.js dev. **Only one execution mode was measured.**
- That baseline red is acceptable under any Phase 0C definition. **It is not.**
- Any Phase 0C.3 graduation. **None was authorized.**

---

## §2.3 Correct current status

**AMBER — BASELINE PRODUCT/TEST DEFECTS REMAIN**

The commits `5e9e625b4`, `8ea2ae166`, `3db1d4c77`, `2d522fbfe`, `1a63623c0`, `3a6586b0a`, `a95db8b57`, `c151aa5b8`, `e280356d1`, `e8d0bb6aa`, `eaab6c62a`, `0f537fcbb` remain pushed to `fix/union-eyes-phase0c-e2e-stabilization` as **historical evidence of Phase 0C.2 infrastructure hardening**. `0f537fcbb`'s verdict (AMBER→GREEN graduation to Phase 0C.3) is **superseded** by this document and by the forthcoming Phase 0C.2R evidence chain.

---

## §2.4 Phase 0C.2R non-negotiables (Aubert authorization)

- **Do not** exclude the administrator project from the authoritative baseline.
- **Do not** redefine the baseline after seeing failures.
- **Do not** transfer current-baseline defects to another team or phase.
- **Do not** begin Phase 0C.3.
- **Do not** begin Phase 0D.
- **Do not** deploy.
- **Do not** begin Phase 1.
- **Do not** graduate CUPE scenarios.
- **Do not** merge to `main`.
- **Do not** force-push.
- **Do not** rewrite pushed history.
- **Do not** call AMBER a "graduation" or "complete".

### Preserved constraints from Phase 0C.2
- **Do not** edit `apps/union-eyes/e2e/**` specs unless a §7 signature register entry requires it *and* the change is scoped to the assertion, not the workflow.
- **Do not** edit `apps/union-eyes/db/**` or migrations (`0008` in particular).
- **Do not** add new dependencies (`@axe-core/playwright` remains excluded).

---

## §2.5 Phase 0C.2R execution plan (from Aubert's §§3–21 mandate)

| § | Deliverable | Status |
| --- | --- | --- |
| §1 | Verify repository truth | ✅ complete (see §BR-10R-1 evidence below) |
| §2 | Closure correction (this document) | ✅ complete (this commit) |
| §3 | Three-run results reconciliation | pending — logs-only (no JSON reporter was captured) |
| §4 | Did-not-run register (every execution has a specific cause) | pending |
| §5 | Do not exclude admin — pick execution strategy A/B/C | pending |
| §6 | Validate the "dev-mode structural limit" claim (5 controlled comparisons) | pending |
| §7 | Exact failure-signature register (by true root cause) | pending |
| §8 | Repair auth + landing per persona | pending |
| §9 | Repair admin workflows (targeted batches) | pending |
| §10 | Repair stakeholder/demo workflows | pending |
| §11 | Runtime-prove security | pending |
| §12 | Runtime-prove bilingual | pending |
| §13 | Runtime-prove accessibility | pending |
| §14 | Execute every project independently to green | pending |
| §15 | Complete authoritative baseline (green, admin included) | pending |
| §16 | Valid flake analysis (3 green comparable runs + single-worker + parallel) | pending |
| §17 | Complete validation battery | pending |
| §18 | Evidence artefacts | continuous |
| §19 | Focused forward commits, normal push | continuous |
| §20 | Final closure status (exactly one of GREEN / AMBER-defects / AMBER-infra / AMBER-flake) | end |
| §21 | Final Phase 0C.2R report (50-item checklist) | end |

---

## §2.6 §1 Repository truth evidence (verified 2026-07-24)

| Check | Result |
| --- | --- |
| Branch | `fix/union-eyes-phase0c-e2e-stabilization` ✅ |
| Local HEAD | `0f537fcbb4e5a1c9d2d6ae98afc23b2587892a5e` ✅ |
| Remote HEAD | `0f537fcbb4e5a1c9d2d6ae98afc23b2587892a5e` ✅ |
| Ahead/behind vs `origin` | `0 / 0` ✅ |
| Working tree | Only unrelated drift (`apps/union-eyes/next-env.d.ts`, `ops/outputs/*.json`) + 4 untracked stale §BR-8 run-artifact dirs — **not part of Phase 0C.2R** |
| Commit range since `a5f2ecd5d` | 12 commits (`5e9e625b4` … `0f537fcbb`) as expected |
| §BR-9 Run 1 artefacts | `run-summary.json` (2864 B) + `server.log` (3369 B) at `run-artifacts/20260724074304_91c082/` ✅ |
| §BR-9 Run 2 artefacts | `run-summary.json` (2865 B) + `server.log` (3393 B) at `run-artifacts/20260724084425_b4cd7a/` ✅ |
| §BR-9 Run 3 artefacts | `run-summary.json` (2864 B) + `server.log` (3393 B) at `run-artifacts/20260724094416_90145a/` ✅ |
| Orphan disposable DBs (`ue_e2e_*`) | none ✅ |
| Port 3002 listeners | none ✅ |
| Owned Next.js processes | none ✅ |
| Owned Playwright processes | none ✅ |
| Stale PID file (`apps/union-eyes/scripts/lifecycle/.next-server.pid`) | absent ✅ |
| `.next/dev/lock` | absent ✅ |
| Tracked auth-state files (`git ls-files apps/union-eyes/playwright/.auth/`) | none ✅ |

**Note on artifact limitation:** the three §BR-9 runs emitted only `run-summary.json` + `server.log` per run, plus the top-level orchestrator `.log` file. **Playwright's JSON reporter was not configured**, so per-test structural reconciliation for §3 must reconstruct from stdout parsing of the three orchestrator logs. Playwright JSON reporter will be enabled by a forthcoming Phase 0C.2R commit before any new full-baseline run so that §3-quality reconciliation is available on future runs.

---

## §2.7 Governance
- No file deleted.
- No pushed commit rewritten.
- `0f537fcbb` remains addressable and cite-able as `phase-0c2-final-remediation-report.md`.
- This document is the canonical **superseding** classification. Future Phase 0C.2R evidence will reference this file, not `0f537fcbb`.

**End of §2 closure correction.**
