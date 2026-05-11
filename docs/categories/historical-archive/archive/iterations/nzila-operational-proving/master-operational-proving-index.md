# Master Operational Proving Index

**Status:** Active
**Effective:** 2026-05-09
**Authority root:** Nzila Ventures institutional operational proving layer.

This index is the canonical entry point to the operational proving
corpus. Operational proving is the institutional act of validating
that the Nzila ecosystem behaves as a real governable institutional
operating environment under real execution conditions.

The proving layer sits above the field operations layer and is its
empirical closure. It does not introduce new governance primitives;
it produces evidence that the existing primitives behave correctly
under real conditions.

---

## Doctrine corpus

- [full-environment-traversal-rehearsal.md](./full-environment-traversal-rehearsal.md)
- [live-rollback-proving.md](./live-rollback-proving.md)
- [promotion-refusal-proving.md](./promotion-refusal-proving.md)
- [live-operator-walkthrough-program.md](./live-operator-walkthrough-program.md)
- [executive-operational-readability-proving.md](./executive-operational-readability-proving.md)
- [cross-app-operational-convergence-proving.md](./cross-app-operational-convergence-proving.md)
- [live-cadence-sustainability-validation.md](./live-cadence-sustainability-validation.md)
- [environment-restoration-proving.md](./environment-restoration-proving.md)
- [live-pilot-operations-proving.md](./live-pilot-operations-proving.md)
- [phase-c-final-readiness-review.md](./phase-c-final-readiness-review.md)

## Companion layers

- [docs/nzila-field-operations/master-field-operations-index.md](../nzila-field-operations/master-field-operations-index.md)
- [docs/nzila-rollout-governance/master-rollout-governance-index.md](../nzila-rollout-governance/master-rollout-governance-index.md)

## Evidence

All proving evidence is captured under
`proof-artifacts/operational-proving/`, indexed by
`proving-manifest.json`. The proving validator
(`pnpm ops:prove`) reads the manifest and verifies that every
referenced attestation exists in the rollout ledger.

## Authority

Changes to the proving corpus require institutional governance
review. Re-proving is required after any change to the promotion
graph or the continuity window policy.
