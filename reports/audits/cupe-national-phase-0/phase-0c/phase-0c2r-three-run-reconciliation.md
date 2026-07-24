# Phase 0C.2R — §3 Three-Run Results Reconciliation

**Scope:** §BR-9 Runs 1 / 2 / 3 (`20260724074304_91c082`, `20260724084425_b4cd7a`, `20260724094416_90145a`).
**Purpose:** Reconcile per-test outcomes across the three §BR-9 baseline runs.
**Ground-truth data available:**
- All three: committed `run-summary.json` (14-step lifecycle outcome + counts) and `server.log` (Next.js stdout).
- Run 3 only: `apps/union-eyes/playwright-report/data/*.md` (50 per-failure Markdown reports) and `apps/union-eyes/test-results/.last-run.json` (list of 50 failed test hash pairs).
- Runs 1 & 2: per-test data is **NOT preserved** — Playwright overwrites both `test-results/` and `playwright-report/` at every run. The §BR-9 orchestrator collected them into `.e2e-lifecycle/runs/<runId>/` but that directory was cleaned between runs, and only the top-level `run-summary.json` + `server.log` were force-added to git.

**Consequence:** Full per-test reconciliation across all three runs is not physically possible with the current artefacts. This document reports what IS reconcilable and enumerates the artefact-preservation gap that Phase 0C.2R §3.1 closes going forward.

---

## §3.1 Artefact-preservation gap (must-fix before next baseline)

Playwright is configured with `[['html', { open: 'on-failure' }]]` only (`apps/union-eyes/playwright.config.ts`). No JSON reporter is emitted. `.e2e-lifecycle/runs/<runId>/playwright-report/` and `test-results/` are ephemeral — they are wiped by subsequent runs and by `pnpm --filter @nzila/union-eyes e2e:*` scripts.

**Fix (Phase 0C.2R §3.1 committed alongside this document):**
1. Add `['json', { outputFile: 'test-results/<runId>.json' }]` reporter unconditionally so every run emits a stable, per-test JSON artefact keyed by `NZILA_E2E_RUN_ID`.
2. Update lifecycle step 11 (`collect-artifacts`) to force-add the per-run JSON reporter file into `run-artifacts/<runId>/results.json`.
3. Add a `playwright.config.test.ts` assertion locking the JSON reporter presence.

Only after §3.1 lands will future §BR-10R baselines produce a §3-quality dataset.

---

## §3.2 What IS reconciled (aggregate + Run 3 detail)

### Aggregate outcomes (from `run-summary.json` × 3)

| Run | Passed | Failed | Skipped | Did-not-run | Playwright exitCode | Total elapsed | Lifecycle 14 steps |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | :---: |
| Run 1 (`20260724074304_91c082`) | 24 | 50 | 7 | 131 | 1 | 3 646 296 ms (~60m 46s) | ✅ all green |
| Run 2 (`20260724084425_b4cd7a`) | 23 | 50 | 7 | 132 | 1 | ~58 min | ✅ all green |
| Run 3 (`20260724094416_90145a`) | 24 | 50 | 7 | 131 | 1 | ~60 min | ✅ all green |

- **Passing tests differ by one between Run 2 and Run 1/3.** The identity of that flipped test is **not derivable** from the preserved artefacts — that requires per-test JSON we no longer possess. It refutes any "identical run" claim.
- **Failure count is stable at 50 across all three runs.** However, count parity ≠ signature parity. Whether the same 50 tests failed cannot be proven from current artefacts.
- **DNR count differs by 1 (131 vs 132 vs 131).** This differential must be closed by §4.

### Run 3 authoritative failure list (from `.last-run.json` + `playwright-report/data/`)

Full JSON: [`phase-0c2r-run3-failures.json`](./phase-0c2r-run3-failures.json).

**Run 3 root-cause histogram (50 failures):**

| Count | Root-cause signature |
| ---: | --- |
| 30 | `Error: [ue:e2e] Server readiness check timed out after 90000ms` — helper's own 90 s budget exceeded (helper is at `apps/union-eyes/tests/e2e/_helpers.ts:9-46`) |
| 6 | `TimeoutError: page.goto: Timeout 45000ms exceeded` — dev-mode cold-compile burst on specific route |
| 5 | `Error: expect(page).toHaveURL(expected) failed` — post-navigation URL mismatch |
| 2 | `Error: expect(locator).toBeVisible() failed` — role-hidden nav mis-configured |
| 2 | `expect(received).toContain(expected)` — page content assertion mismatch |
| 2 | `expect(received).toMatch(expected)` — page content assertion mismatch |
| 2 | `TimeoutError: apiRequestContext.get: Timeout 20000ms exceeded` |
| 1 | `TimeoutError: apiRequestContext.post: Timeout 20000ms exceeded` |

Detail per failure (spec → root-cause signature):

**Category A — helper `ensureServerReady` 90 s timeout (30 tests):**

| Spec (relative to `apps/union-eyes/`) | Test title |
| --- | --- |
| e2e/authenticated-role-navigation.spec.ts | member: /dashboard redirects to centralized landing and role IA |
| e2e/cape-features.spec.ts | Steward workbench > dashboard page loads with content |
| e2e/cape-features.spec.ts | Grievance submission flow > grievance queue page loads with content |
| e2e/cape-features.spec.ts | Grievance draft save & resume > intake page renders form with required fields |
| e2e/cape-features.spec.ts | Pilot readiness checklist > onboarding page renders checklist with 7 items |
| e2e/cape-features.spec.ts | Leadership dashboard > dashboard renders 6 KPI cards |
| e2e/cape-features.spec.ts | Employer communications > contacts API endpoint is reachable |
| e2e/cba-intelligence.spec.ts | authenticated user can navigate protected continuity route without auth failure |
| e2e/dashboard.spec.ts | dashboard loads with navigation sidebar |
| e2e/empty-states.spec.ts | dashboard with no active cases shows meaningful empty state |
| e2e/missing-routes.spec.ts | admin: /dashboard renders for admin role |
| e2e/permission-boundaries.spec.ts | Member role > member: /dashboard/admin is blocked (P0 — missing server-side gate) |
| e2e/pilot-journey.spec.ts | member intake uses the approved intake and evidence endpoints |
| e2e/stakeholder-demo-journeys.spec.ts | executive demo path is stable and continuity-safe |
| e2e/ue-workflow.spec.ts | 1) intake → review → assign → escalate → resolve |
| e2e/a11y/smoke.spec.ts | every marketing route sets `<html lang>` to a non-empty value |
| e2e/bilingual/locale-smoke.en.spec.ts | `/en-CA` renders with `<html lang="en-CA">` |
| e2e/bilingual/locale-smoke.fr.spec.ts | `/fr-CA` renders with `<html lang="fr-CA">` |
| tests/e2e/admin-assignment.spec.ts | admin can assign and member cannot assign |
| tests/e2e/auditor-readonly.spec.ts | auditor can read allowed surfaces but mutation controls are blocked |
| tests/e2e/auth-failure-handling.spec.ts | unauthenticated requests are denied at all critical surfaces (NEG-AUTH-NO-SESSION) |
| tests/e2e/auth-session-switch.spec.ts | sequential logins replace the active session and role context |
| tests/e2e/case-escalation.spec.ts | authorized escalation succeeds and unauthorized escalation is blocked |
| tests/e2e/case-resolution.spec.ts | authorized resolution is visible and invalid post-resolution mutation is blocked |
| tests/e2e/cross-org-block.spec.ts | wrong-org user cannot access case or audit export |
| tests/e2e/evidence-misuse.spec.ts | invalid evidence ID returns safe error (NEG-EVIDENCE-INVALID-ID) |
| tests/e2e/external-ux-tester.spec.ts | external tester is limited to isolated UX scope |
| tests/e2e/negative-workflow-transitions.spec.ts | triage → resolved is blocked (NEG-FSM-TRIAGE-DIRECT-RESOLVE) |
| tests/e2e/org-isolation-negative.spec.ts | wrong-org user cannot lookup primary-org grievance by claim number (NEG-ORG-CLAIM-LOOKUP) |
| tests/e2e/steward-review.spec.ts | steward reviews assigned case and comment path is authorized |

**Category B — `page.goto` 45 s timeout (6 tests):**

| Spec | Test title |
| --- | --- |
| e2e/ocra-adaptive-flow.spec.ts | smoke — renders the consent step and exposes the assessment flow root |
| e2e/ocra-adaptive-flow.spec.ts | smoke — fr-CA route renders the assessment flow |
| e2e/ocra-adaptive-flow.spec.ts | telemetry — POSTs never carry org names or free text |
| e2e/stakeholder-demo-journeys.spec.ts | for-clc and context-aware pages preserve context in CTAs |
| e2e/stakeholder-demo-journeys.spec.ts | pilot request CTA remains actionable from context routes |
| e2e/stakeholder-demo-journeys.spec.ts | executive and governance journeys avoid raw FSM language |

**Category C — URL mismatch after navigation (5 tests):**

| Spec | Test title | Expected pattern |
| --- | --- | --- |
| e2e/no-fsm-overexposure.spec.ts | executive: raw FSM terms are hidden across role journey | `/en-CA/dashboard/intelligence` |
| e2e/no-fsm-overexposure.spec.ts | admin: raw FSM terms are hidden across role journey | `/en-CA/dashboard/admin/organizations` |
| e2e/no-fsm-overexposure.spec.ts | member: raw FSM terms are hidden across role journey | `/en-CA/dashboard/inbox` |
| e2e/member-journey.spec.ts | governance persona: no submit/create buttons visible on landing page | `/en-CA/dashboard/governance` |
| e2e/member-journey.spec.ts | governance persona: cannot see "Open Representation Case" action | `/en-CA/dashboard/governance` |

**Category D — locator visibility (2 tests):**

| Spec | Test title | Locator |
| --- | --- | --- |
| e2e/member-journey.spec.ts | member: governance nav items are not visible | `aside nav` |
| e2e/member-journey.spec.ts | member: case management nav items are not visible | `aside nav` |

**Category E — `expect(received).toContain(expected)` (2 tests) — captured in [`phase-0c2r-run3-failures.json`](./phase-0c2r-run3-failures.json).**

**Category F — `expect(received).toMatch(expected)` (2 tests) — captured in [`phase-0c2r-run3-failures.json`](./phase-0c2r-run3-failures.json).**

**Category G — `apiRequestContext.get` 20 s timeout (2 tests):**

| Spec | Test title |
| --- | --- |
| e2e/governance/deployment-legitimacy-visibility.spec.ts | attestation surface accepts release id queries without 5xx |
| e2e/governance/deployment-legitimacy-visibility.spec.ts | health endpoint exposes release identity governance headers when bound |

**Category H — `apiRequestContext.post` 20 s timeout (1 test):**

| Spec | Test title |
| --- | --- |
| e2e/permission-boundaries.spec.ts | unauthenticated POST to /api/cases/assign returns 401 or 403 |

---

## §3.3 What is NOT reconciled (artefact-preservation gap)

The following per-test facts cannot be established from current data:

1. **Which specific test flipped from `pass` in Run 1/3 to `did-not-run` in Run 2**, causing the 24→23 pass delta.
2. **Whether Run 1 and Run 2 had the exact same 50 failing tests as Run 3.** The failure count is stable but signature parity requires per-test JSON.
3. **Whether the 30 `ensureServerReady` timeouts fell on the same 30 specs in every run**, or migrated between runs based on server-load timing.

**All three questions are answered starting with the first run under §3.1 JSON-reporter configuration.**

---

## §3.4 Actionable insight from Run 3 (feeds §7)

The corrected root-cause taxonomy overrides the §BR-10 RTP-1…RTP-11 register:

- **60 % of failures (30/50) share ONE root cause**: `ensureServerReady` helper's total budget is 90 000 ms, but the enclosing `test.setTimeout(180_000)` set by Phase 0C.2 §12 gave the helper 90 000 ms of unused headroom. Simply raising the helper's `timeoutMs` from `90_000` to `180_000` (and per-request `timeout` from `10_000` to `30_000`, matching cold-compile burst) is the highest-leverage single fix.
- **12 % (6/50) are `page.goto` 45 s** — these routes are known cold-compile hotspots in dev mode. Either raise `navigationTimeout` from 45 s to 90 s, adopt production-mode serving (§6), or pre-warm those routes in an idempotent global setup.
- **10 % (5/50) are URL mismatches** — these are product issues: e.g. `/en-CA/dashboard/governance` does not exist, or role-based redirects don't take the assertion path. Repair at source in §7.
- **10 % (5/50) are content assertions** — spec vs product truth reconciliation in §7.
- **8 % (4/50) are targeted API timeouts** — likely dev-mode-only or specific slow endpoints. Investigate individually in §7.
- **Note:** 3 `permission-boundaries` unauthenticated-user tests had empty `err` field in extraction — these will be re-analysed in §7 by reading the raw Markdown report directly.

This taxonomy — not RTP-1…RTP-11 — is the authoritative basis for §7's rebuilt signature register.

---

## §3.5 Governance
- `phase-0c2r-run3-failures.json` (50 entries) is the per-test evidence artefact.
- `.last-run.json` is Playwright's canonical Run 3 identity file (list of hash pairs).
- No prior artefact is deleted. No file was renamed. Phase 0C.2R adds; it does not remove.
- Future baselines will be JSON-reconcilable across all runs once §3.1 lands.

**End of §3 reconciliation.**
