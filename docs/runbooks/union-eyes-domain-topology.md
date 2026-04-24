# Union Eyes Domain Topology Runbook

## Purpose

Defines production and staging domain topology for Union Eyes on Azure Container Apps, with command-level deployment and rollback guidance.

## Environment Map

| Environment | Branch trigger | Container App | Marketing URL | App URL |
|---|---|---|---|---|
| production | main | nzila-os-union-eyes | <https://unioneyes.app> | <https://app.unioneyes.app> |
| staging | develop | nzila-os-union-eyes-staging | <https://staging.unioneyes.app> | <https://staging-app.unioneyes.app> |

## Azure Resource Map

| Resource type | Name | Notes |
|---|---|---|
| Resource group | nzila-canada-staging-rg | Hosts both prod and staging Union Eyes apps |
| ACA environment | nzila-canada-staging-env | Shared by prod and staging apps |
| ACR | nzilacanadaacr.azurecr.io | Image registry |
| Production app | nzila-os-union-eyes | Public production workload |
| Staging app | nzila-os-union-eyes-staging | Public staging workload |

## Default Azure Hostnames

- <https://nzila-os-union-eyes.jollydune-88c1e97f.canadacentral.azurecontainerapps.io>
- <https://nzila-os-union-eyes-staging.jollydune-88c1e97f.canadacentral.azurecontainerapps.io>

Keep both default hostnames reachable as break-glass fallback.

## Required App Configuration

Set per environment:

- NEXT_PUBLIC_APP_ENV
- UE_ENVIRONMENT
- UE_MARKETING_URL
- UE_APP_URL
- NEXT_PUBLIC_SITE_URL
- NEXT_PUBLIC_APP_URL
- NEXT_PUBLIC_SITE_URL_STAGING
- NEXT_PUBLIC_APP_URL_STAGING

## Required GitHub Environment Variables

Set these as GitHub environment-level variables to avoid hardcoding Azure resource names in workflow logic:

- AZURE_RESOURCE_GROUP_PRODUCTION
- AZURE_CONTAINERAPPS_ENVIRONMENT_PRODUCTION
- AZURE_RESOURCE_GROUP_STAGING
- AZURE_CONTAINERAPPS_ENVIRONMENT_STAGING
- AZURE_ACR_NAME
- DNS_AUTOMATION_ENABLED
- DNS_PROVIDER
- DNS_ZONE_NAME
- DNS_ZONE_ID
- DNS_PROD_ORIGIN
- DNS_STAGING_ORIGIN

Fallback defaults are still present for backward compatibility:

- nzila-canada-staging-rg
- nzila-canada-staging-env
- nzilacanadaacr

## Staging App Provisioning (One-Time)

Run if nzila-os-union-eyes-staging does not already exist.

```bash
RG="nzila-canada-staging-rg"
ENV="nzila-canada-staging-env"
ACR="nzilacanadaacr.azurecr.io"
APP="nzila-os-union-eyes-staging"

az containerapp create \
  --name "$APP" \
  --resource-group "$RG" \
  --environment "$ENV" \
  --image "$ACR/nzila-os-union-eyes:staging" \
  --target-port 3000 \
  --ingress external \
  --cpu 1.0 \
  --memory 2Gi \
  --min-replicas 1 \
  --max-replicas 3 \
  --registry-server "$ACR"
```

Add backend sidecar if required by your runtime topology:

```bash
az containerapp update \
  --name nzila-os-union-eyes-staging \
  --resource-group nzila-canada-staging-rg \
  --container-name django-backend \
  --image nzilacanadaacr.azurecr.io/nzila-os-union-eyes-backend:staging
```

## Domain Binding Commands

```bash
RG="nzila-canada-staging-rg"
ENV="nzila-canada-staging-env"
PROD_APP="nzila-os-union-eyes"
STAGE_APP="nzila-os-union-eyes-staging"

az containerapp hostname add --hostname unioneyes.app --name "$PROD_APP" --resource-group "$RG"
az containerapp hostname add --hostname www.unioneyes.app --name "$PROD_APP" --resource-group "$RG"
az containerapp hostname add --hostname app.unioneyes.app --name "$PROD_APP" --resource-group "$RG"

az containerapp hostname add --hostname staging.unioneyes.app --name "$STAGE_APP" --resource-group "$RG"
az containerapp hostname add --hostname staging-app.unioneyes.app --name "$STAGE_APP" --resource-group "$RG"

az containerapp hostname bind --hostname unioneyes.app --name "$PROD_APP" --resource-group "$RG" --environment "$ENV" --validation-method CNAME
az containerapp hostname bind --hostname www.unioneyes.app --name "$PROD_APP" --resource-group "$RG" --environment "$ENV" --validation-method CNAME
az containerapp hostname bind --hostname app.unioneyes.app --name "$PROD_APP" --resource-group "$RG" --environment "$ENV" --validation-method CNAME

az containerapp hostname bind --hostname staging.unioneyes.app --name "$STAGE_APP" --resource-group "$RG" --environment "$ENV" --validation-method CNAME
az containerapp hostname bind --hostname staging-app.unioneyes.app --name "$STAGE_APP" --resource-group "$RG" --environment "$ENV" --validation-method CNAME
```

## Authoritative DNS Table (Provider-Neutral)

| Type | Host | Value | TTL |
|---|---|---|---|
| CNAME | @ | nzila-os-union-eyes.jollydune-88c1e97f.canadacentral.azurecontainerapps.io | 600 |
| CNAME | www | nzila-os-union-eyes.jollydune-88c1e97f.canadacentral.azurecontainerapps.io | 600 |
| CNAME | app | nzila-os-union-eyes.jollydune-88c1e97f.canadacentral.azurecontainerapps.io | 600 |
| CNAME | staging | nzila-os-union-eyes-staging.jollydune-88c1e97f.canadacentral.azurecontainerapps.io | 600 |
| CNAME | staging-app | nzila-os-union-eyes-staging.jollydune-88c1e97f.canadacentral.azurecontainerapps.io | 600 |

Verification TXT records are also required for each hostname using tokens emitted by az containerapp hostname add.
GoDaddy is registrar-only in this model. Nameservers should delegate to the selected authoritative DNS provider (Cloudflare recommended).

## Verification

```bash
RG="nzila-canada-staging-rg"
az containerapp hostname list --name nzila-os-union-eyes --resource-group "$RG" -o table
az containerapp hostname list --name nzila-os-union-eyes-staging --resource-group "$RG" -o table

curl -I https://unioneyes.app
curl -I https://app.unioneyes.app
curl -I https://staging.unioneyes.app
curl -I https://staging-app.unioneyes.app
```

Staging should be noindex/noindex-follow protected via app-level robots, sitemap, and host headers.

## Rollback

```bash
RG="nzila-canada-staging-rg"
az containerapp hostname delete --hostname unioneyes.app --name nzila-os-union-eyes --resource-group "$RG" --yes
az containerapp hostname delete --hostname app.unioneyes.app --name nzila-os-union-eyes --resource-group "$RG" --yes
az containerapp hostname delete --hostname staging.unioneyes.app --name nzila-os-union-eyes-staging --resource-group "$RG" --yes
az containerapp hostname delete --hostname staging-app.unioneyes.app --name nzila-os-union-eyes-staging --resource-group "$RG" --yes
```

Restore DNS records as needed and route traffic through the Azure default hostnames until cert/domain issues are resolved.

## Certificate Renewal

Azure-managed certs auto-renew while DNS ownership and hostname bindings remain valid. After DNS migrations, re-run hostname list checks and verify cert state before change completion.

## Known Risk

Production currently uses staging-named Azure infrastructure (nzila-canada-staging-rg and nzila-canada-staging-env). This is functionally acceptable but carries governance and operational clarity risk.
