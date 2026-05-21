# OCI Runtime Contracts

**Status:** Canonical contract surface for OCI Runtime Infrastructure™ (Product 4).

**Audience:** Stewards of the runtime, certified facilitators, engineering stewards of `apps/union-eyes/lib/runtime/`.

---

## 1. Purpose

This document defines the contracts that flow between OCI runtime engines. The contracts are deliberately narrow: every contract carries the minimum institutional context required to remain readable, and never more.

The contracts are read-only with respect to the institution. No contract here authorises a write back to the institution's governance record. Persistence is reviewer-led and bounded by `OCI_DATA_HANDLING.md`.

---

## 2. Posture

Every contract holds the following posture:

- **Read-only.** A contract may be observed, composed, and rendered to a facilitator. It is never an authorisation to act upon the institution.
- **Reviewer-led.** Every contract that references a governance memory carries a `reviewerRefId` so the lookup remains traceable to a named reviewer.
- **Anti-surveillance.** No contract carries personally identifying details. Role-states are used in place of personal identifiers (see `OCI_ANTI_SURVEILLANCE_POSITION.md`).
- **Refusal-friendly.** Optional fields are genuinely optional; missing values never imply absence of the underlying institutional reality.

---

## 3. Contract surface

The contract surface is defined in `apps/union-eyes/lib/runtime/contracts/runtimeContracts.ts`. The following contracts are exported:

| Contract                          | Purpose                                                                                  |
| --------------------------------- | ---------------------------------------------------------------------------------------- |
| `RuntimeLineageReference`         | Read-only handle to an upstream institutional artefact (ratification, intervention, etc.). |
| `GovernanceMemoryReference`       | Read-only handle to a rationale envelope persisted by the Governance Memory Runtime.     |
| `ContinuityRuntimeContext`        | Minimal context an operational system needs to behave continuity-aware without inferring intent. |
| `ContinuityEventEnvelope`         | Canonical envelope for discrete continuity events emitted by the Continuity Event Runtime. |
| `StewardshipTransferRecord`       | Read-only record of a stewardship redistribution event.                                  |
| `OnboardingSurvivabilityRecord`   | Read-only record of an onboarding artefact's contribution to survivability.              |
| `RuntimeContinuitySignal`         | Canonical envelope for continuous readings emitted by runtime engines.                   |

---

## 4. Validators

`runtimeEnvelopeValidators.ts` provides refusal-first validators. Validators never coerce, never default-fill, and never authorise an envelope that fails any structural check. They report what is missing in machine-readable violation codes.

---

## 5. Versioning

`RUNTIME_CONTRACT_VERSION` is the single version constant. Contract evolution is doctrinal: a breaking change requires a corresponding update to the consuming engines and to the runtime documentation in `docs/oci/runtime/`.

---

## 6. Boundaries

The runtime contracts do not:

- generate the artefacts they reference,
- persist the artefacts they reference,
- transmit the artefacts they reference outside the institution scope,
- compose readings about individuals.

These boundaries are enforced by invariant tests in `apps/union-eyes/lib/runtime/__tests__/`.

---

## 7. Cross-references

- `docs/oci/OCI_ANTI_SURVEILLANCE_POSITION.md`
- `docs/oci/OCI_AI_BOUNDARY.md`
- `docs/oci/OCI_DATA_HANDLING.md`
- `docs/oci/stabilization/OCI_RUNTIME_ALIGNMENT.md`
- `docs/oci/runtime/OCI_EVENT_RUNTIME.md`
- `docs/oci/runtime/OCI_GOVERNANCE_MEMORY_RUNTIME.md`
- `docs/oci/runtime/OCI_CONTINUITY_LEDGER.md`
