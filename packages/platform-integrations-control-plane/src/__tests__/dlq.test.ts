/**
 * DLQ Manager — Unit Tests
 */
import { describe, it, expect, vi } from 'vitest'
import { DlqManager, type DlqPorts } from '../dlq'
import type { DlqEntry } from '../types'

function makeDlqEntry(overrides: Partial<DlqEntry> = {}): DlqEntry {
  return {
    id: crypto.randomUUID(),
    orgId: 'org-123',
    provider: 'slack',
    channel: 'notification',
    payload: { message: 'test' },
    error: 'Connection timeout',
    attempts: 3,
    failedAt: new Date().toISOString(),
    correlationId: crypto.randomUUID(),
    ...overrides,
  }
}

function makePorts(
  entries: DlqEntry[] = [],
  overrides: Partial<DlqPorts> = {},
): DlqPorts {
  const store = new Map(entries.map((e) => [e.id, e]))

  return {
    listEntries: vi.fn(async (orgId: string, limit: number) =>
      [...store.values()].filter((e) => e.orgId === orgId).slice(0, limit),
    ),
    getEntry: vi.fn(async (id: string) => store.get(id) ?? null),
    removeEntry: vi.fn(async (id: string) => { store.delete(id) }),
    countEntries: vi.fn(async (orgId: string) =>
      [...store.values()].filter((e) => e.orgId === orgId).length,
    ),
    redispatch: vi.fn(async () => ({ success: true })),
    ...overrides,
  }
}

describe('DlqManager', () => {
  it('lists DLQ entries for an org', async () => {
    const entries = [makeDlqEntry(), makeDlqEntry()]
    const dlq = new DlqManager(makePorts(entries))

    const result = await dlq.list('org-123')
    expect(result).toHaveLength(2)
  })

  it('returns DLQ depth', async () => {
    const entries = [makeDlqEntry(), makeDlqEntry(), makeDlqEntry()]
    const dlq = new DlqManager(makePorts(entries))

    expect(await dlq.depth('org-123')).toBe(3)
  })

  it('replays entries successfully', async () => {
    const entry = makeDlqEntry()
    const dlq = new DlqManager(makePorts([entry]))

    const results = await dlq.replay([entry.id])

    expect(results).toHaveLength(1)
    expect(results[0].status).toBe('replayed')
  })

  it('reports failure for missing entries', async () => {
    const dlq = new DlqManager(makePorts([]))

    const results = await dlq.replay(['nonexistent-id'])

    expect(results[0].status).toBe('failed')
    expect(results[0].error).toContain('not found')
  })

  it('reports failure when redispatch fails', async () => {
    const entry = makeDlqEntry()
    const ports = makePorts([entry], {
      redispatch: vi.fn(async () => ({ success: false, error: 'Provider down' })),
    })
    const dlq = new DlqManager(ports)

    const results = await dlq.replay([entry.id])

    expect(results[0].status).toBe('failed')
    expect(results[0].error).toBe('Provider down')
  })

  it('uses fallback replay error when redispatch omits error details', async () => {
    const entry = makeDlqEntry()
    const ports = makePorts([entry], {
      redispatch: vi.fn(async () => ({ success: false })),
    })
    const dlq = new DlqManager(ports)

    const results = await dlq.replay([entry.id])

    expect(results[0].status).toBe('failed')
    expect(results[0].error).toBe('Re-dispatch failed')
  })

  it('reports failure when getEntry throws Error', async () => {
    const entry = makeDlqEntry()
    const ports = makePorts([entry], {
      getEntry: vi.fn(async () => { throw new Error('Lookup failed') }),
    })
    const dlq = new DlqManager(ports)

    const results = await dlq.replay([entry.id])

    expect(results[0].status).toBe('failed')
    expect(results[0].error).toBe('Lookup failed')
  })

  it('reports failure when getEntry throws non-Error value', async () => {
    const entry = makeDlqEntry()
    const ports = makePorts([entry], {
      getEntry: vi.fn(async () => { throw 'lookup panic' }),
    })
    const dlq = new DlqManager(ports)

    const results = await dlq.replay([entry.id])

    expect(results[0].status).toBe('failed')
    expect(results[0].error).toBe('lookup panic')
  })

  it('purges all entries for an org', async () => {
    const entries = [makeDlqEntry(), makeDlqEntry()]
    const ports = makePorts(entries)
    const dlq = new DlqManager(ports)

    const purged = await dlq.purge('org-123')

    expect(purged).toBe(2)
  })

  it('handles errors during purge gracefully', async () => {
    const entry = makeDlqEntry()
    const ports = makePorts([entry], {
      removeEntry: vi.fn(async () => { throw new Error('DB error') }),
    })
    const dlq = new DlqManager(ports)

    const purged = await dlq.purge('org-123')
    expect(purged).toBe(0)
  })

  it('handles non-Error throwables during purge gracefully', async () => {
    const entry = makeDlqEntry()
    const ports = makePorts([entry], {
      removeEntry: vi.fn(async () => { throw 'remove panic' }),
    })
    const dlq = new DlqManager(ports)

    const purged = await dlq.purge('org-123')
    expect(purged).toBe(0)
  })
})
