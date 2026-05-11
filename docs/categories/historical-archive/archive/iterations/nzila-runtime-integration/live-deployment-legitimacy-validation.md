# Live Deployment Legitimacy Validation

> **Status:** Canonical runtime integration · **Layer:** Deployment execution · **Inherits:** [deployment-legitimacy-validation-engine.md](../nzila-runtime-governance/deployment-legitimacy-validation-engine.md)

## 1. Objective

Run deployment legitimacy validation continuously — at deploy time, post-deploy, and on a heartbeat — so that environments either remain provably legitimate or are visibly degraded.

## 2. Validation runs

| Trigger | Cadence | Scope |
|---|---|---|
| `gitops-deploy.yml` post-build | Once per build | release identity + manifest hash |
| ACA `containerapp update` post-rollout | Once per rollout | environment identity + topology |
| Migration apply | Once per migration | migration parity (current vs manifest schema version) |
| Heartbeat | Every 5 minutes | release identity + isolation invariants + manifest hash |
| Pilot activation | Once per pilot | pilot isolation + environment class |

## 3. Required validations

Each run feeds `validateDeploymentLegitimacy()` from [@nzila/governance-runtime](../../packages/governance-runtime) with:

- `release` — read from `NZILA_RELEASE_ID/COMMIT_SHA/MANIFEST_HASH/BUILT_AT`.
- `environment` — read from ACA environment label + provenance.
- `expectedManifestHash` — fetched from the manifest registry.
- `currentSchemaVersion` / `manifestSchemaVersion` — read from the migration ledger.
- `isolationInvariantsHold` — boolean computed by the isolation invariant checker.
- `rollbackTargetAttested` — true unless a rollback is in flight without a verified prior attestation.

## 4. Required fail states

The pipeline MUST emit, with at least one doctrine citation:

- `unknown_release` — release identity cannot be bound at runtime.
- `invalid_environment_mode` — environment identity provenance missing or contradicts the manifest.
- `migration_drift` — current schema version does not match the manifest schema version.
- `pilot_isolation_failure` — pilot isolation invariants fail.
- `topology_misalignment` — observed topology does not match the manifest topology.

Each emits a `deployment_legitimacy_event` of severity `critical` and writes an `extended`-retention ledger record.

## 5. Failure posture

- `verified` — proceed.
- `partial` — proceed, surface in dashboards, attestation reflects partial verdict.
- `rejected` — block the deployment / fail the heartbeat / page on-call (single page, calm).

The pipeline never silently downgrades a `rejected` to a `partial`.

## 6. Discipline

Deployment legitimacy validation is what makes a release attestable rather than asserted. A release that cannot be validated is not a less-attested release; it is an unknown-state release, and the system must say so.
