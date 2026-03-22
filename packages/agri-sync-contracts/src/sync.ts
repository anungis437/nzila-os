// ---------------------------------------------------------------------------
// @nzila/agri-sync-contracts — Sync event format and utilities
// ---------------------------------------------------------------------------

import type { SyncMetadata } from '@nzila/agri-core'
import { SyncStatus, ConflictResolutionStrategy } from '@nzila/agri-core'

export interface SyncEvent<T = unknown> {
  readonly eventId: string
  readonly entityType: string
  readonly localId: string
  readonly canonicalId: string | null
  readonly deviceId: string
  readonly timestamp: string
  readonly operation: 'create' | 'update' | 'delete'
  readonly data: T
  readonly version: number
}

export interface SyncBatch<T = unknown> {
  readonly batchId: string
  readonly deviceId: string
  readonly events: readonly SyncEvent<T>[]
  readonly createdAt: string
}

export interface SyncResponse {
  readonly batchId: string
  readonly accepted: number
  readonly rejected: number
  readonly conflicts: readonly string[]
  readonly serverTimestamp: string
}

let idCounter = 0

function makeId(prefix: string): string {
  idCounter++
  return `${prefix}_${Date.now().toString(36)}_${idCounter.toString(36)}`
}

/**
 * Create initial sync metadata for a new local record.
 */
export function createSyncMetadata(
  localId: string,
  deviceId: string,
  strategy: (typeof ConflictResolutionStrategy)[keyof typeof ConflictResolutionStrategy] = ConflictResolutionStrategy.LAST_WRITE_WINS,
): SyncMetadata {
  return {
    localId,
    canonicalId: null,
    deviceId,
    lastSyncedAt: null,
    syncStatus: SyncStatus.PENDING,
    conflictState: null,
    resolutionStrategy: strategy,
    version: 1,
  }
}

/**
 * Create a sync event for an entity operation.
 */
export function createSyncEvent<T>(params: {
  entityType: string
  localId: string
  canonicalId?: string
  deviceId: string
  operation: SyncEvent['operation']
  data: T
  version: number
}): SyncEvent<T> {
  return {
    eventId: makeId('sync'),
    entityType: params.entityType,
    localId: params.localId,
    canonicalId: params.canonicalId ?? null,
    deviceId: params.deviceId,
    timestamp: new Date().toISOString(),
    operation: params.operation,
    data: params.data,
    version: params.version,
  }
}

/**
 * Create a sync batch from multiple events.
 */
export function createSyncBatch<T>(
  deviceId: string,
  events: SyncEvent<T>[],
): SyncBatch<T> {
  return {
    batchId: makeId('batch'),
    deviceId,
    events,
    createdAt: new Date().toISOString(),
  }
}

/**
 * Mark sync metadata as synced after successful push.
 */
export function markSynced(
  metadata: SyncMetadata,
  canonicalId: string,
): SyncMetadata {
  return {
    ...metadata,
    canonicalId,
    syncStatus: SyncStatus.SYNCED,
    lastSyncedAt: new Date().toISOString(),
    conflictState: null,
    version: metadata.version + 1,
  }
}

/**
 * Mark sync metadata as failed.
 */
export function markSyncFailed(
  metadata: SyncMetadata,
  reason: string,
): SyncMetadata {
  return {
    ...metadata,
    syncStatus: SyncStatus.FAILED,
    conflictState: reason,
  }
}
