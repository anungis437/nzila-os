# Governance-Safe AI Runtime Validation

> **Status:** Canonical runtime governance · **Layer:** AI runtime validation · **Inherits:** [../nzila-assurance/governance-safe-ai-assurance-model.md](../nzila-assurance/governance-safe-ai-assurance-model.md), [../nzila-governance/continuity-safe-ai-governance.md](../nzila-governance/continuity-safe-ai-governance.md)

The **governance-safe AI runtime validation** layer continuously validates that every AI invocation, exposure, and recommendation surface honors governance-safe AI doctrine — at runtime, on every call, not retrospectively.

---

## 1. Posture

The layer:

- **Validates** governance-safe AI constraints on each invocation
- **Refuses** invocations that breach categorical prohibitions
- **Emits** governance events for every breach detected
- **Preserves** human authority — AI never forecloses a governance act
- **Honors** anti-surveillance — AI invocations never resolve individuals coercively
- **Cites** doctrine for every refusal

Runtime validation is not a sampling exercise. It runs on the invocation path.

---

## 2. Required Validations

Per call:

- **Explainability availability** — explanation surface is present and reachable for the invocation's output
- **Reviewability** — output is reviewable in a governance forum on demand
- **Human approval preservation** — outputs do not auto-execute governance acts
- **Anti-surveillance compliance** — invocation neither produces nor consumes individual behavioral resolution
- **Escalation transparency** — when AI suggests escalation, the path is named and human-authoritative
- **Recommendation interpretability** — recommendations are interpretable, not opaque
- **Continuity-safe recommendation exposure** — recommendations honor pacing and stakeholder isolation

---

## 3. Required Event Types

Emitted (typed in [packages/governance-telemetry](../../packages/governance-telemetry)):

- `ai_explainability_failure` — invocation produced output without reachable explanation surface
- `governance_safe_ai_warning` — non-fatal governance friction detected
- `human_oversight_violation` — output bypassed human approval where required
- `opaque_recommendation_detected` — recommendation lacked interpretability binding

Each event carries: invocation id (aggregation-safe), capability id, surface, doctrine citation, severity.

---

## 4. Categorical Prohibitions (refused at the boundary)

Per [governance-safe AI assurance model](../nzila-assurance/governance-safe-ai-assurance-model.md), runtime refuses, by validation, any invocation that would produce:

- Black-box scoring of humans
- Opaque recommendations affecting governance
- Coercive analytics
- Autonomous governance authority
- Behavioral manipulation
- Individual behavioral resolution
- Covert escalation
- Surveillance scoring
- Undisclosed generation

Refusal is not advisory. The invocation does not proceed.

---

## 5. Validation Surfaces

| Surface | Validation Concern |
|---------|--------------------|
| Pre-invocation gate | Capability registration, doctrine citation, prohibition screen |
| Invocation execution | Operational restraint, anti-surveillance compliance |
| Post-invocation surface | Explainability presence, reviewability binding |
| Recommendation rendering | Interpretability, pacing, isolation |
| Auto-action gates | Human authority preservation |

---

## 6. Capability Registration

AI capabilities are registered in a capability registry (in [packages/doctrine-enforcement](../../packages/doctrine-enforcement)). Each registration carries:

- Capability id
- Surface(s) it serves
- Required explainability binding
- Required reviewability surface
- Required human authority gates
- Doctrine citations
- Governance review record id

Unregistered capabilities cannot be invoked through the validated path.

---

## 7. Explainability Binding

Every output must be paired with an explanation surface. Validation enforces:

- Surface reachability
- Surface non-degenerate (not just "the model said so")
- Surface honors anti-surveillance
- Surface is governance-readable (not jargon-only)

Outputs without bound explanations do not propagate to user-visible surfaces.

---

## 8. Human Authority Preservation

Where AI output bears on a governance-bearing act:

- The act is held for human authority
- The hold is recorded as a governance event
- AI's role is recorded as advisory, not authoritative
- Override of an AI recommendation is a first-class governance act, recorded with reasoning

---

## 9. Anti-Patterns

- "AI-augmented decisions" that auto-execute
- Explainability as decorative tooltip
- Recommendation surfaces that imply coercive scoring
- Capabilities invoked outside the registered path
- Sampled validation ("we'll spot-check 5%")
- Per-individual AI-driven surfaces
- Marketing extraction of AI confidence levels
- Cross-environment AI capability bleed

---

## 10. Discipline

Runtime AI validation is the institutional discipline of saying *every AI invocation will be governance-safe, every time, by construction.* It is the difference between an AI surface that is governed and one that merely claims to be.

In Nzila, the governed surface is the only surface that ships.
