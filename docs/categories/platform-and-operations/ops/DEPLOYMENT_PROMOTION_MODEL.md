# Deployment Promotion Model

> Build once. Promote the same artifact. Never rebuild for production.

## Principle

The Nzila OS deployment model enforces **artifact immutability**: each deployable artifact is built exactly once (on the staging pipeline), then promoted to production without modification.

## Artifact Lifecycle

```
push to main
  └─ deploy-staging.yml
       ├─ pre-deploy gates (governance, change validation, contracts, SLO)
       ├─ build → Docker image + SBOM + attestation
       ├─ compute artifact digest (sha256)
       ├─ upload artifact manifest to ops/artifacts/
       └─ deploy to STAGING

tag v*
  └─ deploy-production.yml
       ├─ pre-deploy gates (governance, change validation)
       ├─ download staging artifact (NEVER rebuild)
       ├─ verify digest matches
       ├─ verify SBOM exists
       ├─ verify attestation exists
       └─ deploy verified artifact to PRODUCTION
```

## Artifact Manifest

Each build produces a JSON manifest in `ops/artifacts/`:

```json
{
  "artifact_digest": "sha256:abc123...",
  "sbom_hash": "sha256:def456...",
  "attestation_ref": "sigstore://...",
  "commit_sha": "a1b2c3d",
  "built_at": "2025-06-01T12:00:00Z",
  "source_workflow": "deploy-staging"
}
```

## Verification

Production deployment verifies:

1. **Digest match** — the artifact digest from staging matches what's being deployed
2. **SBOM present** — Software Bill of Materials was generated during the build
3. **Attestation present** — Build provenance attestation exists

## Governance Snapshots

After each deployment to STAGING or PRODUCTION, a governance snapshot is recorded:

```json
{
  "environment": "STAGING",
  "commit": "a1b2c3d",
  "artifact_digest": "sha256:abc123...",
  "sbom_hash": "sha256:def456...",
  "policy_engine_status": "pass",
  "change_record_ref": "CHG-001",
  "timestamp": "2025-06-01T12:00:00Z"
}
```

## Scripts

| Command | Purpose |
|---------|---------|
| `pnpm governance:snapshot <env> <commit> <digest> <sbom>` | Record post-deploy governance snapshot |
| `pnpm rollback <env> <digest>` | Initiate rollback to a previous artifact |
| `pnpm env:health [env]` | Check environment health |

## Rollback

To rollback a protected environment:

```sh
pnpm rollback STAGING sha256:abc123...
```

This verifies the target artifact exists, records a rollback audit record in `ops/rollbacks/`, and prints the `az containerapp update` command needed to complete the rollback.
