// ---------------------------------------------------------------------------
// @nzila/agri-sync-contracts — Conflict resolution engine
// ---------------------------------------------------------------------------

import type { SyncMetadata, ConflictResolutionStrategy } from '@nzila/agri-core'
import { SyncStatus, ConflictResolutionStrategy as Strategy } from '@nzila/agri-core'

export interface SyncConflict<T = unknown> {
  readonly localRecord: { data: T; metadata: SyncMetadata }
  readonly remoteRecord: { data: T; metadata: SyncMetadata }
}

export interface ConflictResolution<T = unknown> {
  readonly winner: 'local' | 'remote' | 'merged'
  readonly resolvedData: T
  readonly resolvedMetadata: SyncMetadata
  readonly resolvedAt: string
}

/**
 * Resolve a conflict using last-write-wins strategy.
 * Compares version numbers; higher version wins.
 * On tie, remote wins (server authority).
 */
export function resolveLastWriteWins<T>(conflict: SyncConflict<T>): ConflictResolution<T> {
  const localVersion = conflict.localRecord.metadata.version
  const remoteVersion = conflict.remoteRecord.metadata.version
  const now = new Date().toISOString()

  if (localVersion > remoteVersion) {
    return {
      winner: 'local',
      resolvedData: conflict.localRecord.data,
      resolvedMetadata: {
        ...conflict.localRecord.metadata,
        syncStatus: SyncStatus.SYNCED,
        conflictState: null,
        lastSyncedAt: now,
      },
      resolvedAt: now,
    }
  }

  return {
    winner: 'remote',
    resolvedData: conflict.remoteRecord.data,
    resolvedMetadata: {
      ...conflict.remoteRecord.metadata,
      syncStatus: SyncStatus.SYNCED,
      conflictState: null,
      lastSyncedAt: now,
    },
    resolvedAt: now,
  }
}

/**
 * Resolve a conflict using device-priority strategy.
 * Preferred device IDs are checked in order; first match wins.
 */
export function resolveDevicePriority<T>(
  conflict: SyncConflict<T>,
  devicePriority: readonly string[],
): ConflictResolution<T> {
  const now = new Date().toISOString()
  const localDevice = conflict.localRecord.metadata.deviceId
  const remoteDevice = conflict.remoteRecord.metadata.deviceId

  const localPriority = devicePriority.indexOf(localDevice)
  const remotePriority = devicePriority.indexOf(remoteDevice)

  // Lower index = higher priority. -1 means not in priority list (lowest).
  const localWins =
    localPriority >= 0 && (remotePriority < 0 || localPriority < remotePriority)

  if (localWins) {
    return {
      winner: 'local',
      resolvedData: conflict.localRecord.data,
      resolvedMetadata: {
        ...conflict.localRecord.metadata,
        syncStatus: SyncStatus.SYNCED,
        conflictState: null,
        lastSyncedAt: now,
      },
      resolvedAt: now,
    }
  }

  return {
    winner: 'remote',
    resolvedData: conflict.remoteRecord.data,
    resolvedMetadata: {
      ...conflict.remoteRecord.metadata,
      syncStatus: SyncStatus.SYNCED,
      conflictState: null,
      lastSyncedAt: now,
    },
    resolvedAt: now,
  }
}

/**
 * Mark a conflict as requiring manual resolution.
 */
export function markManualResolution<T>(conflict: SyncConflict<T>): SyncMetadata {
  return {
    ...conflict.localRecord.metadata,
    syncStatus: SyncStatus.CONFLICT,
    conflictState: JSON.stringify({
      localVersion: conflict.localRecord.metadata.version,
      remoteVersion: conflict.remoteRecord.metadata.version,
      detectedAt: new Date().toISOString(),
    }),
  }
}

/**
 * Resolve a conflict using the configured strategy.
 */
export function resolveConflict<T>(
  conflict: SyncConflict<T>,
  strategy: ConflictResolutionStrategy,
  devicePriority?: readonly string[],
): ConflictResolution<T> | null {
  switch (strategy) {
    case Strategy.LAST_WRITE_WINS:
      return resolveLastWriteWins(conflict)
    case Strategy.DEVICE_PRIORITY:
      return resolveDevicePriority(conflict, devicePriority ?? [])
    case Strategy.MANUAL:
      // Manual resolution returns null — caller must handle
      return null
  }
}
