# OCI Governance Memory Runtime™

**Status:** Doctrine for the Governance Memory Runtime™, the institutional rationale persistence layer of OCI Runtime Infrastructure™ (Product 4).

**Audience:** Stewards of the runtime, certified facilitators, engineering stewards of `apps/union-eyes/lib/runtime/governance-memory/`.

---

## 1. Purpose

The Governance Memory Runtime preserves institutional rationale so successor stewards inherit not only what was decided but why it was decided. The runtime is reviewer-led, anti-surveillance, and refusable.

The runtime does NOT:

- infer intent,
- rank people,
- automate governance authority,
- or generate institutional truth autonomously.

The runtime DOES:

- record rationale a reviewer has stated,
- read rationale on reviewer-led request, within institution scope,
- compose a refusable summary suitable for executive readings.

---

## 2. Subject kinds

A rationale envelope is recorded against one of the following subject kinds (`RationaleSubjectKind`):

- `governance_decision` — a governance body decision recorded by a reviewer.
- `modernization_decision` — a modernization decision with continuity implications.
- `stewardship_transition` — a redistribution event with stated rationale.
- `operational_interpretation` — a reviewer-led interpretation of an operational artefact.
- `continuity_sensitive_change` — a change whose continuity sensitivity is the rationale.

The runtime does not invent new subject kinds. Extending the list is a doctrinal change requiring an update to this document and to `runtimeRationaleEnvelope.ts`.

---

## 3. Persistence posture

`governanceLineagePersistence.ts` provides an in-memory `LineageStore` for deterministic composition. At-rest persistence is governed by `OCI_DATA_HANDLING.md` and the institution's own data residency posture. The runtime does not select a storage technology on behalf of the institution.

Stored envelopes are append-only in the composition surface. Superseding rationale is recorded as a new envelope carrying a lineage reference back to the superseded envelope.

---

## 4. Refusal as the default

If rationale is missing, the runtime reports `not_yet_readable`. It does not fabricate rationale. If the institution scope of a read request does not match the institution scope of the stored envelope, the read is refused with `institution_scope_mismatch`.

---

## 5. Reviewer traceability

Every recorded envelope carries a `reviewerRefId`. The runtime never resolves this to a personal name; the institution's own directory is the source of resolution. This is consistent with `OCI_ANTI_SURVEILLANCE_POSITION.md`.

---

## 6. Boundaries

The Governance Memory Runtime is not:

- a workflow engine,
- an approval system,
- a notification engine,
- an analytics surface.

It is a deterministic, refusable rationale persistence layer.

---

## 7. Cross-references

- `docs/oci/OCI_ANTI_SURVEILLANCE_POSITION.md`
- `docs/oci/OCI_AI_BOUNDARY.md`
- `docs/oci/OCI_DATA_HANDLING.md`
- `docs/oci/runtime/OCI_RUNTIME_CONTRACTS.md`
- `docs/oci/runtime/OCI_EVENT_RUNTIME.md`
- `docs/oci/runtime/OCI_CONTINUITY_LEDGER.md`
- `docs/oci/stabilization/OCI_RUNTIME_ALIGNMENT.md`
