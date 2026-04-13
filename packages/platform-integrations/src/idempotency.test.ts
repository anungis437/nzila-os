import { describe, it, expect, beforeEach } from 'vitest'
import { InMemoryIdempotencyStore } from './idempotency'

describe('InMemoryIdempotencyStore', () => {
  let store: InMemoryIdempotencyStore

  beforeEach(() => {
    store = new InMemoryIdempotencyStore()
  })

  describe('check', () => {
    it('returns null for unseen key', async () => {
      const result = await store.check('key-1')
      expect(result).toBeNull()
    })

    it('returns stored result after recording', async () => {
      await store.record('key-1', { data: 'result' })
      const result = await store.check('key-1')
      expect(result).toEqual({ data: 'result' })
    })
  })

  describe('record', () => {
    it('stores idempotency entry', async () => {
      await store.record('key-2', { success: true })
      const result = await store.check('key-2')
      expect(result).toEqual({ success: true })
    })

    it('overwrites existing entry', async () => {
      await store.record('key-3', { version: 1 })
      await store.record('key-3', { version: 2 })
      const result = await store.check('key-3')
      expect(result).toEqual({ version: 2 })
    })
  })

  describe('remove', () => {
    it('removes stored entry', async () => {
      await store.record('key-4', { data: 'temp' })
      await store.remove('key-4')
      const result = await store.check('key-4')
      expect(result).toBeNull()
    })

    it('is a no-op for non-existent key', async () => {
      await expect(store.remove('nonexistent')).resolves.not.toThrow()
    })
  })

  describe('TTL', () => {
    it('expires entries after TTL', async () => {
      await store.record('key-ttl', { data: 'expires' }, 100) // 100ms TTL
      expect(await store.check('key-ttl')).toEqual({ data: 'expires' })

      await new Promise((r) => setTimeout(r, 200))
      expect(await store.check('key-ttl')).toBeNull()
    })
  })
})
