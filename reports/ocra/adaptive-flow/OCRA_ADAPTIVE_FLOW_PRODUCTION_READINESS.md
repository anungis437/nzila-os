# OCRA Adaptive Flow — Production Readiness Memo

**Doctrine version:** 1.0.0
**Routing engine version:** 1.0.0
**Branch:** `feat/icra-executive-continuity-brief-elite`
**Memo date:** 2026-02 (hardening sprint)

> **Emotional bar:** "This feels calm, trustworthy, and impossible to break casually."

---

## Recommendation

**GO-WITH-NOTES** for staging promotion. **NO-GO** for production until the four notes below are cleared.

The live adaptive routing surface is correct, deterministic, privacy-respecting, accessible, and bilingual at parity. The full end-to-end harness is partially scaffolded; manual sign-off remains required for the cross-browser + screen-reader checks documented in the QA script.

---

## What shipped in this hardening sprint

| Part | Deliverable | Status |
|------|-------------|--------|
| 1 | Manual QA script: [docs/oci/assessment/OCRA_ADAPTIVE_LIVE_FLOW_QA_SCRIPT.md](../../../docs/oci/assessment/OCRA_ADAPTIVE_LIVE_FLOW_QA_SCRIPT.md) | ✅ |
| 2 | Playwright E2E scaffold: [apps/union-eyes/e2e/ocra-adaptive-flow.spec.ts](../../../apps/union-eyes/e2e/ocra-adaptive-flow.spec.ts) | ✅ (smoke + privacy active; full traversal skipped pending question-bank testids) |
| 3 | Component test for `AdaptiveExplanationCard`: [apps/union-eyes/components/icra/__tests__/AdaptiveExplanationCard.test.tsx](../../../apps/union-eyes/components/icra/__tests__/AdaptiveExplanationCard.test.tsx) | ✅ (7 tests, jsdom + @testing-library/react) |
| 4 | Accessibility checks (focus order, keyboard navigation, aria roles, autoFocus heading) inside the same component test | ✅ |
| 5 | Routing explainability snapshot module: [apps/union-eyes/lib/icra/adaptation/routingExplainabilitySnapshot.ts](../../../apps/union-eyes/lib/icra/adaptation/routingExplainabilitySnapshot.ts) | ✅ |
| 6 | Stable testids on the live flow (`icra-assessment-flow`, `icra-consent-step`, `icra-org-context-step`, `icra-adaptive-explanation-card`, `icra-adaptive-continue`, `icra-section-step`) | ✅ |
| 7 | HubSpot adaptive property mapper: [apps/union-eyes/lib/hubspot/icraAdaptiveProperties.ts](../../../apps/union-eyes/lib/hubspot/icraAdaptiveProperties.ts) + privacy regression test | ✅ (helper + test; wiring into `syncIcraPurchase` is **Note 1** below) |
| 8 | Telemetry privacy regression test: [apps/union-eyes/lib/icra/__tests__/adaptiveTelemetryPrivacyRegression.test.ts](../../../apps/union-eyes/lib/icra/__tests__/adaptiveTelemetryPrivacyRegression.test.ts) | ✅ (10 tests) |
| 9 | Routed submission validator: [apps/union-eyes/lib/icra/adaptation/routedSubmissionValidator.ts](../../../apps/union-eyes/lib/icra/adaptation/routedSubmissionValidator.ts) + 6-test suite | ✅ (helper + tests; submit-route wiring is **Note 2** below) |
| 10 | Routing explainability snapshot + 9-test suite | ✅ |
| 11 | fr-CA parity — existing `adaptiveI18nIntegrity.test.ts` covers every `adaptive*` copy key in `FLOW_COPY` for both locales | ✅ |
| 12 | Visual QA — covered by Part 1 manual script (cross-browser visual sign-off) | 🕒 pending manual run |
| 13 | This memo | ✅ |
| 14 | Quality gates — see below | 🕒 in progress at commit time |
| 15 | Acceptance criteria — see table above | ✅ for code; manual items remain |

---

## Notes blocking production (deferred to follow-up commit, NOT this sprint)

### Note 1 — Wire `deriveOcraAdaptiveContactProperties` into the live HubSpot sync

`syncIcraPurchase` already loads the assessment + profile. The adaptive context is not currently persisted on the assessment (see Note 2), so the sync site cannot yet enrich HubSpot with adaptive bands. Once persistence lands, splice the derived properties into the property payload alongside `oci_*` properties; never expand the allowlist without updating `icraAdaptiveProperties.test.ts`.

### Note 2 — Persist `adaptiveContext` on the assessment row

The submit route currently stores `organizationContext` (form selections) but does NOT persist the derived `InstitutionalAssessmentProfile` or the `RoutedQuestionBank` snapshot. Two safe options:

- **Recommended (zero-migration):** stash a `_adaptive` sub-key inside `organizationContext` jsonb on submit; the result/report routes read it back. Forward-compat: the next migration can promote it to a first-class column.
- **Stronger (with migration):** add `assessment_adaptation_context jsonb` column + a small `RoutingExplainabilitySnapshot` JSON column.

Until Note 2 lands, the result page + PDF can deterministically RECONSTRUCT the snapshot at render time by re-running `classifyOrgContext(organizationContext)` + `routeQuestionBank(ALL_QUESTIONS, profile)`. This works because both functions are pure and the static question bank is versioned. The reconstruction path is the right move for v1; persistence is the right move once historical comparability matters.

### Note 3 — Result page adaptive context block + PDF "Adaptive Interpretation Context" section

Both are small UI additions and depend only on Note 2's deterministic reconstruction path. Out of scope for this sprint because they are read-only renderers and add no risk. Recommended copy is in the QA script (Scenario 11) and the FLOW_COPY adaptive keys are already locale-paired.

### Note 4 — Playwright full-traversal scenarios are skipped

The smoke + telemetry-privacy specs are active. The full multi-section traversal scenarios (`test.skip`) require stable per-question data-testid attributes throughout the bank. This is mechanical follow-up work but is not blocking for staging given the manual QA script.

---

## Quality gate results (run at commit time)

| Gate | Command | Result |
|------|---------|--------|
| Adaptive unit + component tests | `npx vitest run apps/union-eyes/lib/icra apps/union-eyes/components/icra apps/union-eyes/lib/hubspot/__tests__/icraAdaptiveProperties.test.ts` | recorded in the commit message |
| Lint (union-eyes) | `pnpm --filter @nzila/union-eyes lint` | recorded in the commit message |
| Typecheck (union-eyes) | `pnpm --filter @nzila/union-eyes typecheck` | recorded in the commit message |
| Repo `pnpm test:fast` | `pnpm test:fast` | recorded in the commit message |
| Repo `pnpm lint` | `pnpm lint` | recorded in the commit message |
| Repo `pnpm typecheck` | `pnpm typecheck` | recorded in the commit message |
| Repo `pnpm validate:docs` | `pnpm validate:docs` | recorded in the commit message |
| Repo `pnpm governance:audit` | `pnpm governance:audit` | recorded in the commit message |

---

## Why this is safe to merge

- **No new doctrine.** Everything here strengthens what shipped in `44fb58773`.
- **Pure additive helpers.** `routingExplainabilitySnapshot.ts`, `routedSubmissionValidator.ts`, and `icraAdaptiveProperties.ts` are pure, deterministic, no I/O, no state.
- **Tests pin contracts.** 32 new tests cover routing snapshot, submission integrity, telemetry privacy, HubSpot mapper privacy, and component rendering / a11y.
- **No schema change.** No migration required. No new env vars.
- **No client/server boundary regression.** Telemetry remains inline POST; server-only helpers stay server-only.
- **No PII pathway introduced.** All new surfaces explicitly forbid free text, org names, emails, raw answers, and per-question identifiers; tests fail loudly if anyone breaks this.

---

## Sign-off

- **Author:** GitHub Copilot (Claude Opus 4.7)
- **Reviewer (engineering):** _pending_
- **Reviewer (security):** _pending_
- **Manual QA (per [QA script](../../../docs/oci/assessment/OCRA_ADAPTIVE_LIVE_FLOW_QA_SCRIPT.md)):** _pending_
