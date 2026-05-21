# Live Evidence Capture Runbook

**Status:** TEMPLATE — requires live Azure access to execute  
**Last updated:** 2026-05-14  
**Source of truth:** This document + `reports/runtime/live-evidence-manifest.template.json`  
**Supersedes:** N/A (new)  
**Live-evidence dependencies:** All sections below require Azure access

---

## Purpose

This runbook provides exact commands for capturing live operational evidence for
the Union Eyes controlled pilot. It is separated from the code/config posture
(which is HEALTHY per `platform-runtime-truth-latest.json`) because live proof
requires Azure access outside the repository.

**Three distinct layers:**

| Layer | State | Source |
|-------|-------|--------|
| Code/config posture | ✅ HEALTHY | `reports/runtime/platform-runtime-truth-latest.json` |
| Live operational proof | ⏳ PENDING | This runbook |
| Production expansion approval | 🔒 CONDITIONAL | Expansion gate (post-pilot) |

---

## Prerequisites

```bash
# Verify Azure CLI is logged in
az account show

# Set subscription
az account set --subscription "<SUBSCRIPTION_ID>"

# Confirm active subscription
az account show --query "{name:name, id:id, state:state}" -o table
```

---

## Section A — Azure Resource Group Separation

### A1. Confirm production resource group exists

```bash
az group show \
  --name nzila-canada-prod-rg \
  --query "{name:name, location:location, provisioningState:properties.provisioningState}" \
  -o json
```

**Expected:** `"name": "nzila-canada-prod-rg"`, `"location": "canadacentral"`, `"provisioningState": "Succeeded"`

### A2. Confirm staging resource group exists (separate from prod)

```bash
az group show \
  --name nzila-canada-staging-rg \
  --query "{name:name, location:location, provisioningState:properties.provisioningState}" \
  -o json
```

**Expected:** `"name": "nzila-canada-staging-rg"` — distinct from prod RG

### A3. Prove prod ≠ staging (blast-radius gate verification)

```bash
# This should return two distinct IDs — proof they are separate resource groups
az group list \
  --query "[?name=='nzila-canada-prod-rg' || name=='nzila-canada-staging-rg'].{name:name, id:id}" \
  -o table
```

**Expected:** Two rows with different resource group IDs

---

## Section B — Container App Environment

### B1. Production Container App environment

```bash
az containerapp env show \
  --name nzila-union-eyes-prod-env \
  --resource-group nzila-canada-prod-rg \
  --query "{name:name, location:location, provisioningState:properties.provisioningState, fqdn:properties.defaultDomain}" \
  -o json
```

### B2. Staging Container App environment

```bash
az containerapp env show \
  --name nzila-union-eyes-staging-env \
  --resource-group nzila-canada-staging-rg \
  --query "{name:name, location:location, provisioningState:properties.provisioningState, fqdn:properties.defaultDomain}" \
  -o json
```

### B3. List Container Apps in production

```bash
az containerapp list \
  --resource-group nzila-canada-prod-rg \
  --query "[].{name:name, fqdn:properties.latestRevisionFqdn, state:properties.runningStatus}" \
  -o table
```

---

## Section C — Key Vault Separation

### C1. Production Key Vault

```bash
az keyvault show \
  --name nzila-prod-kv \
  --resource-group nzila-canada-prod-rg \
  --query "{name:name, location:location, sku:properties.sku.name, enableSoftDelete:properties.enableSoftDelete}" \
  -o json
```

**Expected:** `"location": "canadacentral"`, `"enableSoftDelete": true`

### C2. Staging Key Vault

```bash
az keyvault show \
  --name nzila-staging-kv \
  --resource-group nzila-canada-staging-rg \
  --query "{name:name, location:location}" \
  -o json
```

**Expected:** Distinct name from prod KV

### C3. Confirm prod KV does not share access with staging

```bash
# List access policies or RBAC assignments on prod KV
az keyvault show \
  --name nzila-prod-kv \
  --resource-group nzila-canada-prod-rg \
  --query "properties.accessPolicies[].{objectId:objectId, permissions:permissions}" \
  -o json
```

Review output: staging service principals must NOT appear in prod KV access policies.

---

## Section D — Storage / Evidence Container Separation

### D1. Production evidence storage account

```bash
az storage account show \
  --name nzilaprodevidence \
  --resource-group nzila-canada-prod-rg \
  --query "{name:name, location:primaryLocation, tier:sku.tier, httpsOnly:enableHttpsTrafficOnly}" \
  -o json
```

**Expected:** `"location": "canadacentral"`, `"httpsOnly": true`

### D2. Evidence container exists

```bash
az storage container show \
  --name union-eyes-evidence \
  --account-name nzilaprodevidence \
  --auth-mode login
```

### D3. Staging storage is separate

```bash
az storage account list \
  --resource-group nzila-canada-staging-rg \
  --query "[].{name:name, location:primaryLocation}" \
  -o table
```

---

## Section E — Health and Readiness Checks

### E1. Production health endpoint

```bash
# Replace <PROD_FQDN> with actual Container App FQDN
PROD_URL="https://<PROD_FQDN>"

curl -fsS "${PROD_URL}/api/health" | jq .
```

**Expected:** `{"status":"healthy"}` or equivalent with HTTP 200

### E2. Production readiness endpoint

```bash
curl -fsS "${PROD_URL}/api/ready" | jq .
```

**Expected:** `{"status":"ready"}` with HTTP 200

### E3. Staging health (baseline comparison)

```bash
STAGING_URL="https://<STAGING_FQDN>"
curl -fsS "${STAGING_URL}/api/health" | jq .
```

### E4. Smoke test — authenticated session required

```bash
# Use a valid pilot user token
curl -fsS \
  -H "Authorization: Bearer <PILOT_USER_TOKEN>" \
  "${PROD_URL}/api/cases" | jq '.data | length'
```

**Expected:** HTTP 200, returns an array (empty or with test cases)

---

## Section F — Azure Monitor / Observability

### F1. Confirm Log Analytics workspace exists

```bash
az monitor log-analytics workspace show \
  --workspace-name nzila-prod-logs \
  --resource-group nzila-canada-prod-rg \
  --query "{name:name, customerId:customerId, retentionInDays:retentionInDays}" \
  -o json
```

### F2. Export recent Container App logs (last 1 hour)

```bash
az monitor log-analytics query \
  --workspace "<LOG_ANALYTICS_WORKSPACE_ID>" \
  --analytics-query "ContainerAppConsoleLogs_CL | where TimeGenerated > ago(1h) | take 50" \
  -o table
```

### F3. Confirm alerting rules exist

```bash
az monitor alert list \
  --resource-group nzila-canada-prod-rg \
  --query "[].{name:name, severity:severity, enabled:enabled}" \
  -o table
```

---

## Section G — Restore Drill Evidence

> **Live drill executed 2026-05-21:** see `reports/runtime/live-captures/2026-05-20/restore-drill/restore-drill-manifest.json` for the full manifest (RESTORE-DRILL-2026-05-20-001). The commands below remain the standing quarterly-drill template; next drill due **2026-08-21**.

### G1. Database backup existence

```bash
# List database backups (Azure Database for PostgreSQL Flexible Server)
az postgres flexible-server backup list \
  --name nzila-os-union-eyes-prod-db \
  --resource-group nzila-canada-prod-rg \
  --query "[].{backupName:name, completedTime:completedTime, backupType:backupType}" \
  -o table
```

### G2. Point-in-time restore capability proof

```bash
az postgres flexible-server show \
  --name nzila-os-union-eyes-prod-db \
  --resource-group nzila-canada-prod-rg \
  --query "{name:name, backupRetentionDays:backup.backupRetentionDays, geoRedundant:backup.geoRedundantBackup, earliestRestoreDate:backup.earliestRestoreDate}" \
  -o json
```

**Expected:** `"backupRetentionDays": 30`, `"geoRedundantBackup": "Enabled"`, `earliestRestoreDate` populated.

### G2a. Live PITR drill execution (quarterly)

```bash
# Generate unique restore name (deleted-server names can hold soft-recovery)
$suffix = Get-Random -Maximum 9999
$target = "nzila-ue-drill-pitr-$suffix"
$restoreTime = (Get-Date).ToUniversalTime().AddHours(-2).ToString("yyyy-MM-ddTHH:00:00Z")

# Trigger async PITR
az postgres flexible-server restore `
  --resource-group nzila-canada-prod-rg `
  --name $target `
  --source-server nzila-os-union-eyes-prod-db `
  --restore-time $restoreTime `
  --no-wait

# Poll until Ready (typically 5–10 minutes)
do {
  Start-Sleep -Seconds 30
  $state = az postgres flexible-server show --resource-group nzila-canada-prod-rg --name $target --query state -o tsv
  Write-Host "state=$state"
} while ($state -ne "Ready")

# Verify production database restored
az postgres flexible-server db list --resource-group nzila-canada-prod-rg --server-name $target -o table
# Expect `nzila_os_prod` in the output.

# Cleanup (mandatory — cost containment)
az postgres flexible-server delete --resource-group nzila-canada-prod-rg --name $target --yes
```

Capture all outputs to `reports/runtime/live-captures/<YYYY-MM-DD>/restore-drill/` and produce a `restore-drill-manifest.json` matching the schema of the 2026-05-21 reference manifest.

### G3. Evidence storage backup

```bash
# Confirm PITR / versioning enabled on evidence storage
az storage account show \
  --name nzilaprodevidence \
  --resource-group nzila-canada-prod-rg \
  --query "{blobVersioning:blobServiceProperties.isVersioningEnabled, softDelete:blobServiceProperties.deleteRetentionPolicy}" \
  -o json
```

---

## Section H — Evidence Artifact Storage

All captured command outputs MUST be saved to:

```
reports/runtime/live-captures/YYYY-MM-DD/
├── az-account.json
├── rg-prod.json
├── rg-staging.json
├── rg-separation.txt
├── container-app-env-prod.json
├── container-app-env-staging.json
├── keyvault-prod.json
├── keyvault-staging.json
├── storage-prod.json
├── health-prod.json
├── ready-prod.json
├── monitor-workspace.json
├── db-backup-list.json
└── evidence-manifest.json   (use live-evidence-manifest.template.json)
```

Example capture command:

```bash
az group show --name nzila-canada-prod-rg -o json > reports/runtime/live-captures/$(date +%Y-%m-%d)/rg-prod.json
```

---

## Section I — Reviewer Sign-Off

After all captures are complete, fill in and commit:

```
reports/runtime/live-captures/YYYY-MM-DD/SIGN_OFF.md

Reviewer:          _______________
Date:              _______________
Subscription ID:   _______________
Prod RG confirmed: [ ] YES  [ ] NO
Staging RG separate: [ ] YES  [ ] NO
Health endpoint:   [ ] PASS  [ ] FAIL
Readiness endpoint:[ ] PASS  [ ] FAIL
DB backup confirmed:[ ] YES  [ ] NO
KV separation:     [ ] YES  [ ] NO
Overall:           [ ] EVIDENCE COMPLETE  [ ] GAPS NOTED (list below)

Gaps / exceptions:
_______________
```

---

## Interpreting Results

| Result | Meaning |
|--------|---------|
| All A–G pass | Live operational proof complete — Section B of RUNTIME_EVIDENCE_PACK.md can be marked VERIFIED |
| Partial pass | Document specific gaps in SIGN_OFF.md; update exceptions in evidence manifest |
| Any fail | Escalate to platform engineering before pilot launch with real member data |

---

*This runbook captures what the repository cannot verify autonomously. The code/config posture
is already HEALTHY per `reports/runtime/platform-runtime-truth-latest.json`. This runbook
converts that to live operational proof.*
