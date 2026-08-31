# OCI Platform Runtime Alignment™

**Status:** Doctrine for how OCI Runtime Infrastructure™ (Product 4) aligns to the Nzila / Union Eyes platform.

**Audience:** Stewards of the runtime, certified facilitators, platform engineering stewards.

---

## 1. Purpose

Product 4 turns OCI from a method (Product 1), a measurement infrastructure (Product 2), and a stabilization infrastructure (Product 3) into runtime infrastructure that the platform composes alongside its operational systems. This document records how the runtime composes alongside the platform without absorbing the platform's authority.

---

## 2. Composition, not orchestration

The runtime composes refusable readings. It does not orchestrate the platform. Specifically:

- The runtime never advances a workflow step.
- The runtime never persists at rest on the platform's behalf.
- The runtime never resolves a reviewer reference into a personal name.
- The runtime never publishes or notifies.

The platform retains operational authority. The runtime composes the reading the institution then acts upon.

---

## 3. Layer-by-layer alignment

| Runtime layer                          | Platform alignment posture                                                                          |
| -------------------------------------- | --------------------------------------------------------------------------------------------------- |
| Runtime contracts                      | Single source of truth for shapes flowing between platform engines.                                 |
| Governance memory                      | Platform supplies storage technology; runtime supplies composition surface.                         |
| Operating primitives                   | Platform actions decorate themselves with continuity context; runtime never decorates them.         |
| Continuity event runtime               | Platform supplies events; runtime composes refusable summaries.                                     |
| Continuity ledger                      | Append-only composition surface; platform supplies storage and access control.                      |
| Onboarding runtime                     | Platform owns onboarding workflows; runtime reads survivability records.                            |
| Workflow runtime                       | Platform owns workflow advancement; runtime returns a refusable per-step reading.                   |
| Stewardship runtime                    | Platform owns role-state assignment; runtime reads concentration and dependency evolution.          |
| Governance traceability                | Runtime reads trail sufficiency; platform owns the trail itself.                                    |
| Runtime readiness                      | Runtime composes six conditions; platform owns each condition's evidence.                           |
| Runtime continuity reporting           | Runtime composes an optional appendix to the executive reading; platform owns the reading.          |

---

## 4. Anti-surveillance and AI boundary

The runtime preserves the institution's anti-surveillance posture (`OCI_ANTI_SURVEILLANCE_POSITION.md`) and AI boundary (`OCI_AI_BOUNDARY.md`). The platform must not introduce identifiers or AI inference into these surfaces.

---

## 5. Versioning

All runtime modules carry a per-module version constant. Contracts carry `RUNTIME_CONTRACT_VERSION = '1.0.0'`. Breaking changes to a contract require:

- a doctrinal change to `OCI_RUNTIME_CONTRACTS.md`,
- a major version bump on the contract constant,
- a migration note in this document.

---

## 6. Cross-references

- `docs/oci/OCI_ANTI_SURVEILLANCE_POSITION.md`
- `docs/oci/OCI_AI_BOUNDARY.md`
- `docs/oci/OCI_DATA_HANDLING.md`
- `docs/oci/runtime/OCI_RUNTIME_CONTRACTS.md`
- `docs/oci/runtime/OCI_GOVERNANCE_MEMORY_RUNTIME.md`
- `docs/oci/runtime/OCI_OPERATING_PRIMITIVES.md`
- `docs/oci/runtime/OCI_EVENT_RUNTIME.md`
- `docs/oci/runtime/OCI_CONTINUITY_LEDGER.md`
- `docs/oci/runtime/OCI_ONBOARDING_RUNTIME.md`
- `docs/oci/runtime/OCI_WORKFLOW_RUNTIME.md`
- `docs/oci/runtime/OCI_RUNTIME_STEWARDSHIP.md`
- `docs/oci/runtime/OCI_GOVERNANCE_TRACEABILITY.md`
- `docs/oci/runtime/OCI_RUNTIME_READINESS.md`
- `docs/oci/stabilization/OCI_RUNTIME_ALIGNMENT.md`
