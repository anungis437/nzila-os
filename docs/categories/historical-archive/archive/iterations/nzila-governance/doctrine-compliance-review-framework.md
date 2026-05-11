# Doctrine Compliance Review Framework

> **Status:** Canonical governance · **Layer:** Review methodology · **Inherits:** [doctrine-to-product-mapping.md](doctrine-to-product-mapping.md), all IP doctrine

This document defines the **standardized review methodology** by which any new feature, AI integration, dashboard, workflow, analytics surface, governance tool, routing change, deployment, or modernization initiative is evaluated against the Nzila doctrine corpus.

It exists so that doctrine adherence is **procedural, repeatable, and reviewable** — not a matter of memory or taste.

---

## 1. Scope of Application

A doctrine compliance review is **mandatory** for:

- New feature introduction (any product)
- New AI integration or material change to existing AI behavior
- New dashboard, signal, or analytics surface
- New executive or governance surface
- New workflow that touches role-bearer responsibility
- New routing or visibility rule
- New deployment posture, environment, or rollout pattern
- Any modernization initiative spanning more than one release
- Any change to data retention, access, portability, or audit
- Any change with cross-product implications

A review is **recommended** (lightweight form) for:

- Visual or copy refinements on doctrine-touching surfaces
- Configuration changes affecting visibility, cadence, or notification

A review is **not required** for:

- Internal-only refactors with no behavioral change
- Test scaffolding, dependency hygiene, infrastructure plumbing without surface impact

When in doubt, review.

---

## 2. Review Inputs

A reviewable submission must provide:

1. Description of the change in product terms
2. Doctrinal claim — which doctrine principle(s) the change expresses, preserves, extends, or constrains
3. Surface impact — which UX, signal, governance, deployment, or AI surfaces are touched
4. Stakeholder impact — which role-bearers, populations, or governance forums are affected
5. Reversibility statement — how the change can be paused, rolled back, or scoped down
6. Pacing and rollout statement — how the change respects continuity-safe deployment

Submissions missing any of the above are returned without review.

---

## 3. Review Dimensions

Every review evaluates the change across the following **ten dimensions**. Each dimension produces a finding: *Aligned*, *Conditional*, *Concern*, or *Violation*.

### 3.1 Continuity Impact
Does the change preserve, strengthen, or weaken institutional continuity? Does it respect continuity posture as multi-dimensional? Does it avoid composite-score reductionism?

### 3.2 Governance Legitimacy
Does the change preserve human authority? Does it avoid displacing governance acts to automation? Does it remain explainable and reviewable in governance forums?

### 3.3 Operational Trust
Does the change preserve role-bearer trust? Does it avoid framing that delegitimizes existing operating practice?

### 3.4 Destabilization Risk
Does the change avoid destabilizing the institution's operating equilibrium? Does it respect institutional absorption capacity?

### 3.5 Surveillance Risk
Does the change avoid individual behavioral scoring, covert monitoring, covert escalation, or coercive analytics? Does it honor aggregation stance?

### 3.6 Executive Cognitive Burden
Does the change respect density budgets, refresh cadence, notification budgets, and the calmness contract on executive surfaces?

### 3.7 Pacing
Is the change paced to governance and absorption rhythm? Is concurrent change kept within doctrinal ceilings?

### 3.8 Stakeholder Trust
Does the change strengthen — or at minimum not degrade — trust across affected stakeholder populations (workforce, executive, governance, regulator, public, partner)?

### 3.9 Explainability
Are AI, analytic, and recommendation outputs explainable, with assumptions, horizons, and uncertainty visible? Are surfacing rationales available to the user?

### 3.10 Modernization Safety
Does the change advance modernization in a continuity-safe sequence? Does it avoid demo/production coupling, governance bypass, invisible operational change, and pilot contamination?

---

## 4. Output Verdicts

A review produces exactly one verdict for the submission as a whole.

### 4.1 PASS
All ten dimensions are *Aligned*. The change is doctrine-aligned and may proceed under normal release governance.

### 4.2 CONDITIONAL PASS
Up to two dimensions are *Conditional* with stated remediations. The change may proceed when remediations are merged and re-confirmed by the original reviewer.

Permitted conditions include: minor copy adjustments, density adjustments, additional rationale affordances, additional E2E coverage, narrowed initial rollout scope.

Not permitted as conditions: structural rework of authority displacement, surveillance posture, or governance bypass — those are violations.

### 4.3 DOCTRINE VIOLATION
One or more dimensions show a *Violation*. The change is **blocked**. It may not proceed in any form short of a substantive redesign and a new review.

Examples that are categorical violations:

- Individual behavioral scoring of any workforce or stakeholder population
- Covert escalation paths
- Auto-execution of governance acts
- Removal of human authority framing from a recommendation surface
- Demo/production coupling
- Pilot scope drift into production without governance approval
- Composite "continuity score" widget on an executive surface

### 4.4 HIGH GOVERNANCE RISK
Multiple *Concern* findings or significant ambiguity in stakeholder, regulatory, or legitimacy impact. The change is **paused** and escalated to architectural doctrine review (see [architectural-doctrine-review-system.md](architectural-doctrine-review-system.md)) and, where appropriate, executive governance.

---

## 5. Review Procedure

1. **Submission** — initiator files the review with the inputs in §2.
2. **Routing** — review is routed by surface domain: UX surfaces → design governance; AI surfaces → AI governance; deployment → deployment governance; cross-cutting → architectural review.
3. **Independent reading** — at least one reviewer who is not the initiator reads against the ten dimensions.
4. **Finding production** — reviewer records dimension findings and a single verdict.
5. **Remediation cycle** (CONDITIONAL only) — initiator merges remediations; reviewer re-confirms.
6. **Recording** — verdict, findings, and rationale are recorded in the change's governance trail.
7. **Linkage** — verdict is linked to the deployment gate and, where appropriate, to the doctrine governance scorecard for trend tracking.

A review is not complete until step 6.

---

## 6. Reviewer Standards

Reviewers must:

- Read the affected doctrine before reviewing
- Treat the doctrine corpus as authoritative
- Apply dimensions consistently across products
- Refuse social pressure to weaken findings
- Distinguish *Concern* (signal worth surfacing) from *Violation* (categorical block)
- Resist the temptation to rationalize convenient exceptions

Reviewers may not review their own initiated submissions.

---

## 7. Escalation

Escalation is required when:

- A submission proposes deviation from doctrine "for this case"
- A submission would establish a precedent affecting multiple products
- A submission contests an existing doctrine principle (which is a doctrine-change request, not a feature review — see [doctrine-drift-governance.md](../nzila-ip/doctrine-drift-governance.md))
- A reviewer and initiator cannot converge after one remediation cycle

Escalations route to architectural doctrine review and, for doctrine-change requests, to the doctrine governance forum.

---

## 8. Anti-Patterns This Framework Prevents

- *"It's just a small dashboard"* — every dashboard touches density, calmness, and visibility doctrine
- *"The model is opaque, but it works"* — explainability is non-negotiable on governance-touching surfaces
- *"We'll harden it later"* — pilot discipline and surveillance posture are not deferrable
- *"The customer asked for it"* — customer requests do not override doctrine; they may, however, motivate a doctrine-change proposal
- *"Just this product, not the others"* — invariants are invariants; per-product exceptions break cross-product portability

---

## 9. Discipline of This Framework

The framework's authority depends on consistency. A single waived violation, a single skipped review, a single retroactive blessing erodes the framework's standing.

Doctrine governance is a long game. Procedural discipline is its foundation.
