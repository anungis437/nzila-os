# Union Eyes — Blob Storage Recovery Runbook

> **Owner:** SRE Team  
> **Controls Covered:** DR-04  
> **Last Updated:** 2026-04-24  
> **Classification:** Internal

---

## Overview

Union Eyes stores three categories of objects in Azure Blob Storage:

| Container | Contents | Redundancy | Retention |
|-----------|---------|-----------|----------|
| `evidence` | Sealed evidence packs (SHA-256 + AES-256 HMAC) | RA-GRS (geo-redundant) | 7 years (immutable) |
| `documents` | Member-uploaded documents, CBA files | RA-GRS | Per policy |
| `backups` | pg_dump snapshots, compliance snapshots | LRS → RA-GRS (prod) | 90 days |

All objects are uploaded via `@nzila/blob` which auto-computes SHA-256 and stores
the hash in `documents.sha256` + emits an `audit_event` on write.

---

## Backup Strategy

Azure Blob Storage uses **RA-GRS (Read-Access Geo-Redundant Storage)** in
production, configured in `infrastructure/bicep/modules/postgres.bicep` and
referenced in `ops/disaster-recovery/README.md`.

```
Primary: Azure Canada Central
Secondary (read-only): Azure Canada East
RPO for blob: Near-zero (synchronous replication within region; async geo-replication)
```

---

## Scenario 1 — Recover a Deleted or Overwritten Object

### Trigger

- Evidence pack missing from audit query
- Document 404 returned to user
- Compliance snapshot link broken

### Prerequisites

- Azure CLI authenticated
- Storage account name and container name
- Approximate deletion timestamp (for versioning / soft-delete recovery)

### Commands

```bash
STORAGE_ACCOUNT="nzilacanadastore"
CONTAINER="evidence"
BLOB_PATH="<org_id>/dr-bcp/2026/Q1/restore-test-report/DR-Q1-2026/<artifact>.json"

# Step 1: Check if soft-delete is enabled and blob is recoverable
az storage blob list \
  --account-name "$STORAGE_ACCOUNT" \
  --container-name "$CONTAINER" \
  --include d \
  --prefix "$BLOB_PATH" \
  --query "[?deleted==\`true\`]" \
  -o table

# Step 2: Undelete the blob
az storage blob undelete \
  --account-name "$STORAGE_ACCOUNT" \
  --container-name "$CONTAINER" \
  --name "$BLOB_PATH"

# Step 3: Verify SHA-256 against database record
BLOB_HASH=$(az storage blob download \
  --account-name "$STORAGE_ACCOUNT" \
  --container-name "$CONTAINER" \
  --name "$BLOB_PATH" \
  --file /tmp/recovered_blob && sha256sum /tmp/recovered_blob | awk '{print $1}')

echo "Blob SHA-256: $BLOB_HASH"
# Compare against documents.sha256 in PostgreSQL

# Step 4: Restore from geo-redundant secondary if primary unavailable
az storage blob copy start \
  --source-account-name "${STORAGE_ACCOUNT}-secondary" \
  --source-container "$CONTAINER" \
  --source-blob "$BLOB_PATH" \
  --destination-account-name "$STORAGE_ACCOUNT" \
  --destination-container "$CONTAINER" \
  --destination-blob "$BLOB_PATH"
```

### Verification Checks

- [ ] Blob accessible via authenticated API
- [ ] SHA-256 hash matches `documents.sha256` database record
- [ ] Audit event `dr_evidence_uploaded` or original upload event present
- [ ] Evidence pack can be opened and HMAC seal verified via `@nzila/evidence`

---

## Scenario 2 — Geo-Failover (Canada Central Unavailable)

### Trigger

- Azure Canada Central unavailable > 30 minutes
- Blob 503 errors > 5% of requests

### Commands

```bash
# Check secondary region availability
az storage account show-usage \
  --account-name "${STORAGE_ACCOUNT}-canadaeast"

# Initiate account failover (destructive — only for full region loss)
az storage account failover \
  --name "$STORAGE_ACCOUNT" \
  --resource-group "nzila-prod-rg" \
  --yes

# After failover: update AZURE_STORAGE_ACCOUNT_URL in Key Vault
az keyvault secret set \
  --vault-name "nzila-prod-kv" \
  --name "AZURE-STORAGE-URL" \
  --value "https://${STORAGE_ACCOUNT}.blob.core.windows.net"
```

---

## Blob Backup Manifest

The restore-drill script checks for `ops/evidence/blob-backup-manifest.json`.
This file should be generated after each backup cycle and contain:

```json
{
  "generatedAt": "ISO-8601",
  "storageAccount": "nzilacanadastore",
  "containers": [
    { "name": "evidence", "objectCount": 0, "redundancy": "RA-GRS" },
    { "name": "documents", "objectCount": 0, "redundancy": "RA-GRS" },
    { "name": "backups", "objectCount": 0, "redundancy": "LRS" }
  ]
}
```

> **Current status:** `ops/evidence/blob-backup-manifest.json` does not yet exist.
> This is a known gap. Creating this manifest is a follow-on action from this
> runbook publication (see gap #2 in `reports/dr/restore-drill-2026-04-24.md`).

---

## Evidence Captured

| Artifact | Format | Notes |
|---------|--------|-------|
| Blob recovery log | CLI output | Timestamp, blob path, SHA-256 |
| Audit event verification | DB query output | Confirm `audit_event` exists |
| Post-recovery hash match | SHA-256 comparison | Must match `documents.sha256` |

---

## References

- [Restore Drill Runbook](restore-drill-runbook.md)
- [Platform DR Plan](../../../docs/ops/disaster-recovery.md)
- [Bicep Postgres Module](../../../infrastructure/bicep/modules/postgres.bicep)
- [Ops DR README](../../../ops/disaster-recovery/README.md)
