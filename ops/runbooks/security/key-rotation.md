---
id: sec-002
title: Secret & Key Rotation Runbook
severity: P2
owner: "@nzila/platform"
review_cycle: quarterly
last_reviewed: 2026-02-20
---

# Secret & Key Rotation Runbook

## Overview

All production secrets are stored in **Azure Key Vault** (`nzila-kv`). Applications load secrets at startup via `@nzila/os-core/config/env`. **Never** put secrets in `.env` files, code, or CI environment variables directly.

---

## Rotation Schedule

| Secret | Rotation Period | Urgency Window |
|--------|----------------|----------------|
| `AUTH_SECRET` | 90 days | < 7 days after suspected compromise |
| `DATABASE_URL` | 180 days | Immediate on any suspected exposure |
| `STRIPE_SECRET_KEY` | 90 days | Immediate on any suspected exposure |
| `STRIPE_WEBHOOK_SECRET` | Per Stripe endpoint lifecycle | On webhook endpoint modification |
| `QBO_CLIENT_SECRET` | Annual (QBO requirement) | On suspected OAuth token theft |
| `AZURE_STORAGE_KEY` | 180 days | Immediate on any exposure |
| `OPENAI_API_KEY` | 90 days | Immediate on budget anomaly |

---

## Rotation Procedures

### Auth Secret (AUTH_SECRET)

```bash
# 1. Generate new secret: openssl rand -base64 32
# 2. Store in Azure Key Vault
az keyvault secret set \
  --vault-name nzila-kv \
  --name AUTH-SECRET \
  --value "<generated-secret>"

# 3. Trigger rolling restart of console + partners
# (Container Apps pull secrets from Key Vault at startup)
az containerapp revision restart \
  --resource-group nzila-rg \
  --name nzila-console
az containerapp revision restart \
  --resource-group nzila-rg \
  --name nzila-partners

# 4. Verify health endpoints in each app
curl https://console.nzila.app/api/health
curl https://partners.nzila.app/api/health

# 5. Discard old AUTH_SECRET (after 5 min grace period — sessions will re-authenticate)
```

### Database URL / Password

```bash
# 1. Generate new password
NEW_PASSWORD=$(openssl rand -base64 32)

# 2. Update Azure PostgreSQL
az postgres flexible-server parameter set \
  --resource-group nzila-rg \
  --server-name nzila-db \
  --name password \
  --value "$NEW_PASSWORD"

# 3. Update Key Vault with new connection string
az keyvault secret set \
  --vault-name nzila-kv \
  --name DATABASE-URL \
  --value "postgres://nzila:${NEW_PASSWORD}@nzila-db.postgres.database.azure.com:5432/nzila"

# 4. Rolling restart all services that use the DB
# (console, orchestrator-api)

# 5. Run migration check to verify connectivity
pnpm --filter @nzila/db run migration:check
```

### Stripe Secret Key

```bash
# 1. Create new restricted key in Stripe Dashboard
# 2. Store in Key Vault
az keyvault secret set \
  --vault-name nzila-kv \
  --name STRIPE-SECRET-KEY \
  --value "sk_live_xxxxxxxxxxx"

# 3. Also update STRIPE_WEBHOOK_SECRET if webhook endpoints changed
az keyvault secret set \
  --vault-name nzila-kv \
  --name STRIPE-WEBHOOK-SECRET \
  --value "whsec_xxxxxxxxxxxx"

# 4. Verify Stripe integration is operational
curl https://console.nzila.app/api/health
```

---

## Emergency Revocation

If a secret is suspected to be compromised:

```bash
# Revoke immediately in the upstream provider (Entra ID, Stripe, etc.)
# THEN update Key Vault
# THEN trigger rolling restart

# Don't wait — revoke first, fix later
```

---

## Audit

After every rotation, create a record:
```bash
# Log to audit system
echo "$(date -u +%Y-%m-%dT%H:%M:%SZ) | KEY_ROTATION | AUTH_SECRET | rotated by @engineer" \
  >> ops/change-management/key-rotation-log.txt
git add ops/change-management/key-rotation-log.txt
git commit -m "sec: rotate AUTH_SECRET [$(date -u +%Y-%m-%d)]"
```

---

## Verification

After any rotation, run the full contract test suite to verify env validation still passes:

```bash
pnpm contract-tests
```

---

## Contacts

| Role | Contact |
|------|---------|
| Key Vault owner | `@nzila/platform` |
| Stripe account owner | finance@nzila.app |
| Entra ID / platform-auth owner | ops@nzila.app |
| QBO integration owner | finance@nzila.app |
