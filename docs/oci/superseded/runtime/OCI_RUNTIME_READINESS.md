# OCI Runtime Readiness™

**Status:** Doctrine for the runtime readiness layer of OCI Runtime Infrastructure™ (Product 4).

**Audience:** Stewards of the runtime, certified facilitators, engineering stewards of `apps/union-eyes/lib/runtime/readiness/`.

---

## 1. Purpose

Runtime Readiness composes six conditions into a single refusable reading suitable for an executive reading. The reading describes whether the runtime is sufficient for the institution to operate continuity-aware. The reading is not a permission slip.

---

## 2. The six conditions

| Condition                              | What it reads                                                                                  |
| -------------------------------------- | ---------------------------------------------------------------------------------------------- |
| `stabilization_maturity_sufficient`    | Whether stabilization maturity has reached a sufficient reading per Product 3.                 |
| `governance_ratification_present`      | Whether reviewer-led governance ratification has been recorded for the runtime.                |
| `redistribution_pathways_stable`       | Whether stewardship redistribution pathways present as stable.                                 |
| `continuity_debt_reduced`              | Whether continuity debt has been reduced relative to a prior reading.                          |
| `onboarding_survivability_active`      | Whether onboarding workflows are actively contributing to survivability.                       |
| `runtime_ethics_alignment_verified`    | Whether runtime ethics alignment (anti-surveillance, AI boundary) has been verified.           |

Each condition takes the state `sufficient`, `not_yet_sufficient`, or `not_yet_readable`. The engine never infers a condition from another condition.

---

## 3. The reading

`readRuntimeReadiness(inputs, institutionScope)` returns:

- per-condition statements (the executive can read them aloud),
- a count of sufficient conditions,
- an overall reading: `sufficient` only when every condition is sufficient; `not_yet_sufficient` if any is `not_yet_sufficient`; `not_yet_readable` only when every condition is `not_yet_readable`.

---

## 4. Posture

- **Refusal-first.** Missing conditions collapse to `not_yet_readable`.
- **No coercion.** The engine reports conditions; it never recommends action.
- **Deterministic.** Stable signal ordering.
- **Statement-led.** Per-condition statements are designed to be spoken in a reviewer-led executive reading.

---

## 5. Boundaries

The Readiness Engine is not:

- a permission system,
- a release gate,
- an SLA report,
- a maturity model.

It is a deterministic, refusable composition of six institutional readings.

---

## 6. Cross-references

- `docs/oci/OCI_ANTI_SURVEILLANCE_POSITION.md`
- `docs/oci/OCI_AI_BOUNDARY.md`
- `docs/oci/runtime/OCI_RUNTIME_CONTRACTS.md`
- `docs/oci/runtime/OCI_OPERATING_PRIMITIVES.md`
- `docs/oci/runtime/OCI_GOVERNANCE_MEMORY_RUNTIME.md`
- `docs/oci/runtime/OCI_GOVERNANCE_TRACEABILITY.md`
- `docs/oci/stabilization/OCI_RUNTIME_ALIGNMENT.md`
