# Live Doctrine Enforcement Integration

> **Status:** Canonical runtime integration · **Layer:** Doctrine execution · **Inherits:** [runtime-doctrine-enforcement-engine.md](../nzila-runtime-governance/runtime-doctrine-enforcement-engine.md)

## 1. Objective

Embed doctrine enforcement into the actual runtime path of every Nzila product so doctrine becomes a structural property of request handling rather than a documented intent.

## 2. Integration surfaces

| Surface | Enforcement obligation |
|---|---|
| Edge middleware (`apps/*/proxy.ts`) | Resolve route legitimacy, locale legitimacy, request id propagation. Refuse routes whose feature profile is not registered. |
| Layout guards (`app/[locale]/layout.tsx`) | Resolve org/role/pilot scope; refuse continuity-breaking visibility. |
| Route handlers (`app/api/**/route.ts`) | Apply role policy + pilot isolation assertion before any database read. |
| Server actions | Apply human-authority assertion for governance-bearing acts. |
| API boundaries (`apps/orchestrator-api/**`) | Apply AI capability registration + categorical-refusal screen before invocation. |
| Orchestration adapters | Refuse cross-environment data motion at the adapter boundary. |
| Feature profile resolution | Reject feature exposure absent a citable doctrine policy. |

## 3. Required wiring

Wire the following packages into the surfaces above:

- [@nzila/doctrine-enforcement](../../packages/doctrine-enforcement) — `DoctrinePolicyRegistry`, `evaluatePolicy`, `AICapabilityRegistry`.
- [@nzila/governance-runtime](../../packages/governance-runtime) — `assertPilotIsolation`, `assertExecutiveDensity`, `assertHumanAuthority`, `assertAntiSurveillancePayload`, `validateDeploymentLegitimacy`.
- [@nzila/governance-middleware](../../packages/governance-middleware) — Next.js + Node helpers that adapt the assertions and registries into route-handler shape.

## 4. Required fail states

The integration MUST block — not soften — the following conditions:

- `unauthorized_feature_exposure` — surface rendered without registered feature policy.
- `governance_breaking_visibility` — visibility scope exceeds doctrine-permitted scope.
- `pilot_contamination` — pilot data on production paths or production data on pilot paths.
- `unsafe_ai_exposure` — AI capability invoked outside of its registered surface.
- `continuity_breaking_route` — route serves content classified as destabilizing for the surface's calm budget.
- `invalid_environment_mode` — environment identity does not match release manifest.

Each failure MUST emit a `doctrine_enforcement_event` (severity `warning` minimum, `critical` for pilot contamination and unsafe AI exposure) with at least one doctrine citation.

## 5. Posture

Doctrine enforcement is **fail-closed on doctrine-critical paths**. It is **fail-open with telemetry on advisory paths** so doctrine never degrades operational calmness for non-critical surfaces. Both paths emit governance evidence; only critical paths block the request.

## 6. Discipline

Doctrine enforcement that requires human approval for routine reads is doctrine theatre and is rejected. Doctrine enforcement that silently permits a critical violation because "the alert would be loud" is also rejected. The integration must be quiet on routine, structural on critical.
