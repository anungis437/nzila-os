# Key Vault Auto-Rotation Runbook

## iSSDLC W2-6: Secret & Certificate Rotation Procedures

### Overview

This runbook covers automated and manual rotation procedures for secrets,
keys, and certificates managed via Azure Key Vault.

---

## 1. Rotation Policy

| Secret Type            | Rotation Interval | Method         | Notification   |
|------------------------|--------------------|----------------|----------------|
| Database passwords     | 90 days            | Automated      | 30 days before |
| API keys (internal)    | 180 days           | Automated      | 30 days before |
| API keys (third-party) | Per vendor policy  | Manual         | 30 days before |
| TLS certificates       | 365 days           | Auto-renewal   | 60 days before |
| Clerk signing keys     | Per Clerk rotation | Manual trigger | 14 days before |
| PagerDuty integration  | 180 days           | Manual         | 30 days before |
| Azure Storage keys     | 90 days            | Automated      | 30 days before |

---

## 2. Automated Rotation (Key Vault Native)

### 2.1 Enable Rotation Policy (Bicep)

Reference: `infrastructure/bicep/modules/keyvault.bicep`

```bicep
resource secret 'Microsoft.KeyVault/vaults/secrets@2023-07-01' = {
  parent: keyVault
  name: 'db-connection-string'
  properties: {
    attributes: {
      enabled: true
    }
    rotationPolicy: {
      lifetimeActions: [
        {
          action: { type: 'Notify' }
          trigger: { timeBeforeExpiry: 'P30D' }
        }
        {
          action: { type: 'Rotate' }
          trigger: { timeAfterCreate: 'P90D' }
        }
      ]
      attributes: {
        expiryTime: 'P90D'
      }
    }
  }
}
```

### 2.2 Event Grid Subscription

Key Vault fires `SecretNearExpiry` and `SecretExpired` events. Wire to:

1. **Azure Function** (rotate-db-password) for PostgreSQL credential rotation
2. **Logic App** (rotate-storage-keys) for storage account key rotation
3. **PagerDuty webhook** for manual rotation alerts

---

## 3. PostgreSQL Password Rotation

### 3.1 Automated Flow

```
Key Vault SecretNearExpiry → Event Grid → Azure Function
  1. Generate new password (32 chars, crypto-random)
  2. ALTER USER nzila PASSWORD 'new_password' on PostgreSQL
  3. Update Key Vault secret with new connection string
  4. Container Apps picks up new secret (restart trigger)
  5. Verify connectivity
  6. Emit audit event
```

### 3.2 Manual Rotation (Emergency)

```bash
# 1. Generate new password
NEW_PASSWORD=$(openssl rand -base64 32)

# 2. Update PostgreSQL
az postgres flexible-server execute \
  --name nzila-pg-staging \
  --resource-group nzila-staging-rg \
  --admin-user nzila_admin \
  --admin-password "$OLD_PASSWORD" \
  --querytext "ALTER USER nzila PASSWORD '$NEW_PASSWORD';"

# 3. Update Key Vault
az keyvault secret set \
  --vault-name nzila-staging-kv \
  --name db-connection-string \
  --value "postgresql://nzila:$NEW_PASSWORD@nzila-pg-staging.postgres.database.azure.com:5432/nzila_automation?sslmode=require"

# 4. Restart Container Apps to pick up new secret
az containerapp revision restart \
  --name nzila-os-web \
  --resource-group nzila-staging-rg

# 5. Verify
curl -s https://nzila-os-web.delightfulisland-0d503d3c.eastus.azurecontainerapps.io/api/health
```

---

## 4. Storage Key Rotation

```bash
# Rotate storage account key
az storage account keys renew \
  --account-name nzilastagingstore \
  --resource-group nzila-staging-rg \
  --key key1

# Update Key Vault with new key
NEW_KEY=$(az storage account keys list \
  --account-name nzilastagingstore \
  --query '[0].value' -o tsv)

az keyvault secret set \
  --vault-name nzila-staging-kv \
  --name storage-account-key \
  --value "$NEW_KEY"
```

---

## 5. Monitoring & Alerts

### 5.1 KQL Query — Upcoming Expirations

```kql
AzureDiagnostics
| where ResourceProvider == "MICROSOFT.KEYVAULT"
| where OperationName == "SecretNearExpiry"
| project TimeGenerated, SecretName = id_s, ExpiryDate = exp_d
| sort by ExpiryDate asc
```

### 5.2 Alert Configuration

- **Alert Rule:** `SecretExpiringIn30Days`
- **Action Group:** `nzila-pagerduty-ag` (see PagerDuty runbook)
- **Severity:** Sev3 (warning)

---

## 6. Verification Checklist

After any rotation:

- [ ] New secret is active in Key Vault
- [ ] Old secret version is disabled (not deleted — retain for rollback)
- [ ] Dependent services are healthy (`/api/health` returns 200)
- [ ] Audit event emitted to Log Analytics
- [ ] PagerDuty incident resolved (if triggered)
- [ ] CHANGELOG.md updated (for manual rotations only)

---

## 7. Rollback

If rotation causes an outage:

1. Re-enable previous secret version in Key Vault
2. Restart affected Container Apps
3. Verify health
4. File incident report in `ops/incident-response/`
5. Root-cause the rotation failure before retrying
