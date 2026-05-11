# Cross-Environment Governance Fabric

**Status:** Active
**Effective:** 2026-05-09
**Authority:** [master-rollout-governance-index.md](./master-rollout-governance-index.md)

---

## 1. Purpose

Standardize governance across `demo`, `staging`, `pilot`, `prod`, and
any future environment tier. The same legitimacy primitives apply
everywhere; only the strictness varies.

## 2. Standardized Primitives

| Primitive                  | Implementation                                              |
|----------------------------|-------------------------------------------------------------|
| Identity advertisement     | `/health/identity` per app + UI badge.                      |
| Legitimacy summary         | Rollout governance panel (calm summary).                    |
| Promotion attestation      | `pnpm rollout:promote:attest`.                              |
| Bootstrap attestation      | ORM governance bootstrap orchestrator.                      |
| Readiness review           | `pnpm rollout:readiness`.                                   |
| Rollback attestation       | `pnpm rollout:rollback:attest`.                             |
| Continuity windows         | Per-tier minutes in `governance/foundations/rollout/environments.json`. |

## 3. Strictness Matrix

| Primitive               | local | dev  | staging | demo | pilot | prod |
|-------------------------|-------|------|---------|------|-------|------|
| Identity required       |   o   |  X   |    X    |  X   |   X   |  X   |
| Promotion attestation   |   -   |  X   |    X    |  X   |   X   |  X   |
| Operator review (named) |   -   |  -   |    o    |  X   |   X   |  X   |
| Sponsor sign-off        |   -   |  -   |    -    |  -   |   X   |  X   |
| Institutional sign-off  |   -   |  -   |    -    |  -   |   -   |  X   |
| Per-tier KV isolation   |   -   |  -   |    X    |  o   |   X   |  X   |

`X` = required, `o` = recommended/exception-allowed, `-` = not required.

## 4. Future Environments

Adding a new environment tier requires:

1. Entry in `governance/foundations/rollout/environments.json` with all required
   fields.
2. Update of the strictness matrix above.
3. Update of the master index decision tree.
4. Validator pass (`pnpm rollout:validate`).

## 5. Cross-Tier Anti-Patterns

- A demo workflow appearing in pilot with the same authority gate.
- A pilot workflow appearing in prod without sponsor + institutional
  review.
- A staging-grade attestation accepted as a prod-grade attestation.
- Cross-tier shared infrastructure that bypasses isolation rules.

## 6. Naming

Environment names appear in resources as:
`nzila-os-<service>-<tier>` and `nzila-<region>-<tier>-kv`. Deviations
require a recorded exception attestation.
