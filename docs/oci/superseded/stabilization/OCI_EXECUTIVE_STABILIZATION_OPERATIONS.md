# OCI Executive Stabilization Operations

DOCTRINE_VERSION: 2.0.0
STATUS: Operational doctrine (Product 3)

## 1. Purpose

This document specifies how OCI Method™ presents stabilization
operations to an executive reader (board, CEO, executive sponsor). The
surface is **calm**, **institutional**, **categorical**, and explicitly
**not a dashboard of individuals**.

The executive operations reader composes:

- `stabilizationStateEngine` (current legal state)
- `interventionTrackingEngine` (ratified intervention ledger)
- `stabilizationProgressionReader` (progression band)
- `ociMaturityPathway` (Method-spine placement)
- `institutionalEvolutionTracker` (lineage trajectory)

## 2. The eight executive domains

| # | Domain                          | What it reads                                                |
| - | ------------------------------- | ------------------------------------------------------------ |
| 1 | Stabilization state             | Current legal state from the state engine.                   |
| 2 | Progression direction           | Categorical band (advancing / holding / regressing / not yet).|
| 3 | Maturity placement              | Current Method stage + legal next stage.                     |
| 4 | Intervention ledger health      | Ratified vs reversed; stalled awaiting ratification.         |
| 5 | Stewardship redistribution      | Reciprocity-ratified and carrier-consented redistributions.  |
| 6 | Governance recovery             | Recovery moves logged and ratified.                          |
| 7 | Onboarding survivability        | Onboarding stabilization workflows in progress / completed.  |
| 8 | Continuity operational health   | Composite categorical reading across domains 1–7.            |

## 3. What is NOT in the executive surface

- No individual carrier names.
- No behavioural analytics, sentiment, defensiveness, or readiness
  scoring of persons.
- No predictive claims.
- No numeric "OCI score".
- No leaderboards, no rankings, no comparisons across institutions.
- No "optimization" framing.

## 4. Tone register

Calm institutional present-tense. No urgency framing. No blame. Names
what is ratified, what is pending, what is deferred. Names what cannot
yet be read and why.

## 5. Categorical health bands

Composite operational health is one of four bands:

- `not_yet_readable` — too little ratified activity to read.
- `holding` — recovery preserved, no net movement.
- `stabilizing` — ratified moves are producing forward progression on
  at least one domain without regression on the others.
- `regressing` — recovery has been lost on at least one domain.

These bands are **categorical**. They are never expressed as numbers.

## 6. Signal envelope shape

Executive signals use the canonical envelope:

```ts
{
  signalId: string;          // stable, deterministic
  severity: 'note' | 'observation' | 'warning' | 'critical';
  category: string;          // executive_domain or executive_health
  statement: string;         // calm institutional reading
  evidence: Readonly<Record<string, unknown>>;
}
```

`ENGINE_VERSION='2.0.0'`. Signals are stably sorted by `signalId`.

## 7. Persistence sketch (non-binding)

```
oci_executive_reading (
  institution_id text,
  read_at timestamptz,
  health_band text,
  per_domain jsonb
)
```

Non-binding. Product 3 does not create this table.

## 8. Cross-references

- `OCI_ANTI_SURVEILLANCE_POSITION.md`
- `OCI_AI_BOUNDARY.md`
- `OCI_DATA_HANDLING.md`
- `OCI_STABILIZATION_PROGRESSION.md`
- `OCI_STABILIZATION_STATE_ENGINE.md`
- `OCI_CONTINUITY_INTERVENTION_TRACKING.md`
