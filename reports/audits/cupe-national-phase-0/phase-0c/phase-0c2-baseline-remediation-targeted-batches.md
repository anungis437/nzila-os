# Phase 0C.2 §BR-6 — Baseline Remediation: Targeted Batches A–F

**HEAD context**: builds on §BR-3 (beforeAll cascade forensic), §BR-4 (lifecycle-teardown fix + guard), and §BR-5 (failure-signature register). See:

- `phase-0c2-baseline-remediation-run3-beforeall-cascade.md`
- `phase-0c2-baseline-remediation-lifecycle-teardown-fix.md`
- `phase-0c2-baseline-remediation-failure-signature-register.md`
- `phase-0c2-baseline-run-3-failure-register.csv`

**Redirection mandate under which this section executes** (verbatim):

> **AMBER — BASELINE PRODUCT/TEST DEFECTS REMAIN** … The next action is not another blind full run. First explain the 131 unexecuted tests, repair the lifecycle teardown, and **make each populated Playwright project pass independently**. Every did-not-run test receives a cause. Current-baseline did-not-run must reach zero.

§BR-6 provides the **runner tooling** that §BR-8 will then use to prove each populated project passes in isolation. It does **not** rewrite the baseline; it introduces one narrowly-scoped, opt-in filter that composes with the existing governed lifecycle end-to-end.

---

## §BR-6.1 — Rationale for staged batches (not a single full run)

The §BR-3 forensic established that Run 3's dominant failure was **not** a set of product defects but a **shared infrastructure cascade**: 29 of the 50 recorded failures (58%) traced to `beforeAll` throwing "Server readiness check timed out", and the 131 "did-not-run" tests were the tail of that same cascade (Playwright marks the first test in a `describe` as **failed** when `beforeAll` throws and every remaining test in the block as **did-not-run** — distinct counts, not double-counting).

Combined:

- 50 failed  
- 131 did-not-run  
- 29 (of 50) failures = same `beforeAll` cascade  
- ⇒ **160 of 212 tests (75%) blocked by one shared root cause**  
- ⇒ True unique test-level failure surface = **21 tests across 4 projects** (public 3, member 4, steward 6, admin 8; §BR-5 §3–§7).

Because the cascade appears **only after cumulative dev-server compile pressure exceeds a threshold** (identified in §BR-3 as ~40 minutes of sustained Next.js dev compilation under `workers=1, fullyParallel=false`), the right diagnostic path is **not** another full run — a full run reproduces the pressure and re-buries the signal. Instead, we run each project in a **short-enough window on a fresh dev-server boot** that the cascade cannot recur, exposing whichever failures are genuinely test-level.

The batches below are sized so no single batch approaches the ~40-minute compile-pressure threshold observed in Run 3.

## §BR-6.2 — The six batches

Batches are grouped by (a) authentication regime (public vs. persona vs. security cold-start), (b) approximate spec count, and (c) whether the project contains real §BR-5 §3–§7 test-level failures.

| Batch | Projects | Specs | Test count (Run 3) | Real failures (§BR-5) | Purpose |
|:--:|:--|:--:|:--:|:--:|:--|
| **A** | `setup, public` | 1 + 3 = 4 | ~1 + 12 = 13 | 3 (public) | Prove unauthenticated flows pass; diagnose `no-fsm-overexposure` `toHaveURL` failures. |
| **B** | `setup, member, steward, staff, executive` | 1 + 3 + 2 + 4 + 1 = 11 | ~1 + 18 + 20 + 24 + 6 = ~69 | 4 member + 6 steward + 0 staff + 0 executive = 10 | Bulk persona coverage minus admin. Persona-scoped state, no admin-privilege drift. |
| **C** | `setup, admin` | 1 + 11 = 12 | ~1 + 104 = 105 | 8 (admin: OCRA + stakeholder + governance) | Isolate admin — largest project, contains the OCRA/stakeholder timing signatures. |
| **D** | `setup, security` | 1 + 6 = 7 | ~1 + 24 = 25 | 0 | Cold-start (empty storageState) negative flows. Expected all green in isolation. |
| **E** | `setup, bilingual-en, bilingual-fr` | 1 + 2 = 3 | ~1 + 14 = 15 | 0 | Bilingual smoke (glob `testMatch`, 7 areas × 2 locales). |
| **F** | `setup, accessibility` | 1 + 1 = 2 | ~1 + 5 = 6 | 0 | Accessibility smoke (glob `testMatch`, 5 areas). |

**Total wired**: 4 + 10 + 11 + 6 + 2 + 1 = **34 populated specs**, matching the count enumerated in §BR-5 §1.

Batches D + E + F are the six §BR-5 zero-real-defect projects — they are expected to return green in isolation without any source edit, converting 131 did-not-run tests to `passed` purely by fresh-server isolation. Batches A + B + C carry the 21 unique test-level failures §BR-6 must diagnose.

## §BR-6.3 — Runner mechanism (`PLAYWRIGHT_PROJECTS` env var)

The governed lifecycle (`apps/union-eyes/scripts/lifecycle/run.ts`) step 10 now honours a new opt-in environment variable **without altering** any of the surrounding 14 steps:

```ts
// scripts/lifecycle/run.ts — step 10 (excerpt)
const projectFilter = parseProjectFilter(process.env.PLAYWRIGHT_PROJECTS)
const playwrightArgs = ['exec', 'playwright', 'test']
for (const projectName of projectFilter) {
  playwrightArgs.push('--project', projectName)
}
```

- **Syntax**: comma- and/or whitespace-separated list of project names as declared in `PLAYWRIGHT_PROJECT_MANIFEST` at `apps/union-eyes/playwright.config.ts`.
- **Empty / unset**: filter is not applied — Playwright runs all wired projects (existing baseline behaviour, preserved bit-for-bit).
- **Composition**: the filter passes through as one repeated `--project <name>` flag per entry. Playwright ANDs repeated flags by union.
- **Setup is always required**: every persona project declares `dependencies: ['setup']`. Batches B/C/D always include `setup`. Batches A/E/F include `setup` too — `setup` writes `playwright/.auth/summary.json` which `parseProjectFilter` downstream artifacts reference.
- **No baseline drift**: full-baseline invocation still reads `pnpm --filter @nzila/union-eyes e2e:governed` — the filter is entirely additive.
- **Regression guard**: `apps/union-eyes/tests/lifecycle-project-filter.test.ts` (14 tests) pins the parser contract statically. If parsing regresses, `pnpm test` fails locally and in CI — the six-batch strategy cannot silently degrade to "run everything".

The exported helper `parseProjectFilter(raw: string | undefined | null): string[]` from `scripts/lifecycle/run.ts` is:

- Whitespace-stripping
- Empty-entry-dropping (survives `,,`, leading/trailing `,`, adjacent whitespace)
- Order-preserving
- Duplicate-preserving (dedup is Playwright's job downstream)
- Hyphen-safe (accepts `bilingual-en`, `bilingual-fr`)

The `main()` invocation is also now guarded by `require.main === module` so importing `run.ts` from vitest never boots the orchestrator (the initial version of the regression guard triggered `step 1: preflight` on import — fixed before commit).

## §BR-6.4 — How to run each batch

All commands run from the worktree root (`C:\APPS\nzila-automation-phase0c`). Each batch takes ~2–8 minutes of Playwright wall time plus ~30–60 s of lifecycle overhead, and each runs on a **fresh dev-server boot** (governed step 8 always spawns a new Next.js dev process), so no batch can accumulate the compile-pressure that produced the §BR-3 cascade.

```powershell
# Batch A — public (no auth required)
$env:PLAYWRIGHT_PROJECTS = 'setup,public'
pnpm --filter @nzila/union-eyes e2e:governed *> reports/audits/cupe-national-phase-0/phase-0c/phase-0c2-batch-a.log

# Batch B — member + steward + staff + executive
$env:PLAYWRIGHT_PROJECTS = 'setup,member,steward,staff,executive'
pnpm --filter @nzila/union-eyes e2e:governed *> reports/audits/cupe-national-phase-0/phase-0c/phase-0c2-batch-b.log

# Batch C — admin alone (largest — 11 specs, ~104 tests)
$env:PLAYWRIGHT_PROJECTS = 'setup,admin'
pnpm --filter @nzila/union-eyes e2e:governed *> reports/audits/cupe-national-phase-0/phase-0c/phase-0c2-batch-c.log

# Batch D — security (cold-start negative flows)
$env:PLAYWRIGHT_PROJECTS = 'setup,security'
pnpm --filter @nzila/union-eyes e2e:governed *> reports/audits/cupe-national-phase-0/phase-0c/phase-0c2-batch-d.log

# Batch E — bilingual-en + bilingual-fr
$env:PLAYWRIGHT_PROJECTS = 'setup,bilingual-en,bilingual-fr'
pnpm --filter @nzila/union-eyes e2e:governed *> reports/audits/cupe-national-phase-0/phase-0c/phase-0c2-batch-e.log

# Batch F — accessibility
$env:PLAYWRIGHT_PROJECTS = 'setup,accessibility'
pnpm --filter @nzila/union-eyes e2e:governed *> reports/audits/cupe-national-phase-0/phase-0c/phase-0c2-batch-f.log

Remove-Item Env:\PLAYWRIGHT_PROJECTS
```

Between batches, the orchestrator's step 12 (`stop-server`) plus §BR-4's decoupled log-stream teardown guarantee the dev-server child tree has terminated and no orphan test DB remains (step 13 `drop-db` + step 14 `verify-port-release`). Each batch therefore starts from a completely clean slate.

## §BR-6.5 — Acceptance criteria for §BR-6

§BR-6 itself has three narrow deliverables (all completed in this commit):

1. **`PLAYWRIGHT_PROJECTS` env-var passthrough** wired into `run.ts` step 10 (44 lines added around the existing `spawnSync('pnpm', ['exec','playwright','test'], …)` call).
2. **`parseProjectFilter` helper** exported from `run.ts` (30 lines).
3. **Regression guard** at `tests/lifecycle-project-filter.test.ts` (14 tests, 0 external I/O).
4. **`main()` invocation guarded** by `require.main === module` so importing `run.ts` under vitest does not spawn the orchestrator.
5. **This design document.**

§BR-6 explicitly does **NOT**:

- Rewrite the baseline (Run 3 remains the last full baseline).
- Run any of the six batches (that is §BR-8, per the redirection mandate: "make each populated Playwright project pass independently").
- Diagnose the 21 real test-level failures (that is §BR-8 A/B/C per-batch forensics).
- Reconcile PLAYWRIGHT_TEST_AUTH bypass vs. real storageState (that is §BR-7).

## §BR-6.6 — Handoff to §BR-7 / §BR-8

§BR-6 is complete when the regression guard passes and this design document lands on the shared history. The next actions in remediation order are:

- **§BR-7** — review `apps/union-eyes/e2e/helpers/auth.ts` `loginAsRole` against the resolved TODO(`phase-0c2-§11`) to confirm PLAYWRIGHT_TEST_AUTH bypass and real `nzila_session` storageState remain internally consistent.
- **§BR-8** — execute Batches A → F in order, per-batch commit forensics, drive each project to `did-not-run == 0`.

Each batch's forensic evidence (log, run-artifact directory, summary counts) will be committed under the same `reports/audits/cupe-national-phase-0/phase-0c/` prefix using naming `phase-0c2-batch-<letter>-*.md` / `.log` / `.csv` to keep the §BR-6→§BR-8 evidence chain contiguous with the existing §BR-3, §BR-4, §BR-5 artifacts.
