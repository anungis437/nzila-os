# DNS Secrets Policy

## Purpose

Define required secret handling controls for DNS automation and cutover workflows.

## Required Secrets

- DNS_API_TOKEN

## Required Non-Secret Variables

- DNS_AUTOMATION_ENABLED
- DNS_PROVIDER
- DNS_ZONE_NAME
- DNS_ZONE_ID
- DNS_PROD_ORIGIN
- DNS_STAGING_ORIGIN
- DNS_TTL (optional, defaults to 600)

## Secret Storage Rules

- Store DNS_API_TOKEN in GitHub environment secrets only, never repository variables.
- Mirror DNS_API_TOKEN in Azure Key Vault for operational runbooks.
- Do not log or print token values in scripts, CI, or markdown reports.
- Use least-privilege token scopes:
  - Zone:Read
  - DNS:Edit

## Rotation Rules

- Rotate DNS_API_TOKEN every 90 days or immediately after suspected exposure.
- Rotate before and after major DNS provider migrations.
- After rotation, run:

```bash
pnpm exec tsx scripts/dns/check.ts
pnpm exec tsx scripts/dns/verify.ts
```

## Legacy Registrar Credentials

- GODADDY_API_KEY and GODADDY_API_SECRET are optional legacy values.
- GoDaddy remains registrar-only and is not required for authoritative DNS automation.
- Do not block deployment on GoDaddy API eligibility.

## CI/CD Enforcement

- Deploy workflows must fail fast when DNS_AUTOMATION_ENABLED=true and required DNS settings are missing.
- Post-deploy DNS verification is required when automation is enabled.

## Origin IP Allowlisting Policy

- If origin infrastructure is self-managed (VM, Kubernetes node, or hardware), allowlist Cloudflare proxy IP ranges for HTTP/HTTPS.
- Do not block Cloudflare proxy ranges in upstream firewalls, WAF plugins, or host intrusion tools.
- If strict origin hardening is enabled, block non-Cloudflare HTTP/HTTPS traffic after allowlisting Cloudflare and trusted integrations.
- Refresh allowlists when Cloudflare ranges change. Use:

```bash
pnpm exec tsx scripts/dns/cloudflare-ips.ts
```
