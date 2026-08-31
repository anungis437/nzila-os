# OCI Runtime Stewardship™

**Status:** Doctrine for the runtime stewardship infrastructure of OCI Runtime Infrastructure™ (Product 4).

**Audience:** Stewards of the runtime, engineering stewards of `apps/union-eyes/lib/runtime/stewardship/`.

---

## 1. Purpose

The Runtime Stewardship Infrastructure reads two institutional movements:

- the concentration of stewardship across role-states (`runtimeStewardshipEngine.ts`),
- the evolution of operational dependency on single stewards or systems (`dependencyEvolutionRuntime.ts`).

Both readings are refusable. Neither names individuals. Neither ranks people.

---

## 2. Stewardship concentration

`readStewardshipConcentration(transfers, institutionScope)` returns:

- the number of transfers in scope,
- the number of distinct destination role-states,
- the number of reversible transfers,
- the number of consent-recorded transfers,
- a continuity band derived **only** from structural properties of the transfer set:
  - `regressing` if every destination role-state collapses to one, or if any transfer lacks recorded consent,
  - `holding` if there are at least three distinct destinations and at least one transfer remains reversible,
  - `stabilizing` otherwise.

The runtime does not score concentration on a numeric scale. The band is the institutional reading.

---

## 3. Dependency evolution

`readDependencyEvolution(observations, institutionScope)` reads a sequence of dependency observations (each carrying a `functionRefId` and a `singlePointDependencyCount`) and reports:

- `stabilizing` if the latest count is below the earliest,
- `holding` if equal,
- `regressing` if above,
- `not_yet_readable` if fewer than two observations are scoped to the institution.

---

## 4. Posture

- **Refusal-first.** Single observations and empty sequences are `not_yet_readable`.
- **Deterministic.** Stable signal ordering.
- **Anti-surveillance.** Observations carry function refIds and role-state strings; no names.
- **No coercion.** Bands are reported as institutional readings; the runtime never converts them to scores.

---

## 5. Cross-references

- `docs/oci/OCI_ANTI_SURVEILLANCE_POSITION.md`
- `docs/oci/runtime/OCI_RUNTIME_CONTRACTS.md`
- `docs/oci/runtime/OCI_ONBOARDING_RUNTIME.md`
- `docs/oci/runtime/OCI_RUNTIME_READINESS.md`
- `docs/oci/stabilization/STEWARDSHIP_REDISTRIBUTION.md`
