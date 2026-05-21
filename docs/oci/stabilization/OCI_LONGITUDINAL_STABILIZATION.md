# OCI Longitudinal Stabilization

DOCTRINE_VERSION: 2.0.0
STATUS: Operational doctrine (Product 3 → Product 5 forward-link)

## 1. Purpose

This document specifies the longitudinal foundations that bridge
Product 3 (Stabilization) into Product 5 (Longitudinal
Intelligence). It names the trajectory engine and the k-anonymity
discipline that bounds all longitudinal readings.

## 2. The trajectory reading

The trajectory engine composes:

- `institutionalEvolutionTracker` (evolution direction across eras)
- `ociMaturityPathway` (Method-spine placement)
- `interventionTrackingEngine` (ledger reductions over time)

It emits a categorical trajectory:

- `not_yet_readable` — too few longitudinal data points.
- `improving` — net forward trajectory across at least two of three
  inputs without regression on the third.
- `holding` — neither improving nor regressing.
- `regressing` — net backward trajectory on at least one input.

## 3. K-anonymity floor

No longitudinal reading is emitted unless the underlying ledger has
≥ k intervention events (default k=5) AND ≥ k distinct workflow
participations. Below the floor the engine emits
`longitudinal_below_k_anonymity_floor` and reports
`not_yet_readable`.

## 4. What longitudinal does NOT do

- No predictions. No projections. No estimates of future state.
- No comparison across institutions.
- No identification of any individual.
- No "trends" framed as causal claims.

## 5. Forward-link to Product 5

Product 5 will compose longitudinal readings from many institutions
into sector-level continuity intelligence. Product 3 prepares the
ground by:

1. Naming the trajectory reading shape.
2. Enforcing the k-anonymity floor at source.
3. Recording the contributing inputs explicitly for downstream
   composition.

## 6. Persistence sketch (non-binding)

```
oci_longitudinal_reading (
  institution_id text,
  read_at timestamptz,
  trajectory text check (trajectory in
    ('not_yet_readable','improving','holding','regressing')),
  contributing_inputs text[],
  k_floor_met boolean
)
```

Non-binding.

## 7. Cross-references

- `OCI_STABILIZATION_PROGRESSION.md`
- `OCI_DATA_HANDLING.md`
- `OCI_ANTI_SURVEILLANCE_POSITION.md`
- `OCI_METHOD.md`
