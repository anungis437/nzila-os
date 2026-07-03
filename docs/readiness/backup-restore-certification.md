# Backup / Restore Certification (Phase 5)

- **As of:** 2026-07-03 · verified via Azure CLI.

## Verdict

```
BACKUP RESTORE READY  (union-eyes production database)
```

## Evidence (`az postgres flexible-server show`, prod-rg)

`nzila-os-union-eyes-prod-db` (Postgres 16):

| Control | Value |
| --- | --- |
| Backup retention | **30 days** |
| Geo-redundant backup | **Enabled** |
| High availability | **ZoneRedundant** |
| Storage | 256 GB |
| Encryption at rest | Azure-managed (Postgres Flexible default) |
| PITR | Available (retention window 30d) |

- **Restore test evidence:** a restore-drill server `nzila-ue-prod-db-drill-20260520`
  exists in `nzila-canada-prod-rg` — evidence that a production restore was exercised.
- **Data separation:** production DB (`nzila-os-union-eyes-prod-db`, prod-rg) is
  distinct from staging (`nzila-staging-db`), pilot (`nzila-canada-pilot-db`), and
  demo (`nzila-os-union-eyes-demo-db`).

## Gaps / follow-ups

- Restore **runbook** (documented recovery procedure + RTO/RPO targets) — see
  `docs/runbooks/production-rollback.md` follow-up (not yet authored).
- Firewall/private-endpoint posture of the prod DB not captured in this pass
  (read; can be added). Storage-account soft-delete/versioning: not in scope
  (no production blob storage dependency confirmed for union-eyes).
