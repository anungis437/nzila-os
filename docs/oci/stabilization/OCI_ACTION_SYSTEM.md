# OCI Action System

**Status:** Canonical doctrine. Defines the continuity-native action architecture for Product 3 engagements. Persistence sketch in §5 captures intent; runtime build (database schema, API, UI) is deferred to a separate work programme.

**Audience:** Certified facilitators, governance bodies, platform engineers preparing eventual runtime support.

---

## 1. Purpose

Every Product 3 engagement produces, ratifies, and tracks **actions**. An action is the unit of stabilization. The Action System defines what an action is, what types of action the framework supports, what attributes every action carries, and how actions relate to engagement evidence, governance ratification, and review.

The system is continuity-native: an action is not a task on a project plan. An action is a stabilization move with documented reversibility, severity band, governance owner, and reciprocity terms.

## 2. What an action is

An action is:

- A stabilization move proposed during an engagement,
- Ratified by the governance body before execution,
- Owned by a named governance owner,
- Tied to a severity band reading and a reversibility profile,
- Recorded in the engagement log with consent capture.

An action is not:

- A task assigned to a steward as work,
- A KPI or metric,
- A scoring instrument,
- A surveillance object,
- A unit of attribution.

## 3. The eight action types

Every Product 3 action falls into one of eight types. The type is named at ratification time.

### 3.1 Lineage capture action

Records institutional memory — interpretations, precedents, governance reasoning — in governance-receivable form.

### 3.2 Practice capture action

Records the working practice of a single role or steward cluster in a form a successor could absorb.

### 3.3 Carrier broadening action

Broadens the set of stewards carrying a continuity-bearing practice, with explicit reciprocity terms for the originating steward.

### 3.4 Onboarding stabilization action

Produces a ratified onboarding record for a role whose succession would otherwise be unsupported.

### 3.5 Modernization preservation action

Records the interpretation embedded in a practice that a modernization is replacing, before substitution proceeds.

### 3.6 Reconstruction action

Recovers lapsed practice through secondary sources and adjacent stewards, with explicit recovered/reconstructed/unresolved markings.

### 3.7 Governance ratification action

Brings a captured, reconstructed, or broadened arrangement to the governance body for institutional adoption.

### 3.8 Engagement closure action

Closes the engagement (or a phase of it) with documented residual readings, deferred items with re-open conditions, and reciprocity terms honoured.

## 4. Attributes every action carries

Every action carries the following attributes. All attributes are captured at ratification time.

| Attribute | Meaning |
|-----------|---------|
| `action_type` | One of the eight types above. |
| `severity_band` | Severity band the action engages (`note`, `observation`, `warning`, `critical`). See [OCI_STABILIZATION_SEVERITY_MODEL.md](OCI_STABILIZATION_SEVERITY_MODEL.md). |
| `governance_owner` | The governance body member accountable for ratification and review. |
| `reversibility_profile` | `fully_reversible`, `reversible_with_cost`, or `irreversible`. |
| `status` | `proposed`, `ratified`, `in_sequence`, `paused`, `completed`, `deferred`, `closed_unresolved`. |
| `reciprocity_terms` | Named recognition, standing, and reciprocity commitments the institution makes for the stewards engaged. |

Actions do not carry per-person scoring fields, per-person behavioural data, or per-person inference. Attribution to a steward is limited to recognition (named contributor) and consent (action engages this steward with their consent).

## 5. Non-binding persistence sketch

This section is non-binding. It captures intent for an eventual runtime build. No runtime work is in scope under the current programme.

Three candidate tables would hold the Action System persistence surface:

### 5.1 `oci_stabilization_actions`

| Column | Type / shape |
|--------|--------------|
| `id` | Primary key. |
| `engagement_id` | Foreign key to the engagement. |
| `action_type` | One of the eight types. |
| `severity_band` | One of `note`, `observation`, `warning`, `critical`. |
| `governance_owner` | Reference to the governance body member accountable. |
| `reversibility_profile` | One of `fully_reversible`, `reversible_with_cost`, `irreversible`. |
| `status` | One of the lifecycle statuses in §4. |
| `reciprocity_terms` | Structured record of recognition and standing commitments. |
| `proposed_at`, `ratified_at`, `closed_at` | Lifecycle timestamps. |

### 5.2 `oci_action_evidence`

| Column | Type / shape |
|--------|--------------|
| `id` | Primary key. |
| `action_id` | Foreign key to the action. |
| `evidence_kind` | `engine_signal`, `interview_record`, `archival_source`, `governance_artefact`. |
| `evidence_reference` | Opaque reference to the institutional record (not the raw material). |
| `captured_at` | Timestamp. |

The evidence table holds references only. The institutional records themselves remain in the institution's canonical store. The framework's working copy is severed on engagement close per [OCI_DATA_HANDLING.md](../OCI_DATA_HANDLING.md).

### 5.3 `oci_action_review`

| Column | Type / shape |
|--------|--------------|
| `id` | Primary key. |
| `action_id` | Foreign key to the action. |
| `review_kind` | `governance_ratification`, `progress_check`, `closure_review`, `re_open_review`. |
| `review_decision` | `ratified`, `deferred`, `closed_unresolved`, `re_opened`. |
| `review_notes_reference` | Opaque reference to the institutional record of the review. |
| `reviewed_at` | Timestamp. |

The review table holds the governance trail. It does not hold per-person evaluation, per-person scoring, or per-person fault attribution.

## 6. Anti-surveillance and AI-boundary perimeter

The Action System operates inside the perimeter of [OCI_ANTI_SURVEILLANCE_POSITION.md](../OCI_ANTI_SURVEILLANCE_POSITION.md) and [OCI_AI_BOUNDARY.md](../OCI_AI_BOUNDARY.md). No action attribute is derived from per-person behavioural data. No engine output substitutes for institutional ratification. Engines surface candidate actions; the governance body ratifies or declines them.

## 7. Lifecycle of an action

1. **Proposed** — surfaced by the engagement, either from an engine reading or from a facilitator-led interview.
2. **Ratified** — accepted by the governance body, with severity band, governance owner, reversibility profile, and reciprocity terms recorded.
3. **In sequence** — being executed under the engagement's Lifecycle phase.
4. **Paused** — paused due to consent withdrawal, readiness loss, or governance request.
5. **Completed** — executed and confirmed institutional.
6. **Deferred** — explicitly deferred with re-open conditions recorded.
7. **Closed unresolved** — the institution and the facilitator agree the action will not be completed under this engagement; deferred to a future engagement or to institutional next steps.

A status transition that bypasses governance ratification is a principle breach.

## 8. Doctrine references

- [OCI_METHOD.md](../OCI_METHOD.md)
- [OCI_STABILIZATION_FRAMEWORK.md](OCI_STABILIZATION_FRAMEWORK.md)
- [OCI_INTERVENTION_MODEL.md](OCI_INTERVENTION_MODEL.md)
- [OCI_STABILIZATION_PRINCIPLES.md](OCI_STABILIZATION_PRINCIPLES.md)
- [OCI_STABILIZATION_SEVERITY_MODEL.md](OCI_STABILIZATION_SEVERITY_MODEL.md)
- [OCI_STABILIZATION_TRACKING.md](OCI_STABILIZATION_TRACKING.md)
- [OCI_INTERVENTION_ETHICS.md](OCI_INTERVENTION_ETHICS.md)
- [OCI_ANTI_SURVEILLANCE_POSITION.md](../OCI_ANTI_SURVEILLANCE_POSITION.md)
- [OCI_AI_BOUNDARY.md](../OCI_AI_BOUNDARY.md)
- [OCI_DATA_HANDLING.md](../OCI_DATA_HANDLING.md)
