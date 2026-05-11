# Governance Evidence Pipeline Architecture

> **Status:** Canonical assurance · **Layer:** Evidence pipeline architecture · **Inherits:** [automated-governance-evidence-system.md](automated-governance-evidence-system.md), [institutional-certification-framework.md](institutional-certification-framework.md)

This document defines the **architecture of the governance evidence pipeline**: how evidence flows from generation surfaces (CI/CD, E2E, deployment systems, routing, governance checks, operational telemetry, environment governance) through ingestion, normalization, classification, retention, signing, and packaging into reviewable, certifiable, externally defensible artifacts.

This is the substrate on which all assurance at C3 and above depends.

---

## 1. Posture

The pipeline:

- **Captures** evidence from every surface where it can be produced safely
- **Normalizes** into a stable evidence record shape
- **Classifies** by evidence type (deployment, governance, UX, AI, continuity, pilot)
- **Retains** with appropriate immutability and signing
- **Traces** every record to its source, subject, and certification class
- **Packages** into procurement, certification, and regulator-ready bundles
- **Honors** anti-surveillance constraints throughout

A pipeline that drifts from any of these is itself a governance defect.

---

## 2. Pipeline Stages

### 2.1 Ingestion
Inputs:
- CI policy lint outputs
- E2E doctrine assertion outcomes
- Deployment system manifests, sequencing rationale, approval chains
- Routing layer decisions (sampled, anti-surveillance-safe)
- Governance review records (compliance, architectural, AI governance)
- Operational telemetry (calmness signals, refresh cadence, notification rates)
- Environment governance reports

Ingestion is automatic. Manual ingestion is permitted only for review records that do not fit automated capture, and is itself recorded as such.

### 2.2 Normalization
All evidence is normalized into a stable record shape (per [automated-governance-evidence-system.md](automated-governance-evidence-system.md) §5):

- Subject
- Class
- Outcome
- Cited source
- Timestamp
- Scope
- Signature (where retained)

Normalization preserves source-specific detail in an attached payload while keeping the spine stable.

### 2.3 Classification
Each record is classified by:

- **Evidence type** — deployment, governance, UX, AI, continuity, pilot
- **Certification class** — which class in [institutional-certification-framework.md](institutional-certification-framework.md) it supports
- **Subject scope** — system, surface, release, capability, environment
- **Sensitivity** — public, governance-only, regulator-grade

Classification drives retention, signing, and access governance.

### 2.4 Retention
Retention horizons follow institutional memory governance:

- Deployment evidence: retained for the certification window plus standing review margin
- Governance review records: retained for the doctrine governance forum's archival horizon
- Runtime sampled evidence: retained briefly except where rolled into longer-horizon aggregations
- Signed attestations: retained for the certification's external defensibility horizon

Retention beyond purpose is itself a doctrine defect.

### 2.5 Immutability
Retained evidence is **append-only** at the record level. Corrections are entered as superseding records with cited reasoning, never as in-place edits. Audit trail remains intact.

### 2.6 Signing
Evidence used at C4+ certification is signed. Signing chain identifies:

- Signer role
- Signing key provenance
- Signing time
- Subject record hash

Unsigned evidence is C3-eligible at most.

### 2.7 Traceability
Every record traces:

- Forward — to certifications, attestations, and packages it supports
- Backward — to source surface, originating change, reviewer
- Laterally — to related records bearing on the same subject

Traceability supports reviewer reconstruction without privileged access.

### 2.8 Packaging
Evidence is packaged for:

- Procurement evidence packs ([procurement-assurance-framework.md](procurement-assurance-framework.md))
- Governance attestation bundles
- Deployment legitimacy reports
- Continuity governance summaries
- Explainability assurance summaries
- Pilot safety attestations
- Standing readiness review ([assurance-readiness-review.md](assurance-readiness-review.md))

Packaging is automated where possible; manual narration is preface only.

---

## 3. Source-to-Stage Mapping

| Source | Ingestion Stage | Normalization Output | Classification |
|--------|-----------------|----------------------|----------------|
| CI policy lints | Build-time | Per-policy outcome record | Governance / UX / AI / Continuity |
| E2E suites | Pre-deploy | Assertion-outcome record | Governance / UX / AI / Continuity / Pilot |
| Deployment system | Deploy-time | Manifest + sequencing + approval record | Deployment |
| Routing layer | Runtime | Sampled decision record (aggregated) | Continuity / Pilot |
| Governance reviews | Review-time | Verdict + dimension findings | Governance |
| Architectural reviews | Review-time | Verdict + dimension findings | Governance |
| AI governance reviews | Per-capability | Verdict + dimension findings | AI |
| Operational telemetry | Runtime | Aggregated calmness/cadence record | UX / Executive |
| Environment governance | Per release / per environment | Isolation + parity + rollback record | Deployment / Environment |

---

## 4. Anti-Surveillance Constraints in the Pipeline

The pipeline honors aggregation stance at every stage:

- Runtime evidence is **aggregated**, not individual-resolving
- Reviewer identity in records is **role-named**, not personally weaponized
- Telemetry sampling rates are bounded to prevent restricted-class resolution
- Cross-environment evidence flow honors stakeholder isolation
- Evidence retention horizons honor institutional memory governance
- Evidence access is governed; not all records are universally readable

A pipeline that violates these is a governance defect, not merely a privacy issue.

---

## 5. Future Architecture Compatibility

The pipeline is designed to remain compatible with:

### 5.1 Signed Attestations
Industry-standard signing primitives (e.g., transparent log attestations) can be adopted without changing the record spine. Signing layer is pluggable.

### 5.2 Tamper-Evident Evidence
Append-only retention plus signing supports tamper-evidence. Future integration with verifiable logs is possible without record reshape.

### 5.3 Audit Trails
Traceability spine enables external auditor reconstruction. Audit-trail surfaces can be exported to standard formats.

### 5.4 Governance Ledgers
Long-horizon evidence retention is ledger-compatible. The pipeline does not assume any particular ledger technology and may evolve to integrate with one when external requirements warrant.

### 5.5 Release Provenance Systems
Build-provenance integrations (industry-standard supply chain attestation) can be ingested as governance evidence and bound to deployment manifests.

The pipeline is built for evolution. Stack changes do not destroy evidence continuity.

---

## 6. Pipeline Self-Governance

The pipeline itself is a governed system:

- It is reviewed under the [doctrine compliance review framework](../nzila-governance/doctrine-compliance-review-framework.md)
- It is observable under [continuous-doctrine-compliance-observability.md](continuous-doctrine-compliance-observability.md)
- Its outputs are scorecard-eligible
- Its degradations are themselves drift indicators
- It is reviewed at standing readiness cadence

A pipeline that operates outside governance would itself violate doctrine.

---

## 7. Anti-Patterns

- **Vanity ingestion** — capturing volume without substance
- **Selective retention** — discarding unfavorable records
- **Signing absent at C4+** — claiming a tier the pipeline cannot support
- **Surveillance creep** — expanding sampling toward individual resolution
- **Manual narration as primary evidence** — replacing automated artifacts with prose
- **Retention beyond purpose** — keeping evidence past its institutional purpose
- **Unbounded access** — making sensitive records universally readable
- **Pipeline-as-marketing** — extracting evidence into promotional surfaces in ways that erode register

---

## 8. External Posture

The pipeline is the substrate that lets Nzila say to any external party: *"Here is the evidence. You don't need our story."*

It is presentable in:

- Procurement engagements
- Regulator engagements
- Certification body submissions
- Investor and partner diligence
- Long-horizon institutional partnerships

Its existence is itself a procurement-grade signal.

---

## 9. Discipline

The pipeline's authority depends on continuous, honest, anti-surveillance-safe operation. Every shortcut taken in the pipeline is a shortcut taken in Nzila's institutional standing.

The pipeline is built once, governed always.
