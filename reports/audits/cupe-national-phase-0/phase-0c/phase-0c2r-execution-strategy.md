# Phase 0C.2R §5 — Execution Strategy Pick

**Date:** 2026-07-24
**Author:** Phase 0C.2R remediation
**Predecessors:** §3 three-run reconciliation (`9d6f55d7e`), §4 DNR register (`bd7bca79c`), §7 signature register (`010c6e367`), §8 helper repair (`010c6e367`)
**Successor:** §6 dev-mode 5-run controlled comparison
**Non-negotiables:** NO admin exclusion, NO baseline redefinition, NO defect transfer, NO Phase 0C.3/0D/1, NO deploy, NO merge, NO force-push, NO CUPE graduation.

---

## §5.1 Purpose

Pick a single, evidence-driven execution shape for the §15 authoritative Phase 0C.2R baseline and for the §6 5-run measurement that precedes it. This document does **not** run tests, does **not** change source, and does **not** redefine the baseline — it commits the runtime topology so §6/§9-§14 can be measured against a fixed control.

## §5.2 Constraints (verbatim, non-negotiable)

1. **NO admin exclusion.** The `admin` project (104 tests, 84 DNR observed in Run 3 per §4) MUST be included in every §15-eligible baseline, on identical footing with `public`/`member`/`steward`/`staff`/`executive`/`security`/`bilingual-en`/`bilingual-fr`/`accessibility`. Any strategy that filters `admin` out — for any reason, including latency, cost, or FSR-A cascade blast-radius — is disqualified.
2. **NO Playwright config surgery.** `apps/union-eyes/playwright.config.ts` retains `workers: 1`, `fullyParallel: false`, `retries: CI?2:0`, `timeout: 60_000`, `navigationTimeout: 45_000`, `actionTimeout: 20_000`. Any change would silently redefine baseline semantics and is out of scope for §5.
3. **NO project split at the runner level for §15.** `PLAYWRIGHT_PROJECTS` filtering (supported by `scripts/lifecycle/run.ts` per §BR-6) may be used for targeted §9-§14 repair verification only. §15 authoritative baseline MUST be a single governed invocation covering all 11 projects to prove end-to-end lifecycle integrity.
4. **§8 helper repair is in scope, everything else is not.** `apps/union-eyes/tests/e2e/_helpers.ts::ensureServerReady` timeouts (`timeoutMs = 180_000`, `perRequestTimeoutMs = 30_000`) landed at `010c6e367` and are the only in-flight source change consumed by §5.
5. **Governed lifecycle only.** All §6 and §15 runs use `pnpm --filter @nzila/union-eyes e2e:governed` (invokes `scripts/lifecycle/run.ts`). Ad-hoc `pnpm test:qa:e2e` or `pnpm exec playwright test` invocations are disqualified for measurement — they bypass steps 1-9 and 11-14, cannot allocate a disposable DB, and cannot produce a valid `run-artifacts/{runId}/summary.json`.

## §5.3 Options considered

Options evaluated against §7 evidence (30/50 failures FSR-A, 60% dominance) and §4 causal chain (all 131 DNR = FSR-A cascade through Playwright's `beforeAll` semantics):

| # | Option | Admin included? | Handles FSR-A cause? | Preserves baseline shape? | Verdict |
|---|--------|-----------------|----------------------|---------------------------|---------|
| 1 | Single governed invocation, all 11 projects, §8 helper repair active (default) | ✅ | Partial — §8 raises per-run resilience, does not eliminate Turbopack cold-compile latency | ✅ (unchanged from Runs 1-3) | **PICKED** |
| 2 | Split into per-project sequential governed runs (11 separate DB allocations) | ✅ | Yes — each project boots against a warm server for its own tests, no cross-project cascade | ❌ redefines baseline (11 runs ≠ 1 run) | Disqualified by §5.2.3 |
| 3 | Warmup-then-full-run (single invocation, but prepend HTTP GETs to `/`, `/admin`, `/organization`, `/api/health/readiness` in `run.ts` step 8) | ✅ | Yes — attacks cold-compile latency at root | ⚠ mutates runner topology | **RESERVED as fallback** (see §5.6) |
| 4 | Grouped by weight (light projects together, admin/security separate) | ✅ | Partial — same as (2) at admin scope | ❌ redefines baseline | Disqualified by §5.2.3 |
| 5 | Prod-mode (`next build && next start`) | ✅ | Yes — eliminates Turbopack recompile at source | ❌ redefines dev-mode baseline (§6 spec is *dev-mode* comparison) | Disqualified by §5.2 spirit + §6 title |
| 6 | Admin exclusion | ❌ | N/A | N/A | **Disqualified by §5.2.1** |

## §5.4 Pick

**Strategy P (Primary): Single governed invocation, all 11 projects, §8 helper repair active.**

Concrete invocation for §6 and §15:

```powershell
cd C:\APPS\nzila-automation-phase0c\apps\union-eyes
# NZILA_E2E_RUN_ID set by governed runner; not overridden here
pnpm --filter @nzila/union-eyes e2e:governed
```

Environment (unchanged from Run 3 topology):
- `PLAYWRIGHT_PROJECTS` **unset** (all 11 projects execute)
- `PLAYWRIGHT_PORT` **unset** (defaults to 3002)
- `E2E_PRESERVE_DB` **unset** (disposable DB dropped after run)
- `QA_TEST_ENV=true` (inherited by all spawned processes)
- `NODE_ENV=test`

Expected shape per run:
- 1 disposable DB allocated (step 2), migrations applied (step 4), fixtures seeded (step 7)
- 1 Next.js dev server booted on 3002 with `--webpack` (step 8), readiness polled to 200 (120s cap)
- 1 auth-state generation pass (step 9) producing 4 storageState files + `summary.json`
- 1 Playwright process (step 10) executing all 11 projects with `workers:1`, `fullyParallel:false`, retries 2 (CI) / 0 (local)
- 1 artefact copy (step 11) into `run-artifacts/{runId}/`
- 1 server SIGTERM→SIGKILL (step 12), 1 DB drop (step 13), 1 port-release verify (step 14)
- Exit code = Playwright's own (step 15)

## §5.5 Rationale (evidence-anchored)

1. **§7 evidence (Run 3, 50 preserved failures)** confirms FSR-A is the dominant signature (60%), and §8 already targets it inside `_helpers.ts::ensureServerReady`. Options that additionally redesign the runner topology (2, 4) or replace dev-mode (5) would **confound** §6's measurement: we would not know whether FSR-A reduction was caused by §8 or by the topology change.
2. **§4 DNR causal chain** (all 131 DNR = FSR-A cascade through `beforeAll`) implies that once FSR-A itself is reduced, the cascade collapses without any further intervention. Measurement must be able to attribute a delta cleanly to §8; a fixed topology is a prerequisite.
3. **Non-negotiable §5.2.3 (single governed invocation)** derives from Phase 0C.2R's baseline semantics: Runs 1, 2, 3 were each a single governed invocation. §15 must be comparable to them. Split-invocation strategies would produce a lifecycle-integrity claim that Runs 1-3 do not carry.
4. **Admin's 84 DNR are recoverable-in-place**, not intrinsic. §4 register §6 shows admin DNR is 100% cascade, meaning: if the setup phase or the first admin spec's `beforeAll` completes (via §8 helper), 80+ DNR unblock automatically. No admin-specific source repair is required to move these tests out of DNR — §8 alone is sufficient at the DNR reduction axis. This is exactly the hypothesis §6 will measure.

## §5.6 Fallback ladder (if §6 5-run measurement fails to satisfy exit criteria)

Executed **only** if §6 measurement (5 fresh baselines at HEAD `bd7bca79c` + §8) shows either:
- Mean FSR-A rate > 5% of executed tests, OR
- Mean DNR rate > 5% of test inventory (193 executable per §3), OR
- Any single run has admin DNR ≥ 40 (regression vs. Run 3 admin DNR of 84 divided by 2).

Ladder rungs (each triggers a **new** strategy document `phase-0c2r-execution-strategy-vN.md`, N=2,3,…; §5's Strategy P is retained as the historical control):

1. **Rung 1 — Add readiness pre-warmup probes** in `scripts/lifecycle/run.ts` step 8, immediately after `pollReadiness` returns 200:
   - `GET /` (public landing)
   - `GET /admin` (largest surface)
   - `GET /organization`
   - `GET /api/health/readiness` (redundant confirmation)
   Purpose: attack Turbopack cold-compile latency at its source before Playwright's first `page.goto`. Preserves single-invocation shape.
2. **Rung 2 — Reorder Playwright project execution** by adding an explicit `dependencies` chain so `admin` runs *after* the light-weight projects (`public`, `member`, `staff`, `executive`) warm the server. Requires config edit; must be justified in §16 flake analysis.
3. **Rung 3 — Introduce prod-mode variant baseline** parallel to dev-mode. Not a replacement: `phase-0c2r-baseline-dev.md` and `phase-0c2r-baseline-prod.md` co-exist; §15 authoritative baseline remains **dev-mode**, prod-mode informs §17 validation.

Each rung requires user confirmation before execution (non-negotiable spirit: no scope creep without explicit sign-off).

## §5.7 Deliverables

| ID | Artefact | Status |
|----|----------|--------|
| §5.a | `phase-0c2r-execution-strategy.md` (this file) | ✅ authored |
| §5.b | Registered pick recorded in session memory `/memories/session/phase-0c2-progress.md` | pending (immediately after commit) |
| §5.c | Committed & pushed to `origin/fix/union-eyes-phase0c-e2e-stabilization` with 5/5 pre-commit hooks green and pre-push contract-tests 9426/9426 | pending (immediately after commit) |

## §5.8 What this document does NOT do

- Does **not** run any Playwright, Vitest, or lifecycle test.
- Does **not** modify `_helpers.ts`, `playwright.config.ts`, or `scripts/lifecycle/run.ts`.
- Does **not** redefine the Phase 0C.2R baseline: §15 remains the authoritative baseline, using Strategy P.
- Does **not** transfer any defect out of the failure signature register (§7 FSR-A..H remain owned in-scope).
- Does **not** claim the fallback ladder will be executed. Ladder activation is gated by §6 measurement outcomes and requires user consent.
- Does **not** authorise CUPE graduation, deploy, merge, or force-push.

---

**End of §5 — Phase 0C.2R execution strategy pick.**
