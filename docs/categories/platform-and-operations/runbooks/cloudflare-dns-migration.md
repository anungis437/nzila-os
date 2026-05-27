# Cloudflare DNS Migration Runbook (Registrar-Only GoDaddy)

## Objective

Move authoritative DNS for unioneyes.app from registrar-managed DNS to Cloudflare, while keeping GoDaddy as registrar only.

## Scope

- Zone: unioneyes.app
- Production hosts: unioneyes.app, <www.unioneyes.app>, app.unioneyes.app
- Staging hosts: staging.unioneyes.app, staging-app.unioneyes.app
- Origin targets:
  - nzila-os-union-eyes.jollydune-88c1e97f.canadacentral.azurecontainerapps.io
  - nzila-os-union-eyes-staging.jollydune-88c1e97f.canadacentral.azurecontainerapps.io

## Preconditions

- Azure hostname bindings are already configured for all five hostnames.
- Azure-managed certificates are active.
- Cloudflare account has permission to create/edit zone records.
- GoDaddy account has access to nameserver settings.

## Required GitHub Environment Variables

Set these in both production and staging environments where applicable:

- DNS_AUTOMATION_ENABLED=true
- DNS_PROVIDER=cloudflare
- DNS_ZONE_NAME=unioneyes.app
- DNS_ZONE_ID=<cloudflare-zone-id>
- DNS_PROD_ORIGIN=nzila-os-union-eyes.jollydune-88c1e97f.canadacentral.azurecontainerapps.io
- DNS_STAGING_ORIGIN=nzila-os-union-eyes-staging.jollydune-88c1e97f.canadacentral.azurecontainerapps.io

## Required GitHub Environment Secret

- DNS_API_TOKEN=<cloudflare-api-token>

Token permissions:

- Zone:Read
- DNS:Edit

## Required Azure Key Vault Secrets

In the active environment vaults, store:

- DNS_PROVIDER
- DNS_ZONE_NAME
- DNS_ZONE_ID
- DNS_API_TOKEN
- DNS_PROD_ORIGIN
- DNS_STAGING_ORIGIN

## Migration Steps

1. Lower DNS TTL to 300 at current authoritative provider (24h before cutover).
2. Create Cloudflare zone for unioneyes.app and import existing records.
3. Add/confirm required records in Cloudflare:

| Type | Name | Target | TTL |
|---|---|---|---|
| CNAME | @ | nzila-os-union-eyes.jollydune-88c1e97f.canadacentral.azurecontainerapps.io | 600 |
| CNAME | www | nzila-os-union-eyes.jollydune-88c1e97f.canadacentral.azurecontainerapps.io | 600 |
| CNAME | app | nzila-os-union-eyes.jollydune-88c1e97f.canadacentral.azurecontainerapps.io | 600 |
| CNAME | staging | nzila-os-union-eyes-staging.jollydune-88c1e97f.canadacentral.azurecontainerapps.io | 600 |
| CNAME | staging-app | nzila-os-union-eyes-staging.jollydune-88c1e97f.canadacentral.azurecontainerapps.io | 600 |

4. Validate API access:

```bash
pnpm exec tsx scripts/dns/check.ts
```

5. Dry-run sync:

```bash
pnpm exec tsx scripts/dns/sync.ts --dry-run
```

6. Apply sync:

```bash
pnpm exec tsx scripts/dns/sync.ts
```

7. Verify DNS and HTTPS:

```bash
pnpm exec tsx scripts/dns/verify.ts
pnpm exec tsx scripts/dns/health.ts
```

8. Update nameservers in GoDaddy to the two Cloudflare-assigned nameservers.
9. Monitor propagation using `pnpm exec tsx scripts/dns/verify.ts` every 2-5 minutes until green.
10. Keep Azure default hostnames as break-glass fallback.

## Origin Firewall Guidance

For VM or bare-metal origins behind Cloudflare proxy, allowlist Cloudflare IP ranges at the origin firewall and drop other HTTP/HTTPS sources.

Generate current ranges and helper rules:

```bash
pnpm exec tsx scripts/dns/cloudflare-ips.ts
```

Outputs:

- reports/ops/cloudflare-ips.json
- reports/ops/cloudflare-origin-firewall.sh

Apply only after review and after adding any trusted partner/vendor ranges.

Note: Azure Container Apps managed ingress does not use host-level iptables in your tenant. This guidance is primarily for self-managed Linux origins.

## AWS VPC Route Conflict Check

Cloudflare can egress from 172.64.0.0/13. If AWS route tables send broad 172.x ranges to internal targets, Cloudflare traffic can be blackholed before the Internet Gateway.

Recommended checks:

1. Inspect route tables for broad 172.x routes to Transit Gateway/VPN/peering.
2. Add a more-specific route for 172.64.0.0/13 to the Internet Gateway.
3. Or narrow broad internal routes to 172.16.0.0/12 only.

## Rollback

- If propagation or certificate checks fail, revert GoDaddy nameservers to prior provider.
- Keep Cloudflare records intact for next maintenance window.
- Route operators to Azure default hostnames during incident response.
