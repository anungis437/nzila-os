# How-To: Rotate Secrets

## Overview

Secret rotation is managed by `@nzila/secrets`. All production secrets are stored
in Azure Key Vault and should be rotated on a schedule.

## Default Rotation Schedule

| Secret Type | Interval | Auto-Rotate |
|-------------|----------|-------------|
| API Keys (third-party integrations) | 90 days | No (manual) |
| Database Passwords | 90 days | Yes |
| OAuth Client Secrets (Entra External ID) | 180 days | No |
| TLS Certificates | 365 days | Yes (via Azure) |
| Application Auth/Session Secret (`AUTH_SECRET`) | 90 days | No (manual) |

## Step 1: Check Rotation Status

```typescript
import { SecretRotationManager } from '@nzila/secrets/rotation';

const manager = new SecretRotationManager();

manager.registerPolicy({
  secretName: 'auth-secret',
  rotationIntervalDays: 90,
  lastRotated: new Date('2025-01-01'),
  rotationType: 'app_secret',
});

const status = manager.getRotationStatus();
console.log('Overdue:', status.overdue.map(p => p.secretName));
console.log('Upcoming:', status.upcoming.map(p => p.secretName));
```

## Step 2: Rotate in Azure Key Vault

```bash
# Using Azure CLI
az keyvault secret set \
  --vault-name nzila-canada-prod-kv \
  --name auth-secret \
  --value "NEW_SECRET_VALUE"
```

## Step 3: Record the Rotation Event

```typescript
manager.recordRotation({
  secretName: 'auth-secret',
  rotationType: 'app_secret',
  newVersion: 'v2025-04',
  rotatedAt: new Date(),
  rotatedBy: 'manual',
});
```

## Step 4: Invalidate Cache

If using `KeyVaultClient` with caching, invalidate the rotated secret:

```typescript
import { KeyVaultClient } from '@nzila/secrets/keyvault';

const client = new KeyVaultClient({ vaultUrl: process.env.AZURE_KEY_VAULT_URL! });
client.invalidate('auth-secret');
```

## Emergency Rotation

If a secret is compromised:

1. **Immediately** rotate in Azure Key Vault
2. Invalidate all caches (`client.clearCache()`)
3. Restart affected services
4. Follow the [Secret Compromise Runbook](../runbooks/secret-compromise.md)
5. Create an incident report
