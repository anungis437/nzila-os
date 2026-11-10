# Union Eyes — Gate 0 Final Engineering Convergence — consolidated report

Mandate: a 6-phase engineering-convergence pass over `apps/union-eyes`, scoped to branch
`fix/ue-gate0-final-convergence` (PR #1137, draft, base `main`). This report is scoped to **this
mandate's own work** — it reconciles the 777-record remediation register
(`docs/union-eyes/convergence/remediation/ue-all-777-remediation-register.json`), not the
persona-coverage matrix in `GATE_0_SCOPE_LOCK_REPORT.md` or the schema census in
`UE-FINAL-CONVERGENCE-CHECKPOINT-8.md`, which belong to separate, independently-tracked efforts
this mandate did not touch.

**Status: engineering work for this mandate's scope is complete and locally verified at the SHA
below. Remote CI on that exact SHA was still completing at the time of writing (see "Remote CI"
below) — this report records the real, in-progress state rather than waiting indefinitely or
asserting a result not yet observed.** Per `AGENTS.md`: nothing here is written as
`PROVEN_IN_STAGING`, `complete`, `green`, `ready`, or `delivered` unless the proof is on file.

## Exact SHA this report covers

| Fact | Value |
| --- | --- |
| Branch | `fix/ue-gate0-final-convergence` |
| Final commit (this report covers exactly this SHA) | `17457ff1a` |
| True current `origin/main` (base) | `d0e313e98` (confirmed via `git fetch origin main`; the local `main` ref in this clone was stale at `c051fd89e` and was not used for any comparison in this report) |
| PR | #1137, draft, base `main`, mergeable_state at time of writing: `blocked` (draft + pending checks, not a merge conflict) |
| Commits this mandate added on top of the branch's pre-mandate tip | 12 (`cfb33dcf3` through `17457ff1a`; see table below) |

## Commits in this mandate, in order

| Commit | Phase | What it did |
| --- | --- | --- |
| `cfb33dcf3` | 1 | Made `reconcile-accounting.cjs` self-checking (mutually-exclusive implemented/partial/untouched buckets, sums to 777) |
| `746940d41` | 3 | Authority kernel: `platform_staff` `MandateKind`, migration 0082, `HOLDER_CAPACITIES['platform_staff'] = []` (structurally expressible, grantable to nobody), decision record |
| `5bec21313` | 4 | Portable `python3`/`python` resolution for `local-vault-fixture.ts`; CI wheelhouse-install step |
| `e27e9f4eb` | 4 | Reconciled 2 stale heavy-suite tests (`room_bookings` now reachable, `deadline_reminders` now dead code) with current reality |
| `d9bfe9c05` | 4 | Migration 0083: dropped 6 unused legacy columns from `reward_wallet_ledger`; Django model + migration parity |
| `b23305db8` | 4 | 3 native-postgres test files now `describe.skipIf` instead of hard-failing `pnpm test:fast` outside the native CI workflow |
| `40abd96d8` | 2.2 | Education route parity: `queryIdMutations()` helper; real PATCH/DELETE on sessions/programs/certifications |
| `8dcfa8043` | 2.1 | Campaign audience evaluator; real schedule-preview GET and single-recipient send-test POST |
| `f3ff14f2c` | 2.3 | Migration 0084: relaxed 3 legacy NOT NULL constraints on `ml_predictions` to match the shadowed Drizzle declaration |
| `5e700640f` | 2.4 | External payroll identity resolution (`resolve-employment-mapping.ts` + route) |
| `2b57290eb` | 5 | Evidence-gap reconciliation for 22 earlier-run defects; 2 new regression test files; 1 stale doc-comment fix |
| `14fe008f6` | 6 | Fixed a real regression Phase 2.2 introduced in `lib/api/__tests__/roster-facades.contract.test.ts` (found by a broad test sweep) |
| `2c03f1050` | 6 | Regenerated the V2 source plan after Phase 4's `backend/unions/models.py` edit (found by real CI, `UE_V2_SOURCE_PLAN_DRIFT`) |
| `17457ff1a` | 6 | Scoped the provenance workflow's tracked-tree check to exclude 5 inherently-volatile evidence files (found by real CI, a second failure on the same workflow after the plan fix) |

Phases 2.1–2.4 are the 4 independently-actionable items originally scoped as "Phase 2"; they are
listed here in the order committed, not numeric order, because 2.1 was committed after 2.2/2.3 in
this session.

## Phase-by-phase summary

### Phase 1 — branch, PR, accounting reconciliation (`cfb33dcf3`)

`reconcile-accounting.cjs` now independently recomputes implemented/partial/untouched bucket
membership from the register's own per-record state and asserts: (a) every one of the 777 IDs is
in exactly one bucket, (b) the recomputed `implemented` count matches
`summary.engineeringCorrected`. **Known residual gap, found and documented this session (see
"Known limitations" below): it does not independently recompute `summary.engineeringPartial` /
`summary.engineeringRemaining`** — those 2 fields must still be diffed by hand against the
per-record counts whenever a record's state changes.

### Phase 3 — authority kernel support for a `platform_staff` mandate kind (`746940d41`)

Added the sixth `MandateKind` the kernel can express, scoped to `UE_SYSTEM_ORG_ID`. Deliberately
grantable to nobody (`HOLDER_CAPACITIES['platform_staff'] = []`) until an institutional decision
names a real adopter — see "Institutional decision blockers" below. This is new capability the
kernel did not have before; it does not itself close either of the 2 HIGH-severity defects it
touches.

### Phase 4 — eliminate heavy-suite and tooling test failures (`5bec21313`, `e27e9f4eb`, `d9bfe9c05`, `b23305db8`)

All 5 originally-identified heavy-suite/tooling failures were resolved: 1 portability fix, 2 stale
test reclassifications (test staleness, not a tool defect), 1 genuine source defect (migration
0083), and 1 convention fix (3 files made to `skipIf` like their 91 siblings). The native
PostgreSQL CI mechanism (`.github/workflows/ue-native-postgres.yml`) was confirmed to already
build a real combined Django+Drizzle schema on PG 15/16 with pgvector and run the full
`vitest.native.config.ts` project — it did not need new engineering, only the skip-convention fix
above so it stops being bypassed by `pnpm test:fast`.

### Phase 2 — the 4 independently-actionable remaining items (`40abd96d8`, `8dcfa8043`, `f3ff14f2c`, `5e700640f`)

| Defect | What closed | What is deliberately still open |
| --- | --- | --- |
| `DEF-0B6-EDU-UI-CALLS-OPERATIONS-THE-ROUTES-DO-NOT-EXPORT` | Real PATCH/DELETE for education sessions/programs/certifications via a new `queryIdMutations()` factory helper; `listFilters` on registrations | `includeProgress`/session-status-join reads — underspecified, needs a join the factory does not support; left unresolved rather than fabricated |
| `DEF-0B5-COMMS-CAMPAIGN-DETACHED-FROM-CONSENT-AND-DELIVERY` | Real audience-eligibility evaluator against `consent_records` + `communication_preferences`; schedule GET is now a genuine read-only preview; send-test POST really sends to one caller-supplied address | Real bulk sender, status/stats transition, dispatcher/queue, SMS send-test, template variable substitution — no dispatcher/queue infrastructure exists in this repo to wire into; not built rather than stubbed |
| `DEF-0B9-ML-DECLARED-PREDICTION-SHAPE-CONFLICTS-WITH-THE-SQL-THAT-CREATES-THE-TABLE` | Migration 0084 relaxed 3 legacy NOT NULL constraints on `ml_predictions` to match the actually-resolved (barrel-shadowed) Drizzle declaration; verified both real write paths never supply all 3 together | — |
| `DEF-0B6-EMP-OFFICIAL-APPROVAL-UNREACHABLE` | New deterministic, explicit-pair external-payroll-identity resolution (`resolve-employment-mapping.ts` + route); re-derives truth before resolving the blocking compliance event | — |

### Phase 5 — evidence-gap reconciliation for 22 earlier-run defects (`2b57290eb`)

All 22 defect IDs flagged as evidence gaps from earlier remediation runs were investigated:
source files confirmed to exist at HEAD; existing regression coverage identified and re-run (20 +
9 + 4 pre-existing test files, 207 + ~92 + 36 tests, all passing); 4 defect IDs across 2 source
files (`app/api/breaks/route.ts`, `app/api/ml/monitoring/metrics/route.ts`) had zero prior test
coverage despite being source-corrected — both source files were read and the fixes independently
confirmed correct before writing 2 new regression test files (10 new tests) for them. One stale
JSDoc comment (describing a response shape the code no longer produces) was corrected. The
register's `currentRun.regressionPaths` and a `verificationNote` were populated for all 22 IDs;
`currentHeadVerification` honestly remains `SOURCE_PATCHED_NOT_VERIFIED_AT_CURRENT_HEAD` (this is
local re-verification, not an exact-SHA CI run, and the register says so).

### Phase 6 — full integrated qualification (`14fe008f6`, `2c03f1050`, `17457ff1a`, this report)

Phase 6 surfaced and fixed **four real regressions this mandate's own earlier commits had
introduced**, none of which is a historical 777-ledger defect:

1. **`lib/api/__tests__/roster-facades.contract.test.ts` (found locally, fixed in `14fe008f6`).**
   Phase 2.1 made the campaign schedule route's GET and the send-test route's POST real. A
   separate, independent contract test maintains its own hardcoded list of routes expected to stay
   pure 501 facades for every method, and still listed both. Fixed by removing them from that list
   and adding a dedicated test asserting they still refuse every method they do not implement.
   Found only because a broad, multi-directory test sweep was run as a deliberate final check —
   narrowly-scoped verification after each commit did not touch this file.
2. **Frontend response-shape census (found locally, fixed in `14fe008f6`).** The same Phase 2.1/2.2
   education-route refactor extracted each route's `CrudOptions` into a shared `const` and passed
   it to `crudRoutes()` as a bare identifier. The census's static AST reader
   (`scripts/lib/frontend-census/route-response.ts`) only resolves a Drizzle table's row shape from
   an **inline object literal** argument with `table:` as a direct property; a bare identifier
   broke that resolution for 3 routes (certifications, sessions, programs), degrading their GET
   shape to unknown. This was masked almost everywhere a reader's keys are also present on sibling
   routes' rows; only 2 keys unique to `memberCertifications`
   (`clcRegistrationNumber`, `digitalBadgeUrl`) were not masked, so
   `scripts/__tests__/untyped-read-census.test.ts` went from 51/51 to 1 failed/50 passed. Confirmed
   the cause by running the same census against commit `b23305db8` (the commit immediately
   preceding the education-route refactor) in an isolated `git worktree` — clean there. Fixed by
   re-stating `table` (and `omitFromResponse` where applicable) as a direct literal property
   alongside the spread at each `crudRoutes()` call site — a runtime no-op, purely restoring what
   the census's AST reader needs.
3. **`UE_V2_SOURCE_PLAN_DRIFT` (found only via real remote CI, fixed in `2c03f1050`).** The
   "Union Eyes Bootstrap V2 Provenance" workflow regenerates
   `docs/union-eyes/bootstrap-v2/UE_CANONICAL_SCHEMA_V2_SOURCE_PLAN.json` from source and fails if
   it drifts from the committed copy. Phase 4's `d9bfe9c05` edited
   `backend/unions/models.py` but never regenerated this plan. Fixed by replicating the CI
   workflow's exact steps locally (hash-locked wheelhouse build in the pinned
   `python:3.11-slim` image, wheel-hash verification, `plan.ts --self-test` to regenerate
   deterministically, `--self-test --check` to confirm). The diff touches only entries whose
   provenance traces to the one real source change and its 2 necessarily-cascading aggregate
   digests; top-level counts (735 tables, 6102 statements, 299 decisions, 35 exclusions, 0 security
   blockers) are unchanged in kind.
4. **The same workflow's "tracked tree unchanged" step, `git diff --exit-code` (found only via
   real remote CI, fixed in `17457ff1a`).** After the plan fix above, the same workflow still
   failed on its very next step. Root cause: Phase 4's `5bec21313` ("wire CI to run it") added
   `local-vault-fixture.test.ts` to this job's native test list for the first time — it was
   previously excluded specifically because of the python/cryptography portability gap that same
   commit fixed — and added the missing cryptography-install step that lets it actually execute.
   That test unconditionally rewrites 5 tracked evidence files (`artifacts/ue-v2-local-vault-*.json`,
   `artifacts/ue-v2-production-key-authority-*.json`) on every run, as genuine, non-fabricated proof
   of that run's own child-process network observations — including real OS-assigned pid/port
   values that can never be identical between any two runs, including two CI runs of the literal
   same commit SHA. A bare `git diff --exit-code` immediately afterward is therefore structurally
   incapable of ever passing once this test actually executes, independent of source content.
   Confirmed via `gh run list --workflow=ue-bootstrap-v2-provenance.yml`: this exact workflow was
   `success` on every commit through `746940d41` (Phase 3) and `failure` on every single commit
   from `5bec21313` onward — conclusively isolating the cause to that one commit. Fixed by scoping
   the check to exclude exactly those 5 paths via git pathspec exclusion
   (`git diff --exit-code -- . ':(exclude)artifacts/ue-v2-local-vault-*.json' ':(exclude)artifacts/ue-v2-production-key-authority-*.json'`),
   verified locally (touching one of the 5 files: the scoped command returns exit 0; the same edit
   with no pathspec still correctly returns exit 1, proving the exclusion does not mask real
   changes) and via `js-yaml` parsing of the edited workflow file.

## Defect register reconciliation (final, at `17457ff1a`)

```
population: 777
implemented (IMPLEMENTED_SOURCE_PENDING_VS_VALIDATION): 709
partial (PARTIAL_SOURCE_REMAINING_WORK): 27
untouched: 41
reconcile-accounting.cjs: consistent=true, problems=[]
```

Severity breakdown of the 68 not-fully-implemented records:

| Severity | Partial | Untouched | Total |
| --- | ---: | ---: | ---: |
| HIGH | 2 | 0 | 2 |
| MEDIUM | 22 | 33 | 55 |
| LOW | 3 | 8 | 11 |

The only 2 HIGH-severity records not fully implemented are `DEF-0B2-PLATFORM-DIRECTORY-UNSCOPED-READ`
and `DEF-0B10-OPL-14` — both blocked purely on the institutional decision below, not on remaining
engineering (see their row in the register and the decision record for the full evidence trail).

This mandate changed 0 untouched records; it moved evidence/verification state on records already
`IMPLEMENTED_SOURCE_PENDING_VS_VALIDATION` or `PARTIAL_SOURCE_REMAINING_WORK` and newly implemented
the 4 Phase-2 defects above (which were already counted toward the 709 before this session, per
the register's existing accounting — Phase 2 closed source gaps the register had already flagged
as the remaining actionable work, it did not change the 777 population or re-bucket anything).

## Institutional decision blockers

One outstanding institutional decision blocks both remaining HIGH-severity records:
`UE-INST-PLATFORM-STAFF-MANDATE-AUTHORITY`, state `OUTSTANDING`, status
`DECISION_READY_NOT_DECIDED` (full text:
[docs/union-eyes/convergence/decisions/platform-staff-mandate-decision-record.md](decisions/platform-staff-mandate-decision-record.md)).

Summary: both operations (`GET /api/admin/users`, `GET /api/admin/stats/activity`,
`GET /api/platform/stats`) already check the canonical `isPlatformAdminUser` identity fact, run
their cross-organization read and audit row atomically, mask returned PII, and are proven against a
native PostgreSQL role. What remains is **not** engineering: no institutional instrument yet names
who holds `executive` capacity over the platform pseudo-organization, so the kernel's
`platform_staff` mandate kind (Phase 3) can be structurally expressed but cannot be issued to
anyone. The routes continue operating on the identity fact, not an issued mandate, until that
naming happens.

## Test evidence (local, at `17457ff1a`)

| Suite | Command | Result |
| --- | --- | --- |
| Broad app/contract sweep | `vitest run app/api/__tests__ actions/__tests__ lib/ai/__tests__ lib/api/__tests__ lib/finance/__tests__ lib/services/__tests__ lib/communications lib/employer-execution app/api/employer-execution app/api/education` | 680 files / 9345 tests passed, 0 failed |
| `union-eyes-heavy` project | `vitest run --project union-eyes-heavy` (with a `cryptography`-equipped `python3` on `PATH`) | 32 passed / 103 skipped (135 files); 298 passed / 1568 skipped (1879 tests) |
| `union-eyes-census` project | `vitest run --project union-eyes-census` | 51/51 passing (after the Phase 6 census fix; was 1 failed/50 passed before it) |
| RLS / tenant isolation (`db/__tests__`, `lib/db/__tests__`, `db/queries/__tests__`) | `vitest run db/__tests__ lib/db/__tests__ db/queries/__tests__` | 102 passed / 3 skipped (105 files; skips need a live `UE_AUTHORITY_COMBINED_URL`); 1582 passed / 19 skipped (1601 tests) |
| Audit atomicity/idempotency (`lib/audit/__tests__`) | `vitest run lib/audit/__tests__` | 7/7 files, 49/49 tests |
| Migration lineage (`s44-gate0-pg-migrations.test.ts`) | `vitest run lib/services/__tests__/s44-gate0-pg-migrations.test.ts` | 1/1 file, 5/5 tests |
| V2 source plan determinism + drift check | `plan.ts --self-test --check` against a verified hash-locked wheelhouse | exit 0 (was `UE_V2_SOURCE_PLAN_DRIFT` before the Phase 6 fix) |
| V2 plan's own heavy tests | `vitest run --project union-eyes-heavy system-mutation-contracts.test.ts system-component-integration.test.ts bootstrap-v2.test.ts enum-types.test.ts` | 4/4 files, 81/81 tests |
| TypeScript | `tsc --noEmit -p .` (apps/union-eyes) | exit 0, 0 errors |
| ESLint | targeted runs on every file touched/added this mandate | 0 errors (2 pre-existing-pattern warnings in 1 new test file: a `require()` import and an `any`-typed mock callback, both matching established repo conventions) |
| `pnpm contract-tests` (repo-wide, separate from the above) | `pnpm contract-tests` | 305/306 files, 10062/10072 tests. The one failure, `civic-oci-doctrine-integrity.test.ts`, is confirmed pre-existing and unrelated: zero diff exists between `origin/main` and this branch under `apps/civic` or `governance/foundations/civic-oci-doctrine.contract.json`, so the identical failure would reproduce on `origin/main` directly. Out of scope for this mandate; not modified. |

Native PostgreSQL 15/16 qualification (the "Combined Django + Drizzle PostgreSQL 15/16" CI jobs) is
**not run locally** in this session — it depends on a pinned Docker Postgres image and the
dedicated `ue-native-postgres.yml` / bootstrap-v2-provenance workflow fixtures that are only
exercised by CI. Its remote result is reported in "Remote CI" below.

## Remote CI (PR #1137, head `17457ff1a`)

Real remote CI on this exact branch caught 2 of the 4 regressions documented above
(`UE_V2_SOURCE_PLAN_DRIFT` and the tracked-tree-check incompatibility) that no local test suite
surfaced — both only exist as checks inside
`.github/workflows/ue-bootstrap-v2-provenance.yml`, which this session has no way to execute
end-to-end locally (it needs a hash-locked wheelhouse built inside a pinned Docker image plus a
pinned PostgreSQL container, which were replicated piecemeal for diagnosis but not run as the
exact composed workflow). This is why the mandate's own instruction to run a real integrated
qualification, not just local suites, mattered: both fixes above would otherwise have shipped
undetected.

CI was triggered by each push in turn and was **still completing for `17457ff1a` at the time of
writing**. Observed history across this mandate's pushes, via
`gh run list --workflow=ue-bootstrap-v2-provenance.yml --json headSha,conclusion,createdAt`:

| Commit | `ue-bootstrap-v2-provenance.yml` conclusion |
| --- | --- |
| `c051fd89e` through `746940d41` (Phase 1, 3, pre-mandate any-cleanup) | `success` |
| `5bec21313` through `2b57290eb` (Phase 4.1 through Phase 5) | `failure` (`UE_V2_SOURCE_PLAN_DRIFT`, undiagnosed until Phase 6) |
| `14fe008f6` (Phase 6, local-only fixes) | `failure` (same cause, not yet addressed) |
| `2c03f1050` (Phase 6, V2 plan regenerated) | `failure` (plan check now passes; tracked-tree check newly surfaced) |
| `17457ff1a` (Phase 6, tracked-tree check scoped) | pending at time of writing |

The broader PR-level check snapshot at last read (head `17457ff1a`, taken shortly after push): 12
of 58 checks completed (5 success, 7 skipped), 0 failures, with the remaining ~46 — including the
native PostgreSQL 15/16 combined Django+Drizzle jobs, the UE Whole Application/Contract Test
Suites, Unit Tests, Lint & Typecheck, and the bootstrap-v2-provenance workflow itself — still
in progress. **This report does not claim a final green CI result it has not observed.** Treat the
native-PG and whole-application-suite rows in the local test-evidence table above as "verified by
design and by the dedicated CI workflow's own mechanism" (confirmed in Phase 4's investigation)
rather than "observed green at this exact SHA" until that run completes; if it surfaces a 5th
issue, the same discipline applied to the first 4 (diagnose the exact commit via `gh run list`,
fix narrowly, verify locally where possible, push, re-observe) should be applied before this
mandate is considered closed.

## GO/NO-GO verdicts (independent, scoped to this mandate)

| Verdict | State | Basis |
| --- | --- | --- |
| `ENGINEERING_CONVERGENCE` (this mandate's scope: Phases 1–6) | **PASS, locally verified** | All 6 phases complete; 2 self-introduced regressions found and fixed (1 local, 1 CI-only); 0 known failing local suites; remaining register gaps (68 of 777) are honestly carried as partial/untouched with documented reasons, not claimed closed |
| `REMOTE_CI_QUALIFICATION` | **IN PROGRESS, 0 failures observed so far** | See "Remote CI" above; not yet complete at time of writing |
| `INSTITUTIONAL_POLICY_ADOPTION` (platform-staff mandate) | **NOT ADOPTED** | `DECISION_READY_NOT_DECIDED`; no adopter named; blocks the only 2 HIGH-severity remaining records |
| `STAGING_QUALIFICATION` | **NO-GO** | Not attempted in this mandate; no credentialed signed-in browser acceptance run; native-PG CI result not yet observed at the final SHA |
| `PRODUCTION_RELEASE` | **NO-GO** | PR is draft; institutional decision outstanding; staging not qualified |

## Known limitations (stated, not hidden)

- `reconcile-accounting.cjs` validates `summary.engineeringCorrected` against a fresh count but
  does **not** independently validate `summary.engineeringPartial` / `summary.engineeringRemaining`
  — these were found stale once already this mandate (Phase 2.3) and were hand-corrected; any
  future record-state change must update all 3 counters by hand until the script is extended.
- Phase 5's 22 evidence-gap closures are **local re-verification**, not re-execution of the exact
  historical CI run that originally credited them; the register says so explicitly
  (`currentHeadVerification: SOURCE_PATCHED_NOT_VERIFIED_AT_CURRENT_HEAD`).
- Native PostgreSQL 15/16 qualification for this exact SHA depends on the remote CI run completing
  (see above); it was not independently re-run against a local Docker Postgres in this session.
- Credentialed, signed-in browser acceptance (member/representative/staff personas) was not run.
- The civic-oci-doctrine-integrity pre-existing failure (see test evidence table) remains
  unresolved — confirmed out of scope for Union Eyes, not touched.
- This report does not re-evaluate the persona-coverage matrix (`GATE_0_SCOPE_LOCK_REPORT.md`) or
  the broader schema census (`UE-FINAL-CONVERGENCE-CHECKPOINT-8.md`); those are separate,
  independently-tracked efforts on different PRs with their own verdicts, unchanged by this work.

## What would move this from engineering-complete to release-ready

1. Remote CI on `17457ff1a` finishing green (or any failure triaged and fixed in a follow-up
   commit, repeating the same discipline as the 2 regressions this report already documents).
2. The institutional decision at
   `docs/union-eyes/convergence/decisions/platform-staff-mandate-decision-record.md` being made by
   a named Nzila governing authority (not a customer organization), followed by the 3 engineering
   steps that record already lists (named officer membership rows, a drafted/adopted/activated
   issuance rule).
3. A staging qualification pass: credentialed browser acceptance for at least the member,
   representative, and staff personas, plus a native-PG run against a staging-shaped database.
4. Maintainer review and conversion of PR #1137 from draft to ready, per the repository's own
   merge-authority gates.
