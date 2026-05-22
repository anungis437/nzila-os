# OCI Question Architecture

**Status:** Canonical · OCRA v3 · Bank version 3
**Companion to:** `OCI_MODALITY_DOCTRINE.md`
**Scope:** Defines the intelligence-aware structure every OCRA question must satisfy.

---

## 1. Purpose

The question architecture exists so that every question OCRA asks contributes deliberately to:

- A named dimension
- A named section
- A named modality role
- A named intelligence contribution
- A named longitudinal value
- A named archetype contribution (when applicable)

Questions that cannot articulate this set of contributions do not belong in the bank.

---

## 2. Required Fields

Every scored question carries the existing structural fields (`id`, `section`, `order`, `prompt`, `weights`, `type`, options/scale) plus the **intelligence metadata** defined below.

### Intelligence metadata (`QuestionIntelligenceMetadata`)

| Field                            | Required | Meaning                                                                                                  |
| -------------------------------- | -------- | -------------------------------------------------------------------------------------------------------- |
| `modalityRole`                   | yes      | Why this question uses its modality. See §3.                                                             |
| `intelligenceContribution`       | yes      | What kind of institutional intelligence this question contributes. See §4.                               |
| `longitudinalValue`              | yes      | Whether and how this question contributes to longitudinal/Product-5 trajectory analysis. See §5.         |
| `stabilizationRelevance`         | yes      | Relevance to runtime stabilization (Product 4 / governance reliability). See §6.                         |
| `runtimeRelevance`               | yes      | Relevance to runtime continuity execution (incident, replay, fail-closed). See §7.                       |
| `intelligenceNetworkRelevance`   | yes      | Relevance to Product 5 intelligence network aggregation.                                                 |
| `confidenceSensitivity`          | yes      | Whether the question is sensitive to confidence shifts over time.                                        |
| `governanceSensitivity`          | yes      | Whether the answer is governance-sensitive (e.g. relates to oversight, authority).                       |
| `archetypeContribution`          | optional | If present, names the archetypes this question contributes evidence to.                                  |

These fields are read-only metadata. They do not influence scoring numerics directly; they govern interpretation, longitudinal aggregation, and reporting.

---

## 3. Modality Role

A modality role is the *reason* a question uses its modality. Allowed values:

- `maturity_ladder` — measures position on the continuity maturity progression
- `confidence_sensing` — measures perceived continuity confidence
- `ambiguity_sensing` — measures perceived institutional ambiguity
- `structural_pattern` — surfaces structural continuity topology
- `inheritance_pattern` — surfaces how continuity is transferred
- `topology_pattern` — surfaces governance/operational topology

Modality role must be consistent with question type:

- `maturity_select` → `maturity_ladder` only
- `likert_5` → `confidence_sensing` or `ambiguity_sensing`
- `multiple_choice` → `structural_pattern`, `inheritance_pattern`, or `topology_pattern`

---

## 4. Intelligence Contribution

Each question declares what it contributes to institutional intelligence:

- `continuity_maturity`
- `governance_sophistication`
- `survivability_perception`
- `operational_clarity`
- `reconstruction_confidence`
- `onboarding_confidence`
- `modernization_continuity`
- `structural_topology`
- `inheritance_topology`
- `stewardship_distribution`
- `recoverability_confidence`

A question may not declare more than two contributions. Over-declared questions are rejected by `questionMetadataIntegrity.test.ts`.

---

## 5. Longitudinal Value

Longitudinal value declares whether the question should be tracked across time windows for trend interpretation. Allowed values:

- `high` — meaningful trend interpretation expected; included in Product-5 longitudinal panels
- `medium` — interpretable when paired with other questions
- `low` — point-in-time interpretation only

`likert_5` questions are predominantly `high` (confidence is naturally longitudinal).
`multiple_choice` questions are typically `medium` (structural topology changes infrequently).

---

## 6. Stabilization Relevance

Stabilization relevance ties the question to runtime stabilization signals (Product 4):

- `runtime_reliability`
- `governance_replay`
- `fail_closed_posture`
- `not_applicable`

---

## 7. Runtime Relevance

Runtime relevance ties the question to operational runtime continuity:

- `incident_continuity`
- `replay_continuity`
- `runtime_observability`
- `not_applicable`

---

## 8. Anti-Surveillance Constraints

Regardless of modality, questions must never:

- Reference named individuals
- Reference named departments
- Probe productivity, attendance, or behavioural compliance
- Request affective self-disclosure
- Solicit information about specific people's competence

Violation of these constraints blocks the bank from release via the existing anti-exposure validators.

---

## 9. Archetype Contribution

`multiple_choice` questions may declare contribution to one or more archetypes:

- `stewardship_concentration`
- `governance_fragmentation`
- `onboarding_survivability`
- `operational_continuity`
- `modernization_fragility`
- `institutional_memory_dependency`

Each option in the question maps to at most one archetype. Mapping is verified by `signalContributionIntegrity.test.ts`.

---

## 10. Authoring Discipline

Authoring a new question requires:

1. A doctrine-aligned section.
2. A modality choice justified by the question's intent.
3. Complete intelligence metadata.
4. A rationale string that names the continuity risk the question is sensing.
5. Anti-surveillance review.
6. Bank version increment if released.

Questions without complete metadata are non-mergeable.
