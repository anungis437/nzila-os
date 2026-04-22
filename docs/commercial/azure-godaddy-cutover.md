# Union Eyes: Custom Domain Cutover — Azure Container Apps + Registrar-Only GoDaddy

This runbook covers dual-environment topology with separate production and staging hostnames while preserving Azure default hostnames as fallback.

## Target Topology

- Production marketing: unioneyes.app
- Production web app: app.unioneyes.app
- Production redirect host: www.unioneyes.app -> unioneyes.app
- Staging marketing: staging.unioneyes.app
- Staging web app: staging-app.unioneyes.app

## Azure Resources

- Resource group: nzila-canada-staging-rg
- Container Apps environment: nzila-canada-staging-env
- Production app: nzila-os-union-eyes
- Staging app: nzila-os-union-eyes-staging

## Default Azure Hostnames (must remain available)

- Production app default host: nzila-os-union-eyes.jollydune-88c1e97f.canadacentral.azurecontainerapps.io
- Staging app default host: nzila-os-union-eyes-staging.jollydune-88c1e97f.canadacentral.azurecontainerapps.io

## Prerequisites

```bash
az login
az account set --subscription <your-subscription-id>

RG="nzila-canada-staging-rg"
ENV="nzila-canada-staging-env"
PROD_APP="nzila-os-union-eyes"
STAGE_APP="nzila-os-union-eyes-staging"

az extension add --name containerapp --upgrade

az containerapp show --name "$PROD_APP" --resource-group "$RG" --query "properties.provisioningState" -o tsv
az containerapp show --name "$STAGE_APP" --resource-group "$RG" --query "properties.provisioningState" -o tsv
```

## Step 1 — Add Custom Hostnames in Azure

```bash
RG="nzila-canada-staging-rg"
PROD_APP="nzila-os-union-eyes"
STAGE_APP="nzila-os-union-eyes-staging"

# Production hostnames
az containerapp hostname add --hostname unioneyes.app --name "$PROD_APP" --resource-group "$RG"
az containerapp hostname add --hostname www.unioneyes.app --name "$PROD_APP" --resource-group "$RG"
az containerapp hostname add --hostname app.unioneyes.app --name "$PROD_APP" --resource-group "$RG"

# Staging hostnames
az containerapp hostname add --hostname staging.unioneyes.app --name "$STAGE_APP" --resource-group "$RG"
az containerapp hostname add --hostname staging-app.unioneyes.app --name "$STAGE_APP" --resource-group "$RG"
```

Capture verification IDs:

```bash
az containerapp hostname list --name "$PROD_APP" --resource-group "$RG" -o table
az containerapp hostname list --name "$STAGE_APP" --resource-group "$RG" -o table
```

## Step 2 — Configure Authoritative DNS (Cloudflare Recommended)

Add verification TXT records first, then routing records at the authoritative DNS provider.

### Verification TXT Records

| Type | Name | Value | TTL |
|---|---|---|---|
| TXT | @ | <verification-token-for-unioneyes.app> | 600 |
| TXT | www | <verification-token-for-www.unioneyes.app> | 600 |
| TXT | app | <verification-token-for-app.unioneyes.app> | 600 |
| TXT | staging | <verification-token-for-staging.unioneyes.app> | 600 |
| TXT | staging-app | <verification-token-for-staging-app.unioneyes.app> | 600 |

### Routing Records

| Type | Name | Points to | TTL |
|---|---|---|---|
| ALIAS | @ | nzila-os-union-eyes.jollydune-88c1e97f.canadacentral.azurecontainerapps.io | 600 |
| CNAME | www | nzila-os-union-eyes.jollydune-88c1e97f.canadacentral.azurecontainerapps.io | 600 |
| CNAME | app | nzila-os-union-eyes.jollydune-88c1e97f.canadacentral.azurecontainerapps.io | 600 |
| CNAME | staging | nzila-os-union-eyes-staging.jollydune-88c1e97f.canadacentral.azurecontainerapps.io | 600 |
| CNAME | staging-app | nzila-os-union-eyes-staging.jollydune-88c1e97f.canadacentral.azurecontainerapps.io | 600 |

Notes:

- Keep existing Azure default hostname access for both apps during and after cutover.
- In registrar-only mode, GoDaddy only hosts nameserver delegation.
- For Cloudflare, apex CNAME flattening handles the @ record.

## Step 3 — Bind Managed Certificates

```bash
RG="nzila-canada-staging-rg"
ENV="nzila-canada-staging-env"
PROD_APP="nzila-os-union-eyes"
STAGE_APP="nzila-os-union-eyes-staging"

# Production certs
az containerapp hostname bind --hostname unioneyes.app --name "$PROD_APP" --resource-group "$RG" --environment "$ENV" --validation-method CNAME
az containerapp hostname bind --hostname www.unioneyes.app --name "$PROD_APP" --resource-group "$RG" --environment "$ENV" --validation-method CNAME
az containerapp hostname bind --hostname app.unioneyes.app --name "$PROD_APP" --resource-group "$RG" --environment "$ENV" --validation-method CNAME

# Staging certs
az containerapp hostname bind --hostname staging.unioneyes.app --name "$STAGE_APP" --resource-group "$RG" --environment "$ENV" --validation-method CNAME
az containerapp hostname bind --hostname staging-app.unioneyes.app --name "$STAGE_APP" --resource-group "$RG" --environment "$ENV" --validation-method CNAME
```

If apex validation fails with CNAME, retry apex with HTTP validation:

```bash
az containerapp hostname bind --hostname unioneyes.app --name "$PROD_APP" --resource-group "$RG" --environment "$ENV" --validation-method HTTP
```

## Step 4 — Verify End-to-End

```bash
RG="nzila-canada-staging-rg"
PROD_APP="nzila-os-union-eyes"
STAGE_APP="nzila-os-union-eyes-staging"

az containerapp hostname list --name "$PROD_APP" --resource-group "$RG" -o table
az containerapp hostname list --name "$STAGE_APP" --resource-group "$RG" -o table

curl -I https://unioneyes.app
curl -I https://www.unioneyes.app
curl -I https://app.unioneyes.app
curl -I https://staging.unioneyes.app
curl -I https://staging-app.unioneyes.app

curl -I https://nzila-os-union-eyes.jollydune-88c1e97f.canadacentral.azurecontainerapps.io
curl -I https://nzila-os-union-eyes-staging.jollydune-88c1e97f.canadacentral.azurecontainerapps.io
```

Expected:

- 200/301/302/307/308 status on custom domains.
- Valid managed cert on each custom hostname.
- Azure default hostnames still serve traffic.
- www redirects to apex.

## Step 5 — GitHub Environment Flags

Enable custom-domain smoke checks after DNS and certs are active:

```bash
gh secret set UE_CUSTOM_DOMAIN_ACTIVE --env production --body "true" --repo anungis437/nzila-os
gh secret set UE_CUSTOM_DOMAIN_ACTIVE --env staging --body "true" --repo anungis437/nzila-os

Set DNS automation values in GitHub environments:

```bash
gh variable set DNS_AUTOMATION_ENABLED --env production --body "true" --repo anungis437/nzila-os
gh variable set DNS_AUTOMATION_ENABLED --env staging --body "true" --repo anungis437/nzila-os
gh variable set DNS_PROVIDER --env production --body "cloudflare" --repo anungis437/nzila-os
gh variable set DNS_PROVIDER --env staging --body "cloudflare" --repo anungis437/nzila-os
gh variable set DNS_ZONE_NAME --env production --body "unioneyes.app" --repo anungis437/nzila-os
gh variable set DNS_ZONE_NAME --env staging --body "unioneyes.app" --repo anungis437/nzila-os
gh variable set DNS_ZONE_ID --env production --body "<cloudflare-zone-id>" --repo anungis437/nzila-os
gh variable set DNS_ZONE_ID --env staging --body "<cloudflare-zone-id>" --repo anungis437/nzila-os
gh secret set DNS_API_TOKEN --env production --body "<cloudflare-token>" --repo anungis437/nzila-os
gh secret set DNS_API_TOKEN --env staging --body "<cloudflare-token>" --repo anungis437/nzila-os
```
```

## Rollback

If a custom domain breaks:

```bash
RG="nzila-canada-staging-rg"
az containerapp hostname delete --hostname unioneyes.app --name nzila-os-union-eyes --resource-group "$RG" --yes
az containerapp hostname delete --hostname app.unioneyes.app --name nzila-os-union-eyes --resource-group "$RG" --yes
az containerapp hostname delete --hostname staging.unioneyes.app --name nzila-os-union-eyes-staging --resource-group "$RG" --yes
az containerapp hostname delete --hostname staging-app.unioneyes.app --name nzila-os-union-eyes-staging --resource-group "$RG" --yes
```

Then revert ALIAS/CNAME records to previous values or remove them. Continue access through Azure default hostnames while repairing DNS/certs.

## Operational Risk Note

Production currently runs in staging-named Azure infrastructure (resource group and environment). This is intentionally preserved to avoid disruption but should be tracked as a naming and governance risk.
