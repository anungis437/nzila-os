#!/usr/bin/env node
/**
 * db-restore.mjs — Maestria database restore script.
 *
 * Usage:
 *   SNAPSHOT=<filename-or-path> node --import tsx/esm scripts/db-restore.mjs
 *
 * Or via package.json script:
 *   SNAPSHOT=manual_2025-01-01T00-00-00-000Z.sqlite.bak pnpm db:restore
 *
 * Set SNAPSHOT to either:
 *   - A bare filename (e.g. manual_2025-01-01T00-00-00-000Z.sqlite.bak)
 *     → resolved relative to the backup directory
 *   - An absolute path
 *
 * ⚠️  WARNING: This overwrites the live database. Stop the application first.
 */

import { listSnapshots, resolveSnapshotPath, restoreDatabase } from '../lib/maestria-backup.ts'

const snapshot = process.env.SNAPSHOT ?? process.argv[2]

if (!snapshot) {
  const snapshots = await listSnapshots()
  if (snapshots.length === 0) {
    console.error('❌ No snapshot specified and no snapshots found in backup directory.')
    console.error('   Usage: SNAPSHOT=<filename-or-path> pnpm db:restore')
    process.exit(1)
  }

  console.log('Available snapshots (most recent first):')
  for (const s of snapshots.slice(0, 20)) {
    const kb = (s.sizeBytes / 1024).toFixed(1)
    console.log(`  ${s.name}  (${kb} KB, created ${s.createdAt})`)
  }
  console.error('\n❌ No SNAPSHOT specified. Re-run with SNAPSHOT=<name> pnpm db:restore')
  process.exit(1)
}

const snapshotPath = resolveSnapshotPath(snapshot)

try {
  console.log(`🔄 Restoring Maestria database from: ${snapshotPath}`)
  console.log('⚠️  WARNING: This will overwrite the live database. Ensure the app is stopped.')
  await restoreDatabase(snapshotPath)
  console.log('✅ Restore complete. You may now restart the application.')
} catch (err) {
  console.error('❌ Restore failed:', err instanceof Error ? err.message : String(err))
  process.exit(1)
}
