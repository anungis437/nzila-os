# Production Rollback Runbook

As of 2026-07-03. Scope: `nzila-canada-prod-env` apps (union-eyes, web, partners).

## Principle

Roll back to a **previous known-good immutable digest / revision**, never a mutable tag.

## Container App rollback (union-eyes / web / partners)

1. List revisions and identify the last known-good:
   ```
   az containerapp revision list -n <app> -g nzila-canada-prod-rg \
     --query "[].{rev:name,active:properties.active,created:properties.createdTime,image:properties.template.containers[0].image}" -o table
   ```
2. Reactivate the known-good revision (single-revision mode):
   ```
   az containerapp update -n <app> -g nzila-canada-prod-rg \
     --container-name <app> --image <registry>/<repo>@sha256:<known-good-digest>
   ```
   or, in multi-revision mode, shift traffic:
   ```
   az containerapp ingress traffic set -n <app> -g nzila-canada-prod-rg \
     --revision-weight <known-good-revision>=100
   ```
3. Verify: `curl -I https://<prod-domain>/` → 200 and health/`/api/ready` where present.

Example known-good anchor at graduation: `nzila-os-union-eyes-prod--0000173`.

## Database rollback / restore

- Prod DB `nzila-os-union-eyes-prod-db` has 30-day PITR + geo-redundant backup.
- Point-in-time restore:
  ```
  az postgres flexible-server restore --name <restore-target> \
    --resource-group nzila-canada-prod-rg \
    --source-server nzila-os-union-eyes-prod-db --restore-time <ISO8601>
  ```
- A restore drill exists: `nzila-ue-prod-db-drill-20260520`.

## Owner

Platform-ops. Escalation: repo owner / sole operator.
