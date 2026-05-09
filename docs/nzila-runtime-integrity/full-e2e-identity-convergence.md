# Full E2E Identity Convergence

> Ensures end-to-end tests validate **real institutional embodiment**, not just route reachability. Authorizes a separate runtime hardening PR.

## Authority Anchors

- [Runtime Integrity README](README.md)
- [Full Auth & Role Lineage Audit](full-auth-role-lineage-audit.md)
- [Full Seeded Persona Legitimacy Hardening](full-seeded-persona-legitimacy-hardening.md)
- [Full Dashboard & Runtime Failure Integrity](full-dashboard-runtime-failure-integrity.md)

## Posture

E2E must validate **institutional embodiment**, not just route reachability. A passing E2E suite must mean:

- every seeded persona resolves through the canonical identity chain
- every persona lands on its canonical role landing surface deterministically
- every persona sees its required nav and none of its forbidden nav
- every governance, continuity, onboarding, and executive surface visible to the persona is operationally honest (no fail-open empty shells)
- locale is preserved across every redirect

E2E is the **runtime contract** for institutional identity. A green E2E suite that hides identity drift is a governance-safe regression.

## Audit Targets

| Surface | Concern | Required Posture |
| --- | --- | --- |
| `apps/union-eyes/e2e/authenticated-role-navigation.spec.ts` | currently fails because `/dashboard` does not redirect to the role landing under E2E auth | must pass deterministically against a freshly seeded baseline; failure is a runtime regression, not test flake |
| `apps/union-eyes/e2e/helpers/auth.ts` | `bootstrapE2EAuth` + `loginAsRole` cookie semantics | must align with the canonical org cookie name(s) per the org-identity convergence doc |
| `apps/union-eyes/tests/fixtures/test-users.ts` | persona definitions | must mirror the seed topology one-to-one |
| `apps/union-eyes/scripts/seed-test-env.ts` | seed completion path | must succeed without schema-drift catch swallowing |
| `apps/union-eyes/e2e/helpers/role-fixtures.ts` | required nav, forbidden nav, expected landing | must remain the single source of truth for E2E identity contract |
| dashboard landing assertions | `expect(page).toHaveURL(...)` | must assert the canonical role landing every persona is institutionally entitled to |
| onboarding visibility | first-login flows | must validate that profile auto-create paths are reconciled, not silently masked |
| executive visibility | exec-only surfaces | must validate that executive personas reach the exec landing and see exec-only nav |
| governance visibility | governance-only surfaces | must validate that governance personas reach the governance landing |
| continuity visibility | continuity surfaces | must validate that continuity surfaces remain visible under degradation banners |

## Required Implementation (downstream PR)

The downstream PR (`refactor/nzila-e2e-identity-convergence`) must actually:

- align `loginAsRole` cookie semantics with the canonical org cookie chosen in the org-identity convergence PR
- add a pre-test bootstrap assertion that every persona resolves through `auth()` server-side before any spec runs (fail loud, fail fast)
- add an explicit “persona embodies role” spec per persona that validates: (a) deterministic landing, (b) required nav present, (c) forbidden nav absent, (d) primary action reachable, (e) locale preserved across redirects
- add an executive, governance, continuity, and onboarding visibility spec per applicable persona
- run the suite against `dev`, `staging`, and `demo` baselines (the certification doc enumerates the verdict matrix)

## Forbidden Posture

The following are explicitly rejected:

- **ai-first** test heuristics that paper over deterministic failures (forbidden — E2E is deterministic, not ai-powered, not copilot-driven, not chatbot-driven, not workforce ai)
- **autonomous executive** privilege escalation in E2E shortcuts (forbidden — every persona embodies its declared role only)
- silent flakiness tolerance (forbidden — flake hides institutional drift; flake is incompatible with governance-safe operation)
- **engagement gamification** of test dashboards (forbidden — test reporting is institutional, never a productivity optimization, never an ai assistant or ai ceo surface)

## Stewardship Cadence

E2E identity drift is reviewed on the standing daily / weekly / monthly / quarterly stewardship cadence. Any persona-class regression is treated as continuity-safe drift and remediated under reviewer-of-record approval.

## Authorized Downstream PR

This document authorizes exactly one runtime hardening PR titled `refactor/nzila-e2e-identity-convergence`. It must not bundle other axis work.
