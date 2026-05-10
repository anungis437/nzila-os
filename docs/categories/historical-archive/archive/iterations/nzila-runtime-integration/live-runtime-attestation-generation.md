# Live Runtime Attestation Generation

> **Status:** Canonical runtime integration · **Layer:** Attestation execution · **Inherits:** [runtime-attestation-pipeline.md](../nzila-runtime-governance/runtime-attestation-pipeline.md)

## 1. Objective

Generate real, release-bound, environment-bound attestations as a structural part of every build, deploy, release, and pilot activation. Attestations are not optional artifacts; they are evidence that the act occurred under governance.

## 2. Generation points

| Trigger | Attestation class | Issuer |
|---|---|---|
| `gitops-deploy.yml` post-build | `deployment` | release-governance-pipeline |
| ACA `containerapp update` post-rollout | `environment-legitimacy` | release-governance-pipeline |
| Pilot activation workflow | `pilot-safety` | pilot-governance-forum |
| Doctrine policy update merge | `doctrine-compliance` | platform-governance-forum |
| AI capability registration | `ai-governance` | ai-governance-forum |
| Continuity windowed review | `continuity-governance` | platform-ops |

## 3. Required wiring

`tooling/runtime-governance/generate-attestation.mjs` consumes:

- Release identity (`NZILA_RELEASE_ID`, `NZILA_COMMIT_SHA`, `NZILA_MANIFEST_HASH`, `NZILA_BUILT_AT`) via [@nzila/governance-runtime](../../packages/governance-runtime).
- Environment identity from the deployment metadata.
- Cited evidence references (artifact URIs + content hashes) from prior CI steps.

It emits a JSON attestation validated against `runtimeAttestationSchema`, writes it to `proof-artifacts/attestations/<releaseId>/<class>.json`, and uploads it as a CI artifact.

## 4. Persistence

- Attestations are content-addressable (`computeContentHash`).
- The release manifest references attestation hashes; manifest signing covers the references transitively.
- Supersession (e.g., a re-attestation after a partial verdict resolves) is recorded in the ledger via `GovernanceEvidenceLedger.supersede`. Mutation is rejected.

## 5. Signing posture

Signing is OPTIONAL during the unsigned-attestation phase. During this phase:

- Attestations are still validated, persisted, and ledger-recorded.
- The readiness review tracks signing maturity (`forming` → `established` → `strong`).
- A signing key under HSM/KMS becomes mandatory before procurement-critical assurance is claimed.

## 6. Discipline

An attestation that nobody reads is still doing work — it is a verifiable record that the act occurred under known governance. An attestation that is fabricated, retro-fitted, or generated without cited evidence is worse than no attestation. The pipeline must refuse to emit either kind of falsehood.
