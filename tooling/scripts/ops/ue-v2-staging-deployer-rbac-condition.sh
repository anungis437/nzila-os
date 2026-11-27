#!/usr/bin/env bash
# Owner-run. Updates the staging deploy identity's conditioned
# "Role Based Access Control Administrator" assignment on nzila-canada-staging-rg so
# the Bicep-declared base-operations Reader grants (app identity -> six core jobs and
# the PostgreSQL server; ARM metadata only) can be created and removed.
#
# Allowed after the change:
#   write : Key Vault Secrets User / Key Vault Crypto User to any ServicePrincipal (unchanged)
#           Reader ONLY to the staging app identity nzila-ue-v2-staging-id (new)
#   delete: Key Vault Secrets User / Key Vault Crypto User assignments (unchanged)
#           Reader assignments ONLY of the staging app identity (new)
#
# Default is a dry run that prints the current and proposed condition. Pass --apply to write.
# Requires: az login to the staging tenant; Owner or User Access Administrator on the RG.
set -euo pipefail

SUBSCRIPTION=d562ba7f-d891-4504-a489-10917c0ebaaf
STAGING_RG=nzila-canada-staging-rg
CICD_RG="${CICD_RG:-nzila-canada-cicd-rg}"
DEPLOY_IDENTITY=nzila-os-ue-staging-deploy
APP_IDENTITY=nzila-ue-v2-staging-id
KV_SECRETS_USER=4633458b-17de-408a-b874-0445c86b69e6 # gitleaks:allow — public built-in Azure role definition ID
KV_CRYPTO_USER=12338af0-0e69-4776-bea7-57ae8d297424 # gitleaks:allow — public built-in Azure role definition ID
READER=acdd72a7-3385-48ef-bd42-f606fba81ae7 # gitleaks:allow — public built-in Azure role definition ID
APPLY=false
[ "${1:-}" = "--apply" ] && APPLY=true

az account set --subscription "$SUBSCRIPTION"
STAGING_RG_ID=$(az group show -n "$STAGING_RG" --query id -o tsv)
DEPLOY_PID=$(az identity show -g "$CICD_RG" -n "$DEPLOY_IDENTITY" --query principalId -o tsv)
APP_PID=$(az identity show -g "$STAGING_RG" -n "$APP_IDENTITY" --query principalId -o tsv)
GUID='^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
[[ "$DEPLOY_PID" =~ $GUID && "$APP_PID" =~ $GUID ]] || { echo "identity lookup failed" >&2; exit 1; }

WORK=$(mktemp -d); trap 'rm -rf "$WORK"' EXIT
az role assignment list --assignee "$DEPLOY_PID" --scope "$STAGING_RG_ID" \
  --role "Role Based Access Control Administrator" -o json \
  | jq --arg scope "$STAGING_RG_ID" '[.[] | select((.scope|ascii_downcase) == ($scope|ascii_downcase))]' > "$WORK/current.json"
[ "$(jq length "$WORK/current.json")" = "1" ] || { echo "expected exactly one conditioned RBAC administrator assignment at $STAGING_RG_ID" >&2; jq . "$WORK/current.json" >&2; exit 1; }
jq -e --arg kvs "$KV_SECRETS_USER" '.[0].condition | contains($kvs)' "$WORK/current.json" >/dev/null \
  || { echo "current assignment is not the expected conditioned Key Vault delegation; refusing" >&2; exit 1; }

RA='Microsoft.Authorization/roleAssignments'
CONDITION="((!(ActionMatches{'$RA/write'})) OR ((@Request[$RA:RoleDefinitionId] ForAnyOfAnyValues:GuidEquals {$KV_SECRETS_USER, $KV_CRYPTO_USER} AND @Request[$RA:PrincipalType] StringEqualsIgnoreCase 'ServicePrincipal') OR (@Request[$RA:RoleDefinitionId] ForAnyOfAnyValues:GuidEquals {$READER} AND @Request[$RA:PrincipalId] ForAnyOfAnyValues:GuidEquals {$APP_PID} AND @Request[$RA:PrincipalType] StringEqualsIgnoreCase 'ServicePrincipal'))) AND ((!(ActionMatches{'$RA/delete'})) OR (@Resource[$RA:RoleDefinitionId] ForAnyOfAnyValues:GuidEquals {$KV_SECRETS_USER, $KV_CRYPTO_USER}) OR (@Resource[$RA:RoleDefinitionId] ForAnyOfAnyValues:GuidEquals {$READER} AND @Resource[$RA:PrincipalId] ForAnyOfAnyValues:GuidEquals {$APP_PID}))"

echo "Assignment: $(jq -r '.[0].id' "$WORK/current.json")"
echo; echo "Current condition:"; jq -r '.[0].condition' "$WORK/current.json"
echo; echo "Proposed condition:"; echo "$CONDITION"
if [ "$APPLY" != true ]; then echo; echo "Dry run. Re-run with --apply to write."; exit 0; fi

jq --arg c "$CONDITION" '.[0] | .condition = $c | .conditionVersion = "2.0"' "$WORK/current.json" > "$WORK/updated.json"
az role assignment update --role-assignment "@$WORK/updated.json" -o none
az role assignment list --assignee "$DEPLOY_PID" --scope "$STAGING_RG_ID" --role "Role Based Access Control Administrator" \
  --query "[].{scope:scope, condition:condition}" -o json
echo "Updated."
