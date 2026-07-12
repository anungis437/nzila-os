import { afterEach, describe, expect, it, vi } from 'vitest'

// Proves production uses the DURABLE (PostgreSQL) idempotency store: the
// in-memory store is only a no-database dev/test fallback. `vi.resetModules()`
// creates fresh class identities, so we assert on the constructor name rather
// than `instanceof`.
describe('SAGE idempotency cache selection', () => {
  const original = process.env.DATABASE_URL

  afterEach(() => {
    if (original === undefined) delete process.env.DATABASE_URL
    else process.env.DATABASE_URL = original
    vi.resetModules()
  })

  it('uses a durable PostgreSQL cache when DATABASE_URL is configured', async () => {
    process.env.DATABASE_URL = 'postgres://sage-test'
    vi.resetModules()
    const mod = await import('../idempotency')
    expect(mod.shouldUseDurableIdempotency()).toBe(true)
    expect(mod.getSageIdempotencyCache().constructor.name).toBe('PostgresIdempotencyCache')
  })

  it('falls back to in-memory only when no database is configured', async () => {
    delete process.env.DATABASE_URL
    vi.resetModules()
    const mod = await import('../idempotency')
    expect(mod.shouldUseDurableIdempotency()).toBe(false)
    expect(mod.getSageIdempotencyCache().constructor.name).toBe('InMemoryIdempotencyCache')
  })
})
