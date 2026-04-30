import { copyFileSync, existsSync, mkdirSync, readdirSync, statSync } from 'node:fs'
import { basename, dirname, join } from 'node:path'

function resolveDbPath(): string {
  const fromEnv = process.env.MAESTRIA_DB_PATH
  if (fromEnv && fromEnv.trim().length > 0) return fromEnv
  return join(process.cwd(), 'data', 'maestria.db')
}

function resolveBackupDir(): string {
  const dbPath = resolveDbPath()
  const fromEnv = process.env.MAESTRIA_BACKUP_DIR
  if (fromEnv && fromEnv.trim().length > 0) return fromEnv
  return `${dbPath}.bak`
}

export interface SnapshotInfo {
  name: string
  sizeBytes: number
  createdAt: string
}

export interface BackupResult {
  snapshotPath: string
  sizeBytes: number
  label: string
}

/**
 * Creates a point-in-time backup of the Maestria SQLite database.
 * The DB file is copied to `<MAESTRIA_DB_PATH>.bak/<label>_<timestamp>.sqlite.bak`.
 * Because we use WAL mode, the copy is safe as long as no write is mid-flight;
 * for production use the WAL checkpoint is not explicitly forced here — callers
 * should quiesce writes or use the VACUUM INTO approach if sub-second consistency is needed.
 */
export async function backupDatabase(label?: string): Promise<BackupResult> {
  const dbPath = resolveDbPath()
  if (!existsSync(dbPath)) {
    throw new Error(`Maestria database not found at ${dbPath}`)
  }

  const backupDir = resolveBackupDir()
  mkdirSync(backupDir, { recursive: true })

  const ts = new Date().toISOString().replace(/[:.]/g, '-')
  const safeName = (label ?? 'snapshot').replace(/[^a-zA-Z0-9_-]/g, '_')
  const snapshotFileName = `${safeName}_${ts}.sqlite.bak`
  const snapshotPath = join(backupDir, snapshotFileName)

  copyFileSync(dbPath, snapshotPath)

  const sizeBytes = statSync(snapshotPath).size

  return { snapshotPath, sizeBytes, label: safeName }
}

/**
 * Restores the database from a named snapshot file.
 * The snapshot must exist on disk. The current DB file is overwritten.
 * WARNING: All in-flight transactions will be lost. Quiesce the application first.
 */
export async function restoreDatabase(snapshotPath: string): Promise<void> {
  if (!existsSync(snapshotPath)) {
    throw new Error(`Snapshot not found: ${snapshotPath}`)
  }

  const dbPath = resolveDbPath()
  mkdirSync(dirname(dbPath), { recursive: true })

  copyFileSync(snapshotPath, dbPath)
}

/**
 * Lists all snapshots in the backup directory, sorted by creation time descending.
 */
export async function listSnapshots(): Promise<SnapshotInfo[]> {
  const backupDir = resolveBackupDir()
  if (!existsSync(backupDir)) return []

  const entries = readdirSync(backupDir)
    .filter((name) => name.endsWith('.sqlite.bak'))
    .map((name) => {
      const fullPath = join(backupDir, name)
      const stat = statSync(fullPath)
      return {
        name,
        sizeBytes: stat.size,
        createdAt: stat.birthtime.toISOString(),
      }
    })
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))

  return entries
}

/**
 * Prunes old snapshots, keeping only the most recent `keepCount`.
 * Returns the names of deleted snapshots.
 */
export async function pruneSnapshots(keepCount = 30): Promise<string[]> {
  const snapshots = await listSnapshots()
  if (snapshots.length <= keepCount) return []

  const toDelete = snapshots.slice(keepCount)
  const backupDir = resolveBackupDir()
  const deleted: string[] = []

  for (const snap of toDelete) {
    const fullPath = join(backupDir, snap.name)
    if (existsSync(fullPath)) {
      // Use fs.unlinkSync to remove old snapshots
      const { unlinkSync } = await import('node:fs')
      unlinkSync(fullPath)
      deleted.push(snap.name)
    }
  }

  return deleted
}

/**
 * Returns the name of the backup directory for diagnostic purposes.
 */
export function getBackupDir(): string {
  return resolveBackupDir()
}

/**
 * Returns the resolved path to the live database file.
 */
export function getDbPath(): string {
  return resolveDbPath()
}

// Convenience: derive snapshot path from a raw filename
export function resolveSnapshotPath(nameOrPath: string): string {
  if (nameOrPath.includes('/') || nameOrPath.includes('\\')) return nameOrPath
  return join(resolveBackupDir(), nameOrPath)
}

// Re-export for scripts
export { basename }
