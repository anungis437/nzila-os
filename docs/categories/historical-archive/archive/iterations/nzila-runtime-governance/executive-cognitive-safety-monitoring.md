# Executive Cognitive Safety Monitoring

> **Status:** Canonical runtime governance · **Layer:** Cognitive safety monitoring · **Inherits:** [../nzila-assurance/executive-cognitive-safety-assurance.md](../nzila-assurance/executive-cognitive-safety-assurance.md), [../nzila-governance/executive-cognitive-governance-standards.md](../nzila-governance/executive-cognitive-governance-standards.md)

The **executive cognitive safety monitoring** layer is the runtime form of executive cognitive governance. It continuously observes whether executive surfaces, escalation flows, and operational pacing remain within the doctrine-defined safety thresholds. It is **system-centered**, not person-centered.

---

## 1. Posture

Monitoring:

- Reads **surface-level** indicators (density, refresh cadence, notification rate, escalation flow)
- Reads **system-level** indicators (governance chaos risk, calmness degradation, pacing integrity)
- Refuses to profile, score, or behavior-rank individuals
- Refuses to infer psychological states
- Surfaces results in stewardship register, not anxiety register

The subject of monitoring is the *system* surfacing information to executives — never the executive.

---

## 2. Monitored Domains

| Domain | What Is Read |
|--------|--------------|
| Information density | Per-surface element-count, indicator-count, viewport-filling ratio |
| Escalation flooding | Aggregate escalation rate into bounded surfaces; structural |
| Dashboard overload | Dashboard-class density vs. doctrine-defined budgets |
| Governance chaos risk | Cross-surface concurrency of governance-bearing events |
| Operational calmness degradation | Refresh cadence, notification rate, alert pacing trajectory |
| Continuity-safe pacing integrity | Whether surface refresh respects pacing doctrine |

---

## 3. System-Centered Discipline

The monitoring layer is structurally person-blind:

- Subject keys are *surface*, *route*, *dashboard class*, *escalation queue* — not *user*
- No per-person dwell time
- No per-person attention proxy
- No per-person dashboard-load attribution
- No psychological inference (stress, fatigue, attention)
- No behavioral profiling

Where finer-grained signal would technically allow person resolution, structural refusal applies.

---

## 4. Required Outputs

Emitted (typed in [packages/governance-telemetry](../../packages/governance-telemetry)):

- `executive_cognitive_overload_risk` — system-scope, citing the thresholds breached
- `pacing_violation` — structural pacing doctrine breach
- `density_threshold_exceeded` — per-surface, with the budget cited
- `escalation_concentration_detected` — aggregate, structural
- `calmness_degradation_signal` — directional read of operational calmness

Output is bounded. There are no free-form behavioral attributes.

---

## 5. Doctrine-Defined Thresholds

Thresholds are sourced from [executive-cognitive-safety-assurance](../nzila-assurance/executive-cognitive-safety-assurance.md):

- Information density per surface class
- Escalation pacing per executive surface
- Alert restraint per minute / hour / day
- Strategic readability cadence
- Continuity-safe executive UX refresh cadence

Thresholds are *governance contracts*, not heuristic constants. Their adjustment requires governance review.

---

## 6. Cadence

Indicators update at appropriate aggregation cadence:

- Density: per render
- Refresh cadence: rolling minute window
- Notification rate: rolling hour window
- Escalation concentration: rolling hour and day windows
- Calmness trajectory: rolling day and week windows

Real-time per-individual signal is not used.

---

## 7. Stabilization Bias

When indicators worsen, recommendations bias toward:

- Surface re-pacing
- Density reduction
- Escalation re-routing (to bounded surfaces, not new humans)
- Doctrine review re-engagement

Recommendations never bias toward human pressure.

---

## 8. Categorical Refusals

- Profile individuals
- Behavior-rank executives
- Infer psychological state
- Cross-surface attention reconstruction
- Real-time per-person dashboards
- Manager-facing surfaces of personal pacing
- Performance attribution from cognitive monitoring outputs

---

## 9. Anti-Patterns

- "Executive engagement scoring"
- "Attention heatmaps"
- Per-person notification fatigue inference
- Surveillance-grade dwell tracking
- Real-time alerts on the executive's behavior
- Marketing extraction of monitoring outputs

---

## 10. Discipline

The monitoring layer's job is to keep the *system* worthy of the executive's attention. It is the discipline of refusing to confuse "more visibility" with "more wisdom." The fewer alarms an executive must process, the more deliberate the governance can be.

This is a system that protects executive cognition by protecting the surfaces that executives must read.
