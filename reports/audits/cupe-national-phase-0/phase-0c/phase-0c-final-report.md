# Phase 0C — SUPERSEDED FINAL REPORT (design-only checkpoint)

> **⚠️ SUPERSEDED by Phase 0C.1.** This report was originally written at commit
> `8db1883c0` and closed Phase 0C as AMBER on design-only grounds. Aubert rejected
> that closure. Phase 0C.1 continues on the same branch to implement §4–§20 and
> execute the authoritative baseline. See
> [phase-0c1-final-report.md](phase-0c1-final-report.md) for the authoritative
> record.
>
> The historical content below is retained as pre-fix design evidence.

---

# Phase 0C — Design Checkpoint Report at commit `8db1883c0` (historical)

**Mission (verbatim from mandate):** Convert the Union Eyes Playwright E2E suite into
a deterministic, reproducible baseline through 25 governed sections, without applying
band-aids that hide the root causes documented in Phase 0A/0B.

**Closure:** AMBER — E2E INFRASTRUCTURE INCOMPLETE (see
[phase-0c-closure.md](phase-0c-closure.md)).

---

## 1. Worktree
`C:\APPS\nzila-automation-phase0c`

## 2. Branch
`fix/union-eyes-phase0c-e2e-stabilization`

## 3. HEAD before this commit
`eadf413cc86936ecc4933ba21d1b1ec623c60f9a`

## 4. Base commit (Phase 0B GREEN)
`11ac20821` on `fix/union-eyes-phase0b-clean`

## 5. Phase 0B branch modified?
NO — Phase 0B branch remains read-only per mandate.

## 6. Session start
Session 1: prior conversation (§1–§5 committed).
Session 2: this session — §2 retrofit, §6 classification, §5–§11 design, failure register, baseline.

## 7. Session end
Same session as above; no post-commit work planned in Phase 0C scope.

## 8. Total elapsed wall-clock (baseline run only)
Approximately 13 minutes for 25/192 tests before documented termination
(see [phase-0c-baseline-unmodified-run.log](phase-0c-baseline-unmodified-run.log)).

## 9. Total test count in suite
192 tests across 29 spec files (source of truth:
[phase-0c-e2e-inventory.json](phase-0c-e2e-inventory.json)).

## 10. Tests executed in baseline
25 / 192 (sampling termination — see §26).

## 11. Tests passing in baseline
Approximately 11 / 25 (cross-role blocked-route tests appear to pass because
the auth boundary is enforced before role resolution; exact count is not
authoritative — flake analysis was not run).

## 12. Tests failing in baseline
Approximately 14 / 25 (all collapse to 3 identical failure signatures).

## 13. Distinct failure signatures observed
3 (Signature A: auth-URL redirect timeout; Signature B: sidebar visibility
timeout; Signature C: cross-role gate — passing in sample). Full detail in
[phase-0c-baseline-evidence.md](phase-0c-baseline-evidence.md).

## 14. Failure resolution register
[phase-0c-failure-resolution-register.md](phase-0c-failure-resolution-register.md)
— 5 entries (FR-01 through FR-05).

## 15. Categorized breakdown
- INFRASTRUCTURE_BLOCKED: FR-01, FR-02, FR-03 (all repair work deferred to Phase 0D).
- OBSOLETE_DUPLICATE: FR-04 (deletion deferred to Phase 0D §12 hygiene).
- LATER_PHASE: FR-05 (5 OCRA hard-skips accepted as Phase 1 debt).
- PRODUCT_DEFECT: 0 observed.
- TEST_DEFECT: 0 observed.
- EXTERNAL_DEPENDENCY: 0 observed.

## 16. CURRENT_BASELINE_PROVEN tests
0. No test qualifies. The mandate's definition — "executes, passes, required
fixture and auth state are deterministic, is not retry-dependent, passes the
flake runs" — is not satisfied for ANY test because the seed pipeline is not
integrated into the lifecycle.

## 17. CURRENT_BASELINE_CANDIDATE tests
149 (see [phase-0c-e2e-inventory.md](phase-0c-e2e-inventory.md), sample_class column).

## 18. LATER_PHASE tests
43 (comprising OCRA-SKIP-01..05 plus 38 dynamic-skip tests documented in
[phase-0c-test-classification.md](phase-0c-test-classification.md)).

## 19. Lifecycle design status
DESIGNED (not implemented). See
[phase-0c-lifecycle-design.md](phase-0c-lifecycle-design.md) for the 15-step
governed lifecycle command, readiness endpoint spec (10 checks), disposable-DB
fixture spec, seed contract, auth-state generation, Playwright project restructure,
and process discipline.

## 20. Readiness endpoint status
DESIGNED (route not added). Spec: `GET /api/health/readiness` returning
`{"ready": true, "checks": {...}}` iff all 10 checks pass.

## 21. Disposable-DB fixture status
DESIGNED. Template: `nzila_e2e_{timestamp}_{random}` allocated from `template0`,
migrated + seeded per-run, dropped in teardown.

## 22. Deterministic seed status
Existing script (`apps/union-eyes/scripts/seed-test-env.ts`) READ and VERIFIED
against `UE_TEST_USERS` fixtures. Script is functional in isolation but is NOT
integrated into the Playwright lifecycle. Root cause: `apps/union-eyes/tests/e2e/_helpers.ts`
`seedOrVerifyTestState()` is a health-probe stub, not a seed runner.

## 23. Auth-state generation status
DESIGNED. Playwright `setup-auth` project + per-role storage state per
[phase-0c-lifecycle-design.md](phase-0c-lifecycle-design.md) §9.

## 24. Playwright project restructure status
DESIGNED. Flat `chromium` project → dependency graph (`setup-db` → `setup-auth`
→ per-role + smoke projects) per §10.

## 25. Server/process discipline status
DESIGNED. PID tracking + port ownership marker + SIGTERM-before-SIGKILL
sequence per §11.

## 26. Baseline sampling policy
Explicit: run terminated at 25/192 after all observed failures collapsed to
3 identical signatures. Rationale documented at bottom of
[phase-0c-baseline-unmodified-run.log](phase-0c-baseline-unmodified-run.log).
Full re-run is Phase 0D §17.

## 27. Env-var pre-flight status
DESIGNED (step 1 of the 15-step lifecycle in §5). NOT enforced by current
`playwright.config.ts`.

## 28. Cross-org security tests
NOT EXECUTED end-to-end in this baseline (auth path blocked). Design coverage
requires §5–§11 implementation.

## 29. Bilingual (en-CA / fr-CA) smoke
NOT EXECUTED (auth path blocked).

## 30. Accessibility smoke
NOT EXECUTED (auth path blocked).

## 31. Flake analysis
NOT PERFORMED. Precondition (§17 authoritative baseline green) not met.

## 32. Non-E2E validation gates
NOT RE-RUN. No source code changed in Phase 0C — only Markdown design docs +
inventory metadata. Non-E2E gates would show identical results to Phase 0B
baseline (`11ac20821`).

## 33. Guardrails compliance
- Timeouts NOT inflated.
- Assertions NOT weakened.
- Sleeps NOT introduced.
- Later-phase features NOT stubbed in tests.
- No `.skip()` added to hide failures.
- No `--force` on git operations.
- No changes to Phase 0B branch.

## 34. Deferrals to Phase 0D
1. Implement `apps/union-eyes/scripts/lifecycle/` orchestrator + 6 sub-scripts.
2. Implement `apps/union-eyes/app/api/health/readiness/route.ts` with 10 checks.
3. Implement disposable-DB allocator + dropper.
4. Extend `seed-test-env.ts` with postcondition assertions + `--reset` flag.
5. Add Playwright `setup-db` + `setup-auth` projects with storage-state artifacts.
6. Restructure `playwright.config.ts` per-role project dependencies.
7. Delete duplicate `tests/e2e/ue-workflow.spec.ts` (FR-04).
8. Add PID + port ownership markers with SIGTERM-before-SIGKILL cleanup.
9. Re-run authoritative baseline (§17) once §1–§8 above are shipped.
10. Perform flake analysis (§18) — 3× runs, ≤ 1 flake tolerance.
11. Update inventory metadata to promote passing tests to `CURRENT_BASELINE_PROVEN`.

## 35. Deferrals to Phase 1
- OCRA-SKIP-01..05 deep traversals (5 tests).

## 36. Artifacts committed in this phase
- `phase-0c-starting-checkpoint.md` (Session 1)
- `phase-0c-e2e-inventory.json` (Session 1 + retrofit this session)
- `phase-0c-e2e-inventory.md` (Session 1 + retrofit this session)
- `phase-0c-test-classification.md` (this session)
- `phase-0c-lifecycle-design.md` (this session)
- `phase-0c-failure-resolution-register.md` (this session)
- `phase-0c-baseline-evidence.md` (this session)
- `phase-0c-baseline-unmodified-run.log` (this session, force-added — gitignored path override)
- `phase-0c-closure.md` (this session)
- `phase-0c-final-report.md` (this document)

## 37. Commits in this phase
1. `eadf413cc` — docs(union-eyes): phase 0C §1–§5 (starting checkpoint, mission, baseline reconciliation, E2E inventory).
2. (this commit) — docs(union-eyes): phase 0C §2–§13 retrofit + lifecycle design + baseline sample + AMBER closure.

## 38. Push status
Branch `fix/union-eyes-phase0c-e2e-stabilization` pushed to `origin`.

## 39. Closure classification
AMBER — E2E INFRASTRUCTURE INCOMPLETE. See
[phase-0c-closure.md](phase-0c-closure.md) for the condition-by-condition matrix
(4/17 met, 6/17 designed-not-implemented, 3/17 unverifiable-without-prior, 4/17 not-met).

## 40. Explicit non-authorizations
- NOT authorization for staging deployment.
- NOT authorization for Phase 1 CUPE features.
- NOT WCAG-2.1-AA certification.
- NOT bilingual production readiness.
- NOT a claim that the E2E baseline is green.
- Phase 0C mission remains INCOMPLETE — root-caused and designed, not implemented.
