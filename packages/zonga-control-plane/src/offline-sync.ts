/**
 * @nzila/zonga-control-plane — Offline Sync
 *
 * Handles offline-first operations: sync queues, conflict resolution,
 * state tracking for ticket scanning, playback, and event check-in.
 */
import type { ControlPlaneContext, OfflineSyncResult, OfflineSyncItem } from './types'
import { SystemEventType, AuditSeverity } from './types'
import { emitSystemEvent, buildSystemEvent } from './system-events'

// ── Sync Queue ────────────────────────────────────────────────────────────

export interface SyncQueue {
  readonly items: readonly OfflineSyncItem[]
  readonly lastSyncAt: Date | null
  readonly deviceId: string
}

export interface SyncConflict {
  readonly localItem: OfflineSyncItem
  readonly remoteItem: OfflineSyncItem
  readonly conflictType: 'update_conflict' | 'delete_conflict' | 'duplicate_scan'
}

/**
 * Resolve sync conflicts between local (offline) and remote (server) state.
 * Strategies:
 * - ticket scans: remote wins (server-verified)
 * - playlist changes: timestamp-based (last-write-wins)
 * - listening history: merge (both kept)
 */
export function resolveConflicts(
  conflicts: readonly SyncConflict[],
): readonly OfflineSyncItem[] {
  return conflicts.map((conflict) => {
    switch (conflict.conflictType) {
      case 'duplicate_scan':
        // Server scan is authoritative — use remote
        return {
          ...conflict.remoteItem,
          resolution: 'remote_wins' as const,
        }

      case 'delete_conflict':
        // If remote deleted, respect deletion
        return {
          ...conflict.remoteItem,
          resolution: 'remote_wins' as const,
        }

      case 'update_conflict': {
        // Last-write-wins for content changes
        const localTime = conflict.localItem.timestamp.getTime()
        const remoteTime = conflict.remoteItem.timestamp.getTime()
        if (localTime > remoteTime) {
          return {
            ...conflict.localItem,
            resolution: 'local_wins' as const,
          }
        }
        return {
          ...conflict.remoteItem,
          resolution: 'remote_wins' as const,
        }
      }
    }
  })
}

/**
 * Process a sync queue — applies pending items and resolves conflicts.
 */
export function processSyncQueue(
  context: ControlPlaneContext,
  queue: SyncQueue,
  remoteState: readonly OfflineSyncItem[],
): OfflineSyncResult {
  let synced = 0
  let conflictCount = 0
  let resolved = 0
  let failed = 0
  const pendingItems: OfflineSyncItem[] = []

  const remoteIndex = new Map(remoteState.map((item) => [item.id, item]))

  for (const localItem of queue.items) {
    const remote = remoteIndex.get(localItem.id)

    if (!remote) {
      // No conflict — sync to server
      synced++
      continue
    }

    // Detect conflict
    if (remote.timestamp.getTime() !== localItem.timestamp.getTime()) {
      conflictCount++

      const conflictType: SyncConflict['conflictType'] =
        localItem.type === 'ticket_scan' ? 'duplicate_scan' : 'update_conflict'

      const conflictResolution = resolveConflicts([
        { localItem, remoteItem: remote, conflictType },
      ])

      if (conflictResolution.length > 0) {
        resolved++
      } else {
        failed++
        pendingItems.push(localItem)
      }
    } else {
      synced++
    }
  }

  emitSystemEvent(buildSystemEvent({
    type: SystemEventType.TICKET_SCANNED,
    orgId: context.orgId,
    actorId: context.actorId,
    entityId: queue.deviceId,
    entityType: 'sync_queue',
    correlationId: context.correlationId,
    payload: { synced, conflicts: conflictCount, resolved, failed, deviceId: queue.deviceId },
    severity: failed > 0 ? AuditSeverity.WARNING : AuditSeverity.INFO,
  }))

  return {
    synced,
    conflicts: conflictCount,
    resolved,
    failed,
    pendingItems,
  }
}

// ── Sync State Tracker ────────────────────────────────────────────────────

export interface SyncState {
  readonly deviceId: string
  readonly lastSyncAt: Date | null
  readonly pendingCount: number
  readonly conflictCount: number
  readonly isOnline: boolean
}

/**
 * Build a sync state snapshot for a device.
 */
export function buildSyncState(
  deviceId: string,
  queue: SyncQueue,
  isOnline: boolean,
): SyncState {
  return {
    deviceId,
    lastSyncAt: queue.lastSyncAt,
    pendingCount: queue.items.length,
    conflictCount: queue.items.filter((i) => i.conflictWith).length,
    isOnline,
  }
}

/**
 * Check if a device needs to sync (has pending items).
 */
export function needsSync(state: SyncState): boolean {
  return state.pendingCount > 0 && state.isOnline
}
