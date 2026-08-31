# OCI Facilitator Runtime

DOCTRINE_VERSION: 2.0.0
STATUS: Operational doctrine (Product 3)

## 1. Purpose

This document specifies the facilitator-side runtime infrastructure of
OCI Method™ Product 3. The runtime helps a human facilitator pace
interventions, recognise sensitivity, and defer when readiness is
insufficient.

The runtime is **for the facilitator**, not for the institution. It
emits pacing and deferral signals only. It does **not** score, rank,
profile, or surface any individual.

## 2. Non-negotiables

- **No person-level signals.** The runtime never emits signals
  identifying or characterising a named carrier, staff member,
  steward, or executive.
- **No defensiveness scoring of individuals.** Defensiveness is read
  as an institutional posture only, never as a personal trait.
- **No blame language.** Tone must pass the canonical `BLAME` regex.
- **No "behavioural analytics" framing.** Even where the runtime
  observes pacing signals, it reports them as institutional rhythm,
  not as person-level behaviour.
- **Anti-surveillance binding** from `OCI_ANTI_SURVEILLANCE_POSITION.md`.
- **AI boundary** per `OCI_AI_BOUNDARY.md`: deterministic composition
  only; no inference about persons.
- **Data handling** per `OCI_DATA_HANDLING.md`: k-anonymity floor
  preserved; the runtime never reads identified person records.

## 3. Inputs

The runtime reads:

1. The current stabilization state (from `stabilizationStateEngine`).
2. The intervention ledger summary (from `interventionTrackingEngine`).
3. The progression band (from `stabilizationScoringEngine`).
4. Facilitator-observed institutional readiness signals (provided by
   the facilitator, not inferred about individuals).

## 4. Outputs

A small set of canonical signals:

- `facilitator_pacing_recommendation` — advance, hold, slow, or defer.
- `facilitator_sensitivity_flag` — none, elevated, high.
- `facilitator_readiness_insufficient` — when the runtime recommends
  deferral because at least one readiness condition is unmet.
- `facilitator_overload_protection_engaged` — when the volume or
  velocity of recent interventions exceeds the institutional
  bandwidth threshold.

All signals are categorical. No numeric load or stress score.

## 5. Pacing rules (deterministic)

| Recent ratified count | Recent regressed count | Recommendation |
| --------------------- | ---------------------- | -------------- |
| 0                     | 0                      | hold           |
| ≥ 1                   | 0                      | advance        |
| ≥ 1                   | ≥ 1                    | slow           |
| 0                     | ≥ 1                    | defer          |

"Recent" is bounded by a configurable window (default 14 clock ticks).

## 6. Sensitivity rules (deterministic)

- `elevated` — current state is `continuity_debt_elevated` or
  `governance_recovery_active`, OR progression band is `regressing`.
- `high` — both of the above OR a recent intervention has regressed
  without recovery proposal.
- `none` — otherwise.

## 7. Readiness conditions (composed, never about persons)

- Governance ratification capacity present.
- Carrier consent capture mechanism available.
- Reversibility window not exhausted on any active intervention.
- Workbook completion threshold met.

If any condition is unmet, the runtime emits
`facilitator_readiness_insufficient` with the specific unmet
conditions named. The facilitator decides; the runtime does not act.

## 8. Overload protection

If the count of active interventions exceeds the configured
bandwidth threshold (default 6), the runtime emits
`facilitator_overload_protection_engaged` and recommends `slow`
regardless of pacing rule output.

## 9. Ethics binding

This runtime exists to **slow** interventions, not to accelerate
them. Every signal can defer; no signal forces action. The
facilitator remains the sole agent.

Cross-references:
- `OCI_INTERVENTION_ETHICS.md`
- `OCI_ANTI_SURVEILLANCE_POSITION.md`
- `OCI_AI_BOUNDARY.md`
- `OCI_DATA_HANDLING.md`

## 10. Persistence sketch (non-binding)

```
oci_facilitator_session (
  institution_id text,
  session_at timestamptz,
  pacing text check (pacing in ('advance','hold','slow','defer')),
  sensitivity text check (sensitivity in ('none','elevated','high')),
  overload_engaged boolean,
  unmet_readiness_conditions text[]
)
```

Non-binding. Product 3 does not create this table.
