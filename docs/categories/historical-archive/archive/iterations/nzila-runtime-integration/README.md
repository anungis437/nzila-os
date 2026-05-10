# Nzila Runtime Integration Layer

> **Status:** Canonical runtime integration · **Layer:** Operational embedding · **Inherits:** [docs/nzila-runtime-governance/README.md](../nzila-runtime-governance/README.md)

This corpus is the operational embedding of the runtime governance architecture into actual living Nzila systems. It does not introduce new doctrine. It does not theorize new governance surfaces. It wires the existing governance runtime packages into real product flows so that governance becomes continuously executing system behavior rather than infrastructure waiting to be used.

## Reading order

1. [live-doctrine-enforcement-integration.md](live-doctrine-enforcement-integration.md)
2. [governance-telemetry-live-pipeline.md](governance-telemetry-live-pipeline.md)
3. [continuity-observability-runtime-embedding.md](continuity-observability-runtime-embedding.md)
4. [live-runtime-attestation-generation.md](live-runtime-attestation-generation.md)
5. [governance-evidence-emission.md](governance-evidence-emission.md)
6. [opentelemetry-governance-integration.md](opentelemetry-governance-integration.md)
7. [governance-native-dashboard-embedding.md](governance-native-dashboard-embedding.md)
8. [live-deployment-legitimacy-validation.md](live-deployment-legitimacy-validation.md)
9. [governance-policy-engine-live-execution.md](governance-policy-engine-live-execution.md)
10. [cicd-governance-automation.md](cicd-governance-automation.md)
11. [e2e-governance-validation-harness.md](e2e-governance-validation-harness.md)
12. [cross-product-governance-runtime-activation.md](cross-product-governance-runtime-activation.md)
13. [master-runtime-integration-index.md](master-runtime-integration-index.md)
14. [runtime-governance-activation-readiness-review.md](runtime-governance-activation-readiness-review.md)

## Implementation roots

- [packages/governance-telemetry](../../packages/governance-telemetry)
- [packages/doctrine-enforcement](../../packages/doctrine-enforcement)
- [packages/governance-runtime](../../packages/governance-runtime)
- [packages/continuity-observability](../../packages/continuity-observability)
- [packages/assurance-engine](../../packages/assurance-engine)
- [packages/runtime-attestation](../../packages/runtime-attestation)
- [packages/governance-otel](../../packages/governance-otel) — OTel adapter for governance spans
- [packages/governance-middleware](../../packages/governance-middleware) — runtime hooks usable from Next.js, Node, edge
- [tooling/runtime-governance](../../tooling/runtime-governance) — CI scripts, attestation generators, evidence writers

## Governing principle

Governance integration must always preserve operational calmness, anti-surveillance posture, executive cognitive safety, continuity-safe modernization, human authority, and institutional legitimacy. Any integration that would degrade these properties — even in service of "more governance signal" — is rejected by design.
