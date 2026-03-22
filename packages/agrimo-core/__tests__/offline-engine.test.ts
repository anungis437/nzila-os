import { describe, it, expect, vi } from 'vitest'
import { OfflineStore, type OfflineRecord } from '../offline-engine'

function makeStore() {
  return new OfflineStore({
    device_id: 'device-1',
    conflict_strategy: 'last-write-wins',
  })
}

describe('OfflineStore', () => {
  describe('create', () => {
    it('creates a record with local_id and synced=false', () => {
      const store = makeStore()
      const rec = store.create({ crop: 'maize', quantity: 100 })
      expect(rec.local_id).toMatch(/^local_/)
      expect(rec.synced).toBe(false)
      expect(rec.last_synced_at).toBeNull()
      expect(rec.device_id).toBe('device-1')
      expect(rec.version).toBe(1)
      expect(rec.data).toEqual({ crop: 'maize', quantity: 100 })
    })

    it('is retrievable after creation', () => {
      const store = makeStore()
      const rec = store.create({ name: 'test' })
      expect(store.get(rec.local_id)).toEqual(rec)
    })
  })

  describe('update', () => {
    it('updates data and increments version', () => {
      const store = makeStore()
      const rec = store.create({ crop: 'maize', quantity: 100 })
      const updated = store.update(rec.local_id, { quantity: 200 })
      expect(updated.data).toEqual({ crop: 'maize', quantity: 200 })
      expect(updated.version).toBe(2)
      expect(updated.synced).toBe(false)
    })

    it('throws for unknown record', () => {
      const store = makeStore()
      expect(() => store.update('unknown', {})).toThrow('Record not found')
    })
  })

  describe('list', () => {
    it('returns all records', () => {
      const store = makeStore()
      store.create({ a: 1 })
      store.create({ b: 2 })
      expect(store.list()).toHaveLength(2)
    })
  })

  describe('getPendingWrites', () => {
    it('returns only unsynced records', () => {
      const store = makeStore()
      store.create({ a: 1 })
      store.create({ b: 2 })
      expect(store.getPendingWrites()).toHaveLength(2)
    })
  })

  describe('sync', () => {
    it('pushes pending records and marks as synced', async () => {
      const store = makeStore()
      const rec = store.create({ crop: 'maize' })

      const pushFn = vi.fn(async (records: OfflineRecord[]) => records)
      const pullFn = vi.fn(async () => [])

      const result = await store.sync(pushFn, pullFn)
      expect(result.pushed).toBe(1)
      expect(result.pulled).toBe(0)
      expect(result.conflicts).toHaveLength(0)
      expect(store.get(rec.local_id)?.synced).toBe(true)
    })

    it('pulls new records from remote', async () => {
      const store = makeStore()
      const remoteRec: OfflineRecord = {
        local_id: 'remote_1',
        data: { from: 'server' },
        synced: true,
        last_synced_at: new Date().toISOString(),
        device_id: 'device-2',
        version: 1,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }

      const result = await store.sync(
        async () => [],
        async () => [remoteRec],
      )
      expect(result.pulled).toBe(1)
      expect(store.get('remote_1')).toBeDefined()
    })

    it('resolves conflicts with last-write-wins', async () => {
      const store = makeStore()
      const rec = store.create({ value: 'local' })

      // Sync to mark as synced
      await store.sync(
        async (records) => records,
        async () => [],
      )

      // Remote has a different version
      const remoteRec: OfflineRecord = {
        ...rec,
        data: { value: 'remote' },
        version: 99,
        updated_at: new Date(Date.now() + 10000).toISOString(),
      }

      const result = await store.sync(
        async () => [],
        async () => [remoteRec],
      )
      expect(result.conflicts).toHaveLength(1)
      expect(result.conflicts[0]!.resolution).toBe('remote_wins')
    })
  })

  describe('getSyncStatus', () => {
    it('reports correct counts', () => {
      const store = makeStore()
      store.create({ a: 1 })
      store.create({ b: 2 })
      const status = store.getSyncStatus()
      expect(status.total).toBe(2)
      expect(status.synced).toBe(0)
      expect(status.pending).toBe(2)
    })
  })

  describe('no connectivity', () => {
    it('all operations work without network', () => {
      const store = makeStore()
      const rec = store.create({ data: 'offline' })
      store.update(rec.local_id, { data: 'still offline' })
      expect(store.list()).toHaveLength(1)
      expect(store.getSyncStatus().pending).toBe(1)
    })
  })
})
