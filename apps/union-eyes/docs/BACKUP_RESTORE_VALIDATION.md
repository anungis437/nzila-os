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

Live query output (`2026-05-17`):

```
state:               Ready
version:             16
backupRetentionDays: 30
geoRedundantBackup:  Enabled
earliestRestoreDate: 2026-05-11T05:48:48.367275+00:00
```

Interpretation:

- **DB backup exists** — Azure-managed PITR with 30-day retention.
- **Retention policy defined** — 30 days, geo-redundant.
- **HA** — Zone-redundant standby in AZ 1, currently `Healthy`.
- **Auto-grow** enabled, removes a class of capacity incidents.
- **Earliest restore date** — `2026-05-11` (6+ days of history captured).
- **Owner** — Platform (DB resource is in `nzila-canada-prod-rg`).

Gaps:

- Evidence / blob backup policy is **not defined** because there is no
  prod storage account in `nzila-canada-prod-rg`. Either provision one
  in canadacentral (Geo-Zone-Redundant) or formally declare that
  evidence persistence is DB-only.
- DR-region (canadaeast) cold-restore configuration is documented in
  `production.yml` but not enumerated as a live resource.

## B5B — Restore rehearsal (**validated** `2026-05-17`)

### Drill evidence

| Attribute | Value |
|---|---|
| Drill timestamp | `2026-05-17T18:52:09Z` |
| Restore point | `2026-05-17T16:00:00Z` (2 hours before drill) |
| Source server | `nzila-os-union-eyes-prod-db` |
| Restore server | `nzila-os-ue-prod-db-restore-drill` |
| Region | Canada Central (PIPEDA-compliant, eastus excluded) |
| SKU | Standard_D2s_v3 (matches production tier) |
| Storage | 256 GiB |
| Version | PostgreSQL 16 ✅ |
| Restore duration | ~4 minutes (18:52:09Z → 18:56:37Z) |
| Final state | **Ready** ✅ |
| Production impact | None — source server untouched |
| Deleted at | `2026-05-17T18:57:56Z` (64s deletion) |

### Validation chain

1. **Restore initiated** — `az postgres flexible-server restore`
   with `--restore-time 2026-05-17T16:00:00Z`, no-wait.
2. **Server reached Ready** in ≈ 4 minutes.  Confirmed via
   `az postgres flexible-server list -g nzila-canada-prod-rg`
   showing state `Ready`, version `16`, region `Canada Central`.
3. **Production smoke post-drill** (immediately after drill server deleted):
   - `/api/health` → 200 ✅ (prod DB still ok)
   - `/api/health/liveness` → 200 ✅
   - `/api/metrics/operational` → 401 ✅
   - `nzila-os-ue-prod-db-restore-drill` absent from PG list ✅
4. **Restore server deleted** — cost cleanup confirmed.

### Known gap (deferred, non-blocking for CONTROLLED PILOT READY)

The drill confirmed the Azure PITR restore mechanism produces a
healthy server in the correct region within 4 minutes. A deeper
row-level integrity validation (connect, COUNT tables, spot-check
evidence export query) was not executed in this pass because:
- ACA network egress to the drill server is not configured by default.
- Direct psql from CI/CD context requires a private endpoint or
  firewall allowlist for the drill host IP.

Full data-integrity validation (connect + row audit) remains deferred
until a private endpoint or jump-host procedure is established.

### Acceptance criteria status

| Criterion | Status |
|---|---|
| DB backup exists | ✅ 30-day PITR + geo-redundant |
| Retention policy defined | ✅ 30 days |
| Region compliance | ✅ canadacentral (PIPEDA/Law 25) |
| PITR restore creates healthy server | ✅ Ready in 4 min |
| Production unaffected during drill | ✅ confirmed by smoke |
| Drill server cleaned up | ✅ deleted in 64s |
| Row-level data integrity drill | ⚠️ deferred (network access to drill server not configured) |
