# Union Eyes — Database Restore Runbook

> **Owner:** SRE Team  
> **Severity:** P1 during incident  
> **Controls Covered:** DR-01, DR-02  
> **Last Updated:** 2026-04-24  
> **Classification:** Internal

---

## Overview

Union Eyes uses **Azure Database for PostgreSQL Flexible Server** as its
authoritative database, managed as Infrastructure-as-Code via
`infrastructure/bicep/modules/postgres.bicep`. This runbook covers the three
database recovery scenarios:

| Scenario | Trigger | Method |
|---------|---------|--------|
| Point-in-time recovery (PITR) | Accidental data deletion or corruption | Azure portal / CLI restore to new server |
| Migration rollback | Bad deployment applied broken migration | `scripts/rollback.ts` + last known-good container |
| Full environment rebuild | Server lost, IaC re-provision | Bicep deploy + PITR restore |

---

## Backup Strategy (from Bicep IaC)

| Setting | Value | Source |
|---------|-------|--------|
| Backup retention | 35 days (prod), 7 days (staging) | `infrastructure/bicep/modules/postgres.bicep` line 38 |
| Geo-redundant backup | Enabled (prod), configurable (staging) | `postgres.bicep` line 50 |
| High availability mode | ZoneRedundant (prod) | `postgres.bicep` line 113 |
| WAL / PITR | Continuous | Azure managed |
| RPO window | ≤ 1 hour (documented target) | `ops/disaster-recovery/README.md` |

---

## Scenario 1 — Point-in-Time Recovery

### Trigger

- Accidental `DELETE` or `TRUNCATE` on a production table
- Data corruption detected in audit trail
- Org isolation breach requiring clean-slate restore

### Prerequisites

- Azure CLI authenticated: `az login`
- Subscription and resource group identifiers
- Target restore timestamp (must be within 35-day retention window)
- Staging environment available to validate before production promote
- For staging drill automation: `DR_DB_HOST`, `DR_DB_USER` (and optional `DR_DB_PASSWORD`, `DR_READY_URL`) set

### Scripted Staging Drill Path (Recommended)

```bash
# Step 0: Validate readiness
pnpm exec tsx scripts/dr/drill-checklist.ts --live

# Step 1: Execute live restore drill with measured RTO
pnpm exec tsx scripts/db/restore-drill.ts -- --execute --db-host "$DR_DB_HOST" --db-user "$DR_DB_USER" --ready-url "$DR_READY_URL"

# Step 2: Generate human-readable and JSON evidence
pnpm exec tsx scripts/dr/drill-report.ts
```

This path is preferred for quarterly live drills because it produces consistent,
auditable artifacts in `reports/db/` and `reports/dr/`.

### Commands

```bash
# Step 1: Identify source server and restore point
SOURCE_SERVER="nzila-prod-pg"
RESOURCE_GROUP="nzila-prod-rg"
RESTORE_TO="$(date -u --date='1 hour ago' +%Y-%m-%dT%H:%M:%S+00:00)"
RESTORE_SERVER="nzila-restore-$(date +%Y%m%d%H%M)"

# Step 2: Restore to a new server (does NOT overwrite original)
az postgres flexible-server restore \
  --resource-group "$RESOURCE_GROUP" \
  --name "$RESTORE_SERVER" \
  --source-server "$SOURCE_SERVER" \
  --restore-time "$RESTORE_TO"

# Step 3: Verify restored server is healthy
az postgres flexible-server show \
  --resource-group "$RESOURCE_GROUP" \
  --name "$RESTORE_SERVER" \
  --query "state"

# Step 4: Connect and validate row counts
psql "postgresql://nzilaadmin@${RESTORE_SERVER}.postgres.database.azure.com/union_eyes_prod" \
  -c "SELECT COUNT(*) FROM audit_events; SELECT COUNT(*) FROM cases; SELECT COUNT(*) FROM members;"

# Step 5: If validation passes, update DATABASE_URL in Key Vault to point to restored server
az keyvault secret set \
  --vault-name "nzila-prod-kv" \
  --name "DATABASE-URL" \
  --value "postgresql://nzilaadmin@${RESTORE_SERVER}.postgres.database.azure.com:5432/union_eyes_prod"

# Step 6: Restart application containers to pick up new DB URL
az containerapp update --name nzila-union-eyes --resource-group "$RESOURCE_GROUP" \
  --image $(az containerapp show -n nzila-union-eyes -g "$RESOURCE_GROUP" --query "properties.template.containers[0].image" -o tsv)
```

### Verification Checks

- [ ] Restored server status = `Ready`
- [ ] Row count on `audit_events` ≥ pre-incident count
- [ ] Hash-chain continuity: last 10 audit events have valid `prev_hash` links
- [ ] `GET /api/ready` → HTTP 200
- [ ] `GET /api/health` → HTTP 200
- [ ] RLS context test: confirm cross-org query returns 0 rows
- [ ] Login with a test pilot org user — confirm cases visible, correct org

### Rollback If Restore Fails

```bash
# Revert DATABASE_URL to original server
az keyvault secret set \
  --vault-name "nzila-prod-kv" \
  --name "DATABASE-URL" \
  --value "$ORIGINAL_DATABASE_URL"

# Drop the failed restore server
az postgres flexible-server delete \
  --resource-group "$RESOURCE_GROUP" \
  --name "$RESTORE_SERVER" --yes
```

### Evidence Captured

- Azure CLI output of `flexible-server restore` command (copy to evidence pack)
- Row count comparison (pre/post restore)
- Hash-chain verification output
- App health check response
- Incident ticket link

---

## Scenario 2 — Migration Rollback After Bad Deployment

### Trigger

- Deployment promoted a migration that broke a critical table
- `GET /api/health` returns 500 after deploy
- Case creation/assignment routes return 500

### Prerequisites

- Previous container image digest known (see `ops/artifacts/`)
- Rollback script: `scripts/rollback.ts`

### Commands

```bash
# Step 1: Identify last known-good artifact digest
pnpm exec tsx scripts/release/rollback-prod.ts --list

# Step 2: Execute rollback to previous container image
pnpm exec tsx scripts/release/rollback-prod.ts --tag v1.1.0 --execute

# Step 3: Re-deploy the previous container image via Azure CLI
az containerapp update \
  --name nzila-union-eyes \
  --resource-group nzila-staging-rg \
  --image <acr>.azurecr.io/union-eyes@<digest>

# Step 4: Verify health
curl -s https://nzila-os-union-eyes.jollydune-88c1e97f.canadacentral.azurecontainerapps.io/api/health | jq .
```

### Verification Checks

- [ ] Container running previous image digest confirmed
- [ ] `GET /api/ready` → HTTP 200
- [ ] One full grievance lifecycle test (file → assign → transition)
- [ ] Audit log shows rollback event

---

## Scenario 3 — Full Environment Rebuild

### Trigger

- Azure region outage (Canada Central unavailable > 30 min)
- Database server lost or corrupted beyond PITR
- Security incident requiring clean environment

### Prerequisites

- Azure CLI authenticated with contributor role on subscription
- `dbAdminPassword` available in secure vault
- Most recent database backup within retention window

### Commands

```bash
# Step 1: Provision infrastructure from IaC
az deployment group create \
  --resource-group "nzila-staging-rg" \
  --template-file "infrastructure/bicep/main.bicep" \
  --parameters env=staging dbAdminPassword="$DB_ADMIN_PASSWORD"

# Step 2: Restore database via PITR (see Scenario 1)
# ... (repeat PITR steps targeting the new server)

# Step 3: Deploy application containers
# This is handled by the CD pipeline: push to main → deploy-staging.yml
# Or manually:
az containerapp create \
  --name nzila-union-eyes \
  --resource-group "nzila-staging-rg" \
  --environment nzila-staging-env \
  --image <acr>.azurecr.io/union-eyes:latest

# Step 4: Restore configuration from Key Vault
# Key Vault references are wired via container app managed identity — automatic on provision.

# Step 5: Run full verification suite
pnpm exec tsx scripts/release/run-smoke.ts --env staging --apps web,console,partners,union-eyes,cfo,flow,abr
```

### Estimated Rebuild Time (RTO Components)

| Phase | Estimated Duration | Notes |
|-------|--------------------|-------|
| IaC provision | 15–25 min | Bicep deploy of all modules |
| PITR restore | 20–45 min | Depends on DB size |
| Container deploy | 5–10 min | Image pull + startup |
| Verification | 10–20 min | Health checks + smoke tests |
| **Total estimate** | **50–100 min** | Within 4-hour RTO target |

> These are estimates based on Azure documentation and IaC structure. Actual timing
> must be measured during a live staging drill and recorded in the evidence report.
> Actual measured RTO: **pending first live staging execution** (see `reports/dr/`).

---

## References

- [Restore Drill Runbook](restore-drill-runbook.md)
- [Bicep Postgres Module](../../../infrastructure/bicep/modules/postgres.bicep)
- [Platform DR Plan](../../../docs/ops/disaster-recovery.md)
- [Rollback Script](../../../scripts/rollback.ts)
- [Restore Drill Script](../../../scripts/db/restore-drill.ts)
