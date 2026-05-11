# Governance-Native Dashboard Embedding

> **Status:** Canonical runtime integration · **Layer:** Surface embedding · **Inherits:** [runtime-governance-dashboard-architecture.md](../nzila-runtime-governance/runtime-governance-dashboard-architecture.md)

## 1. Objective

Embed governance runtime outputs into operational surfaces so the institution can see its own governance state continuously — without converting any surface into an alert console.

## 2. Target surfaces

| Surface | Embedded reads |
|---|---|
| Control Plane | Per-product assurance bandings · deployment legitimacy verdict · attestation freshness · ledger growth (calm) |
| ExecutiveOS | Continuity posture (banded) · stabilization recommendations (advisory) · governance windowed summary (weekly) |
| UE Ops | Pilot scope posture · deployment legitimacy for the pilot environment · doctrine violations (last 7d, banded) |
| Pilot admin surfaces | Pilot boundary event count (banded) · isolation invariant status |
| Deployment operations views | Release identity · environment identity · last attestation verdict |

## 3. Reading shape

- All bandings come from [@nzila/assurance-engine](../../packages/assurance-engine). The dashboards never compute their own composite scores.
- Continuity posture comes from [@nzila/continuity-observability](../../packages/continuity-observability)'s `dominantPosture()` and `dominantTrajectory()`.
- Attestations and ledger references come from [@nzila/runtime-attestation](../../packages/runtime-attestation).

## 4. UX contract

Dashboards MUST:

- Default to the calm, system-scoped view.
- Render bandings as text + a single muted indicator. No traffic-light dashboards.
- Refresh on a slow cadence (default 60s). Real-time refresh is rejected.
- Surface stabilization recommendations as advisories with a clear human-authority path, never as auto-actions.
- Provide a "show evidence" affordance that links to the relevant ledger record by content hash.

Dashboards MUST NOT:

- Animate to attract attention.
- Aggregate bandings into a single overall score.
- Surface any individual-resolving content under any circumstance.
- Surface alert volume as a vanity counter.

## 5. Discipline

A governance dashboard succeeds when an operator can confirm "the system is governed" in under five seconds during stable operation, and can locate the governing evidence in under one minute during a real incident. Dashboards that demand attention during stable operation are governance theatre and are rejected.
