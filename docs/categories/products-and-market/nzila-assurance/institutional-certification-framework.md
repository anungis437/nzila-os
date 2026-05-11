# Institutional Certification Framework

> **Status:** Canonical assurance · **Layer:** Certification architecture · **Inherits:** [../nzila-ip/](../nzila-ip/), [../nzila-governance/](../nzila-governance/)

This document defines Nzila's **formal certification architecture**: the classes of certification that Nzila systems can hold, the tiers of maturity within each class, the dimensions against which certification is assessed, and the discipline by which certification is awarded, sustained, and revoked.

Certification at Nzila is not a marketing badge. It is a **governance-grade attestation** that a system meets explicit, evidence-backed assurance standards. A certified system is one whose continuity safety, governance legitimacy, and doctrinal alignment can be **demonstrated**, not merely asserted.

---

## 1. Posture

The certification framework:

- Is **doctrine-grounded** — every certification class derives from doctrine in [../nzila-ip/](../nzila-ip/)
- Is **evidence-backed** — certification requires reviewable evidence from the [governance evidence pipeline](governance-evidence-pipeline-architecture.md)
- Is **tiered** — maturity is recognized in stages; absolutism is rejected
- Is **revocable** — certification at any tier can be downgraded when evidence degrades
- Is **non-coercive** — certification is an institutional steward's instrument, not a competitive ranking
- Is **procurement-defensible** — every certification can be presented to an external auditor, regulator, or institutional buyer

Certification that cannot be defended externally is not certification.

---

## 2. Certification Classes

A Nzila system can be certified across the following classes. Classes are independent; a system can be certified in some and not others.

### 2.1 Doctrine-Compliant System
The system expresses doctrine as specified in [../nzila-governance/doctrine-to-product-mapping.md](../nzila-governance/doctrine-to-product-mapping.md). Surfaces, signals, authority framing, aggregation stance, and vocabulary all align.

### 2.2 Governance-Safe Deployment
Deployments operate under [../nzila-governance/continuity-safe-deployment-governance.md](../nzila-governance/continuity-safe-deployment-governance.md): release manifest, sequencing, pacing, reversibility, environment isolation, stakeholder visibility.

### 2.3 Continuity-Safe Modernization
Modernization initiatives are paced to absorption capacity, sequenced for continuity preservation, and reversible at every step (per [../nzila-ip/institutional-modernization-methodology.md](../nzila-ip/institutional-modernization-methodology.md)).

### 2.4 Operational Legitimacy Readiness
The system meets the legitimacy validation defined in [operational-legitimacy-assurance-system.md](operational-legitimacy-assurance-system.md): pilot realism, deployment realism, organizational trust pacing.

### 2.5 Governance-Safe Intelligence
AI capability satisfies [governance-safe-ai-assurance-model.md](governance-safe-ai-assurance-model.md): explainability, human authority, anti-surveillance, reviewability.

### 2.6 Continuity-Safe UX
Surfaces meet calmness, density, hierarchy, and restraint standards from [../nzila-governance/institutional-design-governance.md](../nzila-governance/institutional-design-governance.md).

### 2.7 Executive Cognitive Governance
Executive surfaces meet the measurable thresholds in [executive-cognitive-safety-assurance.md](executive-cognitive-safety-assurance.md).

### 2.8 Pilot-Safe Operational Posture
Pilot scope is structurally enforced (per [../nzila-governance/executable-doctrine-enforcement.md](../nzila-governance/executable-doctrine-enforcement.md)): no scope drift, no production contamination, no demo coupling.

---

## 3. Certification Tiers

Each class is held at one of six tiers. Tier reflects maturity of evidence and discipline, not aspiration.

| Tier | Name | Meaning |
|------|------|---------|
| C0 | Unverified | No evidence registered against the class |
| C1 | Basic governance alignment | Doctrine acknowledged; manual review evidence; no automation |
| C2 | Operationally governed | Review procedures applied; partial automated evidence; named owners |
| C3 | Continuously attestable | Evidence generated automatically from CI, deployment, and runtime; reviewable on demand |
| C4 | Institutionally certifiable | Evidence is signed, retained, and audit-ready; external review feasible |
| C5 | Governance-reference-grade | Sustained C4 over multiple cycles; suitable as an external standard reference |

Tier movement is **always evidence-led**. A system does not advance because of intention; it advances because evidence sustains the higher tier.

---

## 4. Certification Dimensions

Within a class, certification at any tier is assessed across the following dimensions. Each dimension produces a finding: *Met*, *Partially Met*, *Not Met*.

### 4.1 Continuity Preservation
Does the system preserve institutional continuity through change? Are continuity surfaces, signals, and posture readings honored?

### 4.2 Governance Legitimacy
Are governance acts human-authoritative, reviewable, and consequence-bearing? Is automation kept assistive?

### 4.3 Operational Calmness
Do surfaces and operational rhythms respect calmness floors and pacing standards?

### 4.4 Explainability
Are AI, analytic, and recommendation outputs explainable in governance forums?

### 4.5 Anti-Surveillance Compliance
Does the system avoid individual behavioral resolution, covert escalation, and productivity scoring at every layer?

### 4.6 Deployment Legitimacy
Are releases manifest-governed, paced, reversible, and stakeholder-visible?

### 4.7 Human Oversight Preservation
Are consequential decisions identified to human authorities with credible override paths?

### 4.8 Institutional Trust Safety
Does the system preserve trust across affected stakeholder populations?

A class is held at a tier only when the dimensional findings, taken together, sustain that tier's evidence threshold.

---

## 5. Tier Evidence Thresholds

| Tier | Evidence Threshold |
|------|--------------------|
| C0 | None |
| C1 | Manual review records present; doctrine cited; named owner |
| C2 | Review procedures applied at change time; partial CI/E2E evidence; named owners; remediation tracked |
| C3 | Continuous evidence from CI, deployment, runtime; on-demand reviewability; gap list maintained |
| C4 | Signed and retained evidence; immutable audit trail; external reviewer can verify without privileged access |
| C5 | Sustained C4 across multiple cycles; published reference materials; capable of serving as external standard |

A class certified at C3 or above without evidence retention infrastructure is downgraded automatically.

---

## 6. Certification Procedure

1. **Scope declaration** — the system, its boundary, and the classes for which certification is sought
2. **Evidence assembly** — evidence drawn from the [evidence pipeline](governance-evidence-pipeline-architecture.md), governance reviews, and assurance models
3. **Dimensional assessment** — findings recorded per dimension per class
4. **Tier determination** — tier per class, justified by evidence
5. **Reviewer attestation** — independent reviewer attests to evidence sufficiency
6. **Recording** — certification entered into the governance trail with cited evidence and tier
7. **Standing review** — certification is reviewed at cadence; tier is sustained or revised

Certification is not granted in absence of any of these steps.

---

## 7. Revocation and Downgrade

Certification is downgraded when:

- Sustained evidence degradation moves a dimension below the tier threshold
- A doctrine violation is detected in the certified system
- An incident reveals an enforcement gap inconsistent with the tier
- Evidence retention or signing infrastructure becomes unavailable
- A reviewer attestation cannot be sustained

Downgrade is a stewardship act, not a punitive one. It is recorded, rationalized, and paired with a remediation path.

---

## 8. Anti-Patterns

The following patterns disqualify or invalidate certification:

- **Self-attestation without independent review** — claims without reviewer evidence
- **Aspiration as evidence** — roadmap items presented in place of working evidence
- **Composite tier scoring** — collapsing class tiers into a single overall number
- **Marketing-driven certification** — pursuing tier movement for external positioning rather than for institutional standing
- **Retroactive tier inflation** — back-dating evidence
- **Certification of prohibited capabilities** — see §9
- **Class smuggling** — combining multiple classes' evidence to inflate a single class's tier

---

## 9. Categorical Non-Certifiable Capabilities

Certain capabilities are categorically ineligible for certification at any tier in any class:

- Individual behavioral scoring
- Covert escalation paths
- Autonomous execution of consequential governance acts
- Black-box recommendations without explainability surfaces
- Demo/production coupling
- Surveillance affordances dressed as analytics
- Composite continuity scoring presented as primary executive surface

Certifying any of these would itself be a doctrine violation.

---

## 10. External Posture

Certification is the institutional language Nzila offers to:

- Procurement officers (institutional buyers)
- Regulators (where doctrine adherence is relevant)
- Investors (institutional, governance-grade capital)
- Partners (requiring governance evidence)
- Auditors and certification bodies

Certifications are not used in marketing surfaces in ways that erode the institutional register. They are presented in their reviewable form: scope, dimensions, tier, evidence.

---

## 11. Discipline

Certification's authority depends entirely on the discipline of evidence and the refusal to inflate. A single inflated tier erodes the framework's standing more than years of disciplined certification can restore.

The framework's strength is patience: certifying only what can be defended, downgrading honestly, and treating tier movement as earned rather than scheduled.
