# Cross-Product Governance Runtime Fabric

> **Status:** Canonical runtime governance · **Layer:** Cross-product runtime fabric · **Inherits:** [../nzila-governance-operations/cross-product-governance-operations-fabric.md](../nzila-governance-operations/cross-product-governance-operations-fabric.md), [governance-telemetry-architecture.md](governance-telemetry-architecture.md)

The **cross-product governance runtime fabric** is the layer that ensures runtime governance behaves coherently across Union Eyes, FairCase, ExecutiveOS, Veridian, and future Nzila systems. Each product is doctrinally distinct; each product's governance runtime must speak the same wire and honor the same shared contracts.

---

## 1. Posture

The fabric:

- **Defines** shared governance contracts that every product implements
- **Defines** shared telemetry envelopes that every product emits
- **Defines** shared attestation standards that every product produces
- **Defines** shared continuity observability semantics
- **Defines** shared doctrine enforcement primitives
- **Establishes** cross-product governance lineage that is reviewable end-to-end

The fabric does not absorb product distinctness. It ensures that shared *governance behavior* travels with each product.

---

## 2. Shared Governance Contracts

| Contract | What It Specifies |
|----------|-------------------|
| Doctrine citation contract | How any product cites doctrine in any decision |
| Governance event envelope | The canonical envelope from [governance-telemetry-architecture](governance-telemetry-architecture.md) |
| Evidence record contract | The canonical record shape from [governance-evidence-ledger](governance-evidence-ledger.md) |
| Attestation contract | The canonical envelope from [runtime-attestation-pipeline](runtime-attestation-pipeline.md) |
| Policy registration contract | The canonical policy shape from [governance-policy-engine](governance-policy-engine.md) |
| Continuity observability contract | The canonical posture indicator shape |
| Cognitive safety contract | The thresholds and event types from [executive-cognitive-safety-monitoring](executive-cognitive-safety-monitoring.md) |
| AI capability registration contract | The canonical AI capability registration shape |

Contracts live in the [governance-runtime](../../packages/governance-runtime), [governance-telemetry](../../packages/governance-telemetry), [doctrine-enforcement](../../packages/doctrine-enforcement), [continuity-observability](../../packages/continuity-observability), [runtime-attestation](../../packages/runtime-attestation), and [assurance-engine](../../packages/assurance-engine) packages.

---

## 3. Shared Telemetry Models

- One envelope across Union Eyes, FairCase, ExecutiveOS, Veridian
- One severity vocabulary
- One scope vocabulary (product / environment / pilot / org)
- One doctrine citation format
- One release-id and environment-id binding

A product that emits its own telemetry shape outside the contract breaks the fabric.

---

## 4. Shared Attestation Standards

- One attestation envelope
- One verdict vocabulary (`verified` / `partial` / `unverified` / `rejected`)
- One signing posture progression (unsigned → signed → externally verifiable)
- One supersession discipline

Cross-product certification engagements depend on this commonality.

---

## 5. Shared Continuity Observability

- One posture vocabulary (`stable` / `warming` / `concerning` / `destabilizing`)
- One trajectory vocabulary (`improving` / `stable` / `drifting`)
- One scope vocabulary (route / surface / workflow / queue / environment)
- One stabilization recommendation shape

---

## 6. Shared Doctrine Enforcement Primitives

- Common middleware shape (HTTP / RPC / event)
- Common assertion library
- Common emitter binding to telemetry
- Common policy evaluation entry point

Each product wires these primitives into its own runtime; the primitives themselves are uniform.

---

## 7. Cross-Product Governance Lineage

A governance lineage is the trace of:

- Doctrine → policy → enforcement decision → governance event → ledger record → attestation → procurement evidence pack

The fabric guarantees this lineage is reconstructable across products. A regulator examining UE evidence can find the doctrine source the same way they would for FairCase.

---

## 8. Product-Level Distinctness Preserved

The fabric specifies the shared spine. It does **not** specify:

- Which doctrine policies a product registers (within shared contracts)
- Which surfaces a product instruments
- Product-specific governance forums
- Product-specific evidence types beyond shared classes

Products are doctrinally distinct. The fabric is the discipline of shared coherence beneath that distinctness.

---

## 9. Versioning Across Products

- Contract versions are global; products opt into version uplifts at governance review cadence
- A product running an older contract version remains in the fabric until uplift, with the older version explicitly recorded
- Cross-product surfaces (procurement packs, regulator submissions) honor the lowest active version among contributors

---

## 10. Anti-Patterns

- Per-product telemetry shapes
- Per-product attestation envelopes
- Per-product severity vocabularies
- Shadow contracts ("we'll just emit our own format")
- Cross-product behavioral correlation
- Governance event leakage between products outside contract paths
- Marketing presentation of fabric as "unified governance" without attestation backing

---

## 11. Discipline

The fabric is the discipline of saying *every Nzila product behaves as governed in the same wire-level way.* It is what makes cross-product institutional trust real, rather than per-product marketing.

A regulator, procurement officer, or future certification body that touches any Nzila product touches the same governance fabric. That is the institutional commitment this layer encodes.
