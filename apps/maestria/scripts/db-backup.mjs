#!/usr/bin/env node
/**
 * db-backup.mjs — Maestria database backup script.
 *
 * Usage:
 *   node --import tsx/esm scripts/db-backup.mjs [label]
 *
 * Or via package.json script:
 *   pnpm db:backup
 *   BACKUP_LABEL=pre-deploy pnpm db:backup
 */

import { backupDatabase, listSnapshots, pruneSnapshots } from '../lib/maestria-backup.ts'

const label = process.env.BACKUP_LABEL ?? process.argv[2] ?? 'manual'
const keepCount = Number(process.env.BACKUP_KEEP ?? '30')

try {
  console.log('📦 Creating Maestria database backup...')
  const result = await backupDatabase(label)
  const sizeKB = (result.sizeBytes / 1024).toFixed(1)
  console.log(`✅ Backup complete: ${result.snapshotPath} (${sizeKB} KB)`)

  if (keepCount > 0) {
    const deleted = await pruneSnapshots(keepCount)
    if (deleted.length > 0) {
      console.log(`🗑️  Pruned ${deleted.length} old snapshot(s):`)
      for (const name of deleted) console.log(`   - ${name}`)
    }
  }

  const all = await listSnapshots()
  console.log(`📋 ${all.length} snapshot(s) retained in backup dir.`)
} catch (err) {
  console.error('❌ Backup failed:', err instanceof Error ? err.message : String(err))
  process.exit(1)
}
