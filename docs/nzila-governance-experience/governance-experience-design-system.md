# Governance Experience Design System

> **Status:** Canonical governance experience · **Layer:** Design language · **Inherits:** [governance-operations-ui-system.md](../nzila-governance-operations/governance-operations-ui-system.md)

## 1. Objective

Define the canonical governance operational design language — calm, restrained, institutional, executive-safe.

## 2. Required systems

| System | Definition |
|---|---|
| Spacing | Generous; ≥ 32px between sections. Cards have ≥ 24px internal padding. |
| Hierarchy | Stabilization-oriented; the calmest reading is the most prominent. |
| Motion | None for routine surfaces. Slow fades only for cadence-bound refresh. |
| Color | Restrained operational logic; banded tokens only; never traffic-light overload. |
| Pacing | Continuity-safe; refresh on whole-second boundaries; default 60s. |
| Typography | Institutional sans serif; weight ≤ 600; line-height ≥ 1.6 for body. |
| Interaction density | Executive-safe; ≤ 3 actions per card; ≤ 1 primary action per screen. |

## 3. Token references

All governance experience surfaces consume `GOVERNANCE_DESIGN_TOKENS` and `REFRESH_CADENCE_MS` from [@nzila/governance-operations](../../packages/governance-operations).

## 4. Explicitly prohibited

- Blinking alerts.
- Aggressive red states.
- Telemetry theater.
- Dense observability grids.
- Gamified operations UX.
- Dopamine-driven monitoring systems.
- Pulsing "live" badges.
- Auto-scroll feeds.

## 5. Discipline

The design language succeeds when surfaces look at home in an institutional report. If a surface would not look out of place printed and bound for review, it has succeeded.
