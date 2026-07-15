# 05 — Backup and Restoration (G13)

## Backup configuration (verified read-only)

Observed on the shared staging server `nzila-staging-db`:

| Property | Value |
| --- | --- |
| Engine | PostgreSQL 15 |
| State | `Ready` |
| `backupRetentionDays` | `35` |
| `geoRedundantBackup` | `Disabled` |
| `earliestRestoreDate` | `2026-06-11` |

```
backup configuration:            PASS
35-day PITR availability:        PASS
geo-redundant backup:            disabled
restore execution:               NOT_PROVEN
restoration reconciliation:      NOT_PROVEN
destroyed-data non-reappearance: NOT_PROVEN
```

## Why the restore round-trip was not executed

A configured PITR window proves backups are configured; it does **not** prove
restoration. The required G13 evidence — an isolated restore, SAGE-table
reconciliation, hash and row-count reconciliation, confirmation that destroyed
package bytes do not return, confirmation that destroyed invitation ciphertext
does not become accessible, and post-restore tenant isolation — was **not**
produced this run.

Executing it responsibly requires provisioning cost-producing isolated Postgres
servers and running a restore under supervision. With no human available,
unsupervised cost-provisioning and teardown of live infrastructure was judged
imprudent, so it was deferred. The prod-rg restore-drill server
(`nzila-ue-prod-db-drill-20260520`) was **not** used because it holds real
production data.

## Status

**G13 — NOT_PROVEN.** Backup configuration is verified, but restoration is not.

```
B-003 — Backup restoration not proven
Severity: BLOCKER
Status: open
```

B-003 must **not** be downgraded to a condition until an isolated restore
round-trip succeeds.

## Precise executable plan (for a supervised run)

1. Create one isolated smallest-SKU staging Postgres server, tagged `sage-proof`.
2. Apply the exact locked migration chain `0032`–`0044`; seed synthetic-only SAGE
   lifecycle data including one destroyed/tombstoned package.
3. Perform a PITR restore into a second isolated target.
4. Reconcile all SAGE tables; verify hashes and row counts; verify tenant
   isolation; verify destroyed package bytes do not reappear and destroyed
   invitation ciphertext is inaccessible.
5. Delete both temporary servers; record create/restore/delete timestamps, safe
   aliases, reconciliation results, and cost.

After success, G13 may advance to `PASS` and B-003 may close.
