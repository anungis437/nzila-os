# Master Runtime Governance Index

> **Status:** Canonical runtime governance · **Layer:** Index · **Inherits:** all runtime governance documents in this directory

This index is the navigational map of Nzila's runtime governance layer. It enumerates each runtime instrument, its purpose, its package binding, and the upstream doctrine and assurance documents it operationalizes.

It is what a steward, certification body, regulator, or platform engineer consults to understand how Nzila's governance executes continuously in production.

---

## 1. Source Layers

| Layer | Location | Index |
|-------|----------|-------|
| Doctrine | [../nzila-ip/](../nzila-ip/) | [../nzila-ip/master-ip-index.md](../nzila-ip/master-ip-index.md) |
| Governance operationalization | [../nzila-governance/](../nzila-governance/) | [../nzila-governance/master-governance-index.md](../nzila-governance/master-governance-index.md) |
| Assurance & certification | [../nzila-assurance/](../nzila-assurance/) | [../nzila-assurance/master-assurance-index.md](../nzila-assurance/master-assurance-index.md) |
| Runtime governance (this layer) | [./](./) | this document |

---

## 2. Runtime Governance Engines

| Document | Purpose | Implementation Package |
|----------|---------|------------------------|
| [runtime-doctrine-enforcement-engine.md](runtime-doctrine-enforcement-engine.md) | Validates every governed act against doctrine policy set | [governance-runtime](../../packages/governance-runtime), [doctrine-enforcement](../../packages/doctrine-enforcement) |
| [governance-policy-engine.md](governance-policy-engine.md) | Centralized policy registration, evaluation, decisioning | [doctrine-enforcement](../../packages/doctrine-enforcement) |
| [deployment-legitimacy-validation-engine.md](deployment-legitimacy-validation-engine.md) | Continuously validates running release legitimacy | [governance-runtime](../../packages/governance-runtime) |
| [governance-safe-ai-runtime-validation.md](governance-safe-ai-runtime-validation.md) | Runtime validation of AI invocation governance | [doctrine-enforcement](../../packages/doctrine-enforcement), [governance-runtime](../../packages/governance-runtime) |

---

## 3. Telemetry, Observability, and Cognitive Monitoring

| Document | Purpose | Implementation Package |
|----------|---------|------------------------|
| [governance-telemetry-architecture.md](governance-telemetry-architecture.md) | Schemas, contracts, normalization for all governance signal | [governance-telemetry](../../packages/governance-telemetry) |
| [continuity-observability-system.md](continuity-observability-system.md) | System-centered continuity posture observation | [continuity-observability](../../packages/continuity-observability) |
| [executive-cognitive-safety-monitoring.md](executive-cognitive-safety-monitoring.md) | System-centered cognitive safety monitoring | [continuity-observability](../../packages/continuity-observability), [governance-telemetry](../../packages/governance-telemetry) |

---

## 4. Attestation and Evidence Substrate

| Document | Purpose | Implementation Package |
|----------|---------|------------------------|
| [runtime-attestation-pipeline.md](runtime-attestation-pipeline.md) | Continuous generation of release-linked attestations | [runtime-attestation](../../packages/runtime-attestation) |
| [governance-evidence-ledger.md](governance-evidence-ledger.md) | Append-only governance evidence substrate | [governance-runtime](../../packages/governance-runtime), [runtime-attestation](../../packages/runtime-attestation) |

---

## 5. Assurance Computation

| Document | Purpose | Implementation Package |
|----------|---------|------------------------|
| [runtime-assurance-engine.md](runtime-assurance-engine.md) | Interpretive posture computation across dimensions | [assurance-engine](../../packages/assurance-engine) |

---

## 6. Surfaces and Cross-Product Fabric

| Document | Purpose |
|----------|---------|
| [runtime-governance-dashboard-architecture.md](runtime-governance-dashboard-architecture.md) | Calm, governance-native operational dashboards |
| [cross-product-governance-runtime-fabric.md](cross-product-governance-runtime-fabric.md) | Shared contracts across UE, FairCase, ExecutiveOS, Veridian, future Nzila systems |

---

## 7. Standing Readiness

| Document | Purpose |
|----------|---------|
| [runtime-governance-readiness-review.md](runtime-governance-readiness-review.md) | Standing maturity review of the runtime governance layer |

---

## 8. Doctrine → Runtime Mapping

| Doctrine Surface | Runtime Manifestation |
|------------------|------------------------|
| Continuity doctrine | [continuity-observability-system.md](continuity-observability-system.md), continuity governance attestations |
| Anti-surveillance doctrine | Aggregation stance enforced across telemetry, ledger, assurance, monitoring |
| Pilot discipline | Pilot gating policies, pilot isolation validations, pilot-safety attestations |
| Governance-safe intelligence | [governance-safe-ai-runtime-validation.md](governance-safe-ai-runtime-validation.md) |
| Executive cognitive governance | [executive-cognitive-safety-monitoring.md](executive-cognitive-safety-monitoring.md), executive dashboard class |
| Deployment legitimacy doctrine | [deployment-legitimacy-validation-engine.md](deployment-legitimacy-validation-engine.md), deployment + environment legitimacy attestations |
| Continuity-safe modernization | Modernization safety indicators, continuity-safe modernization attestations |
| Operational legitimacy | Runtime assurance posture surfaces, operational calmness signals |
| Human authority preservation | Human approval preservation in AI runtime validation, governance decision human-bound effects |

---

## 9. Reading Paths

For platform engineers:
1. [README](README.md)
2. [governance-telemetry-architecture.md](governance-telemetry-architecture.md)
3. [runtime-doctrine-enforcement-engine.md](runtime-doctrine-enforcement-engine.md)
4. [governance-policy-engine.md](governance-policy-engine.md)
5. [governance-evidence-ledger.md](governance-evidence-ledger.md)

For stewards / governance forums:
1. [README](README.md)
2. [runtime-doctrine-enforcement-engine.md](runtime-doctrine-enforcement-engine.md)
3. [runtime-assurance-engine.md](runtime-assurance-engine.md)
4. [runtime-governance-dashboard-architecture.md](runtime-governance-dashboard-architecture.md)
5. [runtime-governance-readiness-review.md](runtime-governance-readiness-review.md)

For procurement officers and external counterparties:
1. [README](README.md)
2. [runtime-attestation-pipeline.md](runtime-attestation-pipeline.md)
3. [governance-evidence-ledger.md](governance-evidence-ledger.md)
4. [deployment-legitimacy-validation-engine.md](deployment-legitimacy-validation-engine.md)
5. [runtime-governance-readiness-review.md](runtime-governance-readiness-review.md)

For AI engineers:
1. [governance-safe-ai-runtime-validation.md](governance-safe-ai-runtime-validation.md)
2. [governance-policy-engine.md](governance-policy-engine.md)
3. [governance-telemetry-architecture.md](governance-telemetry-architecture.md)

For executive surface owners:
1. [executive-cognitive-safety-monitoring.md](executive-cognitive-safety-monitoring.md)
2. [runtime-governance-dashboard-architecture.md](runtime-governance-dashboard-architecture.md)

For regulators / certification bodies:
1. [runtime-attestation-pipeline.md](runtime-attestation-pipeline.md)
2. [governance-evidence-ledger.md](governance-evidence-ledger.md)
3. [deployment-legitimacy-validation-engine.md](deployment-legitimacy-validation-engine.md)
4. [governance-safe-ai-runtime-validation.md](governance-safe-ai-runtime-validation.md)
5. [runtime-governance-readiness-review.md](runtime-governance-readiness-review.md)

---

## 10. Discipline

This index is updated whenever a runtime governance instrument or implementation package is added, retired, or materially changed. A stale index is a navigational defect, and a navigational defect erodes runtime governance discipline.
