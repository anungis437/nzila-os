# OCI Operating Primitives™

**Status:** Doctrine for the continuity-native operating primitives that decorate operational actions inside OCI Runtime Infrastructure™ (Product 4).

**Audience:** Stewards of the runtime, engineering stewards of `apps/union-eyes/lib/runtime/primitives/`.

---

## 1. Purpose

Continuity must become an operational primitive, not a reporting artefact. The primitives in this layer let an operational system describe a critical action in continuity-native terms while leaving the action itself entirely under the institution's authority.

---

## 2. The primitives

### 2.1 Continuity Context

`composeContinuityRuntimeContext(input)` returns a `ContinuityRuntimeContext` carrying:

- the institution scope,
- continuity sensitivity (`unknown | standard | continuity_sensitive | continuity_critical`),
- a governance lineage (zero or more `RuntimeLineageReference`s),
- the stewardship concentration band,
- the survivability band,
- whether readiness is sufficient.

Missing inputs collapse to `not_yet_readable` or `false`. The runtime does not guess.

### 2.2 Governance Lineage

A critical action carries a `governanceLineage: readonly RuntimeLineageReference[]`. An empty lineage is itself an institutional observation, not a defect; the runtime reports it as `governanceLineage_empty` rather than fabricating a reference.

### 2.3 Stewardship Sensitivity

`readStewardshipSensitivity(ctx)` returns a refusable reading classifying the action as sensitive if any of:

- the stewardship concentration band is `regressing`,
- the survivability band is `regressing`,
- the sensitivity is `continuity_sensitive` or `continuity_critical`.

This is not a score. There is no numeric weight.

### 2.4 Continuity Traceability

`readTraceability(annotation)` reports whether a `CriticalActionAnnotation` carries the minimum institutional context required to be re-read by a successor steward. The reading is binary at the structural level; institutional traceability remains the institution's own judgment.

---

## 3. Posture

- **Read-only with respect to the action.** The primitives decorate; they do not alter.
- **Refusal-friendly.** Missing metadata is reported in machine-readable codes; defaults never fill the gap.
- **Anti-surveillance.** Actor identifiers are reviewer references, never names.

---

## 4. Cross-references

- `docs/oci/OCI_ANTI_SURVEILLANCE_POSITION.md`
- `docs/oci/OCI_DATA_HANDLING.md`
- `docs/oci/runtime/OCI_RUNTIME_CONTRACTS.md`
- `docs/oci/runtime/OCI_GOVERNANCE_MEMORY_RUNTIME.md`
- `docs/oci/runtime/OCI_WORKFLOW_RUNTIME.md`
