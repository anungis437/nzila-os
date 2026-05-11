# Runtime UI Embodiment

> **Status:** Canonical governance experience · **Layer:** Embodiment · **Inherits:** [live-governance-surfaces.md](live-governance-surfaces.md)

## 1. Objective

Make the runtime governance state — posture, stabilization, continuity, legitimacy, attestation integrity, review state, modernization pacing — visible as institutional UX.

## 2. Required embodiments

| Embodiment | Source primitive |
|---|---|
| Governance posture | `@nzila/governance-operations` posture card |
| Stabilization state | `@nzila/stabilization-signals` reading |
| Continuity health | `@nzila/continuity-review` card |
| Deployment legitimacy | `@nzila/attestation-visibility` legitimacy summary |
| Attestation integrity | `@nzila/attestation-visibility` projection |
| Governance review state | `@nzila/governance-review` `DecisionLedger` |
| Operational modernization pacing | `@nzila/stabilization-signals` modernization-pacing signal |

## 3. NOT exposed

- Raw telemetry streams.
- Noisy event feeds.
- Orchestration internals.
- Operator-panic surfaces.

## 4. Required components

Calm, framework-light React Server Components consuming the primitives:

- `<PostureCard>` — single banded reading per card.
- `<ContinuityBand>` — dimension + trajectory.
- `<AttestationPanel>` — verdict + content hash + interpretation.
- `<StabilizationSummary>` — signal + advisory.
- `<GovernanceTimeline>` — banded entries, ordered newest-first.
- `<DecisionLedgerPanel>` — append-only ledger view.
- `<LegitimacySummaryCard>` — release × environment × verdict.

## 5. Discipline

Embodiment succeeds when the operator stops asking "is the runtime governed?" because the runtime visibly governs itself in the UI.
