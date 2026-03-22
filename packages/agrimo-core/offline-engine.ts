/**
 * Agrimo — Offline-First Engine.
 *
 * Local-first storage, queued writes, sync when network available,
 * deterministic conflict resolution. All operations work offline.
 */
import { createHash } from 'crypto'

// ── Types ───────────────────────────────────────────────────────────────────

export interface OfflineRecord<T = unknown> {
  local_id: string
  data: T
  synced: boolean
  last_synced_at: string | null
  device_id: string
  version: number
  created_at: string
  updated_at: string
}

export interface SyncResult {
  pushed: number
  pulled: number
  conflicts: ConflictResolution[]
}

export interface ConflictResolution {
  local_id: string
  resolution: 'local_wins' | 'remote_wins' | 'merged'
  resolved_at: string
}

export type ConflictStrategy = 'last-write-wins' | 'device-priority' | 'manual'

export interface OfflineEngineConfig {
  device_id: string
  conflict_strategy: ConflictStrategy
  /** Priority order for device-priority strategy */
  device_priority?: string[]
  /** Max age in ms before a pending write is considered stale */
  stale_threshold_ms?: number
}

// ── Store (in-memory, swappable for IndexedDB/SQLite) ──────────────────────

export class OfflineStore<T = unknown> {
  private records = new Map<string, OfflineRecord<T>>()
  private writeQueue: string[] = []
  private config: OfflineEngineConfig

  constructor(config: OfflineEngineConfig) {
    this.config = config
  }

  /** Create a record locally. Works offline. */
  create(data: T): OfflineRecord<T> {
    const local_id = generateLocalId()
    const now = new Date().toISOString()
    const record: OfflineRecord<T> = {
      local_id,
      data,
      synced: false,
      last_synced_at: null,
      device_id: this.config.device_id,
      version: 1,
      created_at: now,
      updated_at: now,
    }
    this.records.set(local_id, record)
    this.writeQueue.push(local_id)
    return record
  }

  /** Update a record locally. Works offline. */
  update(local_id: string, data: Partial<T>): OfflineRecord<T> {
    const existing = this.records.get(local_id)
    if (!existing) throw new Error(`Record not found: ${local_id}`)
    const updated: OfflineRecord<T> = {
      ...existing,
      data: { ...existing.data, ...data },
      synced: false,
      version: existing.version + 1,
      updated_at: new Date().toISOString(),
    }
    this.records.set(local_id, updated)
    if (!this.writeQueue.includes(local_id)) {
      this.writeQueue.push(local_id)
    }
    return updated
  }

  /** Get a record by local_id. Works offline. */
  get(local_id: string): OfflineRecord<T> | undefined {
    return this.records.get(local_id)
  }

  /** List all records. Works offline. */
  list(): OfflineRecord<T>[] {
    return Array.from(this.records.values())
  }

  /** Return records pending sync. */
  getPendingWrites(): OfflineRecord<T>[] {
    return this.writeQueue
      .map((id) => this.records.get(id))
      .filter((r): r is OfflineRecord<T> => r !== undefined && !r.synced)
  }

  /** Sync pending writes to remote. Returns sync result. */
  async sync(
    pushFn: (records: OfflineRecord<T>[]) => Promise<OfflineRecord<T>[]>,
    pullFn: () => Promise<OfflineRecord<T>[]>,
  ): Promise<SyncResult> {
    const pending = this.getPendingWrites()
    const conflicts: ConflictResolution[] = []
    let pushed = 0

    // Push local changes
    if (pending.length > 0) {
      const synced = await pushFn(pending)
      const now = new Date().toISOString()
      for (const rec of synced) {
        this.records.set(rec.local_id, {
          ...rec,
          synced: true,
          last_synced_at: now,
        })
        pushed++
      }
      this.writeQueue = this.writeQueue.filter(
        (id) => !synced.some((s) => s.local_id === id),
      )
    }

    // Pull remote changes
    const remoteRecords = await pullFn()
    let pulled = 0
    for (const remote of remoteRecords) {
      const local = this.records.get(remote.local_id)
      if (!local) {
        // New record from remote
        this.records.set(remote.local_id, {
          ...remote,
          synced: true,
          last_synced_at: new Date().toISOString(),
        })
        pulled++
      } else if (local.version !== remote.version) {
        // Conflict — resolve deterministically
        const resolution = this.resolveConflict(local, remote)
        conflicts.push(resolution)
        pulled++
      }
    }

    return { pushed, pulled, conflicts }
  }

  /** Deterministic conflict resolution based on configured strategy. */
  private resolveConflict(
    local: OfflineRecord<T>,
    remote: OfflineRecord<T>,
  ): ConflictResolution {
    const now = new Date().toISOString()
    let winner: OfflineRecord<T>
    let resolution: ConflictResolution['resolution']

    switch (this.config.conflict_strategy) {
      case 'last-write-wins': {
        winner =
          local.updated_at >= remote.updated_at ? local : remote
        resolution =
          winner === local ? 'local_wins' : 'remote_wins'
        break
      }
      case 'device-priority': {
        const priority = this.config.device_priority ?? []
        const localIdx = priority.indexOf(local.device_id)
        const remoteIdx = priority.indexOf(remote.device_id)
        if (localIdx !== -1 && (remoteIdx === -1 || localIdx < remoteIdx)) {
          winner = local
          resolution = 'local_wins'
        } else {
          winner = remote
          resolution = 'remote_wins'
        }
        break
      }
      default: {
        // Default: last-write-wins
        winner =
          local.updated_at >= remote.updated_at ? local : remote
        resolution =
          winner === local ? 'local_wins' : 'remote_wins'
      }
    }

    this.records.set(local.local_id, {
      ...winner,
      synced: true,
      last_synced_at: now,
    })
    return { local_id: local.local_id, resolution, resolved_at: now }
  }

  /** Get sync status summary */
  getSyncStatus(): { total: number; synced: number; pending: number } {
    const all = this.list()
    const synced = all.filter((r) => r.synced).length
    return { total: all.length, synced, pending: all.length - synced }
  }
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function generateLocalId(): string {
  const timestamp = Date.now().toString(36)
  const random = createHash('sha256')
    .update(`${Date.now()}-${Math.random()}`)
    .digest('hex')
    .substring(0, 12)
  return `local_${timestamp}_${random}`
}
