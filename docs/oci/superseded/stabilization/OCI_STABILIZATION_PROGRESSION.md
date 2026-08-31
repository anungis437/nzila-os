# OCI Stabilization Progression

DOCTRINE_VERSION: 2.0.0
STATUS: Operational doctrine (Product 3)

## 1. Purpose

This document specifies how OCI Method™ reads institutional progression
through the stabilization phase. It is **categorical** and **non-scoring**.
There are no numeric scores in the user-facing surface. Bandings are
discrete and named.

The progression layer composes existing engines — it does not introduce
new analytics:

- `institutionalEvolutionTracker.ts` (governance lineage trajectory)
- `ociMaturityPathway.ts` (Method-spine placement)
- `stabilizationStateEngine.ts` (phase 2 — current legal state)
- `interventionTrackingEngine.ts` (phase 3 — intervention ledger)

## 2. Non-negotiables

- No person-level signals. No individual scoring.
- No predictive claims. Progression is a backward-looking reading.
- No "optimization" / "productivity" / "behavioural analytics" tone.
- Anti-surveillance binding from `OCI_ANTI_SURVEILLANCE_POSITION.md`.
- AI boundary per `OCI_AI_BOUNDARY.md`: composition is deterministic.
- Data handling per `OCI_DATA_HANDLING.md`: k-anonymity floor preserved.

## 3. Progression bands

Three categorical bands. No numeric tier. No leaderboard.

- `not_yet_readable` — insufficient ratified intervention activity to
  read a trajectory.
- `holding` — ratified activity is present and recovery is preserved,
  but no net forward movement is recorded across the reading window.
- `advancing` — ratified activity has produced net forward movement on
  at least one stabilization domain without regression on the others.
- `regressing` — recovery has been lost on at least one domain.

The reader emits exactly one band per institution per reading.

## 4. Directional reading

Direction is read from three converging composition inputs:

| Source                                | Contribution                                       |
| ------------------------------------- | -------------------------------------------------- |
| `stabilizationStateEngine`            | Current legal state + recent transitions.          |
| `institutionalEvolutionTracker`       | Continuity rate trend across governance eras.      |
| `interventionTrackingEngine`          | Ratified vs reversed intervention count and edges. |

A direction is emitted only when at least two of three sources agree.
Single-source readings are reported as `not_yet_readable` with the
contributing source named.

## 5. Maturity continuum binding

The progression reader binds to the OCI Method™ five-stage maturity
continuum (per `ociMaturityPathway.ts`):

`recognition_only → mapping_underway → stabilization_underway →
infrastructure_underway → intelligence_underway`

The progression layer reports the current stage AND the legal next
stage. It does not promise transition. It does not estimate timing.

## 6. What progression does NOT measure

- Individual carrier performance.
- "Risk" of any named carrier.
- Behavioural drift of personnel.
- Productivity, throughput, or velocity.
- Sentiment.
- Any composite "health score" expressed as a number.

## 7. Persistence sketch (non-binding)

If durable persistence is later added, candidate shape:

```
oci_stabilization_progression (
  institution_id text,
  read_at timestamptz,
  band text check (band in
    ('not_yet_readable','holding','advancing','regressing')),
  contributing_sources text[],
  current_maturity_stage text,
  next_maturity_stage text
)
```

This sketch is **non-binding**. No migration is created by Product 3.

## 8. Tone

Calm. Institutional. Recognition-first. Reads what has been ratified.
Never blames any actor. Never frames absence of progression as failure.
