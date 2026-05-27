# Master Finalization Index

**Status:** Active
**Effective:** 2026-05-09
**Authority root:** Nzila Ventures institutional operating system finalization layer.

This index is the canonical entry point to the finalization corpus.
Phase D is the final transition from operationally proven
infrastructure to institutionally production-ready operating
system.

This phase introduces no new governance primitives, no new operational
layers, no new doctrine expansion. It produces convergence,
production hardening, operational coherence finalization, and formal
GO certification per environment.

---

## Doctrine corpus

- [full-ecosystem-convergence-finalization.md](./full-ecosystem-convergence-finalization.md)
- [canonical-operating-system-navigation.md](./canonical-operating-system-navigation.md)
- [full-role-experience-convergence.md](./full-role-experience-convergence.md)
- [executive-operating-system-finalization.md](./executive-operating-system-finalization.md)
- [full-environment-go-certification-program.md](./full-environment-go-certification-program.md)
- [production-readiness-hardening.md](./production-readiness-hardening.md)
- [live-full-chain-operational-rehearsal.md](./live-full-chain-operational-rehearsal.md)
- [cross-app-e2e-validation-matrix.md](./cross-app-e2e-validation-matrix.md)
- [final-operational-legitimacy-audit.md](./final-operational-legitimacy-audit.md)
- [final-operating-system-readiness-review.md](./final-operating-system-readiness-review.md)

## Companion layers

- [docs/nzila-operational-proving/master-operational-proving-index.md](../nzila-operational-proving/master-operational-proving-index.md)
- [docs/nzila-field-operations/master-field-operations-index.md](../nzila-field-operations/master-field-operations-index.md)
- [docs/nzila-rollout-governance/master-rollout-governance-index.md](../nzila-rollout-governance/master-rollout-governance-index.md)

## Evidence

All finalization evidence lives under
`proof-artifacts/finalization/`, anchored by
`finalization-manifest.json`. Per-environment GO certifications are
in `proof-artifacts/finalization/certifications/`. The validator
(`node tooling/scripts/validate-final-go-status.mjs`) emits the formal GO status only when every
certification, every audit, and every proving anchor is present and
internally consistent.

## Authority

Re-certification is required after any change to the promotion graph
or the continuity window policy. Certification artifacts are
append-only; revocation is a new artifact, not a deletion.
