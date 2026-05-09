# Governance Operations UI System

> **Status:** Canonical governance operations · **Layer:** UI · **Inherits:** [governance-operations-dashboard-system.md](governance-operations-dashboard-system.md)

## 1. Objective

Define the UI language for governance operations so every surface reinforces calmness, legitimacy, and stabilization-first cognition.

## 2. Design principles

- **Calmness.** Every surface defaults to low contrast, generous spacing, and restrained typography.
- **Legitimacy.** Every banding is paired with a citation and a content-hash reference where applicable.
- **Institutional trust.** No vendor-dashboard aesthetic, no SaaS-marketing affordances.
- **Restrained visibility.** Information appears at the cadence of the underlying system, not on every paint.
- **Stabilization-first interpretation.** Every advisory phrases action toward slowing, distributing, or extending.
- **Executive cognitive safety.** Reading load per screen is bounded.

## 3. Design tokens

| Token | Value (semantic) |
|---|---|
| `governance.color.posture.stable` | low-saturation neutral green |
| `governance.color.posture.warming` | low-saturation amber |
| `governance.color.posture.concerning` | low-saturation orange |
| `governance.color.posture.destabilizing` | muted red, used as text only |
| `governance.color.background` | institutional off-white / off-charcoal |
| `governance.typography.heading` | restrained sans serif, no weight above 600 |
| `governance.typography.body` | reading-optimized line height (1.6) |
| `governance.spacing.section` | generous (≥ 32px) |
| `governance.motion.cadence` | refresh on whole-second boundaries; no sub-second motion |

## 4. Interaction rules

- No flashing.
- No auto-scroll.
- No modal interruption for non-critical events.
- No real-time chart redraws.
- No gamified counters.
- Hover affordances are subtle and non-coercive.

## 5. Prohibited patterns

- Flashing alerts.
- Chaotic density.
- Gamified monitoring.
- Dopamine-driven telemetry UX.
- Security-center theater.
- "Live" badges that pulse.

## 6. Discipline

The UI language succeeds when the institution's surfaces feel less like a monitoring tool and more like a quiet institutional ledger. If a surface would not look out of place printed and bound for review, it has succeeded.
