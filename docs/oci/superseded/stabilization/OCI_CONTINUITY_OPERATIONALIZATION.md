# OCI Continuity Operationalization

DOCTRINE_VERSION: 2.0.0
STATUS: Operational doctrine (Product 3)

## 1. Purpose

This document specifies the six operationalization domains where
continuity-sensitive checks attach to the institutional operating
rhythm. The hooks are **declarative** — they name where checks
attach, not how they execute.

## 2. The six operationalization domains

| # | Domain                                  | Hook intent                                                  |
| - | --------------------------------------- | ------------------------------------------------------------ |
| 1 | `governance_ratification_cycle`         | Re-check stewardship ratification at each governance cycle. |
| 2 | `onboarding_intake_rhythm`              | Re-check survivability at each onboarding intake.            |
| 3 | `carrier_change_event`                  | Re-check carrier consent on any carrier change.              |
| 4 | `intervention_reversibility_window_end` | Re-check reversibility before any window closes.             |
| 5 | `executive_reporting_cycle`             | Re-read executive composite health each executive cycle.     |
| 6 | `longitudinal_reading_cycle`            | Re-read evolution and progression each longitudinal cycle.   |

## 3. Hooks are inert when readiness is insufficient

Each hook composes the readiness reading from
`OCI_FACILITATOR_RUNTIME.md` §7. If readiness is insufficient the
hook emits a `hook_deferred_readiness_insufficient` signal and
takes no further action.

## 4. What hooks are NOT

- Not background workers. No daemons. No schedulers.
- Not transactional. No DB writes.
- Not authoritative. The facilitator and governance authority
  remain the sole agents.
- Not predictive. Hooks read deterministically.

## 5. Governance posture

Hooks are **observational**. Their output is a signal envelope that
the facilitator can read. They do not advance state. They do not
ratify interventions. They do not consent on behalf of carriers.

## 6. Persistence sketch (non-binding)

```
oci_operationalization_reading (
  institution_id text,
  read_at timestamptz,
  domain text,
  signal_id text,
  severity text
)
```

Non-binding.

## 7. Cross-references

- `OCI_FACILITATOR_RUNTIME.md`
- `OCI_EXECUTIVE_STABILIZATION_OPERATIONS.md`
- `OCI_AI_BOUNDARY.md`
- `OCI_ANTI_SURVEILLANCE_POSITION.md`
