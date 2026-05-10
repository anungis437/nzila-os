# Governance Operations Dashboard System

> **Status:** Canonical governance operations · **Layer:** Dashboard surface · **Inherits:** [governance-native-dashboard-embedding.md](../nzila-runtime-integration/governance-native-dashboard-embedding.md)

## 1. Objective

Design governance-native operational dashboards that make institutional governance posture continuously visible without inducing operational panic, telemetry addiction, or surveillance behavior.

## 2. Required surfaces

| Surface | Posture exposed |
|---|---|
| Governance posture card | Per-product banding (`stable` / `warming` / `concerning` / `destabilizing`) |
| Continuity posture band | Dominant continuity posture + trajectory |
| Attestation status panel | Latest attestation per class with verdict + freshness |
| Deployment legitimacy summary | Release identity, environment identity, last validation verdict |
| Stabilization indicator | Banded operational calmness reading |
| Governance-safe timeline | Last N governance-bearing events, banded, no payload exposure |
| Drift indicator | Banded drift across products / surfaces / contracts |

## 3. UX principles

- **Calm.** No animation. No pulse. No traffic-light walls.
- **Sparse.** A dashboard renders one truth per card, never composite scores.
- **Interpretable.** Every banding is paired with a one-sentence interpretation.
- **Executive-readable.** A non-engineer must be able to read the dashboard without orientation.
- **Refresh on slow cadence.** Default 60s. Real-time refresh is rejected.

## 4. Refresh model

Dashboards pull banded summaries from:

- [@nzila/assurance-engine](../../packages/assurance-engine) for posture bandings.
- [@nzila/continuity-observability](../../packages/continuity-observability) for posture + trajectory.
- [@nzila/runtime-attestation](../../packages/runtime-attestation) for attestation freshness.
- [@nzila/governance-runtime](../../packages/governance-runtime) for release identity + last legitimacy verdict.

Dashboards never compute their own composite scores.

## 5. Prohibited patterns

- Red-alert overload.
- Blinking operational noise.
- Security-theater dashboards.
- Productivity-style monitoring.
- Operator anxiety amplification.
- Vanity counters of alert volume.

## 6. Discipline

A governance dashboard succeeds when an operator can confirm "the system is governed" in under five seconds during stable operation, and can locate the governing evidence in under one minute during a real incident. Dashboards that demand attention during stable operation are governance theatre and are rejected.
