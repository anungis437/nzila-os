# Continuity Observability Runtime Embedding

> **Status:** Canonical runtime integration · **Layer:** Continuity execution · **Inherits:** [continuity-observability-system.md](../nzila-runtime-governance/continuity-observability-system.md)

## 1. Objective

Make continuity posture and stabilization recommendations live, visible, and acted upon — without transforming any surface into an alarm system.

## 2. Embedding surfaces

| Surface | Continuity role |
|---|---|
| Operational dashboards (Control Plane, Console) | Render dominant posture per system scope. Do not collapse to a composite score. |
| Executive intelligence surfaces (ExecutiveOS) | Present banded posture + trajectory. Refuse individual resolution. |
| Pilot admin surfaces | Render pilot scope posture independently from production. |
| Governance review flows | Surface stabilization recommendations as advisory, not autonomous. |
| Operational coherence systems | Consume `dominantPosture()` and `dominantTrajectory()` for routing decisions. |

## 3. Required wiring

- Periodic posture refresh (default 60s) calls `continuityIndicatorSchema.parse(...)` at the boundary; rejected indicators are dropped, not coerced.
- `recommendStabilization()` is invoked when a `cognitive_safety_signal:threshold_exceeded` event is emitted. The recommendation is rendered to the relevant governance review queue, never auto-applied.
- All posture reads carry `evaluatedAt` and a SYSTEM scope. Person-scope reads are structurally absent — there is no path to construct one.

## 4. UX contract

Continuity outputs MUST appear:

- Calm.
- Restrained.
- Banded (`stable`/`warming`/`concerning`/`destabilizing`), never numeric scores presented as truth.
- Stabilization-oriented (suggested action is always to reduce density, extend cadence, distribute load — never to accelerate or surveil).

The surface MUST NOT:

- Flash, pulse, or animate to draw attention.
- Auto-escalate.
- Compete for attention with content the operator is reading.

## 5. Discipline

Continuity observability succeeds when operators stop noticing it during stable operation and trust it during destabilizing operation. If operators learn to ignore continuity surfaces because they are noisy, the integration has failed regardless of technical correctness.
