# OCI Stabilization Tracking

**Status:** Canonical doctrine. Defines what a Product 3 engagement tracks, how the tracking is bounded by the Anti-Surveillance Position, and how severity-band trajectory is read across the engagement.

**Audience:** Certified facilitators, governance bodies, platform engineers preparing eventual tracking surfaces.

---

## 1. Purpose

A Product 3 engagement produces longitudinal continuity readings. Tracking is the discipline of capturing those readings in a form a governance body can use across the engagement's lifecycle without the tracking surface itself becoming a surveillance instrument.

The framework distinguishes tracking from monitoring. Monitoring observes people; tracking reads institutional continuity. The Tracking spec is bound by [OCI_ANTI_SURVEILLANCE_POSITION.md](../../OCI_ANTI_SURVEILLANCE_POSITION.md) at every step.

## 2. The seven tracking domains

A Product 3 engagement tracks across seven institutional domains.

### 2.1 Continuity Debt™ category readings

The five Continuity Debt categories (see [OCI_CONTINUITY_DEBT.md](OCI_CONTINUITY_DEBT.md)) are read at engagement open, at each Lifecycle phase boundary, and at engagement close. Readings are per category; no composite figure is produced.

### 2.2 Severity band trajectory

Each engaged dimension carries a severity band reading (see [OCI_STABILIZATION_SEVERITY_MODEL.md](OCI_STABILIZATION_SEVERITY_MODEL.md)). The trajectory across phase boundaries is recorded. The framework does not predict band trajectory; it records the band reading at each boundary.

### 2.3 Action lifecycle status

Each ratified action carries a lifecycle status (see [OCI_ACTION_SYSTEM.md](OCI_ACTION_SYSTEM.md) §7). The tracking surface reflects current status, status history with timestamps, and the governance ratification trail.

### 2.4 Engagement log entries

The engagement log records every consent capture, every deferral with re-open conditions, every readiness band reading, every persona resonance reading, every facilitator decision, and every reciprocity term ratification.

### 2.5 Reciprocity ledger

Reciprocity terms ratified during the engagement are tracked across the engagement and across any subsequent engagement (Product 4 retainer, Product 5 longitudinal). The reciprocity ledger is institutional; the framework does not retain a working copy beyond engagement close.

### 2.6 Residual readings and deferrals

At every phase boundary and at engagement close, residual readings — what remains unstabilised — are recorded with re-open conditions. The framework refuses to mark an engagement complete with undocumented residual readings.

### 2.7 Doctrine adherence

Adherence to the binding principles (see [OCI_STABILIZATION_PRINCIPLES.md](OCI_STABILIZATION_PRINCIPLES.md)) is tracked at every Lifecycle phase boundary. Any departure is recorded with reason and referred to the recertification process where the departure is structural.

## 3. Severity-band trajectory reading

The severity-band trajectory is the engagement's primary tracked story. A band trajectory:

- Records the band reading per dimension at each phase boundary.
- Distinguishes movement from `critical` to `warning` (stabilization progress) from movement from `warning` to `critical` (continuity exposure increased).
- Is read with the institution, not pronounced over the institution.
- Is not converted into a single composite number.
- Is not used as a basis for per-person evaluation under any condition.

## 4. Anti-surveillance bounding

Tracking is bounded by [OCI_ANTI_SURVEILLANCE_POSITION.md](../../OCI_ANTI_SURVEILLANCE_POSITION.md). Specific rules:

### 4.1 No per-person tracking

The tracking surface holds no per-person behavioural data. Where an institutional reading derives from interviews with named stewards, the steward is recorded as a contributor (with consent), not as a tracked subject.

### 4.2 No per-person scoring

No tracked attribute reduces to a per-person score, ranking, or evaluation metric. Where a steward's load reads as elevated, the load is tracked at the institutional dimension level (e.g., "stewardship concentration in domain X"), not as a per-person attribute.

### 4.3 k-anonymity discipline for institutional readings

Any tracked reading that could re-identify a single steward through small cluster size is bounded by a k-anonymity discipline:

- Cluster sizes below k=5 are not reported in tracked artefacts.
- Where a sub-domain reading would otherwise resolve to a cluster below k=5, the reading is rolled up to the parent domain or marked as suppressed for k-anonymity.
- The k threshold is configurable per institution but cannot fall below k=3 under any condition.

### 4.4 No inference

Tracked readings are observations of institutional state, not inferences about future state. The framework does not project, predict, or score future continuity exposure. The governance body and the institution interpret trajectory; the tracking surface records.

### 4.5 Governance-receivable form

Tracked artefacts are produced in governance-receivable form. The form is institutional (the governance body can ratify or decline), not analytical (no proprietary scoring model the institution cannot audit).

## 5. Tracking cadence

| Cadence | Domains read |
|---------|--------------|
| Engagement open | Continuity Debt, severity bands, action set, readiness band, persona resonance. |
| Each Lifecycle phase boundary | Continuity Debt, severity band trajectory, action status, residual readings, doctrine adherence. |
| Each ratified action transition | Action status, governance review, reciprocity ledger. |
| Engagement close | All seven domains, with residual readings and re-open conditions explicit. |

The cadence is institutional. The tracking surface does not run on a real-time observation cadence; it runs on a ratification cadence.

## 6. Tracked artefact retention

Tracked artefacts are the institution's property. The framework retains a working copy only for the duration of the engagement and severs the working copy on engagement close per [OCI_DATA_HANDLING.md](../../OCI_DATA_HANDLING.md). The institution holds the canonical record across engagements.

A Product 4 retainer or a Product 5 longitudinal engagement that references prior tracked artefacts does so by receiving them back from the institution, not by retaining them across engagement boundaries.

## 7. Doctrine references

- [OCI_METHOD.md](../../OCI_METHOD.md)
- [OCI_STABILIZATION_FRAMEWORK.md](OCI_STABILIZATION_FRAMEWORK.md)
- [OCI_STABILIZATION_LIFECYCLE.md](OCI_STABILIZATION_LIFECYCLE.md)
- [OCI_STABILIZATION_SEVERITY_MODEL.md](OCI_STABILIZATION_SEVERITY_MODEL.md)
- [OCI_CONTINUITY_DEBT.md](OCI_CONTINUITY_DEBT.md)
- [OCI_ACTION_SYSTEM.md](OCI_ACTION_SYSTEM.md)
- [OCI_STABILIZATION_PRINCIPLES.md](OCI_STABILIZATION_PRINCIPLES.md)
- [OCI_INTERVENTION_ETHICS.md](OCI_INTERVENTION_ETHICS.md)
- [OCI_ANTI_SURVEILLANCE_POSITION.md](../../OCI_ANTI_SURVEILLANCE_POSITION.md)
- [OCI_AI_BOUNDARY.md](../../OCI_AI_BOUNDARY.md)
- [OCI_DATA_HANDLING.md](../../OCI_DATA_HANDLING.md)
