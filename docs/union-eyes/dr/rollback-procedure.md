# Union Eyes — Deployment Rollback Procedure

> **Owner:** Platform Engineering  
> **Severity:** P2 (escalates to P1 if data integrity at risk)  
> **Controls Covered:** CM-05  
> **Last Updated:** 2026-04-24  
> **Classification:** Internal

---

## Overview

Union Eyes deployments are container-based on Azure Container Apps. All container
images are signed and recorded in `ops/artifacts/` via the CI pipeline. The
rollback script at `scripts/rollback.ts` (invoked via `pnpm release:rollback`)
validates that the target artifact exists before writing a rollback record.

---

## Trigger

- `GET /api/health` returns 500 after deployment
- Case creation/assignment returns 5xx
- Migration applied that breaks existing data
- Security vulnerability discovered in deployed image
- Pilot org reports loss of access post-deploy

---

## Prerequisites

- Previous container image digest available in `ops/artifacts/`
- Azure CLI authenticated with contributor role on the container app resource group
- `GITHUB_TOKEN` or appropriate CI credentials if triggering via Actions

---

## Step 1 — Identify the Last Known-Good Artifact

```bash
# List available rollback targets
pnpm release:rollback:list

# Example output:
# Available artifacts in ops/artifacts/:
#   sha256:abc123 — commit a1b2c3 built 2026-04-23T14:00:00Z [deploy-staging.yml]
#   sha256:def456 — commit d4e5f6 built 2026-04-22T09:00:00Z [deploy-staging.yml]
```

---

## Step 2 — Execute the Rollback

```bash
# Write rollback record (audit trail) and print the az command
pnpm release:rollback -- <artifact_digest>

# Output will include the exact az command to run:
# az containerapp update --name nzila-union-eyes --image <acr>/<repo>@sha256:abc123
```

---

## Step 3 — Apply the Rollback via Azure CLI

```bash
RESOURCE_GROUP="nzila-staging-rg"
APP_NAME="nzila-union-eyes"
DIGEST="sha256:<previous_digest>"
ACR="<acr_login_server>"

az containerapp update \
  --name "$APP_NAME" \
  --resource-group "$RESOURCE_GROUP" \
  --image "${ACR}/union-eyes@${DIGEST}"
```

For production rollback, repeat with `nzila-prod-rg` and require a second approver
confirmation before executing.

---

## Step 4 — Verify Application Health

```bash
# Health check
curl -s https://nzila-os-union-eyes.jollydune-88c1e97f.canadacentral.azurecontainerapps.io/api/health | jq .

# Readiness check
curl -s https://nzila-os-union-eyes.jollydune-88c1e97f.canadacentral.azurecontainerapps.io/api/ready | jq .

# Confirm running image matches target digest
az containerapp show \
  --name "$APP_NAME" \
  --resource-group "$RESOURCE_GROUP" \
  --query "properties.template.containers[0].image"
```

---

## Step 5 — Django Backend Rollback (if needed)

The Django backend runs on the same container app infrastructure. If the backend
was also rolled forward in the same deployment:

```bash
az containerapp update \
  --name "nzila-union-eyes-django" \
  --resource-group "$RESOURCE_GROUP" \
  --image "${ACR}/union-eyes-django@${DIGEST}"
```

---

## Verification Checks

- [ ] Container app running the target (previous) image digest
- [ ] `GET /api/ready` → HTTP 200
- [ ] `GET /api/health` → HTTP 200
- [ ] Grievance filing flow responds correctly (manual spot test)
- [ ] Audit log entry created for rollback event
- [ ] Rollback record saved in `ops/rollbacks/`
- [ ] On-call team notified of rollback completion

---

## Evidence Captured

| Artifact | Format | Notes |
|---------|--------|-------|
| Rollback record | JSON (`ops/rollbacks/<env>-<timestamp>.json`) | Auto-written by `scripts/rollback.ts` |
| Azure CLI output | Text | Copy to incident ticket |
| Health check response | JSON | Screenshot or curl output |

---

## Escalation

If rollback does not restore health within 30 minutes:

1. Escalate to Platform Engineering lead
2. Consider database restore (see [database-restore.md](database-restore.md))
3. If data integrity concern: escalate to CTO, open P1 incident

---

## References

- [Restore Drill Runbook](restore-drill-runbook.md)
- [Database Restore Runbook](database-restore.md)
- [Rollback Script](../../../scripts/rollback.ts)
- [Release Rollback Script](../../../scripts/release/rollback-prod.ts)
- [Pilot Runbook](../../../ops/runbooks/ue-pilot.md)
