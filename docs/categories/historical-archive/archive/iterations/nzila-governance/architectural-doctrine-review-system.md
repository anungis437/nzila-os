# Architectural Doctrine Review System

> **Status:** Canonical governance · **Layer:** Architecture review · **Inherits:** [doctrine-vs-implementation-boundary.md](../nzila-ip/doctrine-vs-implementation-boundary.md), [cross-vertical-doctrine-mapping.md](../nzila-ip/cross-vertical-doctrine-mapping.md), [institutional-modernization-methodology.md](../nzila-ip/institutional-modernization-methodology.md)

This document specifies the **architecture review system** by which platform, product, and infrastructural design decisions are evaluated against doctrine.

It is the review tier above the [doctrine compliance review framework](doctrine-compliance-review-framework.md): where compliance review evaluates *features and surfaces*, architectural review evaluates *systems, structures, and modernization decisions*.

---

## 1. Scope

Architectural doctrine review is **mandatory** for:

- New platform package, shared module, or cross-product abstraction
- Material change to identity, authorization, routing, surfacing, or visibility layers
- Material change to data model retention, portability, or aggregation handling
- Introduction of a new vertical or product
- Introduction of a new AI subsystem or significant change to AI architecture
- Introduction of a new deployment posture, environment topology, or rollout pattern
- Modernization initiatives crossing more than one product
- Architectural deviations proposed during compliance review (escalation path)

---

## 2. Review Inputs

A reviewable architecture submission must provide:

1. Architectural intent — what the change is, in architectural terms
2. Doctrinal claim — which doctrine principles motivate, constrain, or are altered by the change
3. Cross-product impact — invariants and adaptations affected
4. Continuity exposure — institutional continuity surfaces touched
5. Stakeholder cognition impact — what role-bearer or executive cognition the change reshapes
6. Modernization sequencing — where this fits in the modernization roadmap and how pacing is preserved
7. Deployment posture — environment, rollout, reversibility, isolation
8. Failure modes — what failure looks like in continuity, governance, and trust terms

---

## 3. Review Dimensions

### 3.1 Continuity Preservation
Does the architecture preserve continuity surfaces, postures, and signal taxonomies? Does it avoid coupling continuity to vendor- or stack-specific structure?

### 3.2 Governance-Safe Modernization
Does the architecture advance modernization without bypassing governance? Are governance acts still expressible, reviewable, and human-authoritative?

### 3.3 Operational Legitimacy
Does the architecture preserve the legitimacy of role-bearers, governance forums, and stakeholder populations? Does it avoid concentrating consequential authority into automated paths?

### 3.4 Deployment Safety
Is the architecture deployable in continuity-safe sequences? Is it reversible? Does it support pacing, isolation, and pilot discipline?

### 3.5 Doctrine Alignment
Does the architecture express the [doctrine/implementation boundary](../nzila-ip/doctrine-vs-implementation-boundary.md) cleanly: doctrine in shared platform packages, adaptation in vertical packages, no doctrine drift inside product code?

### 3.6 Continuity Risk
What is the worst plausible continuity outcome from a failure of this architecture? Is the blast radius contained? Are recovery paths legitimate?

### 3.7 Stakeholder Cognition Impact
How does the architecture reshape what role-bearers, executives, and external stakeholders perceive? Is the perceptual change continuity-safe?

### 3.8 Institutional Trust Impact
Does the architecture strengthen or weaken trust across stakeholder populations? Does it preserve workforce trust, governance trust, regulator confidence, and partner trust?

### 3.9 Cross-Product Portability
Does the architecture preserve the portability of doctrine across verticals? Does it avoid encoding vertical assumptions into shared layers?

### 3.10 Aggregation and Surveillance Posture
Does the architecture preserve aggregation stance at the data-model and surfacing layers? Does it close, not open, surveillance affordances?

---

## 4. Verdicts

Architectural review verdicts are:

- **PASS** — architecture is doctrine-aligned and may proceed
- **CONDITIONAL PASS** — architecture is aligned with stated remediations
- **DEFER** — architecture is not yet reviewable; missing inputs, missing doctrinal grounding, or insufficient cross-product analysis
- **DOCTRINE VIOLATION** — architecture proposes a structural departure from doctrine; blocked
- **DOCTRINE-CHANGE REQUEST** — architecture would require a doctrine change; routed to the doctrine governance forum (see [doctrine-drift-governance.md](../nzila-ip/doctrine-drift-governance.md))

---

## 5. Reviewer Composition

An architectural review requires at minimum:

- One reviewer with platform-architecture standing
- One reviewer with cross-product responsibility
- One reviewer independent of the originating product

Where the change touches AI, deployment, or executive cognition, an additional reviewer from the relevant domain governance is required.

---

## 6. Architectural Anti-Patterns

The following architectural patterns are categorically off-doctrine:

- **Doctrine inside product code** — encoding doctrinal invariants in product packages rather than platform packages
- **Vertical leakage into platform** — platform packages encoding vertical-specific assumptions
- **Hidden surveillance affordances** — data models or pipelines that quietly enable individual behavioral resolution
- **Authority displacement structures** — architectures that route consequential decisions through automation without human authority surfaces
- **Unbounded blast-radius designs** — architectures whose failure modes cross stakeholder isolation boundaries
- **Demo/production coupling** — architectures that make demo and production share structural fate
- **Governance bypass** — architectures that allow capability to reach production without traversing governance
- **Continuity coupling to vendor stack** — architectures that make doctrine survival dependent on a particular stack

---

## 7. Modernization Sequencing Review

Architectural review is the gate at which modernization sequencing is evaluated:

- Is the sequence continuity-safe?
- Does it respect institutional absorption capacity?
- Is concurrent change kept within doctrinal ceilings?
- Are reversibility and recovery paths credible at every step?
- Does each step earn the right to the next, or are steps merely scheduled?

Sequences that schedule rather than earn are deferred or revised.

---

## 8. Cross-Product Alignment

Architectural review verifies:

- Invariants from [cross-vertical-doctrine-mapping.md](../nzila-ip/cross-vertical-doctrine-mapping.md) are honored across products
- Adaptable layers express vertical context without redefining doctrine
- Shared platform contracts evolve coherently across products
- Doctrinal vocabulary is consistent

A change that improves one product at the cost of cross-product coherence is reviewed accordingly.

---

## 9. Discipline of This Layer

Architectural review is the layer at which doctrine survives stack changes, vendor changes, and team changes. It is the layer that makes Nzila portable across decades, not just across releases.

Its discipline is patience: refusing convenient structural choices that would, over time, erode doctrine's capacity to govern.
