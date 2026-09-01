# OCI Continuity Ledger™

**Status:** Doctrine for the institutional continuity persistence layer of OCI Runtime Infrastructure™ (Product 4).

**Audience:** Stewards of the runtime, certified facilitators, engineering stewards of `apps/union-eyes/lib/runtime/ledger/`.

---

## 1. What this is not

The Runtime Continuity Ledger™ is **not**:

- blockchain infrastructure,
- immutable-hype architecture,
- audit-theatre,
- crypto logic of any kind.

It does not produce tokens, mine hashes, or compose distributed consensus. It is an institutional continuity persistence layer.

---

## 2. What this is

The ledger preserves:

- governance lineage,
- operational continuity references,
- continuity transitions,
- stewardship redistribution lineage,
- onboarding survivability evolution,
- runtime continuity state history.

The ledger is human-readable, institution-scoped, and reviewer-led. Every entry is composed under the same posture as every other artefact in OCI Runtime Infrastructure™.

---

## 3. Entry kinds

`LedgerEntryKind` is closed:

| Kind                                       | Purpose                                                                                  |
| ------------------------------------------ | ---------------------------------------------------------------------------------------- |
| `governance_lineage`                       | A governance decision's continuity lineage.                                              |
| `operational_continuity_reference`         | An operational artefact's continuity reference.                                          |
| `continuity_transition`                    | A P3 → P4 runtime transition activation, ratified.                                       |
| `stewardship_redistribution_lineage`       | A stewardship redistribution event's lineage.                                            |
| `onboarding_survivability_evolution`       | An onboarding survivability evolution observation.                                       |
| `runtime_continuity_state_history`         | A runtime continuity state history entry.                                                |

Extending the list is a doctrinal change requiring updates to `continuityLedgerContracts.ts` and this document.

---

## 4. Append-only posture

Entries are append-only in the composition surface. Superseding entries carry a `supersedesEntryId` reference back to the entry they supersede. The ledger does not edit entries in place and does not delete entries.

At-rest persistence is governed by `OCI_DATA_HANDLING.md`. This runtime ships an in-memory composition surface only; the institution selects the storage technology.

---

## 5. Refusable reads

`readLedgerSummary(reader, options)` returns a refusable summary suitable for an executive reading. If no entries exist, the summary is `not_yet_readable`. If the reader cannot authorise the read (missing `reviewerRefId` or `institutionScope`), the list is empty.

---

## 6. Boundaries

The ledger is not:

- a search engine,
- a query layer,
- a metrics system,
- a public record.

It is a deterministic, refusable, append-only continuity persistence surface.

---

## 7. Cross-references

- `docs/oci/OCI_ANTI_SURVEILLANCE_POSITION.md`
- `docs/oci/OCI_AI_BOUNDARY.md`
- `docs/oci/OCI_DATA_HANDLING.md`
- `docs/oci/runtime/OCI_RUNTIME_CONTRACTS.md`
- `docs/oci/runtime/OCI_GOVERNANCE_MEMORY_RUNTIME.md`
- `docs/oci/runtime/OCI_EVENT_RUNTIME.md`
- `docs/oci/runtime/OCI_GOVERNANCE_TRACEABILITY.md`
