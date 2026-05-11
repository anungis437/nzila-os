# E2E Governance Validation Harness

> **Status:** Canonical runtime integration · **Layer:** E2E execution · **Inherits:** [live-doctrine-enforcement-integration.md](live-doctrine-enforcement-integration.md)

## 1. Objective

Extend the existing Playwright E2E harness so it validates governance behavior — not only that the application functions.

## 2. Required tests

| Suite | What it validates |
|---|---|
| `e2e/governance/role-safe-routing.spec.ts` | Roles cannot reach routes outside their policy scope; refusal is calm (no stacktrace, no sensitive disclosure). |
| `e2e/governance/pilot-isolation.spec.ts` | A pilot identity sees no production data; a production identity sees no pilot data; both transitions are denied with `pilot_isolation_failure`. |
| `e2e/governance/governance-safe-visibility.spec.ts` | Continuity-safe visibility scoping is honored; no surface exceeds its calm budget. |
| `e2e/governance/ai-governance-enforcement.spec.ts` | An unregistered AI capability invocation is refused at the boundary; a categorically refused behavior is rejected at registration. |
| `e2e/governance/executive-cognitive-safety.spec.ts` | Executive surfaces stay under their density and refresh-cadence budgets across a 5-minute observation. |
| `e2e/governance/deployment-legitimacy-visibility.spec.ts` | Release identity, environment identity, and last attestation verdict are reachable from the operations surface and match the running release. |
| `e2e/governance/environment-correctness.spec.ts` | The environment identity reported by the running app matches the manifest. |

## 3. Helper API

`apps/union-eyes/e2e/helpers/governance.ts` exposes:

- `expectGovernanceEvent(page, type, severity?)` — drains the in-process governance event sink and asserts at least one matching envelope was emitted.
- `expectNoForbiddenPayloadKeys(page)` — asserts no governance event in the run carried a person-resolving key.
- `expectAttestationReachable(page, releaseId)` — asserts the operations surface exposes the attestation for the running release.

## 4. Test posture

- Tests are deterministic and parallel-safe.
- Tests do not seed personal data; pilot/production fixtures are system-scoped.
- Tests fail loudly on governance regressions and quietly on functional success.

## 5. Discipline

Governance E2E is not a smoke test. It is a contract test for institutional behavior. A passing E2E suite that does not assert governance behavior is a procurement-risk artifact.
