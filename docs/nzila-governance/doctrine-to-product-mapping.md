# Doctrine-to-Product Mapping

> **Status:** Canonical governance · **Layer:** Traceability · **Inherits:** All doctrine in [../nzila-ip/](../nzila-ip/)

This document is the **traceability spine** of the operational governance layer. Every major doctrine principle is mapped to its concrete expression in product behavior, UX surface, routing rule, deployment control, governance gate, and end-to-end validation.

It is the document a reviewer consults to answer: *"Where in the running system is this doctrine actually enforced?"*

If a doctrine principle has no entry here, it is not yet operationalized. If an entry has no enforcement mechanism, it is not yet enforceable. Both states are governance defects.

---

## 1. How to Read This Mapping

Each entry contains:

- **Originating doctrine** — the canonical IP file
- **Core principle** — the doctrinal statement being operationalized
- **Implementation expression** — how the principle manifests in product behavior
- **Affected products** — which Nzila products implement it
- **Affected UX surfaces** — which surfaces express it
- **Enforcement mechanism** — code review, CI policy, E2E test, design review, routing rule, deployment gate
- **Governance risk if violated** — what continuity, legitimacy, or trust harm follows from drift
- **E2E validation linkage** — the validation surface that confirms conformance

Products referenced: Union Eyes, ExecutiveOS, FairCase, Veridian, ABR, Agrimo, Cora, Trade, Mobility, Trustcore, Maestria, NACP, Weekone, Zonga, and future verticals.

---

## 2. Foundational Doctrine Mappings

### 2.1 Continuity Posture as First-Class Surface
- **Originating doctrine:** [continuity-ontology.md](../nzila-ip/continuity-ontology.md)
- **Core principle:** Continuity posture is multi-dimensional and never a single score
- **Implementation expression:** Every executive surface presents continuity posture as a multi-dimensional reading; no composite score is rendered
- **Affected products:** ExecutiveOS, Union Eyes, FairCase, Veridian
- **Affected UX surfaces:** Executive reading surface, governance review surface
- **Enforcement mechanism:** Design review checklist; component lint rule prohibiting "continuity score" components; doctrine compliance review at feature gate
- **Governance risk if violated:** Score absolutism; misread postures; reduced governance interpretive responsibility
- **E2E validation linkage:** Executive-surface E2E asserts presence of multi-dimensional posture, absence of single-score widget

### 2.2 Aggregation-Stance Discipline
- **Originating doctrine:** [continuity-signals-taxonomy.md](../nzila-ip/continuity-signals-taxonomy.md), [governance-safe-intelligence.md](../nzila-ip/governance-safe-intelligence.md)
- **Core principle:** Categorically off-limits-individually material is never surfaced at the individual level
- **Implementation expression:** Signal pipelines carry aggregation-stance metadata; surfacing layer refuses to render individual-level views of restricted classes
- **Affected products:** All
- **Affected UX surfaces:** All analytics, signal, and reading surfaces
- **Enforcement mechanism:** Type-system tagging of signal classes; runtime guard at surfacing layer; CI policy check; mandatory review on any new signal class
- **Governance risk if violated:** Surveillance, workforce trust collapse, regulatory exposure, doctrine violation
- **E2E validation linkage:** Aggregation-stance contract test in shared platform package; per-product surfacing tests

### 2.3 Human Authority Statement
- **Originating doctrine:** [governance-safe-intelligence.md](../nzila-ip/governance-safe-intelligence.md)
- **Core principle:** Final organizational judgment, governance authority, escalation approval, institutional prioritization, and continuity decisions remain human responsibilities
- **Implementation expression:** Every AI-assisted recommendation surface includes explicit human-authority framing; no auto-execution of governance acts
- **Affected products:** All AI-touched surfaces across the portfolio
- **Affected UX surfaces:** Recommendation panels, scenario surfaces, escalation surfaces
- **Enforcement mechanism:** Component contract requires authority-framing slot; design review checklist; copy review for authority-displacing language
- **Governance risk if violated:** Authority displacement, workforce alienation, governance bypass
- **E2E validation linkage:** Recommendation-surface E2E asserts authority-framing presence; copy-lint catches "auto-decided", "system-approved" patterns

### 2.4 Continuity-Safe Deployment Velocity
- **Originating doctrine:** [institutional-risk-philosophy.md](../nzila-ip/institutional-risk-philosophy.md)
- **Core principle:** Velocity is paced to institutional absorption capacity, not vendor schedule
- **Implementation expression:** Release governance includes explicit pacing rationale; concurrent-change ceilings per institution; pause authority documented
- **Affected products:** All
- **Affected UX surfaces:** N/A (operational layer)
- **Enforcement mechanism:** Release governance gate; deployment governance review (see [continuity-safe-deployment-governance.md](continuity-safe-deployment-governance.md))
- **Governance risk if violated:** Destabilization, fatigue, trust erosion
- **E2E validation linkage:** Release-readiness checklist; deployment audit log

---

## 3. Architectural Doctrine Mappings

### 3.1 Operational Calmness
- **Originating doctrine:** [role-centered-continuity-architecture.md](../nzila-ip/role-centered-continuity-architecture.md), [executive-cognitive-governance.md](../nzila-ip/executive-cognitive-governance.md)
- **Core principle:** Calmness is a designed system property, not aesthetic finish
- **Implementation expression:** Per-surface density budgets; conservative motion/color/notification defaults; stable layout
- **Affected products:** All
- **Affected UX surfaces:** All
- **Enforcement mechanism:** Design system tokens; density-budget lint; design review checklist; cognitive load review
- **Governance risk if violated:** Executive cognitive overload, legitimacy erosion
- **E2E validation linkage:** Visual regression on density; component-level audit of motion/notification usage

### 3.2 Continuity-Safe Visibility
- **Originating doctrine:** [executable-experience-governance.md](../nzila-ip/executable-experience-governance.md)
- **Core principle:** Surfaces show what is doctrinally appropriate; default posture is *less, with greater interpretive density*
- **Implementation expression:** Visibility scope is per-role and exposure-mapped; no "show-everything" toggles; rationale is surfaceable for every shown item
- **Affected products:** All
- **Affected UX surfaces:** All signal, reading, and surfacing views
- **Enforcement mechanism:** Visibility policy in shared platform package; "why am I seeing this" affordance contract; design review
- **Governance risk if violated:** Surveillance drift, role-exposure violation, urgency theater
- **E2E validation linkage:** Per-role visibility E2E suite; rationale-affordance presence test

### 3.3 Governance-Safe Intelligence at the Surface
- **Originating doctrine:** [governance-safe-intelligence.md](../nzila-ip/governance-safe-intelligence.md), [scenario-intelligence-framework.md](../nzila-ip/scenario-intelligence-framework.md)
- **Core principle:** Intelligence surfaces interpretation, never assertion; uncertainty is shown
- **Implementation expression:** Scenario and recommendation outputs carry assumption, horizon, and uncertainty metadata, rendered visibly
- **Affected products:** ExecutiveOS, Union Eyes, FairCase, Veridian (any product with interpretive outputs)
- **Affected UX surfaces:** Scenario panels, recommendation panels, reading surfaces
- **Enforcement mechanism:** Output schema requires assumption/horizon/uncertainty fields; renderer rejects outputs without them; design review
- **Governance risk if violated:** False precision, opaque AI surfacing, governance bypass
- **E2E validation linkage:** Output schema contract tests; renderer-presence tests

### 3.4 Progressive Sophistication
- **Originating doctrine:** [role-centered-continuity-architecture.md](../nzila-ip/role-centered-continuity-architecture.md)
- **Core principle:** First encounter exposes the role's center-of-gravity, not full surface area
- **Implementation expression:** Default surface per role centers on the role's primary continuity exposure; depth is opt-in
- **Affected products:** All
- **Affected UX surfaces:** Role primary views
- **Enforcement mechanism:** Role-canon registry per product; design review against the canon; cognitive load review
- **Governance risk if violated:** Module sprawl, dashboard overload, role-bearer disengagement
- **E2E validation linkage:** Role-first navigation E2E; first-encounter density audit

### 3.5 Anti-Surveillance Modernization
- **Originating doctrine:** [governance-safe-intelligence.md](../nzila-ip/governance-safe-intelligence.md), [continuity-metrics-philosophy.md](../nzila-ip/continuity-metrics-philosophy.md)
- **Core principle:** No individual behavioral scoring, no covert monitoring, no covert escalation
- **Implementation expression:** Data model rejects individual-behavioral signal classes; covert-escalation paths are not implemented; audit trail is workforce-visible where appropriate
- **Affected products:** All
- **Affected UX surfaces:** All
- **Enforcement mechanism:** Schema-level prohibitions; type-system constraints; mandatory AI governance review (see [continuity-safe-ai-governance.md](continuity-safe-ai-governance.md))
- **Governance risk if violated:** Categorical doctrine violation; commercial pathway exclusion (per IP commercialization pathways)
- **E2E validation linkage:** Schema audit; surveillance-pattern lint; aggregation contract test

### 3.6 Executive Cognitive Pacing
- **Originating doctrine:** [executive-cognitive-governance.md](../nzila-ip/executive-cognitive-governance.md)
- **Core principle:** Pace executive surfaces to governance rhythm, not data rhythm
- **Implementation expression:** No real-time feeds at executive surfaces; refresh cadence aligned with governance forums; bounded notification budgets
- **Affected products:** ExecutiveOS, Union Eyes (executive surfaces), FairCase (executive surfaces)
- **Affected UX surfaces:** Executive reading surfaces
- **Enforcement mechanism:** Cadence configuration governed by design review; notification governance policy; standards in [executive-cognitive-governance-standards.md](executive-cognitive-governance-standards.md)
- **Governance risk if violated:** Executive bandwidth erosion, legitimacy loss
- **E2E validation linkage:** Executive surface cadence audit; notification budget audit

---

## 4. Operational Doctrine Mappings

### 4.1 Pilot Discipline Enforcement
- **Originating doctrine:** [executable-experience-governance.md](../nzila-ip/executable-experience-governance.md), [operational-legitimacy-framework.md](../nzila-ip/operational-legitimacy-framework.md)
- **Core principle:** Pilot scope is structurally enforced; no silent production drift
- **Implementation expression:** Pilot-mode is a system property, not a setting; out-of-scope production usage is rejected; reversibility is structural
- **Affected products:** All
- **Affected UX surfaces:** Pilot indicators, scope surfaces
- **Enforcement mechanism:** Pilot gating in routing layer; deployment gate; pilot E2E suite
- **Governance risk if violated:** Legitimacy collapse, governance violation
- **E2E validation linkage:** Pilot-scope E2E asserts blocked production usage and visible scope

### 4.2 Continuity-Safe Rollout
- **Originating doctrine:** [institutional-modernization-methodology.md](../nzila-ip/institutional-modernization-methodology.md), [operational-legitimacy-framework.md](../nzila-ip/operational-legitimacy-framework.md)
- **Core principle:** Rollouts are sequenced, paced, reversible, and continuity-aware
- **Implementation expression:** Release governance enforces sequencing; recovery intervals between substantive changes; rollback path validated per release
- **Affected products:** All
- **Affected UX surfaces:** N/A (operational)
- **Enforcement mechanism:** Release governance gate; deployment governance (see [continuity-safe-deployment-governance.md](continuity-safe-deployment-governance.md))
- **Governance risk if violated:** Destabilization, trust loss
- **E2E validation linkage:** Release-readiness checklist; rollback drill record

### 4.3 Stakeholder Isolation
- **Originating doctrine:** [executable-experience-governance.md](../nzila-ip/executable-experience-governance.md)
- **Core principle:** Where doctrine requires isolation between stakeholder populations, the system structurally isolates them
- **Implementation expression:** Identity, routing, surfacing, audit honor isolation; cross-isolation visibility is governed
- **Affected products:** Union Eyes (representative vs. administered), FairCase (matter parties), Veridian (clinical vs. workforce)
- **Affected UX surfaces:** All role surfaces
- **Enforcement mechanism:** Identity/authorization layer; routing policy; cross-isolation contract tests
- **Governance risk if violated:** Legitimacy collapse, regulatory exposure
- **E2E validation linkage:** Cross-isolation E2E suite per product

### 4.4 Memory Governance Bindings
- **Originating doctrine:** [institutional-memory-governance.md](../nzila-ip/institutional-memory-governance.md)
- **Core principle:** Retention serves continuity purpose; portability is structural; aggregation stance is honored
- **Implementation expression:** Per-data-class retention horizons; export/portability surfaces; access logging
- **Affected products:** All
- **Affected UX surfaces:** Memory surfaces, export surfaces, governance review surfaces
- **Enforcement mechanism:** Schema-level retention policy; portability contract; access audit
- **Governance risk if violated:** Memory loss, vendor lock-in, surveillance creep
- **E2E validation linkage:** Retention policy audit; portability E2E

---

## 5. Strategic Doctrine Mappings

### 5.1 Doctrine/Implementation Boundary Preservation
- **Originating doctrine:** [doctrine-vs-implementation-boundary.md](../nzila-ip/doctrine-vs-implementation-boundary.md)
- **Core principle:** Doctrine survives stack changes; products do not redefine doctrine
- **Implementation expression:** Doctrinal vocabulary used for naming where concepts are doctrinal; product-specific names insulated
- **Affected products:** All
- **Affected UX surfaces:** All
- **Enforcement mechanism:** Naming review at architecture review; doctrine compliance review on new modules
- **Governance risk if violated:** IP erosion, drift, loss of cross-product portability
- **E2E validation linkage:** Periodic terminology audit (per drift-governance cadence)

### 5.2 Cross-Product Doctrine Inheritance
- **Originating doctrine:** [cross-vertical-doctrine-mapping.md](../nzila-ip/cross-vertical-doctrine-mapping.md)
- **Core principle:** Invariant doctrine is identical across verticals; adaptable layers express vertical context
- **Implementation expression:** Shared platform packages encode invariants; vertical packages express adaptations
- **Affected products:** All
- **Affected UX surfaces:** N/A (architecture-level)
- **Enforcement mechanism:** Architectural doctrine review (see [architectural-doctrine-review-system.md](architectural-doctrine-review-system.md)); cross-product alignment check
- **Governance risk if violated:** Vertical doctrinal drift, loss of portability
- **E2E validation linkage:** Cross-product contract tests

### 5.3 Narrative Coherence
- **Originating doctrine:** [category-creation-strategy.md](../nzila-ip/category-creation-strategy.md), [competitive-paradigm-analysis.md](../nzila-ip/competitive-paradigm-analysis.md)
- **Core principle:** External narrative leads with doctrine and category; products are framed as expressions
- **Implementation expression:** Approved positioning vocabulary; prohibited positioning vocabulary; category framing in all external assets
- **Affected products:** All external surfaces (web, decks, RFP responses, releases)
- **Affected UX surfaces:** Marketing surfaces (governed under narrative alignment)
- **Enforcement mechanism:** [investor-and-procurement-narrative-alignment.md](investor-and-procurement-narrative-alignment.md); copy review
- **Governance risk if violated:** Category dilution, drift toward AI-startup framing
- **E2E validation linkage:** Periodic narrative audit

---

## 6. Coverage Summary

| Doctrine Layer | Mapped | Enforcement Mechanism Established | E2E Linked |
|---------------|--------|-----------------------------------|------------|
| Foundational | ✅ | ✅ | ✅ |
| Architectural | ✅ | ✅ | ✅ |
| Operational | ✅ | ✅ | ✅ |
| Governance | ✅ | ✅ | partial — see readiness review |
| Field/Strategic | ✅ | ✅ | partial — narrative audits are periodic |

Gaps and partial coverage are tracked in [doctrine-operationalization-readiness-review.md](doctrine-operationalization-readiness-review.md).

---

## 7. Discipline of This Document

This mapping is **load-bearing**. It must be:

- Updated whenever a new doctrine principle requires expression
- Updated whenever a product gains, loses, or changes a surface that touches doctrine
- Reviewed at every doctrine compliance review
- Treated as the authoritative answer to "is this doctrine actually enforced?"

Stale entries are governance defects.
