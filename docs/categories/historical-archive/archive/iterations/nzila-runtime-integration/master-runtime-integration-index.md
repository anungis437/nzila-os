# Master Runtime Integration Index

> **Status:** Canonical runtime integration · **Layer:** Navigation · **Inherits:** [README.md](README.md)

## 1. Live integrations

| Integration | Doc | Implementation root |
|---|---|---|
| Doctrine enforcement (route + role + pilot + AI) | [live-doctrine-enforcement-integration.md](live-doctrine-enforcement-integration.md) | [packages/governance-middleware](../../packages/governance-middleware) |
| Governance telemetry pipeline | [governance-telemetry-live-pipeline.md](governance-telemetry-live-pipeline.md) | [packages/governance-telemetry](../../packages/governance-telemetry) + [packages/governance-otel](../../packages/governance-otel) |
| Continuity observability embedding | [continuity-observability-runtime-embedding.md](continuity-observability-runtime-embedding.md) | [packages/continuity-observability](../../packages/continuity-observability) |
| Runtime attestation generation | [live-runtime-attestation-generation.md](live-runtime-attestation-generation.md) | [tooling/runtime-governance](../../tooling/runtime-governance) |
| Governance evidence emission | [governance-evidence-emission.md](governance-evidence-emission.md) | [packages/runtime-attestation](../../packages/runtime-attestation) |
| OpenTelemetry adapter | [opentelemetry-governance-integration.md](opentelemetry-governance-integration.md) | [packages/governance-otel](../../packages/governance-otel) |
| Governance dashboard embedding | [governance-native-dashboard-embedding.md](governance-native-dashboard-embedding.md) | apps/control-plane, apps/console |
| Deployment legitimacy validation | [live-deployment-legitimacy-validation.md](live-deployment-legitimacy-validation.md) | [packages/governance-runtime](../../packages/governance-runtime) |
| Governance policy engine execution | [governance-policy-engine-live-execution.md](governance-policy-engine-live-execution.md) | [packages/doctrine-enforcement](../../packages/doctrine-enforcement) + [packages/governance-middleware](../../packages/governance-middleware) |
| CI/CD governance automation | [cicd-governance-automation.md](cicd-governance-automation.md) | `.github/workflows/runtime-governance-attestation.yml` |
| E2E governance validation | [e2e-governance-validation-harness.md](e2e-governance-validation-harness.md) | apps/union-eyes/e2e/governance/ |
| Cross-product activation | [cross-product-governance-runtime-activation.md](cross-product-governance-runtime-activation.md) | All apps/* |

## 2. Reading paths by audience

| Audience | Path |
|---|---|
| Platform engineering | live-doctrine → governance-telemetry → opentelemetry → governance-policy-engine → cicd |
| Product engineering | live-doctrine → governance-telemetry → cross-product → e2e |
| Operations / SRE | continuity-observability → governance-native-dashboard → live-deployment-legitimacy → cicd |
| Governance forum | governance-evidence-emission → live-runtime-attestation → continuity-observability → readiness-review |
| Procurement / external attestation | live-runtime-attestation → governance-evidence-emission → readiness-review |

## 3. Implementation packages

- [@nzila/governance-telemetry](../../packages/governance-telemetry)
- [@nzila/doctrine-enforcement](../../packages/doctrine-enforcement)
- [@nzila/governance-runtime](../../packages/governance-runtime)
- [@nzila/continuity-observability](../../packages/continuity-observability)
- [@nzila/assurance-engine](../../packages/assurance-engine)
- [@nzila/runtime-attestation](../../packages/runtime-attestation)
- [@nzila/governance-otel](../../packages/governance-otel)
- [@nzila/governance-middleware](../../packages/governance-middleware)

## 4. Tooling

- [tooling/runtime-governance](../../tooling/runtime-governance) — attestation generator, evidence writer, CI checks
- `.github/workflows/runtime-governance-attestation.yml` — release-time attestation pipeline
