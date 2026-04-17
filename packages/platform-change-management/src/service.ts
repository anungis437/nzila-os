/**
 * @nzila/platform-change-management — File-based storage service
 *
 * Implements CRUD operations for change records stored as JSON files
 * in ops/change-records/. Each file is named by its change_id.
 *
 * Gracefully handles malformed or invalid files.
 *
 * @module @nzila/platform-change-management/service
 */
import { readFileSync, writeFileSync, readdirSync, existsSync, mkdirSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { changeRecordSchema } from './schemas'
import type { ChangeRecord, Environment } from './types'

// ── Constants ───────────────────────────────────────────────────────────────

/** Default directory for change records, relative to repo root. */
const DEFAULT_CHANGE_RECORDS_DIR = 'ops/change-records'

/** Resolve the change records directory, allowing override for tests. */
export function getChangeRecordsDir(baseDir?: string): string {
  if (baseDir) return resolve(baseDir)

  // Prefer statically-scoped paths to avoid broad tracing in app bundles.
  const cwd = process.cwd()
  const scopedCandidates = [
    resolve(cwd, DEFAULT_CHANGE_RECORDS_DIR),
    resolve(cwd, '..', DEFAULT_CHANGE_RECORDS_DIR),
    resolve(cwd, '..', '..', DEFAULT_CHANGE_RECORDS_DIR),
    resolve(cwd, '..', '..', '..', DEFAULT_CHANGE_RECORDS_DIR),
  ]
  for (const candidate of scopedCandidates) {
    if (existsSync(candidate)) return candidate
  }

  return resolve(cwd, DEFAULT_CHANGE_RECORDS_DIR)
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function ensureDir(dir: string): void {
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true })
  }
}

function changeFilePath(dir: string, id: string): string {
  // Sanitise the ID to prevent path traversal
  const safe = id.replace(/[^a-zA-Z0-9_-]/g, '-')
  return join(dir, `${safe}.json`)
}

// ── Public API ──────────────────────────────────────────────────────────────

/**
 * Load a single change record by ID.
 * Returns null if file not found or parse fails.
 */
export function loadChangeRecord(
  id: string,
  opts?: { baseDir?: string },
): ChangeRecord | null {
  const dir = getChangeRecordsDir(opts?.baseDir)
  const filePath = changeFilePath(dir, id)
  if (!existsSync(filePath)) return null

  try {
    const raw = JSON.parse(readFileSync(filePath, 'utf-8'))
    const parsed = changeRecordSchema.safeParse(raw)
    if (!parsed.success) {
      console.warn(`[change-management] Invalid change record ${id}: ${parsed.error.message}`)
      return null
    }
    return parsed.data as ChangeRecord
  } catch (err) {
    console.warn(`[change-management] Failed to load change record ${id}:`, err)
    return null
  }
}

/**
 * Load all valid change records from the directory.
 * Skips malformed files with warnings.
 */
export function loadAllChanges(opts?: { baseDir?: string }): ChangeRecord[] {
  const dir = getChangeRecordsDir(opts?.baseDir)
  if (!existsSync(dir)) return []

  const files = readdirSync(dir).filter((f) => f.endsWith('.json'))
  const records: ChangeRecord[] = []

  for (const file of files) {
    const id = file.replace(/\.json$/, '')
    const record = loadChangeRecord(id, opts)
    if (record) records.push(record)
  }

  return records
}

/**
 * Save a change record to disk.
 * Validates with Zod before writing.
 */
export function saveChangeRecord(
  change: ChangeRecord,
  opts?: { baseDir?: string },
): void {
  const dir = getChangeRecordsDir(opts?.baseDir)
  ensureDir(dir)

  // Validate before writing
  const parsed = changeRecordSchema.parse(change)
  const filePath = changeFilePath(dir, parsed.change_id)
  writeFileSync(filePath, JSON.stringify(parsed, null, 2) + '\n', 'utf-8')
}

/**
 * List change records filtered by environment.
 */
export function listChangesByEnvironment(
  env: Environment,
  opts?: { baseDir?: string },
): ChangeRecord[] {
  return loadAllChanges(opts).filter((c) => c.environment === env)
}

/**
 * List change records filtered by service.
 */
export function listChangesByService(
  service: string,
  opts?: { baseDir?: string },
): ChangeRecord[] {
  return loadAllChanges(opts).filter((c) => c.service === service)
}

/**
 * Find change records matching environment + service + approved status.
 * Used by the deploy validation script.
 */
export function findApprovedChange(
  env: Environment,
  service: string,
  opts?: { baseDir?: string },
): ChangeRecord | null {
  const all = loadAllChanges(opts)
  return (
    all.find(
      (c) =>
        c.environment === env &&
        c.service === service &&
        c.approval_status === 'APPROVED' &&
        (c.status === 'APPROVED' || c.status === 'SCHEDULED' || c.status === 'IMPLEMENTING'),
    ) ?? null
  )
}
