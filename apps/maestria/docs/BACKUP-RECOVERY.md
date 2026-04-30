# Backup & Recovery Runbook — Maestria

> **Audience:** DevOps, on-call engineers, platform operators.  
> **Scope:** The embedded SQLite database used by the Maestria application.

---

## Overview

Maestria stores operational records, connector accounts, KPI events, and
notification deliveries in a single SQLite file. Backups are point-in-time
file copies; restores are an overwrite of the live file.

**Recovery Time Objective (RTO):** < 10 minutes for a restore from local backup.  
**Recovery Point Objective (RPO):** Depends on backup cadence (recommended: hourly in production).

---

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `MAESTRIA_DB_PATH` | `<cwd>/data/maestria.db` | Absolute path to the live SQLite file |
| `MAESTRIA_BACKUP_DIR` | `<db-path>.bak/` | Directory where snapshots are written |
| `BACKUP_LABEL` | `manual` | Label prefix embedded in the snapshot filename |
| `BACKUP_KEEP` | `30` | Number of snapshots to retain; oldest are pruned after each backup |
| `SNAPSHOT` | _(required for restore)_ | Snapshot filename or absolute path to restore from |

---

## Backup

### Manual backup (one-off)

```bash
pnpm --filter @nzila/maestria db:backup
# Or with a custom label:
BACKUP_LABEL=pre-deploy pnpm --filter @nzila/maestria db:backup
```

### Automated / scheduled backup

Add a cron entry or CI job step that sets the required env vars and runs:

```bash
MAESTRIA_DB_PATH=/data/maestria.db \
MAESTRIA_BACKUP_DIR=/backups/maestria \
BACKUP_LABEL=scheduled \
BACKUP_KEEP=48 \
pnpm --filter @nzila/maestria db:backup
```

Recommended cadence: **every hour** in production, **daily** in staging.

### Snapshot naming convention

```
<label>_<ISO-timestamp>.sqlite.bak
```

Example: `scheduled_2025-06-15T14-30-00-000Z.sqlite.bak`

---

## Restore Procedure

> ⚠️ **Stop the application before restoring.** A live process may hold a write
> lock on the database, causing a corrupted restore.

### Step 1 — Identify the target snapshot

List available snapshots:

```bash
MAESTRIA_BACKUP_DIR=/backups/maestria \
pnpm --filter @nzila/maestria db:restore
# Running without SNAPSHOT prints the list then exits with an error.
```

### Step 2 — Restore

```bash
MAESTRIA_DB_PATH=/data/maestria.db \
MAESTRIA_BACKUP_DIR=/backups/maestria \
SNAPSHOT=scheduled_2025-06-15T14-30-00-000Z.sqlite.bak \
pnpm --filter @nzila/maestria db:restore
```

You may also provide an absolute path:

```bash
SNAPSHOT=/backups/maestria/scheduled_2025-06-15T14-30-00-000Z.sqlite.bak \
pnpm --filter @nzila/maestria db:restore
```

### Step 3 — Verify

After the script reports `✅ Restore complete`, restart the application and
confirm the health endpoint responds:

```bash
curl http://localhost:3021/api/maestria/health
# Expected: {"status":"ok", ...}
```

---

## Retention Policy

The `db:backup` script automatically prunes snapshots exceeding the
`BACKUP_KEEP` count (default: 30) after each successful backup. The oldest
snapshots are deleted first.

To change retention:

```bash
BACKUP_KEEP=48 pnpm --filter @nzila/maestria db:backup
```

---

## Backup Library API

The `apps/maestria/lib/maestria-backup.ts` module exports the following
functions for use in automation or application code:

| Function | Description |
|---|---|
| `backupDatabase(label?)` | Creates a snapshot and returns `{ snapshotPath, sizeBytes, label }` |
| `restoreDatabase(snapshotPath)` | Overwrites the live DB with the given snapshot |
| `listSnapshots()` | Returns all snapshots sorted by date descending |
| `pruneSnapshots(keepCount?)` | Deletes oldest snapshots; returns names of deleted files |
| `resolveSnapshotPath(nameOrPath)` | Resolves a bare filename or absolute path to a full path |
| `getDbPath()` | Returns the resolved live DB path |
| `getBackupDir()` | Returns the resolved backup directory path |

---

## Troubleshooting

### "Cannot copy file: source does not exist"

The live DB file has not been created yet. Start the application (which
initialises the SQLite file on first request) before taking a backup.

### "Snapshot not found" during restore

Check that `MAESTRIA_BACKUP_DIR` points to the correct directory. Run the
restore script without `SNAPSHOT` to list available snapshots.

### Application fails to start after restore

1. Verify file permissions on `MAESTRIA_DB_PATH`.
2. Confirm the snapshot was taken from a compatible schema version.
3. Check application logs for SQLite errors — the schema may need migration.
