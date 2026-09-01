/**
 * Proves the core invariant behind the RLS-foundation system/tenant
 * connection split: code that queries through the module-level `db` import
 * (from '@/db/db') — the pattern every existing withSystemContext() caller
 * uses — transparently resolves to the active system connection while
 * inside withSystemContext()/withPlatformAdminRLSContext(), even though
 * those callers never touch the `tx` parameter their callback receives.
 *
 * This does NOT mock db.ts's routing logic — it exercises the real Proxy
 * in db.ts and the real AsyncLocalStorage in system-context-storage.ts.
 * Only the underlying postgres/drizzle client construction is unreachable
 * in a unit test (no live DB here), which is why this asserts against a
 * fake "system db" object pushed through systemContextStorage.run()
 * directly, rather than exercising the full withSystemContext() control
 * flow (that requires a live Postgres connection — see
 * scripts/rls-manual-proof.sql for the live, DB-backed proof).
 */
import { describe, it, expect, afterEach } from 'vitest'

// Real modules — nothing mocked here on purpose.
import { systemContextStorage } from '../system-context-storage'
import { db } from '../db'

describe('db.ts system-context routing (AsyncLocalStorage)', () => {
  afterEach(() => {
    // Nothing to reset — AsyncLocalStorage scoping is automatically bounded
    // to the .run() callback and cannot leak between tests.
  })

  it('routes db.<prop> to the active system connection when inside systemContextStorage.run()', () => {
    const marker = Symbol('system-connection-marker')
    const fakeSystemDb = { execute: marker } as any

    const observed = systemContextStorage.run(fakeSystemDb, () => {
      // This is exactly the pattern every existing withSystemContext()
      // caller uses: `db.execute(...)` via the plain module import, not a
      // destructured `tx`. It must resolve to the active system db.
      return db.execute
    })

    expect(observed).toBe(marker)
  })

  it('does not leak the system connection outside the run() scope', () => {
    const fakeSystemDb = { execute: Symbol('inside-scope') } as any

    systemContextStorage.run(fakeSystemDb, () => {
      expect(db.execute).toBe(fakeSystemDb.execute)
    })

    // Outside the run() callback, accessing db.execute must NOT throw due
    // to a lingering system override, and must not equal the fake marker —
    // it falls through to the real (lazy-initialized) tenant client getter,
    // which throws in this test environment because DATABASE_URL is unset.
    // That failure mode itself proves no system override survived: if the
    // system override had leaked, db.execute would still equal the fake
    // marker with no error at all.
    expect(() => db.execute).toThrow(/DATABASE_URL/)
  })

  it('supports nested/sequential system contexts without cross-contamination', () => {
    const dbA = { execute: Symbol('a') } as any
    const dbB = { execute: Symbol('b') } as any

    systemContextStorage.run(dbA, () => {
      expect(db.execute).toBe(dbA.execute)
    })

    systemContextStorage.run(dbB, () => {
      expect(db.execute).toBe(dbB.execute)
    })
  })

  it('isolates concurrent, interleaved async system contexts (the actual property AsyncLocalStorage exists to guarantee — two simultaneous requests must never observe each other\'s connection)', async () => {
    const dbA = { execute: Symbol('concurrent-a'), tag: 'A' } as any
    const dbB = { execute: Symbol('concurrent-b'), tag: 'B' } as any

    const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

    const runA = systemContextStorage.run(dbA, async () => {
      // Yield to the event loop BEFORE reading db.execute, so runB's own
      // run() call interleaves with this one — a purely synchronous test
      // (like the sequential test above) cannot catch ALS context leaking
      // across concurrent async executions, only this interleaved-await
      // shape can.
      await delay(5)
      expect(db.execute).toBe(dbA.execute)
      await delay(5)
      // Re-check after a second yield, in case runB's completion (which
      // also runs during this window) incorrectly cleared or overwrote
      // runA's context.
      expect(db.execute).toBe(dbA.execute)
      return dbA.tag
    })

    const runB = systemContextStorage.run(dbB, async () => {
      await delay(1) // starts and interleaves slightly ahead of runA's first yield
      expect(db.execute).toBe(dbB.execute)
      await delay(10)
      expect(db.execute).toBe(dbB.execute)
      return dbB.tag
    })

    const [resultA, resultB] = await Promise.all([runA, runB])
    expect(resultA).toBe('A')
    expect(resultB).toBe('B')

    // Both scopes have exited — neither context should linger.
    expect(() => db.execute).toThrow(/DATABASE_URL/)
  })
})
