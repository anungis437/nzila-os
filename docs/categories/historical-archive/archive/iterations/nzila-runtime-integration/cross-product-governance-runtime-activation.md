# Cross-Product Governance Runtime Activation

> **Status:** Canonical runtime integration · **Layer:** Cross-product fabric · **Inherits:** [cross-product-governance-runtime-fabric.md](../nzila-runtime-governance/cross-product-governance-runtime-fabric.md)

## 1. Objective

Activate governance runtime systems consistently across Union Eyes, FairCase, ExecutiveOS, Veridian, and any future product, so that governance is a property of the platform rather than an opt-in per product.

## 2. Shared contracts

| Contract | Source of truth | Consumed by |
|---|---|---|
| Canonical event envelope | [@nzila/governance-telemetry](../../packages/governance-telemetry) | All products |
| Doctrine policy shape | [@nzila/doctrine-enforcement](../../packages/doctrine-enforcement) | All products |
| Continuity posture / cognitive safety threshold | [@nzila/continuity-observability](../../packages/continuity-observability) | All products |
| Assurance posture read | [@nzila/assurance-engine](../../packages/assurance-engine) | Control Plane, ExecutiveOS |
| Runtime attestation envelope | [@nzila/runtime-attestation](../../packages/runtime-attestation) | All products + CI |
| Governance middleware adapter | [@nzila/governance-middleware](../../packages/governance-middleware) | All Next.js / Node products |

## 3. Activation checklist (per product)

For a product to be considered governance-runtime-activated, it MUST:

1. Depend on `@nzila/governance-middleware`.
2. Wire `withPolicyGate` into at least one route handler per registered route policy.
3. Emit `governance_event:route_resolution` from edge middleware.
4. Emit `pilot_boundary_event` from any pilot-scoped surface.
5. Emit `ai_governance_event` from any AI capability invocation path.
6. Bind release identity at startup via `readReleaseIdentityFromEnv()`.
7. Run heartbeat deployment legitimacy validation at the configured cadence.
8. Surface its release identity, environment identity, and last attestation verdict on its `/health` endpoint.

## 4. Activation status

The readiness review tracks activation status per product as `forming` / `established` / `strong`. Union Eyes is the reference implementation and is the first product to reach `established`. FairCase, ExecutiveOS, and Veridian inherit the same shape.

## 5. Drift discipline

Cross-product drift — where one product diverges from the shared contracts — is treated as a doctrine-bearing regression, not an engineering preference. Any divergence must either:

- Be reverted to the shared contract, OR
- Be promoted into the shared contract via a doctrine-cited change to the upstream package.

Per-product forks of governance contracts are rejected.

## 6. Discipline

Cross-product activation succeeds when the institution can describe its governance posture in a single sentence regardless of which product is being discussed. If a stakeholder must learn a new governance model per product, the activation has failed.
