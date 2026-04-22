# DNS Cutover Zero-Downtime Runbook

## Goal

Cut over authoritative DNS with no customer-visible downtime and no loss of staging availability.

## Strategy

- Keep old authoritative DNS serving until new provider is fully prepared.
- Pre-stage all records and validate both DNS and HTTPS before nameserver switch.
- Preserve Azure default hostnames for emergency bypass.

## Cutover Timeline

### T-24h

1. Reduce TTL to 300 at current authoritative DNS.
2. Verify Azure hostname bindings and cert state for:
   - unioneyes.app
   - www.unioneyes.app
   - app.unioneyes.app
   - staging.unioneyes.app
   - staging-app.unioneyes.app

### T-2h

1. Run API and configuration preflight:

```bash
pnpm dns:check
pnpm dns:sync -- --dry-run
```

2. Apply desired DNS records:

```bash
pnpm dns:sync
```

3. Validate target state:

```bash
pnpm dns:verify
pnpm dns:health
```

### T-0

1. Change registrar nameservers to the new authoritative provider.
2. Start propagation watch loop:

```bash
while true; do pnpm dns:verify && break; sleep 120; done
```

3. Confirm workflow smoke checks are green in both staging and production deploy pipelines.

### T+1h

1. Raise TTL back to 600 (or operational baseline).
2. Record generated reports:
   - reports/ops/dns-health.json
   - reports/ops/dns-health.md

## Validation Matrix

- DNS resolution:
  - unioneyes.app resolves to production origin via apex flattening/A records
  - app.unioneyes.app CNAME to production origin
  - staging.unioneyes.app and staging-app.unioneyes.app to staging origin
- HTTPS:
  - 200/301/302/307/308 on all five hostnames
- App behavior:
  - staging remains noindex
  - production metadata remains canonical

## Rollback Triggers

Trigger rollback if any condition persists for more than 15 minutes:

- dns:verify failing for required hosts
- TLS errors on production hostnames
- Persistent 5xx responses on custom domains

## Rollback Actions

1. Revert registrar nameservers to previous authoritative DNS.
2. Keep Azure default hostnames available for operational access.
3. Pause deployments until dns:verify is green.
