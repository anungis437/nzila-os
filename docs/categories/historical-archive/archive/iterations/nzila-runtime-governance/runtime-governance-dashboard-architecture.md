# Runtime Governance Dashboard Architecture

> **Status:** Canonical runtime governance · **Layer:** Governance-native dashboards · **Inherits:** [../nzila-governance/executive-cognitive-governance-standards.md](../nzila-governance/executive-cognitive-governance-standards.md), [executive-cognitive-safety-monitoring.md](executive-cognitive-safety-monitoring.md)

The **runtime governance dashboard architecture** defines how runtime governance signal is surfaced — to stewards, to executives, to procurement reviewers — without violating the calmness, restraint, and stabilization-first principles the layer itself enforces.

A governance dashboard that produces operational anxiety is itself a governance failure.

---

## 1. Posture

Dashboards:

- **Are calm by default** — quiet, structured, deliberate
- **Honor governance readability** — language is institutional, not jargon
- **Bias toward stabilization** — surfaces resolve to *what to do calmly*, not *what to panic about*
- **Are restraint-tuned** — density and refresh cadence honor doctrine-defined budgets
- **Are role-shaped** — surfaces are aligned to steward / executive / reviewer / procurement reading patterns
- **Are anti-surveillance** — no person-resolving views

The dashboard layer is the governance layer's most public surface. Its discipline determines whether governance feels institutional or chaotic.

---

## 2. Required Principles

- **Operational calmness** — visual rhythm honors pacing doctrine
- **Governance readability** — every surfaced item carries doctrine citation reachable in one step
- **Continuity-safe visibility** — no surface resolves individuals; aggregation stance enforced
- **Executive restraint** — executive surfaces meet the cognitive safety thresholds
- **Stabilization-first interpretation** — bands, trajectories, and recommendations bias toward *calm action*
- **Anti-chaos presentation** — no spinning indicators, no flooding alert lists, no infinite scroll of governance noise

---

## 3. Dashboard Classes

| Class | Audience | Primary Surface |
|-------|----------|-----------------|
| Steward dashboard | Stewards / governance forums | Aggregated posture, indicator trends, open concerns |
| Executive dashboard | Executive readers | Bounded posture, strategic readability summary |
| Reviewer dashboard | Internal reviewers | Evidence packs, attestation status, drift indicators |
| Procurement dashboard | External procurement-bound surfaces (where authorized) | Procurement evidence pack reads, attestation status, certification posture |
| Operator dashboard | Platform operators | Runtime validation status, deployment legitimacy, environment identity |

Each class has its own density, cadence, and severity budgets.

---

## 4. Layout Discipline

- Single primary read per surface (band, indicator, status)
- Supporting evidence one step away, not piled in primary view
- Trajectory always paired with band
- Severity coloration restrained — no full-screen red surfaces
- No infinite scroll of governance events
- No animation that implies urgency where there is none

---

## 5. Refresh Cadence

| Surface Class | Default Cadence |
|---------------|-----------------|
| Steward | Hour or longer |
| Executive | Day |
| Reviewer | Hour |
| Procurement | Day or per-engagement snapshot |
| Operator | Minute or per-event |

Real-time per-individual cadence is not used.

---

## 6. Notification Discipline

- Notifications are governance events worth a human moment, never noise
- Per-surface budgets enforced by the executive cognitive safety monitoring layer
- Critical severity reserved for actual doctrine-bearing failures
- Snooze / acknowledge are first-class with reasoning recorded

---

## 7. Categorical Prohibitions

- Alert spam
- Operational panic UX (flashing, oversized red banners, urgent sound)
- Excessive visualization density
- Governance anxiety amplification (raw counts presented without context)
- Person-resolving views
- Cross-environment behavioral correlation views
- Marketing extraction views
- Vanity dashboards (count surfaces with no governance role)

---

## 8. Required Implementation Surfaces

The dashboard layer composes outputs from:

- [Runtime assurance engine](runtime-assurance-engine.md) (bands, trajectories)
- [Continuity observability system](continuity-observability-system.md) (continuity posture)
- [Deployment legitimacy validation engine](deployment-legitimacy-validation-engine.md) (deployment status)
- [Governance evidence ledger](governance-evidence-ledger.md) (evidence references)
- [Runtime attestation pipeline](runtime-attestation-pipeline.md) (attestation status)

It composes; it does not replicate state. The ledger is authoritative.

---

## 9. Anti-Patterns

- Dashboards that compete for executive attention with operational systems
- Dashboards that present raw event counts as importance
- Dashboards that lack doctrine citation pathways
- Dashboards that imply human pressure
- Dashboards that surface gaps without paired remediation paths
- Dashboards that look like consumer analytics

---

## 10. Discipline

The dashboard is the most-read surface of the runtime governance layer. Its restraint is the institution's most-felt evidence of governance maturity. A calm dashboard signals an institution that has internalized governance. A loud dashboard signals an institution that is performing governance for an audience.

Nzila ships the calm dashboard.
