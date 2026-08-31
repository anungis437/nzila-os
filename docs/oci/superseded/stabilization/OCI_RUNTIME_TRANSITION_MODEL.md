# OCI Runtime Transition Model

DOCTRINE_VERSION: 2.0.0
STATUS: Operational doctrine (Product 3)

## 1. Purpose

This document specifies the five named runtime transitions that
govern movement out of OCI Method™ Product 3 (Stabilization) into
later products. Each transition is **gated** by deterministic
preconditions and **consent-bound**.

## 2. The five transitions

| # | Name                                          | From → To                                          |
| - | --------------------------------------------- | --------------------------------------------------- |
| 1 | `stabilization_to_commercial_pilot`           | P3 stabilized → P4 commercial pilot scoping         |
| 2 | `stabilization_to_continuity_operationalization` | P3 stabilized → ongoing operationalization layer  |
| 3 | `stabilization_to_longitudinal_monitoring`    | P3 stabilized → P5 longitudinal foundations         |
| 4 | `stabilization_to_governance_reaffirmation`   | P3 stabilized → governance ratification rhythm      |
| 5 | `stabilization_to_continued_facilitation`     | P3 stabilized → continued facilitated stewardship   |

A transition is **offered**, never imposed. The facilitator and the
governance authority decide.

## 3. Gates

Every transition requires ALL of:

1. Current state is `continuity_stabilized` or
   `longitudinal_monitoring` from `stabilizationStateEngine`.
2. Progression band is `holding`, `advancing`, or
   `longitudinal_monitoring` — never `regressing`.
3. No active intervention has exhausted its reversibility window.
4. Readiness conditions from `OCI_FACILITATOR_RUNTIME.md` §7 are
   sufficient.
5. Transition-specific gate (see §4).

If any gate fails the transition is **refused** with the failing
gate named.

## 4. Transition-specific gates

- `stabilization_to_commercial_pilot` — at least one
  `stewardship_redistribution` intervention is irreversibly ratified.
- `stabilization_to_continuity_operationalization` — composite
  operational health is `holding` or `stabilizing`.
- `stabilization_to_longitudinal_monitoring` — institutional
  evolution direction is `advancing` or `holding`.
- `stabilization_to_governance_reaffirmation` — at least one
  governance recovery move has been ratified.
- `stabilization_to_continued_facilitation` — facilitator sensitivity
  register is `elevated` or `high` (the runtime recommends continued
  facilitation when sensitivity is non-zero).

## 5. Consent capture

The transition engine **records** consent intent (proposed,
captured, declined). It does **not** verify identity, signatures, or
legal binding. Consent capture is a sketch only.

## 6. Readiness reverification

Before any transition is offered, all four readiness conditions
from `OCI_FACILITATOR_RUNTIME.md` §7 are reverified. Stale readings
are rejected; a fresh reading is required.

## 7. Persistence sketch (non-binding)

```
oci_runtime_transition (
  institution_id text,
  proposed_at timestamptz,
  transition_name text,
  disposition text check (disposition in ('offered','refused','deferred')),
  failed_gates text[],
  consent_status text
)
```

Non-binding. Product 3 does not create this table.

## 8. Cross-references

- `OCI_STABILIZATION_STATE_ENGINE.md`
- `OCI_FACILITATOR_RUNTIME.md`
- `OCI_EXECUTIVE_STABILIZATION_OPERATIONS.md`
- `OCI_INTERVENTION_ETHICS.md`
