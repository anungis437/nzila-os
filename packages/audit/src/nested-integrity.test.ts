import { createHash } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { AuditEngine, computeAuditHash } from './engine.js'
import { InMemoryAuditStore } from './store.js'
import { verifyChain } from './verify.js'
import { GENESIS_HASH } from './schema.js'

const fixed = {
  id: '00000000-0000-4000-8000-000000000001',
  timestamp: '2026-10-17T00:00:00.000Z',
  actorId: 'synthetic-actor', orgId: 'synthetic-org',
  action: 'grant', resource: 'synthetic-resource', resourceId: 'resource-1',
}

describe('nested audit integrity', () => {
  it('matches the independently specified domain-separated canonical v2 input', () => {
    const payload = { z: [{ second: 2, first: true }, null], a: { nested: 'value' } }
    const canonical = '{"a":{"nested":"value"},"z":[{"first":true,"second":2},null]}'
    const expected = createHash('sha256').update(`nzila:audit:sha256:v2\0${GENESIS_HASH}\0${canonical}`).digest('hex')
    expect(computeAuditHash(GENESIS_HASH, payload, 2)).toBe(expected)
    expect(computeAuditHash(GENESIS_HASH, payload, 1)).not.toBe(expected)
  })

  it('changes the hash when only a nested grant changes', () => {
    const before = { ...fixed, payload: { grant: { allowNetwork: false } } }
    const after = { ...fixed, payload: { grant: { allowNetwork: true } } }
    expect(computeAuditHash(GENESIS_HASH, before)).not.toBe(computeAuditHash(GENESIS_HASH, after))
  })

  it.each([
    ['nested object', { grant: { allowNetwork: true } }],
    ['deep object', { grant: { allowNetwork: false }, context: { owner: { id: 'changed' } } }],
    ['array value', { grant: { allowNetwork: false }, context: { owner: { id: 'owner' } }, values: [2, 1] }],
  ])('detects %s tampering without changing the recorded hash', async (_name, payload) => {
    const store = new InMemoryAuditStore()
    const entry = await new AuditEngine(store).record({
      actorId: fixed.actorId, orgId: fixed.orgId, action: fixed.action, resource: fixed.resource,
      payload: { grant: { allowNetwork: false }, context: { owner: { id: 'owner' } }, values: [1, 2] },
    })
    expect(verifyChain([{ ...entry, payload }]).valid).toBe(false)
  })

  it('ignores insertion order at every object depth while retaining array order', () => {
    const a = { ...fixed, payload: { z: [1, { y: null, x: false }], a: { second: 2, first: 'one' } } }
    const b = { payload: { a: { first: 'one', second: 2 }, z: [1, { x: false, y: null }] }, ...fixed }
    expect(computeAuditHash(GENESIS_HASH, a)).toBe(computeAuditHash(GENESIS_HASH, b))
  })

  it('preserves primitive types, null, array order and input values', () => {
    const values = [false, true, null, 0, '0', '', [], {}, [1, 2], [2, 1]]
    const hashes = values.map(value => computeAuditHash(GENESIS_HASH, { ...fixed, payload: { value } }))
    expect(new Set(hashes).size).toBe(values.length)
    const input = Object.freeze({ ...fixed, payload: Object.freeze({ z: 2, a: Object.freeze([1, null]) }) })
    const before = JSON.stringify(input)
    computeAuditHash(GENESIS_HASH, input)
    expect(JSON.stringify(input)).toBe(before)
  })

  it('hashes the same JSON snapshot it persists, including stateful toJSON', async () => {
    let serializations = 0
    const store = new InMemoryAuditStore()
    const entry = await new AuditEngine(store).record({
      ...fixed, payload: { value: { toJSON: () => ({ serializations: ++serializations }) } },
    })
    expect(serializations).toBe(1)
    expect(entry.payload).toEqual({ value: { serializations: 1 } })
    expect(verifyChain(store.getAll(), { requireFullCoverage: true }).valid).toBe(true)
  })

  it('captures nested input before awaiting the store and isolates the recorded value', async () => {
    const store = new InMemoryAuditStore()
    const payload = { grant: { allowNetwork: false }, values: [1, 2] }
    const recording = new AuditEngine(store).record({ ...fixed, payload })
    payload.grant.allowNetwork = true
    payload.values.reverse()
    const entry = await recording
    expect(entry.payload).toEqual({ grant: { allowNetwork: false }, values: [1, 2] })
    ;(entry.payload.grant as { allowNetwork: boolean }).allowNetwork = true
    expect((await store.getEntry(entry.id))?.payload.grant).toEqual({ allowNetwork: false })
    expect(verifyChain(store.getAll()).valid).toBe(true)
    expect(() => {
      const stored = store.getAll()[0]
      ;(stored.payload.grant as { allowNetwork: boolean }).allowNetwork = true
    }).toThrow()
  })

  it.each([1n, { nested: 1n }])('rejects non-JSON BigInt values before append', async value => {
    const store = new InMemoryAuditStore()
    await expect(new AuditEngine(store).record({ ...fixed, payload: { value } })).rejects.toThrow()
    expect(store.getAll()).toHaveLength(0)
  })

  it('preserves JSON omission, array holes, date and non-finite number semantics', async () => {
    const store = new InMemoryAuditStore()
    const entry = await new AuditEngine(store).record({
      ...fixed, payload: { absent: undefined, values: [undefined, NaN, Infinity], date: new Date(fixed.timestamp) },
    })
    expect(entry.payload).toEqual({ values: [null, null, null], date: fixed.timestamp })
    expect(verifyChain(store.getAll()).valid).toBe(true)
  })
})
