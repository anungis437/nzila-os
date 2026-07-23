# Phase 0C — Test Classification Register (§6)

**Status:** In progress. This is the ADJUDICATED classification for every discovered E2E
test after route/feature/role/seed/env cross-check. The `[Post-execution result]` column
is populated by §17 authoritative baseline. Do not treat this file as evidence that any
test passes — only §17 + §18 output can graduate a test to `CURRENT_BASELINE_PROVEN`.

**Terminology (per §2 correction):**
- `CURRENT_BASELINE_CANDIDATE` — pre-execution: route/feature/role/seed all exist; expected to pass under Phase 0C lifecycle
- `CURRENT_BASELINE_PROVEN` — post-execution: passed under §17 without retry AND survived §18 flake analysis
- `LATER_PHASE` — capability not yet built or graduated; must be skipped by an explicit `test.skip` with governed reason
- `EXTERNAL_DEPENDENCY` — blocked by an external non-local service; cannot be part of the deterministic baseline
- `OBSOLETE_DUPLICATE` — superseded by another spec; removed under §12
- `INFRASTRUCTURE_BLOCKED` — post-execution: failed for lifecycle/DB/seed/auth reasons; blocked on §5–§9
- `PRODUCT_DEFECT` — post-execution: product does not implement the asserted behavior
- `TEST_DEFECT` — post-execution: test bug or asserts on behavior never claimed

## Adjudication method

For every discovered test (192 total across 29 spec files), the following signals were consulted:
1. **Route exists** — grep `apps/union-eyes/app/` and `apps/union-eyes/src/app/` for the asserted URL
2. **Feature exists** — grep for the asserted `data-testid`, page heading, form control, or workflow verb
3. **Required role exists** — grep for role literal in `packages/union-eyes-domain/src/roles.ts`
4. **Seed data can be created** — inspect `apps/union-eyes/scripts/seed-test-env.ts` and Django seed fixtures for the identity/org/case referenced
5. **Env variable required** — read from `apps/union-eyes/tests/e2e/e2e-env.ts` DETERMINISTIC_DEFAULTS
6. **Assertion belongs to current product reality** — cross-reference against
   `reports/audits/cupe-national-phase-0/phase-0b/*` and `docs/product/union-eyes/*`
7. **Duplicated elsewhere** — file+testid dedup search
8. **Skip reason (if any)** — read the actual `test.skip(...)` argument or describe-level conditional guard

## Adjudicated spec-level classifications

| # | Spec | Preliminary class | Adjudicated class | Rationale summary |
|---|------|-------------------|-------------------|-------------------|
| 1 | `e2e/authenticated-role-navigation.spec.ts` | CURRENT_BASELINE_CANDIDATE | CURRENT_BASELINE_CANDIDATE | Roles member/steward/rep/admin/leadership all exist; `/dashboard` and `/dashboard/(role)/*` routes exist; requires PLAYWRIGHT_TEST_AUTH + seed |
| 2 | `e2e/dependabot-panel-authenticated.spec.ts` | CURRENT_BASELINE_CANDIDATE (skips at runtime when data absent) | CURRENT_BASELINE_CANDIDATE | 6 tests self-skip via `test.skip(!hasPanel)` when data absent — this is a governed dynamic skip, not a fail |
| 3 | `e2e/dependabot-panel-public.spec.ts` | CURRENT_BASELINE_CANDIDATE | CURRENT_BASELINE_CANDIDATE | Public read-only slice; no auth needed |
| 4 | `e2e/ocra-adaptive-flow.spec.ts` | MIXED | 4 CURRENT_BASELINE_CANDIDATE + 5 LATER_PHASE | See OCRA deep-traversal register below |
| 5 | `e2e/pilot-mode-gating.spec.ts` | CURRENT_BASELINE_CANDIDATE | CURRENT_BASELINE_CANDIDATE | Feature-flag gating with `UE_E2E_RISK_BYPASS=true` |
| 6 | `e2e/stakeholder-demo-journeys.spec.ts` | CURRENT_BASELINE_CANDIDATE | CURRENT_BASELINE_CANDIDATE | Public marketing/demo flows |
| 7 | `e2e/ue-workflow.spec.ts` | CURRENT_BASELINE_CANDIDATE | CURRENT_BASELINE_CANDIDATE | Canonical workflow spec (see §12 for `tests/e2e/` duplicate) |
| 8 | `tests/e2e/analytics.spec.ts` | CURRENT_BASELINE_CANDIDATE | CURRENT_BASELINE_CANDIDATE | Analytics beacon assertion |
| 9 | `tests/e2e/audit-log.spec.ts` | CURRENT_BASELINE_CANDIDATE | CURRENT_BASELINE_CANDIDATE | Requires seed audit records |
| 10 | `tests/e2e/auth-failure-handling.spec.ts` | CURRENT_BASELINE_CANDIDATE | CURRENT_BASELINE_CANDIDATE | Negative auth path suite; requires seed member/auditor/steward |
| 11 | `tests/e2e/auth-session-switch.spec.ts` | CURRENT_BASELINE_CANDIDATE | CURRENT_BASELINE_CANDIDATE | Requires two seeded users of different roles |
| 12 | `tests/e2e/case-escalation.spec.ts` | CURRENT_BASELINE_CANDIDATE | CURRENT_BASELINE_CANDIDATE | Requires seed grievance with escalation-eligible state |
| 13 | `tests/e2e/case-resolution.spec.ts` | CURRENT_BASELINE_CANDIDATE | CURRENT_BASELINE_CANDIDATE | Requires seed case in `under_review` |
| 14 | `tests/e2e/cross-org-block.spec.ts` | CURRENT_BASELINE_CANDIDATE | CURRENT_BASELINE_CANDIDATE | Requires seed Org A + Org B with cases/evidence |
| 15 | `tests/e2e/dashboard-empty-states.spec.ts` | CURRENT_BASELINE_CANDIDATE (dynamic 404 skip) | CURRENT_BASELINE_CANDIDATE | Dynamic 404 self-skip must be removed under §13 if routes exist |
| 16 | `tests/e2e/evidence-misuse.spec.ts` | CURRENT_BASELINE_CANDIDATE | CURRENT_BASELINE_CANDIDATE | Negative evidence-access suite |
| 17 | `tests/e2e/external-ux-tester.spec.ts` | CURRENT_BASELINE_CANDIDATE | CURRENT_BASELINE_CANDIDATE | External-UX role isolation |
| 18 | `tests/e2e/member-intake.spec.ts` | CURRENT_BASELINE_CANDIDATE | CURRENT_BASELINE_CANDIDATE | Member submits intake + creates grievance |
| 19 | `tests/e2e/member-journey.spec.ts` | CURRENT_BASELINE_CANDIDATE (dynamic 404 skip) | CURRENT_BASELINE_CANDIDATE | See §13: dynamic 404 to be removed |
| 20 | `tests/e2e/missing-routes.spec.ts` | CURRENT_BASELINE_CANDIDATE (dynamic 404 skip) | CURRENT_BASELINE_CANDIDATE | See §13: reclassify per outcome |
| 21 | `tests/e2e/negative-workflow-transitions.spec.ts` | CURRENT_BASELINE_CANDIDATE | CURRENT_BASELINE_CANDIDATE | FSM invariant negative paths |
| 22 | `tests/e2e/org-isolation-negative.spec.ts` | CURRENT_BASELINE_CANDIDATE | CURRENT_BASELINE_CANDIDATE | Cross-org negative paths |
| 23 | `tests/e2e/organization-context.spec.ts` | CURRENT_BASELINE_CANDIDATE | CURRENT_BASELINE_CANDIDATE | Phase 0B resolver contract |
| 24 | `tests/e2e/pilot-mode-gating.spec.ts` | CURRENT_BASELINE_CANDIDATE | CURRENT_BASELINE_CANDIDATE | Pilot flag surface |
| 25 | `tests/e2e/public-access.spec.ts` | CURRENT_BASELINE_CANDIDATE | CURRENT_BASELINE_CANDIDATE | Public entry pages |
| 26 | `tests/e2e/representative-view.spec.ts` | CURRENT_BASELINE_CANDIDATE | CURRENT_BASELINE_CANDIDATE | Rep dashboard view |
| 27 | `tests/e2e/steward-dashboard.spec.ts` | CURRENT_BASELINE_CANDIDATE | CURRENT_BASELINE_CANDIDATE | Steward IA |
| 28 | `tests/e2e/steward-review.spec.ts` | CURRENT_BASELINE_CANDIDATE | CURRENT_BASELINE_CANDIDATE | Steward mutation permissions |
| 29 | `tests/e2e/ue-workflow.spec.ts` | OBSOLETE_DUPLICATE | OBSOLETE_DUPLICATE | Duplicates `e2e/ue-workflow.spec.ts`; testIgnore'd today, delete under §12 |
| 30 | `tests/e2e/leadership-viewer.spec.ts` | CURRENT_BASELINE_CANDIDATE | CURRENT_BASELINE_CANDIDATE | Leadership read-only |

**Discovered spec count:** 30 files → 29 active (1 testIgnore'd).
**Discovered test count (Playwright expansion):** 192 tests.
**Source-level test count (spec-file level):** 149 (delta = 43 loop-expanded).

## Hard-skip register (per §3 requirement)

Every hard `test.skip('...')` (unconditional) MUST have a stable identifier, owning phase,
exact missing capability, activation condition, and expiration/review gate.

| Stable ID | File:Line | Owning phase | Exact missing capability | Activation condition | Expiration / review gate |
|-----------|-----------|--------------|--------------------------|----------------------|--------------------------|
| OCRA-SKIP-01 | `apps/union-eyes/e2e/ocra-adaptive-flow.spec.ts:105` | Phase 1 (Union Eyes ICRA graduation) | Stable `data-testid="icra-question-{q.id}"` on every question row AND `data-testid="icra-option-{q.id}-{value}"` on every radio | ICRAAssessmentFlow.tsx must expose per-question + per-option testids in question bank | Review at start of Phase 1; must be un-skipped or upgraded to full journey coverage before ICRA graduates to production |
| OCRA-SKIP-02 | `apps/union-eyes/e2e/ocra-adaptive-flow.spec.ts:109` | Phase 1 | Stable `data-testid="icra-org-option-{questionId}-{value}"` on organization-context options + deterministic band-assignment output | Org-context step exposes testids + adaptive card renders band via `data-testid="icra-band-badge"` | Same gate as OCRA-SKIP-01 |
| OCRA-SKIP-03 | `apps/union-eyes/e2e/ocra-adaptive-flow.spec.ts:113` | Phase 1 | Healthcare-band adaptive card testid (`data-testid="icra-adaptive-card-healthcare"`) | Adaptive card component includes discriminating testid per band | Same gate as OCRA-SKIP-01 |
| OCRA-SKIP-04 | `apps/union-eyes/e2e/ocra-adaptive-flow.spec.ts:117` | Phase 1 | Stable localStorage namespace (`icra:session:{id}`) + `page.evaluate` harness for state restoration | Persistence layer uses a documented namespace and testable serialization | Same gate as OCRA-SKIP-01 |
| OCRA-SKIP-05 | `apps/union-eyes/e2e/ocra-adaptive-flow.spec.ts:121` | Phase 1 | Same as OCRA-SKIP-04 + explicit corruption-recovery path in `ICRAAssessmentFlow` | Component handles JSON parse failure by resetting to `consent` step | Same gate as OCRA-SKIP-01 |

**Governance:** all five OCRA_SKIP_* IDs are owned by Phase 1. If Phase 1 begins without
un-skipping them, `phase-0c-open-items-register.md` records the deferral. They may not be
silently deleted or renamed.

## Dynamic-skip register (per §3)

These describe-level or test-level runtime guards MUST be either removed (route exists →
test must run) or converted to governed skip. §13 finalizes decisions.

| Guard | File | Trigger | §13 disposition (TBD) |
|-------|------|---------|-----------------------|
| `!isTestAuth` describe conditional | 25 auth-role specs | `PLAYWRIGHT_TEST_AUTH !== 'true'` | Convert to setup-project dependency (§10) so entire suite fails-closed if auth mode is off, rather than silently skipping |
| `if (response.status() === 404) test.skip(...)` | `dashboard-empty-states.spec.ts`, `member-journey.spec.ts`, `missing-routes.spec.ts` | Route returns 404 | If route exists → remove guard. If route does not exist → reclassify to LATER_PHASE and add stable skip ID |
| `if (!hasPanel) test.skip(...)` | `dependabot-panel-authenticated.spec.ts` (6 tests) | Panel not rendered | Governed: this is the correct pattern when panel is a nightly data-dependent surface; document in dispatch decision |

## Hard-fail environment preconditions (per §3)

Every current-baseline test requires these preconditions. Missing any of them results in
`INFRASTRUCTURE_BLOCKED`, not `PRODUCT_DEFECT` or `TEST_DEFECT`:

- `DATABASE_URL` resolvable to a PostgreSQL 17.x database with a fresh migration lineage
- Platform migrations applied (Drizzle, `pnpm --filter @nzila/union-eyes-schema drizzle:migrate`)
- Django migrations applied (`python manage.py migrate` in union-eyes-django)
- Phase 0B `organization_membership` resolver contract in place
- Seed fixture from `apps/union-eyes/scripts/seed-test-env.ts` executed idempotently
- `PLAYWRIGHT_TEST_AUTH=true`
- `UE_E2E_RISK_BYPASS=true`
- `AUTH_SECRET`, `VOTING_SECRET`, `NODE_ENV=test`, `QA_TEST_ENV=true`
- Port 3002 available and owned by this run (§11)
- Union Eyes Next.js server responds on `/api/health/readiness` with all 10 §6 checks green

## Post-execution result column

Populated by §17 authoritative baseline. Values only from the enum:
`CURRENT_BASELINE_PROVEN | INFRASTRUCTURE_BLOCKED | PRODUCT_DEFECT | TEST_DEFECT | LATER_PHASE`.

**All rows currently `[pending §17]`.** This file will be re-committed with the results in
commit 2 of §21 alongside the baseline log.
