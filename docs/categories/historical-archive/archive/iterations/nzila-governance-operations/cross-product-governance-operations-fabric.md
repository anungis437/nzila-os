# Cross-Product Governance Operations Fabric

> **Status:** Canonical governance operations · **Layer:** Cross-product fabric · **Inherits:** [cross-product-governance-runtime-activation.md](../nzila-runtime-integration/cross-product-governance-runtime-activation.md)

## 1. Objective

Standardize governance operations across Union Eyes, FairCase, ExecutiveOS, Veridian, and any future Nzila product so the institution speaks one governance operations language.

## 2. Standardized contracts

| Contract | Source of truth |
|---|---|
| Posture banding shape | [@nzila/assurance-engine](../../packages/assurance-engine) |
| Continuity posture + trajectory | [@nzila/continuity-observability](../../packages/continuity-observability) |
| Attestation envelope shape | [@nzila/runtime-attestation](../../packages/runtime-attestation) |
| Evidence record shape | [@nzila/runtime-attestation](../../packages/runtime-attestation) |
| Dashboard primitives | [@nzila/governance-operations](../../packages/governance-operations) |
| Continuity panels | [@nzila/continuity-review](../../packages/continuity-review) |
| Attestation viewers | [@nzila/attestation-visibility](../../packages/attestation-visibility) |
| Review workflow primitives | [@nzila/governance-review](../../packages/governance-review) |
| Stabilization signals | [@nzila/stabilization-signals](../../packages/stabilization-signals) |

## 3. Required uniform behaviors

Every product MUST:

- Render bandings using the same banded shape.
- Cite the same doctrine references for the same governance categories.
- Refuse the same person-resolving content at every UI boundary.
- Honor the same role model.
- Refresh on the same slow cadence.

## 4. Drift discipline

Per-product divergence in governance operations is treated as a doctrine-bearing regression. Either the divergence is reverted or it is promoted into the shared contract by a doctrine-cited change.

## 5. Discipline

A cross-product fabric succeeds when a stakeholder can move between products and never need to re-learn what governance looks like. If each product wears a different governance face, the fabric has failed.
