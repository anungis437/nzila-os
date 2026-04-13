import { describe, it, expect, beforeEach } from 'vitest'
import type { ControlPlaneContext, OfflineSyncItem } from './types'
import { clearEventLog, getEventLog } from './system-events'
import {
  resolveConflicts,
  processSyncQueue,
  buildSyncState,
  needsSync,
  type SyncQueue,
  type SyncConflict,
} from './offline-sync'

function makeContext(overrides?: Partial<ControlPlaneContext>): ControlPlaneContext {
  return {
    orgId: 'org-test',
    actorId: 'actor-test',
    actorRole: 'admin',
    correlationId: 'corr-test',
    requestId: 'req-test',
    timestamp: new Date(),
    ...overrides,
  }
}

function makeSyncItem(overrides?: Partial<OfflineSyncItem>): OfflineSyncItem {
  return {
    id: 'item-1',
    type: 'ticket_scan',
    action: 'scan',
    timestamp: new Date('2025-01-01T12:00:00Z'),
    data: {},
    ...overrides,
  }
}

describe('@nzila/zonga-control-plane — Offline Sync', () => {
  beforeEach(() => {
    clearEventLog()
  })

  // ── resolveConflicts ──────────────────────────────────────────────

  describe('resolveConflicts', () => {
    it('resolves duplicate_scan with remote wins', () => {
      const local = makeSyncItem({ id: 'scan-1' })
      const remote = makeSyncItem({ id: 'scan-1', data: { verified: true } })
      const conflicts: SyncConflict[] = [
        { localItem: local, remoteItem: remote, conflictType: 'duplicate_scan' },
      ]

      const resolved = resolveConflicts(conflicts)
      expect(resolved).toHaveLength(1)
      expect(resolved[0]!.data).toEqual({ verified: true })
    })

    it('resolves delete_conflict with remote wins', () => {
      const local = makeSyncItem({ id: 'del-1' })
      const remote = makeSyncItem({ id: 'del-1', data: { deleted: true } })
      const conflicts: SyncConflict[] = [
        { localItem: local, remoteItem: remote, conflictType: 'delete_conflict' },
      ]

      const resolved = resolveConflicts(conflicts)
      expect(resolved).toHaveLength(1)
      expect(resolved[0]!.data).toEqual({ deleted: true })
    })

    it('resolves update_conflict with last-write-wins (local newer)', () => {
      const local = makeSyncItem({
        id: 'upd-1',
        timestamp: new Date('2025-01-02T00:00:00Z'),
        data: { local: true },
      })
      const remote = makeSyncItem({
        id: 'upd-1',
        timestamp: new Date('2025-01-01T00:00:00Z'),
        data: { remote: true },
      })
      const conflicts: SyncConflict[] = [
        { localItem: local, remoteItem: remote, conflictType: 'update_conflict' },
      ]

      const resolved = resolveConflicts(conflicts)
      expect(resolved[0]!.data).toEqual({ local: true })
    })

    it('resolves update_conflict with last-write-wins (remote newer)', () => {
      const local = makeSyncItem({
        id: 'upd-2',
        timestamp: new Date('2025-01-01T00:00:00Z'),
        data: { local: true },
      })
      const remote = makeSyncItem({
        id: 'upd-2',
        timestamp: new Date('2025-01-02T00:00:00Z'),
        data: { remote: true },
      })
      const conflicts: SyncConflict[] = [
        { localItem: local, remoteItem: remote, conflictType: 'update_conflict' },
      ]

      const resolved = resolveConflicts(conflicts)
      expect(resolved[0]!.data).toEqual({ remote: true })
    })
  })

  // ── processSyncQueue ──────────────────────────────────────────────

  describe('processSyncQueue', () => {
    it('syncs items not present on remote', () => {
      const ctx = makeContext()
      const queue: SyncQueue = {
        items: [makeSyncItem({ id: 'new-1' }), makeSyncItem({ id: 'new-2' })],
        lastSyncAt: null,
        deviceId: 'device-1',
      }

      const result = processSyncQueue(ctx, queue, [])

      expect(result.synced).toBe(2)
      expect(result.conflicts).toBe(0)
      expect(result.failed).toBe(0)
    })

    it('detects and resolves conflicts with remote', () => {
      const ctx = makeContext()
      const localItem = makeSyncItem({
        id: 'conflict-1',
        timestamp: new Date('2025-01-01T00:00:00Z'),
      })
      const remoteItem = makeSyncItem({
        id: 'conflict-1',
        timestamp: new Date('2025-01-02T00:00:00Z'),
      })
      const queue: SyncQueue = {
        items: [localItem],
        lastSyncAt: null,
        deviceId: 'device-1',
      }

      const result = processSyncQueue(ctx, queue, [remoteItem])

      expect(result.conflicts).toBe(1)
      expect(result.resolved).toBe(1)
    })

    it('counts matching timestamps as synced (no conflict)', () => {
      const ctx = makeContext()
      const ts = new Date('2025-01-01T00:00:00Z')
      const item = makeSyncItem({ id: 'same-1', timestamp: ts })
      const queue: SyncQueue = {
        items: [item],
        lastSyncAt: null,
        deviceId: 'device-1',
      }

      const result = processSyncQueue(ctx, queue, [makeSyncItem({ id: 'same-1', timestamp: ts })])

      expect(result.synced).toBe(1)
      expect(result.conflicts).toBe(0)
    })

    it('emits sync event', () => {
      const ctx = makeContext()
      const queue: SyncQueue = {
        items: [makeSyncItem({ id: 'q-1' })],
        lastSyncAt: null,
        deviceId: 'device-x',
      }

      processSyncQueue(ctx, queue, [])

      const events = getEventLog()
      expect(events.length).toBeGreaterThanOrEqual(1)
      expect(events[0]!.payload['deviceId']).toBe('device-x')
    })

    it('tracks failed items when conflict resolution returns empty', () => {
      const ctx = makeContext()
      const localItem = makeSyncItem({
        id: 'upd-1',
        type: 'playlist_change',
        timestamp: new Date('2025-01-01T00:00:00Z'),
      })
      const remoteItem = makeSyncItem({
        id: 'upd-1',
        type: 'playlist_change',
        timestamp: new Date('2025-01-02T00:00:00Z'),
      })
      const queue: SyncQueue = {
        items: [localItem],
        lastSyncAt: null,
        deviceId: 'device-upd',
      }

      const result = processSyncQueue(ctx, queue, [remoteItem])

      // Non-ticket_scan items use update_conflict resolution
      expect(result.conflicts).toBe(1)
      expect(result.resolved).toBe(1)
    })
  })

  // ── buildSyncState / needsSync ────────────────────────────────────

  describe('buildSyncState', () => {
    it('builds state from queue', () => {
      const queue: SyncQueue = {
        items: [makeSyncItem(), makeSyncItem({ id: 'item-2' })],
        lastSyncAt: new Date('2025-01-01'),
        deviceId: 'dev-1',
      }

      const state = buildSyncState('dev-1', queue, true)

      expect(state.deviceId).toBe('dev-1')
      expect(state.pendingCount).toBe(2)
      expect(state.isOnline).toBe(true)
      expect(state.lastSyncAt).toEqual(new Date('2025-01-01'))
    })

    it('counts items with conflictWith as conflicts', () => {
      const queue: SyncQueue = {
        items: [
          makeSyncItem({ id: 'c-1', conflictWith: 'remote-1' }),
          makeSyncItem({ id: 'c-2' }),
        ],
        lastSyncAt: null,
        deviceId: 'dev-2',
      }

      const state = buildSyncState('dev-2', queue, false)

      expect(state.conflictCount).toBe(1)
      expect(state.isOnline).toBe(false)
    })
  })

  describe('needsSync', () => {
    it('returns true when online with pending items', () => {
      const state = {
        deviceId: 'd-1',
        lastSyncAt: null,
        pendingCount: 3,
        conflictCount: 0,
        isOnline: true,
      }
      expect(needsSync(state)).toBe(true)
    })

    it('returns false when offline', () => {
      const state = {
        deviceId: 'd-1',
        lastSyncAt: null,
        pendingCount: 3,
        conflictCount: 0,
        isOnline: false,
      }
      expect(needsSync(state)).toBe(false)
    })

    it('returns false when no pending items', () => {
      const state = {
        deviceId: 'd-1',
        lastSyncAt: null,
        pendingCount: 0,
        conflictCount: 0,
        isOnline: true,
      }
      expect(needsSync(state)).toBe(false)
    })
  })
})
