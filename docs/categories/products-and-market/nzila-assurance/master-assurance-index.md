# Master Assurance Index

> **Status:** Canonical assurance · **Layer:** Index · **Inherits:** all assurance documents in this directory and the corpus in [../nzila-ip/](../nzila-ip/), [../nzila-governance/](../nzila-governance/)

This index is the **single navigational map** of Nzila's assurance and certification layer. It enumerates each assurance instrument, its purpose, its doctrinal and governance basis, and its evidence anchor.

It is the document a steward, certification body, regulator, procurement officer, or external auditor consults to understand how Nzila's governance becomes continuously verifiable.

---

## 1. Source Layers

### 1.1 Doctrine Corpus
Authoritative source under [../nzila-ip/](../nzila-ip/). Indexed at [../nzila-ip/master-ip-index.md](../nzila-ip/master-ip-index.md).

### 1.2 Governance Operationalization
Operational governance under [../nzila-governance/](../nzila-governance/). Indexed at [../nzila-governance/master-governance-index.md](../nzila-governance/master-governance-index.md).

### 1.3 Assurance and Certification (this layer)
Continuous verification under [./](./). Indexed by this document.

---

## 2. Assurance Instruments

### 2.1 Certification
- **[institutional-certification-framework.md](institutional-certification-framework.md)** — certification classes, six-tier maturity model (C0–C5), certification dimensions, evidence thresholds, revocation discipline, categorical non-certifiable capabilities.

### 2.2 Evidence Generation
- **[automated-governance-evidence-system.md](automated-governance-evidence-system.md)** — evidence types (deployment, governance, UX, AI, continuity, pilot), CI/CD integration models (build, deploy, runtime, E2E, drift), evidence quality standards, anti-surveillance constraints.
- **[governance-evidence-pipeline-architecture.md](governance-evidence-pipeline-architecture.md)** — pipeline stages (ingestion, normalization, classification, retention, immutability, signing, traceability, packaging), source-to-stage mapping, future architecture compatibility (signed attestations, tamper-evident logs, audit trails, governance ledgers, release provenance).

### 2.3 Continuous Observability
- **[continuous-doctrine-compliance-observability.md](continuous-doctrine-compliance-observability.md)** — observability domains (drift, violations, destabilization, continuity-breaking changes, overload, executive burden, pilot contamination, AI degradation), indicator categories, drift response.

### 2.4 Domain Assurance Models
- **[continuity-governance-attestation-model.md](continuity-governance-attestation-model.md)** — continuity-safe deployment, routing, isolation, stabilization, onboarding, modernization, operational coherence; per-deployment / per-release / per-environment / per-pilot / per-organization / per-product scopes.
- **[governance-safe-ai-assurance-model.md](governance-safe-ai-assurance-model.md)** — explainability, human authority, anti-surveillance, escalation transparency, interpretability, reviewability, operational restraint, continuity-safe recommendations; categorical non-certifiable AI.
- **[executive-cognitive-safety-assurance.md](executive-cognitive-safety-assurance.md)** — measurable thresholds for density, escalation pacing, alert restraint, readability, visibility, calmness, overload risk, executive UX; UX / heuristic / pacing / readability validation models.
- **[operational-legitimacy-assurance-system.md](operational-legitimacy-assurance-system.md)** — deployment realism, pilot realism, modernization safety, rollout governance, trust pacing, institutional readiness, operational maturity signaling; anti-pattern screen (startup theater, demo instability, governance ambiguity, deployment opacity, uncontrolled rollout, modernization chaos).
- **[environment-governance-assurance.md](environment-governance-assurance.md)** — environment isolation, release traceability, seed protections, deployment metadata, rollback legitimacy, pilot/demo isolation, production protection; required evidence (environment identity, release SHA, manifests, isolation verification, migration parity, rollback proof).

### 2.5 External Translation
- **[procurement-assurance-framework.md](procurement-assurance-framework.md)** — procurement concern map, required outputs (procurement evidence packs, governance attestation bundles, deployment legitimacy reports, continuity governance summaries, explainability assurance summaries, pilot safety attestations), procurement language discipline.

### 2.6 Trust Reading
- **[institutional-trust-scoring-model.md](institutional-trust-scoring-model.md)** — nine-dimension interpretive trust read; banding (Strong / Established / Forming / Concern); categorical refusal of behavioral ranking, productivity scoring, institutional coercion, composite collapse.

### 2.7 Standing Readiness
- **[assurance-readiness-review.md](assurance-readiness-review.md)** — assurance maturity assessment across certification, evidence, observability, deployment assurance, AI assurance, operational legitimacy, procurement assurance; gaps, future certification pathways, readiness for external attestation.

---

## 3. Certification Class to Instrument Map

| Certification Class | Anchor Instrument | Supporting Evidence |
|---------------------|-------------------|---------------------|
| Doctrine-Compliant System | certification framework | governance evidence, observability indicators |
| Governance-Safe Deployment | environment governance assurance | deployment evidence, release manifests, rollback proof |
| Continuity-Safe Modernization | operational legitimacy assurance | pacing evidence, sequencing rationale, stakeholder visibility |
| Operational Legitimacy Readiness | operational legitimacy assurance | realism evidence, pilot evidence, trust pacing observation |
| Governance-Safe Intelligence | AI assurance model | AI evidence, explainability presence, surveillance-pattern lint |
| Continuity-Safe UX | executive cognitive safety assurance + design governance | UX evidence, density audits, calmness signals |
| Executive Cognitive Governance | executive cognitive safety assurance | executive surface evidence, refresh cadence, notification rate |
| Pilot-Safe Operational Posture | environment governance + continuity attestation | pilot evidence, scope enforcement, exit governance |

---

## 4. Evidence Type to Source Map

| Evidence Type | Generation Source | Pipeline Stage |
|---------------|-------------------|----------------|
| Deployment | Deployment system | Deploy-time |
| Governance | CI policy + reviews | Build-time + review-time |
| UX | CI lint + visual regression + telemetry | Build-time + runtime |
| AI | E2E + governance review + lint | Pre-deploy + review-time |
| Continuity | Routing + contract tests + telemetry | Runtime + pre-deploy |
| Pilot | Routing + manifest + governance | Runtime + deploy-time + review-time |

---

## 5. Reading Paths

For new stewards:
1. [README](README.md)
2. [institutional-certification-framework.md](institutional-certification-framework.md)
3. [automated-governance-evidence-system.md](automated-governance-evidence-system.md)
4. [assurance-readiness-review.md](assurance-readiness-review.md)

For procurement officers and institutional buyers:
1. [procurement-assurance-framework.md](procurement-assurance-framework.md)
2. [institutional-certification-framework.md](institutional-certification-framework.md)
3. [continuity-governance-attestation-model.md](continuity-governance-attestation-model.md)
4. [governance-safe-ai-assurance-model.md](governance-safe-ai-assurance-model.md)
5. [environment-governance-assurance.md](environment-governance-assurance.md)
6. [assurance-readiness-review.md](assurance-readiness-review.md)

For regulators and certification bodies:
1. [institutional-certification-framework.md](institutional-certification-framework.md)
2. [governance-evidence-pipeline-architecture.md](governance-evidence-pipeline-architecture.md)
3. [continuity-governance-attestation-model.md](continuity-governance-attestation-model.md)
4. [governance-safe-ai-assurance-model.md](governance-safe-ai-assurance-model.md)
5. [environment-governance-assurance.md](environment-governance-assurance.md)
6. [assurance-readiness-review.md](assurance-readiness-review.md)

For platform engineering and assurance owners:
1. [governance-evidence-pipeline-architecture.md](governance-evidence-pipeline-architecture.md)
2. [automated-governance-evidence-system.md](automated-governance-evidence-system.md)
3. [continuous-doctrine-compliance-observability.md](continuous-doctrine-compliance-observability.md)

For AI engineers seeking assurance pathways:
1. [governance-safe-ai-assurance-model.md](governance-safe-ai-assurance-model.md)
2. [../nzila-governance/continuity-safe-ai-governance.md](../nzila-governance/continuity-safe-ai-governance.md)
3. [institutional-certification-framework.md](institutional-certification-framework.md)

For executive surface owners:
1. [executive-cognitive-safety-assurance.md](executive-cognitive-safety-assurance.md)
2. [../nzila-governance/executive-cognitive-governance-standards.md](../nzila-governance/executive-cognitive-governance-standards.md)

For investors evaluating institutional posture:
1. [README](README.md)
2. [institutional-trust-scoring-model.md](institutional-trust-scoring-model.md)
3. [assurance-readiness-review.md](assurance-readiness-review.md)

---

## 6. Discipline

This index is updated whenever an assurance instrument is added, retired, or materially changed. A stale index is a navigational defect, and a navigational defect erodes assurance discipline.
