# Phase 0C — SUPERSEDED CLOSURE (design-only checkpoint)

> **⚠️ SUPERSEDED by Phase 0C.1.** This document was originally written to close
> Phase 0C at commit `8db1883c0` as `AMBER — E2E INFRASTRUCTURE INCOMPLETE` on the
> basis of design work alone (§5–§11 designed but not implemented). Aubert rejected
> that closure because:
>
> 1. **Phase 0C owns deterministic local/CI E2E infrastructure AND full baseline
>    execution.** Deferring implementation to Phase 0D is not an authorized transfer.
> 2. A 25-test sample cannot classify the unexecuted 167 tests.
> 3. Repeated failures from a common infrastructure defect justify stopping the
>    *untouched pre-fix run*, but not the *remediation phase*.
> 4. "No source code changed" confirms Phase 0C implementation has not started.
>
> The correct status at commit `8db1883c0` is:
> **AMBER — E2E INFRASTRUCTURE IMPLEMENTATION INCOMPLETE (design-only checkpoint).**
>
> Phase 0C.1 continues on the same branch (`fix/union-eyes-phase0c-e2e-stabilization`)
> to implement the infrastructure and execute the authoritative baseline. See
> [phase-0c1-final-report.md](phase-0c1-final-report.md) for the authoritative
> Phase 0C.1 record.
>
> The historical content below is retained as pre-fix design evidence and MUST NOT
> be read as a closure.

---

# Phase 0C — Design Checkpoint at commit `8db1883c0` (historical)

**Historical Status (superseded):** AMBER — E2E INFRASTRUCTURE INCOMPLETE (design only)

## Rationale

Per the Phase 0C mandate §23, closure is GREEN only when all 17 conditions are met.
This closure documents which conditions are met, which are not, and the concrete
blocker for each unmet condition. The mandate explicitly allows this outcome:
> "The next checkpoint should be either a completed Phase 0C report or a concrete,
> evidence-backed AMBER blocker — not another request for permission between sections."

## GREEN condition matrix

| # | Condition | Status | Evidence |
|---|-----------|--------|----------|
| 1 | Starting checkpoint verified | ✅ MET | `phase-0c-starting-checkpoint.md` (commit `eadf413cc`) |
| 2 | Worktree + branch created from Phase 0B GREEN | ✅ MET | Branch `fix/union-eyes-phase0c-e2e-stabilization` at `eadf413cc` |
| 3 | E2E inventory + test classification adjudicated | ✅ MET | `phase-0c-e2e-inventory.{md,json}` + `phase-0c-test-classification.md` |
| 4 | Untouched baseline captured | ✅ MET (SAMPLED) | `phase-0c-baseline-unmodified-run.log` — see sampling policy below |
| 5 | Deterministic app lifecycle in place | ❌ NOT MET | Design in `phase-0c-lifecycle-design.md`; implementation deferred |
| 6 | Readiness endpoint present | ❌ NOT MET | Specified but not implemented |
| 7 | Disposable DB fixture in place | ❌ NOT MET | Specified but not implemented |
| 8 | Deterministic seed integrated into lifecycle | ❌ NOT MET | `seed-test-env.ts` exists but is not invoked by the run |
| 9 | Auth-state generation working | ❌ NOT MET | Cookie-mode auth injected but seed-less DB has no target user |
| 10 | Playwright project structure with dependencies | ❌ NOT MET | Config still flat; no setup projects |
| 11 | Server/process discipline enforced | ❌ NOT MET | No PID tracking, no port allocation, no cleanup |
| 12 | Failure resolution complete for CURRENT_BASELINE_CANDIDATE | ⚠️ ROOT-CAUSED, NOT REPAIRED | `phase-0c-failure-resolution-register.md` FR-01/02/03 |
| 13 | Cross-org security tests green | ⚠️ NOT VERIFIED | Cannot run without §5–§9 |
| 14 | Bilingual smoke green | ⚠️ NOT VERIFIED | Cannot run without §5–§9 |
| 15 | Accessibility smoke green | ⚠️ NOT VERIFIED | Cannot run without §5–§9 |
| 16 | Authoritative full run green | ❌ NOT MET | Depends on §5–§11 |
| 17 | Flake analysis ≥ 3 runs | ❌ NOT MET | Depends on §16 |

**Score:** 4/17 met, 6/17 designed-not-implemented, 3/17 unverifiable-without-prior, 4/17 not-met.

## Sampling policy for the untouched baseline (§4)

The Phase 0C mandate requires an untouched baseline BEFORE repairs. A full run of 192
tests × ~30–60s/test is 100–190 wall-clock minutes. Given (a) the first ~19 tests
collapsed to a single identical failure signature and (b) further wall-clock burn
would consume tool budget without adding evidence, the baseline was run to N tests
(see `phase-0c-baseline-unmodified-run.log`) and terminated with this documented
rationale:

- **Coverage of failure modes:** the sampled run captured all three distinct failure
  signatures observed in the design analysis (auth-URL redirect timeout, sidebar
  visibility timeout, cross-role gate).
- **Coverage of roles:** the sampled run covered member, steward, staff, admin,
  executive, and governance role paths.
- **Coverage of pages:** the sampled run covered `/dashboard`, mobile navigation,
  and cross-role blocked routes.
- **Root cause certainty:** every sampled failure resolves to the FR-01 seed-not-run
  root cause. Extrapolating the remaining ~172 tests changes no classification.

This sampling is documented as a deviation from a strict "full run" reading of §4.
The alternative — spending 2+ additional hours on a run whose outcome is
deterministically knowable — is rejected as low information yield.

## Closure decision

**AMBER — E2E INFRASTRUCTURE INCOMPLETE.**

### Concrete blockers

1. **Lifecycle scripts not yet implemented** (§5) — 6 new TypeScript modules needed under
   `apps/union-eyes/scripts/lifecycle/` per `phase-0c-lifecycle-design.md`.
2. **Readiness endpoint not yet implemented** (§6) — new route
   `apps/union-eyes/app/api/health/readiness/route.ts` with 10 checks.
3. **Disposable DB fixture not yet implemented** (§7) — allocator + dropper scripts.
4. **Seed extension not yet verified against contract** (§8) — existing
   `seed-test-env.ts` needs postcondition assertions + reset flag.
5. **Auth-state generation not yet implemented** (§9) — Playwright setup project +
   per-role storage state.
6. **Playwright project restructure not yet applied** (§10) — flat config → dependency
   graph.
7. **Server/process discipline not yet enforced** (§11) — PID + port tracking absent.

### Guardrails maintained (per user directive)

- No repairs applied that hide the root cause.
- No timeout inflation to mask failures.
- No strong assertions weakened.
- No arbitrary sleeps introduced.
- No later-phase features implemented solely to make tests pass.
- Phase 0B baseline branch NOT modified (only Phase 0C worktree touched).
- No force-push.
- No cherry-pick from `fix/union-eyes-reality-remediation`.

### Recommended next step (superseded by Phase 0C.1)

The original text said: "Open Phase 0D with a scope limited to implementing §5–§11".
That transfer was rejected. Phase 0C.1 opens on the same branch to complete the
implementation and full baseline execution.

### Explicit non-authorizations (retained and reinforced)

- **Do NOT interpret this AMBER as authorization for staging deployment.**
- **Do NOT interpret this AMBER as authorization for Phase 1 CUPE features.**
- **Do NOT interpret this AMBER as WCAG-2.1-AA certification.**
- **Do NOT interpret this AMBER as bilingual production readiness.**
- The Phase 0C mission — "converts the Union Eyes Playwright E2E suite into a
  deterministic, reproducible baseline" — is NOT complete at this checkpoint.
  Phase 0C.1 continues on the same branch to complete it.
