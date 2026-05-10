# Environment Architecture

> Nzila OS supports four canonical environments: **LOCAL**, **PREVIEW**, **STAGING**, and **PRODUCTION**.

## Environment Lifecycle

```
LOCAL → PREVIEW → STAGING → PRODUCTION
  │        │          │           │
  dev      PR      main        tag
```

| Environment | Trigger | Protected | Rebuild | Debug | AI Experimental |
|-------------|---------|-----------|---------|-------|-----------------|
| LOCAL       | Manual  | No        | N/A     | Yes   | Yes             |
| PREVIEW     | PR open | No        | Yes     | Yes   | Yes             |
| STAGING     | main    | Yes       | Yes     | Yes   | Yes             |
| PRODUCTION  | tag     | Yes       | Never   | No    | No              |

## Packages

| Package | Purpose |
|---------|---------|
| `@nzila/platform-environment` | Environment detection, namespacing, config, artifacts, governance snapshots |
| `@nzila/platform-feature-flags` | Environment-aware feature flag registry |

## Detection

The `getEnvironment()` function resolves the current environment in order:

1. `ENVIRONMENT` env var (explicit override)
2. CI heuristics: tag push → PRODUCTION, PR → PREVIEW, main branch → STAGING
3. Fallback → LOCAL

## Isolation

Every environment gets scoped resource names via `getEnvironmentNamespace()`:

```
nzila-staging-db        nzila-prod-db
nzila-staging-storage   nzila-prod-storage
nzila-staging-queue     nzila-prod-queue
nzila.staging           nzila.prod          (observability)
```

## Configuration Files

Environment config lives in `ops/environments/`:

```
ops/environments/
  local.env
  preview.env
  staging.env
  prod.env
```

## CI/CD Workflows

| Workflow | Trigger | Key Gates |
|----------|---------|-----------|
| `preview-deploy.yml` | PR | lint, typecheck, test |
| `deploy-staging.yml` | push to main | governance, change validation, contracts, SLO |
| `deploy-production.yml` | tag `v*` | governance, artifact verification (never rebuilds) |

## Feature Flags

Flags are evaluated per-environment:

```ts
import { isFeatureEnabled } from '@nzila/platform-feature-flags'

if (isFeatureEnabled('ai_experimental')) {
  // only active on LOCAL, PREVIEW, STAGING
}
```

Default flags: `ai_experimental`, `governance_debug`, `advanced_intelligence`.

## Observability

Environment-scoped telemetry prevents cross-contamination:

```ts
import { envLog, envMetricName, envAlertTags } from '@nzila/platform-environment'

envLog('info', 'Request processed', { latency: 42 })
// → { environment: 'STAGING', namespace: 'nzila.staging', ... }

envMetricName('api.request_count')
// → "nzila.staging.api.request_count"
```

## Control Plane

The `/environments` dashboard shows:

- Per-environment cards with config, latest artifact, governance snapshot, feature flags
- Deployment history and artifact viewer components
- Health check status
