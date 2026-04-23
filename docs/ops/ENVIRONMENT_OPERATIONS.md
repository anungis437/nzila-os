# Environment Operations

> Day-to-day operational commands for environment management.

## Health Checks

Canonical endpoint policy is defined in `docs/ops/HEALTH_CHECK_STANDARD.md`.
Use that document for endpoint format, probe order, and service-specific exceptions.

Canonical deployment paths:

- Staging and development: `.github/workflows/gitops-deploy.yml`
- Production: `.github/workflows/deploy-production.yml`
- App-specific deploy workflows are emergency/manual only.

Run health checks across all environments:

```sh
pnpm env:health
```

Check a specific environment:

```sh
pnpm env:health STAGING
```

Health checks verify:

- Environment config files exist and have correct values
- CI/CD workflow files are present
- Artifact directory is ready
- Governance snapshot directory is ready
- Protected environment gates are configured
- Service probes follow the canonical health-check standard

## Staging Seed

Generate deterministic seed data for staging:

```sh
pnpm staging:seed
```

Produces seed files in `ops/seed/`:

- `organizations.json` — 5 seed organizations
- `users.json` — 10 seed users
- `policies.json` — 8 seed policies
- `manifest.json` — seed generation manifest

All seed data uses deterministic IDs (`org-seed-0001`, `user-seed-0001`, etc.) for reproducibility.

## Governance Snapshots

Record a post-deploy governance snapshot:

```sh
pnpm governance:snapshot STAGING abc1234 sha256:digest sha256:sbom CHG-001
```

Arguments:

1. Environment (STAGING or PRODUCTION)
2. Commit SHA
3. Artifact digest
4. SBOM hash
5. Change record reference (optional)

Snapshots are saved in `ops/governance-snapshots/`.

## Release Governance Automation

Generate governance scorecards and workflow-sprawl audit:

```sh
pnpm release:audit
```

Run secret inventory audit over all GitHub workflows:

```sh
pnpm release:secrets:audit
```

Run policy-aware smoke tests using deployment inventory:

```sh
pnpm release:smoke
```

Validate migration safety before promotion:

```sh
pnpm release:migration:safety
```

## Rollback

Initiate a rollback to a previous artifact:

```sh
pnpm rollback STAGING sha256:abc123...
```

The script:

1. Verifies the target artifact exists in `ops/artifacts/`
2. Prints artifact details (commit, build time, workflow, SBOM)
3. Records a rollback audit record in `ops/rollbacks/`
4. Prints the `az containerapp update` command for completion

## Feature Flags

Default flags and their enabled environments:

| Flag | LOCAL | PREVIEW | STAGING | PRODUCTION |
|------|-------|---------|---------|------------|
| `ai_experimental` | ✓ | ✓ | ✓ | ✗ |
| `governance_debug` | ✓ | ✓ | ✓ | ✗ |
| `advanced_intelligence` | ✓ | ✓ | ✓ | ✗ |

Register custom flags at runtime:

```ts
import { registerFlag, isFeatureEnabled } from '@nzila/platform-feature-flags'

registerFlag({
  name: 'new_onboarding',
  enabled: true,
  environments: ['LOCAL', 'PREVIEW'],
})

if (isFeatureEnabled('new_onboarding')) {
  // ...
}
```

## Directory Structure

```
ops/
  environments/     # Environment config files (.env)
  artifacts/        # Deployment artifact manifests
  governance-snapshots/  # Post-deploy governance snapshots
  rollbacks/        # Rollback audit records
  seed/             # Staging seed data
```
