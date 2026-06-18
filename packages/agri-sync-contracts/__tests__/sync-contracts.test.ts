import { describe, it, expect } from 'vitest'
import {
  resolveLastWriteWins,
  resolveDevicePriority,
  markManualResolution,
  resolveConflict,
} from '../src/resolver'
import {
  createSyncMetadata,
  createSyncEvent,
  createSyncBatch,
  markSynced,
  markSyncFailed,
} from '../src/sync'
import { ConflictResolutionStrategy, SyncStatus } from '@nzila/agri-core'

// ── resolver.ts ─────────────────────────────────────────────────────────────

function makeConflict<T>(
  localData: T,
  remoteData: T,
  overrides?: {
    localVersion?: number
    remoteVersion?: number
    localDeviceId?: string
    remoteDeviceId?: string
  },
) {
  const localMeta = createSyncMetadata('local_a', overrides?.localDeviceId ?? 'd1')
  const remoteMeta = createSyncMetadata('remote_a', overrides?.remoteDeviceId ?? 'd2')
  if (overrides?.localVersion) {
    ;(localMeta as unknown).version = overrides.localVersion
  }
  if (overrides?.remoteVersion) {
    ;(remoteMeta as unknown).version = overrides.remoteVersion
  }
  return {
    localRecord: { data: localData, metadata: localMeta },
    remoteRecord: { data: remoteData, metadata: remoteMeta },
  }
}

describe('resolveLastWriteWins', () => {
  it('picks the higher version', () => {
    const conflict = makeConflict({ name: 'local' }, { name: 'remote' }, {
      localVersion: 3,
      remoteVersion: 5,
    })
    const result = resolveLastWriteWins(conflict)
    expect(result.winner).toBe('remote')
    expect(result.resolvedData).toEqual({ name: 'remote' })
  })

  it('picks remote on tie', () => {
    const conflict = makeConflict({ name: 'local' }, { name: 'remote' }, {
      localVersion: 5,
      remoteVersion: 5,
    })
    const result = resolveLastWriteWins(conflict)
    expect(result.winner).toBe('remote')
  })

  it('picks local when local version is higher', () => {
    const conflict = makeConflict({ name: 'local' }, { name: 'remote' }, {
      localVersion: 7,
      remoteVersion: 3,
    })
    const result = resolveLastWriteWins(conflict)
    expect(result.winner).toBe('local')
    expect(result.resolvedData).toEqual({ name: 'local' })
  })
})

describe('resolveDevicePriority', () => {
  it('picks the device earlier in priority list', () => {
    const conflict = makeConflict({ name: 'local' }, { name: 'remote' }, {
      localDeviceId: 'tablet_1',
      remoteDeviceId: 'server',
    })
    const result = resolveDevicePriority(conflict, ['server', 'tablet_1'])
    expect(result.winner).toBe('remote')
    expect(result.resolvedData).toEqual({ name: 'remote' })
  })

  it('falls back to remote for unknown devices', () => {
    const conflict = makeConflict({ v: 1 }, { v: 2 }, {
      localDeviceId: 'unknown1',
      remoteDeviceId: 'unknown2',
    })
    const result = resolveDevicePriority(conflict, ['server'])
    expect(result.winner).toBe('remote')
  })

  it('picks local when local is in priority list but remote is not', () => {
    const conflict = makeConflict({ name: 'local' }, { name: 'remote' }, {
      localDeviceId: 'tablet_1',
      remoteDeviceId: 'unknown_device',
    })
    const result = resolveDevicePriority(conflict, ['tablet_1'])
    expect(result.winner).toBe('local')
    expect(result.resolvedData).toEqual({ name: 'local' })
  })
})

describe('markManualResolution', () => {
  it('marks conflict for manual resolution', () => {
    const conflict = makeConflict({ v: 1 }, { v: 2 })
    const result = markManualResolution(conflict)
    expect(result.syncStatus).toBe(SyncStatus.CONFLICT)
    expect(result.conflictState).toBeTruthy()
  })
})

describe('resolveConflict', () => {
  it('dispatches LAST_WRITE_WINS', () => {
    const conflict = makeConflict({ v: 1 }, { v: 2 }, { localVersion: 1, remoteVersion: 2 })
    const result = resolveConflict(conflict, ConflictResolutionStrategy.LAST_WRITE_WINS)
    expect(result).not.toBeNull()
    expect(result!.winner).toBe('remote')
  })

  it('dispatches DEVICE_PRIORITY', () => {
    const conflict = makeConflict({ v: 1 }, { v: 2 }, { localDeviceId: 'd1', remoteDeviceId: 'd2' })
    const result = resolveConflict(conflict, ConflictResolutionStrategy.DEVICE_PRIORITY, ['d1', 'd2'])
    expect(result).not.toBeNull()
    expect(result!.winner).toBe('local')
  })

  it('dispatches DEVICE_PRIORITY with default empty priority list', () => {
    const conflict = makeConflict({ v: 1 }, { v: 2 }, { localDeviceId: 'd1', remoteDeviceId: 'd2' })
    const result = resolveConflict(conflict, ConflictResolutionStrategy.DEVICE_PRIORITY)
    expect(result).not.toBeNull()
    // Both devices unknown in empty list → falls back to last-write-wins (remote v2 > local v1)
    expect(result!.winner).toBe('remote')
  })

  it('dispatches MANUAL', () => {
    const conflict = makeConflict({ v: 1 }, { v: 2 })
    const result = resolveConflict(conflict, ConflictResolutionStrategy.MANUAL)
    expect(result).toBeNull()
  })
})

// ── sync.ts ─────────────────────────────────────────────────────────────────

describe('createSyncMetadata', () => {
  it('creates pending sync metadata', () => {
    const meta = createSyncMetadata('local_1', 'dev_a')
    expect(meta.localId).toBe('local_1')
    expect(meta.deviceId).toBe('dev_a')
    expect(meta.syncStatus).toBe(SyncStatus.PENDING)
    expect(meta.canonicalId).toBeNull()
    expect(meta.version).toBe(1)
  })

  it('defaults to LAST_WRITE_WINS strategy', () => {
    const meta = createSyncMetadata('local_1', 'dev_a')
    expect(meta.resolutionStrategy).toBe(ConflictResolutionStrategy.LAST_WRITE_WINS)
  })
})

describe('createSyncEvent', () => {
  it('creates a sync event', () => {
    const event = createSyncEvent({
      entityType: 'harvest_record',
      localId: 'local_1',
      deviceId: 'dev_a',
      operation: 'create',
      data: { crop: 'maize' },
      version: 1,
    })
    expect(event.eventId).toMatch(/^sync_/)
    expect(event.entityType).toBe('harvest_record')
    expect(event.operation).toBe('create')
    expect(event.canonicalId).toBeNull()
  })
})

describe('createSyncBatch', () => {
  it('wraps events in a batch', () => {
    const event = createSyncEvent({
      entityType: 'harvest',
      localId: 'l1',
      deviceId: 'd1',
      operation: 'create',
      data: {},
      version: 1,
    })
    const batch = createSyncBatch('d1', [event])
    expect(batch.batchId).toMatch(/^batch_/)
    expect(batch.events).toHaveLength(1)
    expect(batch.deviceId).toBe('d1')
  })
})

describe('markSynced', () => {
  it('updates metadata to synced state', () => {
    const meta = createSyncMetadata('local_1', 'dev_a')
    const synced = markSynced(meta, 'canonical_42')
    expect(synced.syncStatus).toBe(SyncStatus.SYNCED)
    expect(synced.canonicalId).toBe('canonical_42')
    expect(synced.lastSyncedAt).toBeTruthy()
    expect(synced.version).toBe(2)
  })
})

describe('markSyncFailed', () => {
  it('updates metadata to failed state', () => {
    const meta = createSyncMetadata('local_1', 'dev_a')
    const failed = markSyncFailed(meta, 'Network error')
    expect(failed.syncStatus).toBe(SyncStatus.FAILED)
    expect(failed.conflictState).toBe('Network error')
  })
})
