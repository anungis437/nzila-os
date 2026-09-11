/**
 * Proves the tenant-side counterpart of db/__tests__/system-context-
 * routing.test.ts: code that queries through the module-level `db` import
 * (from '@/db/db') — the pattern several existing withRLSContext()/
 * withExplicitUserContext() callers use (e.g.
 * `withRLSContext(async () => db.update(boardPackets)...)`) — transparently
 * resolves to the active TENANT transaction (the one that actually
 * received `set_config('app.current_org_id', ...)`) while inside that
 * scope, even though those callers never touch the `tx` parameter their
 * callback receives.
 *
 * PR #752 (public-authority tranche, round 16): before db/tenant-context-
 * storage.ts existed, db.ts's proxy had NO redirection for this case (only
 * for withSystemContext()'s system transaction) — a no-argument
 * withRLSContext() callback querying through `db` directly ran on the
 * ordinary pooled connection, a DIFFERENT physical connection than the one
 * `set_config()` was applied to. Once a real RLS policy is installed for a
 * table whose callers use this pattern, that gap would mean the policy's
 * `current_setting('app.current_org_id', true)` check sees an EMPTY/wrong
 * value on the pooled connection, not the value the code appears to set.
 *
 * This does NOT mock db.ts's routing logic — it exercises the real Proxy
 * in db.ts and the real AsyncLocalStorage in tenant-context-storage.ts.
 */
import { describe, it, expect } from 'vitest'

// Real modules — nothing mocked here on purpose.
import { tenantContextStorage } from '../tenant-context-storage'
import { systemContextStorage } from '../system-context-storage'
import { db } from '../db'

function readOutsideScope(): { threw: boolean; value: unknown } {
  try {
    return { threw: false, value: db.execute }
  } catch (err) {
    return { threw: true, value: err }
  }
}

describe('db.ts tenant-context routing (AsyncLocalStorage)', () => {
  it('routes db.<prop> to the active tenant transaction when inside tenantContextStorage.run()', () => {
    const marker = Symbol('tenant-connection-marker')
    const fakeTenantTx = { execute: marker } as any

    const observed = tenantContextStorage.run(fakeTenantTx, () => {
      // The exact pattern several existing withRLSContext() callers use:
      // `db.update(...)`/`db.select(...)` via the plain module import, not
      // a destructured `tx`. It must resolve to the active tenant tx.
      return db.execute
    })

    expect(observed).toBe(marker)
  })

  it('does not leak the tenant connection outside the run() scope', () => {
    const fakeTenantTx = { execute: Symbol('inside-tenant-scope') } as any

    tenantContextStorage.run(fakeTenantTx, () => {
      expect(db.execute).toBe(fakeTenantTx.execute)
    })

    const { threw, value } = readOutsideScope()
    if (!threw) {
      expect(value).not.toBe(fakeTenantTx.execute)
    }
  })

  it('supports nested/sequential tenant contexts without cross-contamination', () => {
    const txA = { execute: Symbol('tenant-a') } as any
    const txB = { execute: Symbol('tenant-b') } as any

    tenantContextStorage.run(txA, () => {
      expect(db.execute).toBe(txA.execute)
    })

    tenantContextStorage.run(txB, () => {
      expect(db.execute).toBe(txB.execute)
    })
  })

  it('isolates concurrent, interleaved async tenant contexts (Org A and Org B requests must never observe each other\'s transaction)', async () => {
    const txA = { execute: Symbol('concurrent-tenant-a'), tag: 'A' } as any
    const txB = { execute: Symbol('concurrent-tenant-b'), tag: 'B' } as any

    const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

    const runA = tenantContextStorage.run(txA, async () => {
      await delay(5)
      expect(db.execute).toBe(txA.execute)
      await delay(5)
      expect(db.execute).toBe(txA.execute)
      return txA.tag
    })

    const runB = tenantContextStorage.run(txB, async () => {
      await delay(1)
      expect(db.execute).toBe(txB.execute)
      await delay(10)
      expect(db.execute).toBe(txB.execute)
      return txB.tag
    })

    const [resultA, resultB] = await Promise.all([runA, runB])
    expect(resultA).toBe('A')
    expect(resultB).toBe('B')

    const { threw, value } = readOutsideScope()
    if (!threw) {
      expect(value).not.toBe(txA.execute)
      expect(value).not.toBe(txB.execute)
    }
  })

  it('gives the SYSTEM connection priority over an active tenant context (should the two ever be nested)', () => {
    const fakeTenantTx = { execute: Symbol('tenant') } as any
    const fakeSystemTx = { execute: Symbol('system') } as any

    tenantContextStorage.run(fakeTenantTx, () => {
      expect(db.execute).toBe(fakeTenantTx.execute)

      systemContextStorage.run(fakeSystemTx, () => {
        // withSystemContext() nested inside an outer tenant scope must
        // never silently execute as the tenant connection.
        expect(db.execute).toBe(fakeSystemTx.execute)
      })

      // Exiting the nested system scope restores the tenant connection.
      expect(db.execute).toBe(fakeTenantTx.execute)
    })
  })
})
