# Environment Promotion Governance

**Status:** Active
**Effective:** 2026-05-09
**Authority:** [master-rollout-governance-index.md](./master-rollout-governance-index.md)

---

## 1. Scope

Governs all environment promotion behavior across the Nzila ecosystem.
The canonical environment registry lives at
`governance/foundations/rollout/environments.json`.

## 2. Recognized Environments

| Tier     | Purpose                                                              | Topology              |
|----------|----------------------------------------------------------------------|-----------------------|
| local    | Developer workstation                                                | isolated              |
| dev      | Shared integration                                                   | shared-dev            |
| staging  | Pre-promotion validation                                             | staging-isolated      |
| demo     | Institutional demonstration                                          | demo-isolated         |
| pilot    | Live institutional pilot                                             | pilot-isolated        |
| prod     | Canonical institutional operating environment                        | prod-isolated         |

Promotion graph: `local → dev → staging → { demo, pilot } → prod`.
Promotions outside this graph are prohibited and refused by the
validator.

## 3. Promotion Authority

| From → To                | Authority                                            |
|--------------------------|------------------------------------------------------|
| local → dev              | engineering                                          |
| dev → staging            | engineering + platform                               |
| staging → demo           | platform                                             |
| staging → pilot          | platform + institutional sponsor                     |
| pilot → prod             | platform + institutional authority                   |

A promotion executed without the documented authority is treated as a
governance incident, not a deployment event.

## 4. Promotion Review

Every promotion must satisfy, in order:

1. **Legitimacy review** — schema legitimacy (per ORM governance),
   deployment legitimacy, runtime governance attachment.
2. **Attestation validation** — required attestations exist for the
   release identifier being promoted.
3. **Continuity readiness** — stabilization window from prior promotion
   has elapsed (see `continuity_window_minutes` in registry).
4. **Operator review** — required reviewers per the table above have
   signed off in writing.

## 5. Attestation Requirements

Promotions to `staging`, `demo`, `pilot`, `prod` MUST emit a promotion
attestation via `node tooling/scripts/record-promotion-attestation.mjs`. The attestation records:

- `release_id`, `git_sha`, `from`, `to`, `reviewer`, `reason`,
  `timestamp`, `legitimacy_review_ref`, `continuity_window_satisfied`.

## 6. Rollback Legitimacy

Rollbacks are governed by [governed-rollback-system.md](./governed-rollback-system.md).
A rollback that crosses an environment boundary requires a
re-promotion, not an in-place reversion.

## 7. Isolation Guarantees

- `prod` MUST NOT share secrets, databases, or storage with any other
  tier.
- `pilot` MUST NOT share secrets, databases, or storage with `prod`
  or with another pilot.
- `demo` operates under TSOSA per
  [docs/categories/products-and-market/union-eyes/release/transitional-shared-secret-topology.md](../categories/products-and-market/union-eyes/release/transitional-shared-secret-topology.md);
  this is a documented, time-bounded exception.

## 8. Environment Identity Validation

Every running environment must advertise:

- `tier`
- `release_id`
- `git_sha`
- `secret_topology`
- `bootstrap_attestation_ref` (where applicable per ORM governance)

A running environment that cannot advertise these fields is treated as
illegitimate and excluded from promotion graph eligibility.

## 9. Prohibitions

- No automatic promotion based on green CI alone.
- No promotion across non-adjacent tiers (e.g., `dev → demo`).
- No promotion that bypasses the attestation recorder.
- No promotion during an open continuity window.
