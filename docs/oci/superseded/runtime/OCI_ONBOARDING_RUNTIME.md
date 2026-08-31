# OCI Onboarding Runtime™

**Status:** Doctrine for the onboarding survivability and stewardship transfer reading layer of OCI Runtime Infrastructure™ (Product 4).

**Audience:** Stewards of the runtime, certified facilitators, engineering stewards of `apps/union-eyes/lib/runtime/onboarding/`.

---

## 1. Purpose

Onboarding workflows are operational artefacts authored and operated by the institution. The Onboarding Runtime never authors, runs, or orchestrates onboarding workflows. It reads three things and composes refusable observations:

- the survivability contribution of onboarding workflows (`onboardingRuntime.ts`),
- the continuity carried by stewardship transfers (`continuityTransferRuntime.ts`),
- the readiness of successor stewardship as the institutional composition of the above (`successorStewardshipRuntime.ts`).

---

## 2. Posture

- **Refusal-first.** Empty inputs collapse to `not_yet_readable`; the runtime does not interpolate.
- **Deterministic.** Stable ordering on signals (`signalId.localeCompare`).
- **No personal identifiers.** Records carry workflow refIds and reviewer refIds, never names.
- **No ranking of individuals.** The runtime reports institutional readings only; it does not score successor stewards.
- **Cross-institution scope mismatch is refused** rather than coerced.

---

## 3. Bands

All three readings produce one of `not_yet_readable | holding | stabilizing | regressing`. The composition runtime selects the weakest available band rather than a numeric average, because continuity is read by its most fragile point.

---

## 4. Boundaries

The Onboarding Runtime is not:

- a workflow engine,
- an HR system,
- an LMS,
- a performance system,
- a successor planning system.

It is a deterministic, refusable reader of survivability and stewardship transfer records.

---

## 5. Cross-references

- `docs/oci/OCI_ANTI_SURVEILLANCE_POSITION.md`
- `docs/oci/OCI_AI_BOUNDARY.md`
- `docs/oci/runtime/OCI_RUNTIME_CONTRACTS.md`
- `docs/oci/runtime/OCI_RUNTIME_STEWARDSHIP.md`
- `docs/oci/runtime/OCI_RUNTIME_READINESS.md`
- `docs/oci/stabilization/OCI_RUNTIME_ALIGNMENT.md`
