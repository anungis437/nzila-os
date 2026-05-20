#!/usr/bin/env bash
# provision-prod-rg.sh
#
# One-time ops runbook: create the dedicated production resource group
# (nzila-canada-prod-rg) and deploy Bicep infra with env=prod.
#
# EXC-001 resolution — prod and staging were previously sharing
# nzila-canada-staging-rg/nzila-canada-staging-env.  This script
# provisions the sovereign prod substrate and documents the container-app
# migration steps.
#
# Prerequisites:
#   - az login (Contributor on subscription 5d819f33-d16f-429c-a3c0-5b0e94740ba3)
#   - jq
#   - Azure CLI >= 2.58
#
# Usage:
#   bash infrastructure/scripts/provision-prod-rg.sh [--dry-run]
#
# After this script succeeds, re-run `pnpm proof:ingest:azure` to refresh
# reports/runtime/azure-runtime-latest.json and verify overallStatus → HEALTHY.

set -euo pipefail

DRY_RUN=false
if [[ "${1:-}" == "--dry-run" ]]; then
  DRY_RUN=true
  echo "::notice:: DRY-RUN mode — no Azure mutations will be made"
fi

SUBSCRIPTION="5d819f33-d16f-429c-a3c0-5b0e94740ba3"
PROD_RG="nzila-canada-prod-rg"
PROD_ENV="nzila-canada-prod-env"
STAGING_RG="nzila-canada-staging-rg"
REGION="canadacentral"
BICEP_MAIN="infrastructure/bicep/main.bicep"
BICEP_PARAMS="infrastructure/bicep/parameters/prod.bicepparam"

# --- Guard: never accidentally target staging ---
if [[ "$PROD_RG" == "$STAGING_RG" ]]; then
  echo "ERROR: PROD_RG and STAGING_RG are the same. Refusing to continue." >&2
  exit 1
fi

run() {
  if $DRY_RUN; then
    echo "[DRY-RUN] $*"
  else
    "$@"
  fi
}

echo "==> Setting subscription"
run az account set --subscription "$SUBSCRIPTION"

echo "==> Creating prod resource group (idempotent)"
run az group create \
  --name "$PROD_RG" \
  --location "$REGION" \
  --tags environment=production project=nzila-os data-residency=canada-only \
  --output none

echo "==> Deploying Bicep infra with env=prod"
run az deployment group create \
  --resource-group "$PROD_RG" \
  --template-file "$BICEP_MAIN" \
  --parameters "@$BICEP_PARAMS" \
  --mode Incremental \
  --output none

echo "==> Verifying Container App Environment was created"
run az containerapp env show \
  --name "$PROD_ENV" \
  --resource-group "$PROD_RG" \
  --query "properties.provisioningState" -o tsv

echo ""
echo "==> Manual migration steps (run after infra is provisioned):"
echo "    The following container apps currently live in $STAGING_RG and must"
echo "    be recreated/moved into $PROD_RG.  Azure Container Apps cannot be"
echo "    moved between resource groups directly; recreate from ACR images."
echo ""
echo "    Production apps to recreate:"
az containerapp list \
  --resource-group "$STAGING_RG" \
  --query "[?contains(name, 'nzila-os-')].{name:name, image:properties.template.containers[0].image}" \
  -o table 2>/dev/null || echo "    (list unavailable in dry-run or if staging RG not accessible)"
echo ""
echo "    For each app:"
echo "      az containerapp create \\"
echo "        --name <app-name> \\"
echo "        --resource-group $PROD_RG \\"
echo "        --environment $PROD_ENV \\"
echo "        --image <current-image> \\"
echo "        ...env-vars, secrets, ingress from staging app definition"
echo ""
echo "    After recreation, update DNS/custom-domain bindings and rotate"
echo "    AZURE_RESOURCE_GROUP secret in GitHub → $PROD_RG."
echo ""
echo "==> Run after migration: pnpm proof:ingest:azure"
echo "    This refreshes azure-runtime-latest.json and should show overallStatus: HEALTHY"
echo ""
echo "✅ provision-prod-rg.sh complete"
