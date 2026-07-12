/**
 * Crash-recovery + fencing tests for the leased idempotency reservation.
 *
 * The in-memory suite drives the protocol with an INJECTED clock so a lease can
 * be expired deterministically (no real waiting), proving stale reclaim and
 * owner fencing. The Postgres suite mocks the drizzle client + `drizzle-orm`
 * helpers to assert the atomic reclaim / fenced finalize / fenced release SQL
 * (predicates + parameterization) without a live database.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

// ── Postgres drizzle mocks (hoisted, file-scoped) ─────────────────────────────

const h = vi.hoisted(() => ({
  eqCalls: [] as Array<[unknown, unknown]>,
  ltCalls: [] as Array<[unknown, unknown]>,
  setPayload: null as Record<string, unknown> | null,
  insertReturning: [] as unknown[],
  selectRows: [] as unknown[],
  updateReturning: [] as unknown[],
}))

vi.mock('@nzila/db/schema', () => ({
  idempotencyCache: {
    id: 'id',
    cacheKey: 'cache_key',
    payloadHash: 'payload_hash',
    status: 'status',
    body: 'body',
    headers: 'headers',
    reservationOwner: 'reservation_owner',
    createdAt: 'created_at',
    expiresAt: 'expires_at',
  },
}))

vi.mock('drizzle-orm', () => ({
  eq: (col: unknown, val: unknown) => {
    h.eqCalls.push([col, val])
    return { op: 'eq', col, val }
  },
  lt: (col: unknown, val: unknown) => {
    h.ltCalls.push([col, val])
    return { op: 'lt', col, val }
  },
  gt: (col: unknown, val: unknown) => ({ op: 'gt', col, val }),
  and: (...args: unknown[]) => ({ op: 'and', args }),
}))

vi.mock('@nzila/db/client', () => ({
  db: {
    insert: () => ({
      values: () => ({
        onConflictDoNothing: () => ({
          returning: async () => h.insertReturning,
        }),
      }),
    }),
    select: () => ({
      from: () => ({ where: () => ({ limit: async () => h.selectRows }) }),
    }),
    update: () => ({
      set: (payload: Record<string, unknown>) => {
        h.setPayload = payload
        return { where: () => ({ returning: async () => h.updateReturning }) }
      },
    }),
    delete: () => ({ where: async () => undefined }),
  },
}))

import {
  InMemoryIdempotencyCache,
  PostgresIdempotencyCache,
  runIdempotentMutation,
} from '../idempotency'

// ── In-memory: lease + fencing + crash recovery ──────────────────────────────

function leasedCache(clockRef: { t: number }, leaseMs = 1_000) {
  return new InMemoryIdempotencyCache(50_000, { leaseMs, now: () => clockRef.t })
}
function owner(acq: { outcome: string } & Record<string, unknown>): string {
  if (acq.outcome !== 'acquired') throw new Error(`expected acquired, got ${acq.outcome}`)
  return acq.owner as string
}

describe('InMemory reservation lease — crash recovery + fencing', () => {
  it('reclaims a stale lease for owner B and fences the crashed owner A end to end', async () => {
    const clock = { t: 1_000 }
    const cache = leasedCache(clock)

    const a = await cache.acquire('k', 'h')
    const ownerA = owner(a)

    // Owner A "crashes" — never finalizes/releases. Lease lapses.
    clock.t += 2_000

    // Owner B reclaims the same key + payload.
    const b = await cache.acquire('k', 'h')
    const ownerB = owner(b)
    expect(ownerB).not.toBe(ownerA)

    // A cannot finalize (ownership lost).
    const lateFinalizeA = await cache.finalize('k', ownerA, {
      payloadHash: 'h',
      status: 201,
      body: '{"v":"A"}',
      headers: {},
      createdAt: clock.t,
    })
    expect(lateFinalizeA).toEqual({ ok: false, reason: 'ownership_lost' })

    // A cannot release B's reservation.
    await cache.release('k', ownerA)
    expect((await cache.acquire('k', 'h')).outcome).toBe('in_progress') // B still holds it

    // B can finalize.
    const finalizeB = await cache.finalize('k', ownerB, {
      payloadHash: 'h',
      status: 201,
      body: '{"v":"B"}',
      headers: {},
      createdAt: clock.t,
    })
    expect(finalizeB).toEqual({ ok: true })

    // A later retry replays B's completed result.
    const replay = await cache.acquire('k', 'h')
    expect(replay.outcome).toBe('replay')
    if (replay.outcome === 'replay') expect(replay.entry.body).toBe('{"v":"B"}')
  })

  it('does not reclaim while the lease is still active (returns in_progress)', async () => {
    const clock = { t: 1_000 }
    const cache = leasedCache(clock, 5_000)
    await cache.acquire('k', 'h')
    clock.t += 1_000 // still within the 5s lease
    expect((await cache.acquire('k', 'h')).outcome).toBe('in_progress')
  })

  it('never reclaims a stale reservation across a different payload (conflict)', async () => {
    const clock = { t: 1_000 }
    const cache = leasedCache(clock)
    await cache.acquire('k', 'h-a')
    clock.t += 2_000 // stale
    expect((await cache.acquire('k', 'h-b')).outcome).toBe('mismatch')
  })

  it('recovers from a crashed holder: the mutation runs once after reclaim and is replayable', async () => {
    const clock = { t: 1_000 }
    const cache = leasedCache(clock)

    // Worker A acquires then "crashes" (no finalize/release).
    expect((await cache.acquire('k', 'h')).outcome).toBe('acquired')
    clock.t += 2_000 // lease expires

    const run = vi.fn(async () => ({ id: 'once' }))
    const first = await runIdempotentMutation({
      cache,
      cacheKey: 'k',
      payloadHash: 'h',
      status: 201,
      run,
      pollMs: 1,
    })
    expect(run).toHaveBeenCalledTimes(1) // reclaimed + executed exactly once
    expect(first.replayed).toBe(false)
    expect(first.response).toEqual({ id: 'once' })

    const second = await runIdempotentMutation({
      cache,
      cacheKey: 'k',
      payloadHash: 'h',
      status: 201,
      run,
      pollMs: 1,
    })
    expect(run).toHaveBeenCalledTimes(1) // replayed, not re-run
    expect(second.replayed).toBe(true)
    expect(second.response).toEqual({ id: 'once' })
  })

  it("rejects a late finalize from a reclaimed owner and keeps the new owner's result authoritative", async () => {
    const clock = { t: 1_000 }
    const cache = leasedCache(clock)
    const a = await cache.acquire('k', 'h')
    const ownerA = owner(a)
    clock.t += 2_000
    const b = await cache.acquire('k', 'h')
    const ownerB = owner(b)

    await cache.finalize('k', ownerB, {
      payloadHash: 'h',
      status: 201,
      body: '{"v":"B"}',
      headers: {},
      createdAt: clock.t,
    })
    const late = await cache.finalize('k', ownerA, {
      payloadHash: 'h',
      status: 201,
      body: '{"v":"A-late"}',
      headers: {},
      createdAt: clock.t,
    })
    expect(late).toEqual({ ok: false, reason: 'ownership_lost' })

    const replay = await cache.acquire('k', 'h')
    if (replay.outcome === 'replay') expect(replay.entry.body).toBe('{"v":"B"}')
    else throw new Error('expected replay of B')
  })
})

// ── Postgres: atomic reclaim / fenced finalize / fenced release SQL ───────────

describe('PostgresIdempotencyCache — lease SQL (mocked drizzle)', () => {
  beforeEach(() => {
    h.eqCalls = []
    h.ltCalls = []
    h.setPayload = null
    h.insertReturning = []
    h.selectRows = []
    h.updateReturning = []
  })

  function eqValueFor(col: string): unknown {
    const found = h.eqCalls.find(([c]) => c === col)
    return found ? found[1] : undefined
  }

  it('reclaims a stale reservation with an atomic compare-and-set (status + payload + expiry)', async () => {
    // Fresh insert conflicts (row exists); the existing row is a STALE reservation.
    h.insertReturning = []
    h.selectRows = [
      {
        status: 0,
        payloadHash: 'h',
        body: '',
        headers: {},
        reservationOwner: 'old',
        createdAt: new Date(),
        expiresAt: new Date(Date.now() - 60_000), // lease already lapsed
      },
    ]
    h.updateReturning = [{ cacheKey: 'k' }] // reclaim CAS matched one row

    const cache = new PostgresIdempotencyCache(48 * 3600 * 1000, { leaseMs: 1_000 })
    const result = await cache.acquire('k', 'h')
    expect(result.outcome).toBe('acquired')

    // The reclaim UPDATE predicate is a compare-and-set on status=0 + payload + expiry.
    expect(eqValueFor('status')).toBe(0)
    expect(eqValueFor('payload_hash')).toBe('h')
    expect(eqValueFor('cache_key')).toBe('k')
    expect(h.ltCalls.some(([c]) => c === 'expires_at')).toBe(true) // lease-expiry predicate
    // The reclaim SET installs a NEW owner token + a fresh lease.
    expect(typeof h.setPayload?.reservationOwner).toBe('string')
    expect(h.setPayload?.expiresAt).toBeInstanceOf(Date)
  })

  it('returns in_progress for a reservation whose lease is still active', async () => {
    h.insertReturning = []
    h.selectRows = [
      {
        status: 0,
        payloadHash: 'h',
        body: '',
        headers: {},
        reservationOwner: 'holder',
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + 60_000), // lease still active
      },
    ]
    const cache = new PostgresIdempotencyCache(48 * 3600 * 1000, { leaseMs: 1_000 })
    expect((await cache.acquire('k', 'h')).outcome).toBe('in_progress')
  })

  it('does not reclaim a stale reservation with a different payload (conflict)', async () => {
    h.insertReturning = []
    h.selectRows = [
      {
        status: 0,
        payloadHash: 'h-a',
        body: '',
        headers: {},
        reservationOwner: 'old',
        createdAt: new Date(),
        expiresAt: new Date(Date.now() - 60_000),
      },
    ]
    const cache = new PostgresIdempotencyCache(48 * 3600 * 1000, { leaseMs: 1_000 })
    expect((await cache.acquire('k', 'h-b')).outcome).toBe('mismatch')
    // No reclaim UPDATE happened.
    expect(h.setPayload).toBeNull()
  })

  it('fences finalize on the reservation owner and reports ownership_lost on zero rows', async () => {
    const cache = new PostgresIdempotencyCache(48 * 3600 * 1000, { leaseMs: 1_000 })

    h.updateReturning = [{ cacheKey: 'k' }]
    const ok = await cache.finalize('k', 'owner-1', {
      payloadHash: 'h',
      status: 201,
      body: '{"id":"1"}',
      headers: {},
      createdAt: Date.now(),
    })
    expect(ok).toEqual({ ok: true })
    expect(eqValueFor('reservation_owner')).toBe('owner-1') // fenced on owner (parameterized)
    expect(eqValueFor('status')).toBe(0)
    expect(eqValueFor('cache_key')).toBe('k')
    expect(h.setPayload?.reservationOwner).toBeNull() // cleared on completion

    h.eqCalls = []
    h.updateReturning = [] // ownership lost → zero rows
    const lost = await cache.finalize('k', 'owner-1', {
      payloadHash: 'h',
      status: 201,
      body: '{"id":"1"}',
      headers: {},
      createdAt: Date.now(),
    })
    expect(lost).toEqual({ ok: false, reason: 'ownership_lost' })
  })

  it('fences release on the reservation owner', async () => {
    const cache = new PostgresIdempotencyCache(48 * 3600 * 1000, { leaseMs: 1_000 })
    await cache.release('k', 'owner-1')
    expect(eqValueFor('reservation_owner')).toBe('owner-1')
    expect(eqValueFor('status')).toBe(0)
    expect(eqValueFor('cache_key')).toBe('k')
  })
})
