# UnionEyes — Backup / Restore Validation (B5)

## B5A — Backup verification (configured)

Live `az postgres flexible-server show` against
`nzila-os-union-eyes-prod-db` returned:

```json
{
  "backup": {
    "backupRetentionDays": 30,
    "earliestRestoreDate": "<captured at scan time>",
    "geoRedundantBackup": "Enabled"
  },
  "highAvailability": {
    "mode": "ZoneRedundant",
    "standbyAvailabilityZone": "1",
    "state": "Healthy"
  },
  "storage": { "storageSizeGb": 256, "tier": "P15", "autoGrow": "Enabled" },
  "version": "16",
  "state": "Ready"
}
```

Interpretation:

- **DB backup exists** — Azure-managed PITR with 30-day retention.
- **Retention policy defined** — 30 days, geo-redundant.
- **HA** — Zone-redundant standby in AZ 1, currently `Healthy`.
- **Auto-grow** enabled, removes a class of capacity incidents.
- **Owner** — Platform (DB resource is in `nzila-canada-prod-rg`).

Gaps:

- Evidence / blob backup policy is **not defined** because there is no
  prod storage account in `nzila-canada-prod-rg`. Either provision one
  in canadacentral (Geo-Zone-Redundant) or formally declare that
  evidence persistence is DB-only.
- DR-region (canadaeast) cold-restore configuration is documented in
  `production.yml` but not enumerated as a live resource.

## B5B — Restore rehearsal (deferred)

Procedure to be executed once explicitly approved:

```powershell
# Create a point-in-time restore into a parallel server.
$ts = (Get-Date).AddMinutes(-15).ToString("yyyy-MM-ddTHH:mm:ssZ")
az postgres flexible-server restore `
  --resource-group nzila-canada-prod-rg `
  --name nzila-os-union-eyes-prod-db-restore-rehearsal `
  --source-server nzila-os-union-eyes-prod-db `
  --restore-time $ts
```

Validation steps post-restore:

1. Connect to the rehearsal server with a read-only role.
2. Verify row counts for: `users`, `evidence_records`, `audit_log`,
   `governance_events` (or equivalent tables in current schema).
3. Run the evidence export query against the rehearsal server and
   confirm the export validates against the seal key contract.
4. Document restore duration and any data gaps.
5. Delete the rehearsal server.

Mark `validated` only when this sequence has been executed and the
captured artifacts are linked from this doc.
