# Phase 0C — Starting Checkpoint, Mission & Baseline Reconciliation

**Authored:** 2026-05-14 (Phase 0C kickoff)
**Author:** Automation agent, under human maintainer authorization
**Scope:** Sections §1, §2, §3, §4 of the Phase 0C authorization
**Status:** RECORDED — foundational precondition satisfied

---

## §1 — Starting checkpoint (verified truth, not assumption)

Verification was performed inside the accepted Phase 0B baseline worktree
`C:\APPS\nzila-automation-phase0b-clean` before any new branch was cut.

| Field                     | Observed value                                                                 | Match |
| ------------------------- | ------------------------------------------------------------------------------ | :---: |
| Working directory         | `C:\APPS\nzila-automation-phase0b-clean`                                       |   ✓   |
| Branch                    | `fix/union-eyes-phase0b-clean`                                                 |   ✓   |
| HEAD                      | `11ac20821b4ce3bb050272704f09a1a7c226ca8f`                                     |   ✓   |
| Remote HEAD               | `11ac20821b4ce3bb050272704f09a1a7c226ca8f` (identical)                          |   ✓   |
| Ahead / behind of remote  | `0 / 0`                                                                        |   ✓   |
| Working tree              | Empty (`git status --porcelain` returned no lines)                             |   ✓   |
| Top commits (`git log -5`) | `11ac20821`, `272221d46`, `8c19cdc0c`, `690c9cbf5`, `8e6ac8f30`               |   ✓   |

Every value corresponds to the accepted Phase 0B.3 GREEN closure. No divergence,
no in-flight edits, no orphan changes. Phase 0C therefore begins from an
undisturbed accepted baseline.

---

## §2 — Phase 0C branch creation (executed)

A separate worktree and branch were created from the accepted HEAD. The Phase 0B
worktree was left completely untouched.

```
git worktree add -b fix/union-eyes-phase0c-e2e-stabilization \
  ../nzila-automation-phase0c 11ac20821
```

Post-create verification:

| Field                | Value                                                                        |
| -------------------- | ---------------------------------------------------------------------------- |
| Worktree             | `C:\APPS\nzila-automation-phase0c`                                          |
| Branch               | `fix/union-eyes-phase0c-e2e-stabilization`                                   |
| HEAD                 | `11ac20821b4ce3bb050272704f09a1a7c226ca8f`                                   |
| Status               | Clean                                                                        |
| Historical branch    | `fix/union-eyes-reality-remediation` — **NOT merged, NOT cherry-picked**     |
| Timeout sweep        | Repository-wide test-timeout sweep — **NOT imported**                        |
| Force push           | Not used                                                                     |
| Phase 0B history     | Not rewritten                                                                |

Concurrent worktrees at the time of branch creation:

```
C:/APPS/nzila-automation               c83e55efc [fix/union-eyes-reality-remediation]
C:/APPS/nzila-automation-phase0b-clean 11ac20821 [fix/union-eyes-phase0b-clean]
C:/APPS/nzila-automation-phase0c       11ac20821 [fix/union-eyes-phase0c-e2e-stabilization]  ← Phase 0C
C:/APPS/nzila-courtlens-phase0         432552fa9 [docs/courtlens-refactor-phase0-v3]
C:/APPS/nzila-gap3-baseline            6b6d3736d (detached HEAD)
C:/APPS/nzila-gap3-final               f526f9c9b [proof/courtlens-gap3-final]
C:/APPS/nzila-gap3-proof               d7adb10ff (detached HEAD)
```

The Phase 0C worktree and the Phase 0B worktree share the same commit but live in
separate directories, so no work performed in Phase 0C can implicitly mutate the
accepted Phase 0B branch.

---

## §3 — Mission statement

Phase 0C exists to convert the Union Eyes Playwright and end-to-end test surface
into a **deterministic, reproducible baseline**. That means:

1. **Reproducibility.** Every included E2E test is expected to pass or fail for a
   documented, structural reason — not because of timing, port drift, stale seed
   state, environment leakage, or unstable auth.
2. **Determinism of the environment.** The application under test must be brought
   up from a known state (schema, seed, feature flags, ports, auth), and each
   test must observe that state — or explicitly, in isolation, mutate it.
3. **Honest classification.** Every test currently in the tree must land in one
   of four classes: (A) part of the deterministic baseline, (B) intentionally
   deferred to a later phase with a mechanism preventing accidental execution,
   (C) blocked by a real external dependency and marked as such, or
   (D) obsolete/duplicate and removed with rationale.
4. **Evidence-first closure.** Phase 0C closes only when the full E2E run under
   the new lifecycle produces a stable pass set across multiple executions, a
   documented set of intentionally skipped tests, and either zero unexplained
   failures or a truthful AMBER classification. No opinions substitute for
   artifacts.

Phase 0C explicitly does **not** attempt any of the following:

- Deploy anything to staging (that is Phase 0D territory).
- Implement any new CUPE feature or graduate any CUPE scenario.
- Retrofit the tenant resolver across every remaining Union Eyes route (the
  Phase 0B.3 open-items register captures that work, and its scope belongs to
  later capability phases, not to E2E baseline integrity).
- Merge, cherry-pick, or import commits from
  `fix/union-eyes-reality-remediation` or the repository-wide test-timeout sweep.
- Modify the accepted Phase 0B branch `fix/union-eyes-phase0b-clean`.

Phase 0C hard-stops after its final report. The next phase is not auto-scheduled.

---

## §4 — Baseline reconciliation (no historical count assumption)

Earlier documents in the audit trail cite a raw pass/fail count of
`116 passed / 24 failed / 10 skipped / 42 not run` for the previous E2E run.
Phase 0C treats those numbers as **historical context only**. They will not be
carried into the Phase 0C classification, and no Phase 0C evidence relies on
them being current.

Reasons:

- The number of Playwright specs, their skip mechanisms, and their coverage
  have moved between the earlier run and the Phase 0B.3 GREEN closure. Even a
  quick directory walk in the Phase 0C worktree finds spec files that did not
  exist under the previous accounting (e.g. `apps/union-eyes/e2e/pilot-mode-gating.spec.ts`,
  `apps/union-eyes/tests/e2e/cross-org-blocking.spec.ts`) and vice versa.
- Environmental determinants (auth path, readiness path, DB fixture, port
  policy) have not yet been stabilized under Phase 0C; running the old suite as
  is would only reproduce old flake, not measure the target baseline.
- The point of §5–§21 is precisely to re-inventory, re-classify, and re-run
  under a stable lifecycle. Any Phase 0C count is what §5 and §20 produce, not
  what a prior run remembered.

Accordingly, the phase-0c inventory (§5) is authoritative and starts from a
directory walk of the current worktree. Prior counts are cited only for
historical context inside `phase-0c-e2e-inventory.md` (§5) and are not used as
success criteria.

---

## Discovered starting surface (informational, not yet classified)

To ease the reader's expectations for §5, a raw enumeration of the current
Union Eyes Playwright surface as observed at `HEAD=11ac20821` follows. This is
**not** the §5 classification — that will be produced with per-test fields.

**Playwright configuration.** Single project, chromium only.

- File: `apps/union-eyes/playwright.config.ts`
- `testDir: '.'`, `testMatch: ['e2e/**/*.spec.ts', 'tests/e2e/**/*.spec.ts']`
- `testIgnore: ['tests/e2e/ue-workflow.spec.ts', '**/.next/**', '**/node_modules/**']`
- Test timeout: 60_000; navigation: 45_000; action: 20_000
- Workers: 1; fullyParallel: false; retries: 0 locally, 2 on CI
- webServer command (local): `pnpm dev` on port 3002, timeout 120_000
- Environment injected by webServer.env: `QA_TEST_ENV=true`, `NODE_ENV=test`,
  `PLAYWRIGHT_TEST_AUTH=true`, `UE_E2E_RISK_BYPASS=true`, plus the resolved
  values from `getE2EEnv()`

**Test files (raw list, before classification).**

Under `apps/union-eyes/e2e/`:

- `authenticated-role-navigation.spec.ts`
- `cape-features.spec.ts`
- `cba-intelligence.spec.ts`
- `dashboard.spec.ts`
- `empty-states.spec.ts`
- `member-journey.spec.ts`
- `missing-routes.spec.ts`
- `no-fsm-overexposure.spec.ts`
- `ocra-adaptive-flow.spec.ts`
- `permission-boundaries.spec.ts`
- `pilot-journey.spec.ts`
- `pilot-mode-gating.spec.ts`
- `smoke.spec.ts`
- `stakeholder-demo-journeys.spec.ts`
- `ue-workflow.spec.ts`
- `governance/deployment-*.spec.ts` (subdirectory)

Under `apps/union-eyes/tests/e2e/`:

- `admin-assignment.spec.ts`
- `auditor-readonly.spec.ts`
- `auth-failure-handling.spec.ts`
- `auth-session-*.spec.ts`
- `case-escalation.spec.ts`
- `case-resolution.spec.ts`
- `cross-org-blocking.spec.ts`
- `evidence-misuse.spec.ts`
- `external-ux-tester.spec.ts`
- `member-intake.spec.ts`
- `negative-workflow-transitions.spec.ts`
- `org-isolation-negative.spec.ts`
- `steward-review.spec.ts`
- `ue-workflow.spec.ts` (currently ignored via `testIgnore`)

**Existing helpers touched by the lifecycle.**

- Env resolver: `apps/union-eyes/tests/e2e/e2e-env.ts`
- Base helpers: `apps/union-eyes/tests/e2e/_helpers.ts` (readiness poll,
  seed-or-verify, login, permission assertions)
- Role fixtures & auth: `apps/union-eyes/e2e/helpers/auth.ts`,
  `apps/union-eyes/e2e/helpers/role-fixtures.ts`
- Fixture data: `apps/union-eyes/tests/fixtures/test-users.ts`,
  `apps/union-eyes/tests/fixtures/test-orgs.ts`,
  `apps/union-eyes/tests/fixtures/test-cases.ts`
- Seed: `apps/union-eyes/scripts/seed-test-env.ts` (production-guarded)

**Readiness endpoints already present** (multiple, none of them purpose-built
for E2E lifecycle):

- `/api/health`
- `/api/health/liveness`
- `/api/auth_core/health/`
- `/api/pilot/readiness`
- `/api/status`

Phase 0C §8 will introduce a single, purpose-built readiness endpoint
(`/api/e2e/readiness`) that verifies schema presence, seed presence, feature
flag state, and auth reachability in one call — as required by the
authorization document. The existing endpoints will be left in place;
Phase 0C does not delete them.

**Ports.** Union Eyes dev server is pinned to 3002 in `next dev --port 3002`
and in the Playwright config's `webServer.port`. §13 will formalize the port
discipline in a single source of truth.

---

## Precondition state — READY to advance to §5

- [x] §1 precondition satisfied (starting checkpoint recorded)
- [x] §2 precondition satisfied (branch cut, worktree isolated)
- [x] §3 mission recorded in this artifact
- [x] §4 reconciliation recorded in this artifact
- [ ] §5 E2E inventory — next artifact (`phase-0c-e2e-inventory.md` + `.json`)

No implementation work has been performed yet. The Phase 0C worktree HEAD
remains at `11ac20821` until the first Phase 0C commit is made under §22's
focused commit plan.
