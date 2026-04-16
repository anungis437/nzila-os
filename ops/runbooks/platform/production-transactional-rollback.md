# Production Transactional Rollback

## Purpose

Execute a production promotion with automatic rollback and evidence capture when any target fails health validation.

## Trigger

Use when deploying tagged production releases through `deploy-production.yml`.

## Preconditions

- Azure OIDC credentials and `AZURE_RESOURCE_GROUP` are configured.
- `staging-build-artifacts` includes `artifact-manifest.json`.
- Deploy targets are present in either:
  - `artifact-manifest.json` (`deployTargets`), or
  - `PRODUCTION_DEPLOY_TARGETS_JSON` secret.

## Procedure

1. Execute transactional deployment:

```bash
pnpm deploy:transactional \
  --manifest staging-artifacts/artifact-manifest.json \
  --resource-group <resource-group> \
  --health-attempts 10 \
  --health-delay-ms 5000 \
  --health-timeout-ms 20000 \
  --evidence-out ops/deploy-evidence/production-manual-$(date -u +%Y%m%dT%H%M%SZ).json
```

2. Verify evidence file includes:

- `capturedState` for each target (previous image + revision)
- `healthChecks` with pass/fail per target
- `rollbackPerformed` and final `status`

3. If failed with rollback performed:

- Confirm each app is on its previous image:

```bash
az containerapp show --name <app> --resource-group <resource-group> --query properties.template.containers[0].image -o tsv
```

- Attach evidence JSON to incident/change record.

## Evidence Path

- CI artifact: `production-deploy-evidence`
- Local/manual: `ops/deploy-evidence/*.json`

## Failure Handling

- If rollback itself fails, stop further promotions immediately.
- Declare incident, collect failed target names + last errors from evidence, and execute manual rollback app-by-app.
