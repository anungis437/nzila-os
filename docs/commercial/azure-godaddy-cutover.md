# Union Eyes: Custom Domain Cutover — Azure + GoDaddy

**Target domains**: `unioneyes.app` (marketing), `www.unioneyes.app` (redirect), `app.unioneyes.app` (authenticated app)  
**Container App**: `nzila-os-union-eyes` in `nzila-canada-staging-rg`, Canada Central  
**Container Apps Environment**: `nzila-canada-staging-env`  
**Default domain**: `nzila-os-union-eyes.jollydune-88c1e97f.canadacentral.azurecontainerapps.io`

---

## Prerequisites

```bash
# Ensure you're logged in and targeting the right subscription
az login
az account set --subscription <your-subscription-id>

# Verify the Container App is healthy
az containerapp show \
  --name nzila-os-union-eyes \
  --resource-group nzila-canada-staging-rg \
  --query "properties.provisioningState" -o tsv
# Expected: Succeeded
```

---

## Step 1 — Add Hostnames to the Container App

Each domain requires its own hostname binding before Azure issues a managed certificate.

```bash
RG="nzila-canada-staging-rg"
APP="nzila-os-union-eyes"

# Apex domain
az containerapp hostname add \
  --hostname unioneyes.app \
  --name "$APP" \
  --resource-group "$RG"

# www subdomain
az containerapp hostname add \
  --hostname www.unioneyes.app \
  --name "$APP" \
  --resource-group "$RG"

# app subdomain (authenticated app entry point)
az containerapp hostname add \
  --hostname app.unioneyes.app \
  --name "$APP" \
  --resource-group "$RG"
```

Each command will output a **domain verification token** (a TXT record value). Record these — you need them in Step 2.

To retrieve verification tokens at any time:

```bash
az containerapp hostname list \
  --name nzila-os-union-eyes \
  --resource-group nzila-canada-staging-rg \
  -o table
```

---

## Step 2 — Add DNS Records in GoDaddy

Log in to GoDaddy → "My Products" → `unioneyes.app` → DNS → Manage DNS.

### 2a. Domain Verification TXT Records (do these first)

Azure needs to verify you own the domain before issuing a certificate. Add one TXT record per domain:

| Type | Name (Host) | Value | TTL |
|---|---|---|---|
| TXT | `@` | `<verification-token-for-unioneyes.app>` | 600 |
| TXT | `www` | `<verification-token-for-www.unioneyes.app>` | 600 |
| TXT | `app` | `<verification-token-for-app.unioneyes.app>` | 600 |

Replace `<verification-token-...>` with the values from Step 1.

### 2b. Apex Domain — ALIAS Record (GoDaddy supports ALIAS)

GoDaddy supports ALIAS records (also called ANAME) for the apex domain. This allows the apex to point to a hostname instead of an IP address, which is required for Azure Container Apps (which use a DNS hostname, not a static IP).

| Type | Name (Host) | Points to | TTL |
|---|---|---|---|
| ALIAS | `@` | `nzila-os-union-eyes.jollydune-88c1e97f.canadacentral.azurecontainerapps.io` | 600 |

> **Note**: If GoDaddy's DNS editor does not show ALIAS as a record type, use their "Forwarding" feature for the apex, or contact GoDaddy support to enable ALIAS. Alternatively, delegate DNS to Azure DNS (see Appendix A).

### 2c. Subdomains — CNAME Records

| Type | Name (Host) | Points to | TTL |
|---|---|---|---|
| CNAME | `www` | `nzila-os-union-eyes.jollydune-88c1e97f.canadacentral.azurecontainerapps.io` | 600 |
| CNAME | `app` | `nzila-os-union-eyes.jollydune-88c1e97f.canadacentral.azurecontainerapps.io` | 600 |

---

## Step 3 — Bind Managed Certificates

After DNS propagation (typically 5–30 minutes; allow up to 1 hour), bind the managed TLS certificates:

```bash
ENV="nzila-canada-staging-env"
RG="nzila-canada-staging-rg"
APP="nzila-os-union-eyes"

az containerapp hostname bind \
  --hostname unioneyes.app \
  --name "$APP" \
  --resource-group "$RG" \
  --environment "$ENV" \
  --validation-method CNAME

az containerapp hostname bind \
  --hostname www.unioneyes.app \
  --name "$APP" \
  --resource-group "$RG" \
  --environment "$ENV" \
  --validation-method CNAME

az containerapp hostname bind \
  --hostname app.unioneyes.app \
  --name "$APP" \
  --resource-group "$RG" \
  --environment "$ENV" \
  --validation-method CNAME
```

> For the apex domain (`unioneyes.app`) use `--validation-method HTTP` if CNAME validation fails (apex CNAMEs are not standard; GoDaddy's ALIAS record may not pass CNAME validation).

Certificate provisioning typically takes 2–10 minutes. Monitor with:

```bash
az containerapp hostname list \
  --name nzila-os-union-eyes \
  --resource-group nzila-canada-staging-rg \
  --query "[].{hostname:name, bindingType:bindingType, certStatus:customDomainVerificationId}" \
  -o table
```

---

## Step 4 — Verify

```bash
# Check all hostnames are bound with certificates
az containerapp hostname list \
  --name nzila-os-union-eyes \
  --resource-group nzila-canada-staging-rg \
  -o table

# Manual smoke check
curl -I https://unioneyes.app
curl -I https://www.unioneyes.app
curl -I https://app.unioneyes.app
```

Expected: HTTP 200 or 301/302 (redirect), TLS handshake succeeds, certificate issuer is "Microsoft Azure" or "Let's Encrypt via Azure".

---

## Step 5 — Post-Cutover GitHub Secret

Once the custom domain is verified, set the GitHub secret to enable custom domain smoke checks in CI:

```bash
gh secret set UE_CUSTOM_DOMAIN_ACTIVE --body "true" --repo anungis437/nzila-os
```

This enables the `Custom domain smoke check (unioneyes.app)` step in `gitops-deploy.yml`.

---

## Step 6 — Add www → apex Redirect (Optional)

To redirect `www.unioneyes.app` → `unioneyes.app`, add a route in the Next.js config or use Azure Container Apps' ingress rules. The simplest approach is a Next.js redirect in `next.config.ts`:

```typescript
async redirects() {
  return [
    {
      source: '/:path*',
      has: [{ type: 'host', value: 'www.unioneyes.app' }],
      destination: 'https://unioneyes.app/:path*',
      permanent: true,
    },
  ];
},
```

---

## Rollback Plan

If the custom domain causes issues, the Container App continues to respond on its default Azure domain:

```
https://nzila-os-union-eyes.jollydune-88c1e97f.canadacentral.azurecontainerapps.io
```

To remove a custom hostname binding:

```bash
az containerapp hostname delete \
  --hostname unioneyes.app \
  --name nzila-os-union-eyes \
  --resource-group nzila-canada-staging-rg \
  --yes
```

Then revert the GoDaddy ALIAS/CNAME records.

---

## Appendix A — Delegating to Azure DNS (Optional)

If GoDaddy's DNS editor does not support ALIAS records for the apex, the cleanest solution is to delegate the `unioneyes.app` zone to Azure DNS:

1. Create an Azure DNS zone: `az network dns zone create --name unioneyes.app --resource-group nzila-canada-staging-rg`
2. Note the 4 Azure name servers returned
3. In GoDaddy, replace the nameservers with the 4 Azure ones
4. Add all DNS records in Azure DNS instead of GoDaddy

This also gives you Azure Monitor integration for DNS query logging.

---

## Estimated Timeline

| Activity | Duration |
|---|---|
| Step 1 (hostname add commands) | 5 minutes |
| Step 2 (GoDaddy DNS update) | 10 minutes |
| DNS propagation | 5–60 minutes |
| Step 3 (certificate binding) | 2–10 minutes per domain |
| Total cutover window | ~1–2 hours |

**Best time to run**: Low-traffic window. The Container App remains accessible on its Azure default domain throughout — there is no downtime during cutover.
