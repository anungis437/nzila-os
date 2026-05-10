# Cross-App E2E Maturity Matrix

> Operational validation matrix for ecosystem maturity.

## 1. Convergence Statement

Maturity is validated **operationally**, not only doctrinally. E2E coverage must validate maturity behaviors across the ecosystem.

## 2. Maturity Behaviors Validated E2E

| Behavior | UE | Console | ExecutiveOS | UE Ops | CFO | FairCase |
|----------|----|---------|-------------|--------|-----|----------|
| Onboarding maturity | ✅ | 🟡 | 🟡 | 🟡 | 🟡 | 🟡 |
| Governance maturity | ✅ | ✅ | ✅ | 🟡 | 🟡 | 🟡 |
| Cognition maturity | ✅ | ✅ | ✅ | 🟡 | ✅ | 🟡 |
| Cadence maturity | ✅ | ✅ | ✅ | 🟡 | 🟡 | 🟡 |
| Stabilization maturity | ✅ | 🟡 | 🟡 | 🟡 | 🟡 | 🟡 |
| Navigation maturity | ✅ | ✅ | ✅ | 🟡 | ✅ | 🟡 |
| Role continuity maturity | ✅ | 🟡 | 🟡 | 🟡 | 🟡 | 🟡 |
| Operational calmness | ✅ | ✅ | ✅ | 🟡 | ✅ | 🟡 |

✅ = E2E or contract-validated · 🟡 = doctrinally specified, E2E coverage to expand

## 3. E2E Anchor Tests

- `apps/union-eyes/e2e/cba-intelligence.spec.ts` — protected continuity route, entitlement-aware.
- `pnpm validate:cognition` — cross-app cognition consistency.
- `pnpm validate:labor-continuity` — UE labor continuity invariants.
- `pnpm validate:maturity-elevation` — ecosystem convergence.
- `pnpm validate:maturity` — app-level maturity contract tests.

## 4. Expansion Direction

E2E coverage will progressively cover:

- onboarding cadence maturity
- stabilization UX (refusal, rollback, restoration)
- escalation UX
- cross-app navigation rhythm

## 5. Authority

Anchored to [Cross-App Cognition Consistency](../nzila-cognition-doctrine/cross-app-cognition-consistency.md).
