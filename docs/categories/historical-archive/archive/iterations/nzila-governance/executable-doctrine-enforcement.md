# Executable Doctrine Enforcement

> **Status:** Canonical governance · **Layer:** Code, CI, deployment, routing enforcement · **Inherits:** [doctrine-to-product-mapping.md](doctrine-to-product-mapping.md), [doctrine-compliance-review-framework.md](doctrine-compliance-review-framework.md)

This document specifies how Nzila doctrine becomes **executable governance** — enforced not by memory, intention, or review alone, but by code review, continuous integration, end-to-end validation, routing policy, feature gating, deployment governance, and release validation.

The premise is simple: **a doctrine principle that depends solely on intention will drift.** Each principle that can be enforced mechanically must be enforced mechanically.

---

## 1. Layers of Enforcement

Doctrine is enforced across the following layers, each with progressively wider blast radius:

1. **Code review** — pull-request-level governance against doctrine principles
2. **Static checks** — lint, type-system, schema policy
3. **Continuous integration** — automated policy gates that block merges
4. **End-to-end validation** — runtime assertions of doctrine-conformant behavior
5. **Routing and visibility** — production-time enforcement of doctrine-shaped exposure
6. **Feature gating** — controlled exposure of doctrine-touching capability
7. **Deployment governance** — release-time enforcement of pacing, scoping, reversibility
8. **Post-release validation** — production observation against doctrine-aligned signals

A doctrine principle should be enforced at the earliest layer that can detect its violation.

---

## 2. Mapping Doctrine to E2E Assertions

The following doctrine-to-E2E mappings are mandatory. Each E2E suite asserts a doctrinal property; absence of an assertion is an enforcement defect.

| Doctrine Principle | E2E Assertion |
|--------------------|---------------|
| Multi-dimensional continuity posture | Executive surface E2E asserts presence of multi-dimensional posture; asserts absence of composite-score widget |
| Aggregation stance | Per-product surfacing E2E asserts restricted classes never resolve to individual rendering |
| Human authority framing | Recommendation surface E2E asserts authority framing slot is rendered with non-empty content |
| Continuity-safe visibility | Per-role visibility E2E asserts only role-appropriate scopes resolve |
| Rationale availability | Surfacing E2E asserts "why am I seeing this" affordance is reachable for every shown signal |
| Pilot scope discipline | Pilot E2E asserts out-of-scope production access is blocked and visibly indicated |
| Cross-isolation | Per-product cross-isolation E2E asserts identities cannot traverse stakeholder isolation boundaries |
| Output explainability | Recommendation/scenario E2E asserts assumption, horizon, and uncertainty fields render |
| Notification governance | Notification suite asserts arrival rates remain within doctrinal ceilings under representative load |
| Density budget | Visual regression / density audit asserts budget compliance per surface class |

E2E suites with these assertions are first-class governance artifacts. Their failure blocks release.

---

## 3. Policy Checks

The following policy checks operate at CI:

- **Surveillance-pattern lint** — flags signal classes, schema fields, and renderer outputs matching surveillance-pattern signatures (per-individual behavioral scoring, covert monitoring, covert escalation)
- **Composite-score lint** — flags components or schema outputs that collapse multi-dimensional posture into a single score
- **Authority-framing lint** — flags recommendation surfaces missing authority framing
- **Density-budget lint** — flags surfaces exceeding budget for surface class
- **Aggregation-stance type check** — ensures restricted signal classes carry the type-system tag and resolve only through aggregation-respecting code paths
- **Doctrinal vocabulary lint** — flags introduction of off-doctrine vocabulary (e.g., "score", "ranking", "productivity index") without a doctrine compliance review record
- **Orchestration-exposure lint** — flags UX surfacing of pipeline, agent, chain, or model concepts
- **Pilot-scope check** — ensures pilot-mode features carry pilot gating and do not register production routes outside scope

CI policy failures are **blocking**, not advisory.

---

## 4. Role Isolation Enforcement

Role isolation is enforced at three layers:

1. **Identity layer** — role and stakeholder population are first-class identity attributes
2. **Routing layer** — routes are gated on role and stakeholder population; cross-isolation traversal is rejected, not redirected
3. **Surfacing layer** — components refuse to render data outside the requestor's role/population scope

Cross-isolation contract tests live in shared platform packages and run for every product that consumes them.

---

## 5. Pilot Gating

Pilot mode is **structural**, not configurational:

- Pilot scope is encoded as a first-class property of the running system
- Pilot routes do not register production handlers
- Pilot data does not flow into production analytic surfaces
- Pilot scope is visibly indicated on all in-scope surfaces
- Pilot exit is a governed release event, not a configuration change

Pilot scope drift is a categorical doctrine violation.

---

## 6. Visibility Enforcement

Visibility is enforced by a shared visibility policy that:

- Resolves each candidate signal against role, stakeholder population, aggregation stance, exposure map, and rationale availability
- Refuses to surface a signal that fails any check
- Records refusal for governance audit
- Provides the surfacing layer with a stable, reviewable visibility decision

There is no global "show everything" override. Privileged visibility is itself a doctrine-reviewed surface.

---

## 7. Feature Exposure

New features are exposed only after:

1. Doctrine compliance review verdict of PASS or CONDITIONAL PASS (with remediations merged)
2. Required E2E assertions present and passing
3. CI policy checks passing
4. Required visibility policy registered
5. Pilot or staged rollout plan approved by deployment governance (where applicable)

Exposure outside this sequence is a release governance defect.

---

## 8. Route Enforcement

Route registration follows doctrinal constraints:

- Routes carry role and stakeholder population requirements
- Routes carry pilot-scope and feature-exposure requirements
- Public routes carry explicit aggregation stance
- Cross-product routes traverse only via shared platform contracts
- Edge-routed surfaces honor density and notification governance

A route registered without doctrinal metadata is rejected.

---

## 9. Anti-Patterns This Layer Prevents

- **Raw orchestration exposure** — surfacing pipelines, agents, model chains as user-facing concepts
- **Governance-breaking UX** — surfaces that bypass authority framing, rationale, or visibility policy
- **Executive overload** — surfaces that violate density budget or notification ceilings on executive views
- **Pilot-scope drift** — pilot capability appearing in production surfaces, analytics, or workflows
- **Surveillance-like analytics** — analytics surfaces that resolve to individual behavioral signals
- **Composite scoring** — collapse of multi-dimensional posture into single rankable numbers
- **Cross-isolation leakage** — stakeholder population data crossing isolation boundaries
- **Silent capability emergence** — features appearing in production without a registered review verdict

---

## 10. Operating Posture

Enforcement is not adversarial. It is the institutional discipline that lets the team move with confidence and lets external stakeholders trust the result.

A change that passes enforcement is **defensible**: in front of a regulator, a customer, an investor, a workforce. That defensibility is the product of every layer in this document.

The cost of enforcement is paid once, in design and discipline. The cost of *not* enforcing is paid repeatedly, in drift, incident, and trust.

---

## 11. Discipline of This Layer

Enforcement quality is reviewed at the [doctrine governance scorecard](doctrine-governance-scorecard.md) and at the [doctrine operationalization readiness review](doctrine-operationalization-readiness-review.md).

Layers that fall behind doctrine — for example, a new doctrine principle without a corresponding enforcement mechanism — are tracked as enforcement debt. Enforcement debt is governance debt.
